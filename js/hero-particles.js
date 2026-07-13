import * as THREE from 'three';

export function initHeroParticles() {
  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  // Create a dense grid of particles to cover the entire screen width
  const cols = 90;
  const rows = 46;
  const numParticles = cols * rows;
  const spacingX = 0.45;
  const spacingY = 0.45;
  
  const positions = new Float32Array(numParticles * 3);
  const homes = new Float32Array(numParticles * 3);
  const velocities = new Float32Array(numParticles * 3);
  const colors = new Float32Array(numParticles * 3);
  const homeColors = new Float32Array(numParticles * 3); // Backup of original gradient colors
  const gpuVelocities = new Float32Array(numParticles * 2); // 2D velocity for the shader

  const startX = -((cols - 1) * spacingX) / 2;
  const startY = -((rows - 1) * spacingY) / 2;

  // Blue and cyan/green brand colors
  const blueColor = new THREE.Color(0x0066ff);
  const greenColor = new THREE.Color(0x00D4AA);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const x = startX + c * spacingX;
      const y = startY + r * spacingY;
      const z = 0;

      positions[idx * 3] = x;
      positions[idx * 3 + 1] = y;
      positions[idx * 3 + 2] = z;

      homes[idx * 3] = x;
      homes[idx * 3 + 1] = y;
      homes[idx * 3 + 2] = z;

      velocities[idx * 3] = 0;
      velocities[idx * 3 + 1] = 0;
      velocities[idx * 3 + 2] = 0;

      gpuVelocities[idx * 2] = 0;
      gpuVelocities[idx * 2 + 1] = 0;

      // Color gradient from left (blue) to right (cyan/green)
      const mixFactor = c / (cols - 1);
      const lerpedColor = blueColor.clone().lerp(greenColor, mixFactor);
      
      colors[idx * 3] = lerpedColor.r;
      colors[idx * 3 + 1] = lerpedColor.g;
      colors[idx * 3 + 2] = lerpedColor.b;

      homeColors[idx * 3] = lerpedColor.r;
      homeColors[idx * 3 + 1] = lerpedColor.g;
      homeColors[idx * 3 + 2] = lerpedColor.b;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('velocity', new THREE.BufferAttribute(gpuVelocities, 2));

  // Custom ShaderMaterial to render crisp circles that stretch into fluid drops when moving
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSize: { value: 0.5 } // Scaled to exactly 1mm (approx 10-12px on screen)
    },
    vertexShader: `
      attribute vec3 color;
      attribute vec2 velocity;
      varying vec3 vColor;
      varying vec2 vVelocity;
      uniform float uSize;
      
      void main() {
        vColor = color;
        vVelocity = velocity;
        
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        
        // Stretch size of billboard helper based on velocity speed
        float speed = length(velocity);
        float sizeMultiplier = 1.0 + speed * 1.5;
        
        gl_PointSize = uSize * sizeMultiplier * (350.0 / -mvPosition.z);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying vec2 vVelocity;
      
      void main() {
        // Shift uv coords center to 0
        vec2 uv = gl_PointCoord - vec2(0.5);
        
        float speed = length(vVelocity);
        
        if (speed > 0.015) {
          // 1. Rotate the coordinate space along the movement direction
          float angle = atan(vVelocity.y, vVelocity.x);
          float cosA = cos(-angle);
          float sinA = sin(-angle);
          vec2 rotatedUv = vec2(
            uv.x * cosA - uv.y * sinA,
            uv.x * sinA + uv.y * cosA
          );
          
          // 2. Stretch coordinate grid to elongate the circle (looks like fluid droplet)
          rotatedUv.x /= (1.0 + speed * 6.5);
          
          // Crisp circle edge in stretched coordinates (gives sharp anti-aliasing)
          float dist = length(rotatedUv);
          float alpha = smoothstep(0.48, 0.44, dist);
          if (alpha == 0.0) discard;
          gl_FragColor = vec4(vColor, alpha * 0.95);
        } else {
          // Perfectly crisp, solid circular particle with anti-aliasing (no blur)
          float dist = length(uv);
          float alpha = smoothstep(0.48, 0.44, dist);
          if (alpha == 0.0) discard;
          gl_FragColor = vec4(vColor, alpha * 0.95);
        }
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  const particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Position camera
  camera.position.z = 15;

  // Track mouse in 3D coordinates
  const mouse = new THREE.Vector2(-999, -999);
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  document.addEventListener('mousemove', (e) => {
    // Standard NDC coordinates
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  });

  document.addEventListener('mouseleave', () => {
    mouse.set(-999, -999);
  });

  // Scroll parallax
  let scrollY = 0;
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  });

  // Animation Loop (Spring Physics, Fluid wave drift, & Dynamic Stretched Warp)
  const springStrength = 0.05;
  const damping = 0.83;
  const mouseInfluenceRadius = 4.0;
  const mouseForce = 1.4;
  const purpleColor = new THREE.Color(0x9d4edd); // Modern neon purple

  const clock = new THREE.Clock();
  let wavePhase = 0;

  function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);
    
    // Speed up fluid wave ripples when scrolling
    const waveSpeed = 1.2 + scrollY * 0.006;
    wavePhase += dt * waveSpeed;

    // Find the 3D mouse intersection point on our particle plane
    raycaster.setFromCamera(mouse, camera);
    const mouseIntersection = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, mouseIntersection);

    const posAttr = geometry.attributes.position;
    const posArray = posAttr.array;

    const colorAttr = geometry.attributes.color;
    const colorArray = colorAttr.array;

    const velAttr = geometry.attributes.velocity;
    const velArray = velAttr.array;

    for (let i = 0; i < numParticles; i++) {
      const i3 = i * 3;
      const i2 = i * 2;
      
      const currentX = posArray[i3];
      const currentY = posArray[i3 + 1];
      const currentZ = posArray[i3 + 2];

      const homeX = homes[i3];
      const homeY = homes[i3 + 1];
      const homeZ = homes[i3 + 2];

      const homeR = homeColors[i3];
      const homeG = homeColors[i3 + 1];
      const homeB = homeColors[i3 + 2];

      // Organic fluid flow wave coordinate drift (ripples speed up during scrolling)
      const waveX = Math.sin(wavePhase + homeX * 0.4 + homeY * 0.3) * 0.15;
      const waveY = Math.cos(wavePhase * 0.83 + homeX * 0.3 + homeY * 0.4) * 0.15;

      const flowHomeX = homeX + waveX;
      const flowHomeY = homeY + waveY;

      // 1. Spring force back to flow home position
      const forceX = (flowHomeX - currentX) * springStrength;
      const forceY = (flowHomeY - currentY) * springStrength;
      const forceZ = (homeZ - currentZ) * springStrength;

      velocities[i3] += forceX;
      velocities[i3 + 1] += forceY;
      velocities[i3 + 2] += forceZ;

      // 2. Mouse influence (repulsion & color shift)
      let targetR = homeR;
      let targetG = homeG;
      let targetB = homeB;

      if (mouse.x > -900) {
        const dx = currentX - mouseIntersection.x;
        const dy = currentY - mouseIntersection.y;
        const dz = currentZ - mouseIntersection.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

        if (dist < mouseInfluenceRadius) {
          // Repulsion force
          const forceFactor = (1.0 - dist / mouseInfluenceRadius) * mouseForce;
          const angle = Math.atan2(dy, dx);
          
          velocities[i3] += Math.cos(angle) * forceFactor * 0.12;
          velocities[i3 + 1] += Math.sin(angle) * forceFactor * 0.12;
          velocities[i3 + 2] += (mouseInfluenceRadius - dist) * 0.12; // Pull forward

          // Shift color to purple based on proximity
          const colorFactor = (1.0 - dist / mouseInfluenceRadius);
          targetR = homeR + (purpleColor.r - homeR) * colorFactor;
          targetG = homeG + (purpleColor.g - homeG) * colorFactor;
          targetB = homeB + (purpleColor.b - homeB) * colorFactor;
        }
      }

      // 3. Apply color blending (smoothly transition back to original colors)
      colorArray[i3] += (targetR - colorArray[i3]) * 0.1;
      colorArray[i3 + 1] += (targetG - colorArray[i3 + 1]) * 0.1;
      colorArray[i3 + 2] += (targetB - colorArray[i3 + 2]) * 0.1;

      // 4. Apply damping & update position
      velocities[i3] *= damping;
      velocities[i3 + 1] *= damping;
      velocities[i3 + 2] *= damping;

      posArray[i3] += velocities[i3];
      posArray[i3 + 1] += velocities[i3 + 1];
      posArray[i3 + 2] += velocities[i3 + 2];

      // Update shader velocity attribute (X and Y only)
      velArray[i2] = velocities[i3];
      velArray[i2 + 1] = velocities[i3 + 1];
    }

    // Tell Three.js positions, colors, and velocities changed
    posAttr.needsUpdate = true;
    colorAttr.needsUpdate = true;
    velAttr.needsUpdate = true;

    // Keep grid fixed in position so it covers the entire graphic area without cut-off
    particleSystem.rotation.x = 0;
    particleSystem.rotation.y = 0;
    particleSystem.position.z = 0;

    renderer.render(scene, camera);
  }
  animate();

  // Resize handler
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}
