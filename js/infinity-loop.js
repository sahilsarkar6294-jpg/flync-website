import * as THREE from 'three';

export function initInfinityLoop() {
  const container = document.getElementById('infinity-container');
  if (!container) return;

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      observer.disconnect();
      buildScene();
    }
  }, { rootMargin: '200px' });
  observer.observe(container);

  function buildScene() {
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    const scene = new THREE.Scene();
    const w = container.clientWidth;
    const h = container.clientHeight;
    const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Create infinity curve
    class InfinityCurve extends THREE.Curve {
      getPoint(t) {
        const angle = t * Math.PI * 2;
        const scale = 2;
        const x = scale * Math.cos(angle) / (1 + Math.sin(angle) * Math.sin(angle));
        const y = scale * Math.sin(angle) * Math.cos(angle) / (1 + Math.sin(angle) * Math.sin(angle));
        return new THREE.Vector3(x, y, Math.sin(angle * 2) * 0.3);
      }
    }

    const curve = new InfinityCurve();
    const tubeGeo = new THREE.TubeGeometry(curve, 200, 0.08, 12, true);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: 0x0066FF,
      emissive: 0x003399,
      emissiveIntensity: 0.5,
      metalness: 0.9,
      roughness: 0.1
    });
    const tube = new THREE.Mesh(tubeGeo, tubeMat);
    scene.add(tube);

    // Glowing wireframe overlay
    const wireGeo = new THREE.TubeGeometry(curve, 200, 0.12, 8, true);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x00D4AA, wireframe: true, transparent: true, opacity: 0.15 });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    scene.add(wire);

    // Add floating particles around the loop
    const pCount = 300;
    const pPositions = new Float32Array(pCount * 3);
    for (let i = 0; i < pCount; i++) {
      const pt = curve.getPoint(i / pCount);
      pPositions[i * 3] = pt.x + (Math.random() - 0.5) * 0.8;
      pPositions[i * 3 + 1] = pt.y + (Math.random() - 0.5) * 0.8;
      pPositions[i * 3 + 2] = pt.z + (Math.random() - 0.5) * 0.8;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    const pMat = new THREE.PointsMaterial({ color: 0x00D4AA, size: 0.03, transparent: true, opacity: 0.5 });
    const points = new THREE.Points(pGeo, pMat);
    scene.add(points);

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pl1 = new THREE.PointLight(0x0066FF, 3, 15);
    pl1.position.set(3, 2, 3);
    scene.add(pl1);
    const pl2 = new THREE.PointLight(0x00D4AA, 2, 15);
    pl2.position.set(-3, -1, 2);
    scene.add(pl2);

    camera.position.z = 5;

    let scrollY = 0;
    window.addEventListener('scroll', () => {
      scrollY = window.scrollY;
    });

    const clock = new THREE.Clock();
    function animate() {
      requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const scrollOffset = scrollY * 0.0015;
      
      tube.rotation.z = t * 0.15 + scrollOffset;
      wire.rotation.z = t * 0.15 + scrollOffset;
      points.rotation.z = t * 0.15 + scrollOffset;
      
      tube.rotation.y = Math.sin(t * 0.2) * 0.1 + scrollOffset * 0.5;
      wire.rotation.y = Math.sin(t * 0.2) * 0.1 + scrollOffset * 0.5;
      points.rotation.y = Math.sin(t * 0.2) * 0.1 + scrollOffset * 0.5;
      
      tube.rotation.x = Math.sin(t * 0.3) * 0.1;
      wire.rotation.x = Math.sin(t * 0.3) * 0.1;
      
      renderer.render(scene, camera);
    }
    animate();

    window.addEventListener('resize', () => {
      const nw = container.clientWidth;
      const nh = container.clientHeight;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    });
  }
}
