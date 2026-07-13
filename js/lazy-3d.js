import * as THREE from 'three';

export function initLazy3D() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const el = entry.target;
        if (el.dataset.scene && !el.dataset.loaded) {
          el.dataset.loaded = 'true';
          createMiniScene(el, el.dataset.scene);
        }
        el.classList.add('visible');
      }
    });
  }, { rootMargin: '100px', threshold: 0.1 });

  document.querySelectorAll('.animate-in, [data-scene]').forEach(el => observer.observe(el));
}

function createMiniScene(container, sceneType) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.borderRadius = '12px';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const w = container.clientWidth;
  const h = container.clientHeight;
  const camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  let mesh;

  switch (sceneType) {
    case 'gear': {
      // Create a gear shape using ExtrudeGeometry
      const shape = new THREE.Shape();
      const teeth = 12, innerR = 1.1, toothH = 0.3;
      for (let i = 0; i < teeth; i++) {
        const a1 = (i / teeth) * Math.PI * 2;
        const a2 = ((i + 0.3) / teeth) * Math.PI * 2;
        const a3 = ((i + 0.5) / teeth) * Math.PI * 2;
        const a4 = ((i + 0.8) / teeth) * Math.PI * 2;
        if (i === 0) shape.moveTo(Math.cos(a1) * innerR, Math.sin(a1) * innerR);
        shape.lineTo(Math.cos(a2) * innerR, Math.sin(a2) * innerR);
        shape.lineTo(Math.cos(a2) * (innerR + toothH), Math.sin(a2) * (innerR + toothH));
        shape.lineTo(Math.cos(a3) * (innerR + toothH), Math.sin(a3) * (innerR + toothH));
        shape.lineTo(Math.cos(a4) * innerR, Math.sin(a4) * innerR);
      }
      const extrudeSettings = { depth: 0.4, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05 };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const mat = new THREE.MeshStandardMaterial({ color: 0x0066FF, metalness: 0.8, roughness: 0.2, wireframe: true });
      mesh = new THREE.Mesh(geo, mat);
      break;
    }
    case 'chip': {
      // RFID chip
      const group = new THREE.Group();
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(2, 0.1, 1.4),
        new THREE.MeshStandardMaterial({ color: 0x0066FF, metalness: 0.6, roughness: 0.3, wireframe: true })
      );
      group.add(board);
      const chipCore = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.15, 0.6),
        new THREE.MeshStandardMaterial({ color: 0x00D4AA, metalness: 0.9, roughness: 0.1, wireframe: true })
      );
      chipCore.position.y = 0.12;
      group.add(chipCore);
      // Add traces
      for (let i = 0; i < 6; i++) {
        const trace = new THREE.Mesh(
          new THREE.BoxGeometry(0.04, 0.02, 0.5),
          new THREE.MeshStandardMaterial({ color: 0x00D4AA, wireframe: true })
        );
        trace.position.set(-0.5 + i * 0.2, 0.06, 0.6);
        group.add(trace);
      }
      mesh = group;
      break;
    }
    case 'wave': {
      // Predictive maintenance wave
      const planeGeo = new THREE.PlaneGeometry(4, 3, 60, 40);
      const planeMat = new THREE.MeshStandardMaterial({ color: 0x0066FF, wireframe: true, transparent: true, opacity: 0.6 });
      mesh = new THREE.Mesh(planeGeo, planeMat);
      mesh.rotation.x = -0.6;
      mesh.userData.isWave = true;
      break;
    }
    case 'bot': {
      // AI chatbot sphere
      const sphereGeo = new THREE.IcosahedronGeometry(1.2, 2);
      const sphereMat = new THREE.MeshStandardMaterial({ color: 0x00D4AA, wireframe: true, transparent: true, opacity: 0.7 });
      mesh = new THREE.Mesh(sphereGeo, sphereMat);
      // Add inner sphere
      const inner = new THREE.Mesh(
        new THREE.IcosahedronGeometry(0.6, 1),
        new THREE.MeshStandardMaterial({ color: 0x0066FF, wireframe: true })
      );
      mesh.add(inner);
      mesh.userData.innerMesh = inner;
      break;
    }
    case 'headset': {
      // XR headset wireframe
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(2, 1, 1.2, 4, 4, 4),
        new THREE.MeshStandardMaterial({ color: 0x8B5CF6, wireframe: true })
      );
      group.add(body);
      const lensL = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x00D4AA, wireframe: true })
      );
      lensL.position.set(-0.4, 0, 0.61);
      group.add(lensL);
      const lensR = new THREE.Mesh(
        new THREE.RingGeometry(0.15, 0.3, 16),
        new THREE.MeshStandardMaterial({ color: 0x00D4AA, wireframe: true })
      );
      lensR.position.set(0.4, 0, 0.61);
      group.add(lensR);
      mesh = group;
      break;
    }
    default: {
      mesh = new THREE.Mesh(
        new THREE.TorusKnotGeometry(1, 0.3, 100, 16),
        new THREE.MeshStandardMaterial({ color: 0x0066FF, wireframe: true })
      );
    }
  }

  scene.add(mesh);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const pointLight = new THREE.PointLight(0x0066FF, 2, 20);
  pointLight.position.set(3, 3, 3);
  scene.add(pointLight);
  const pointLight2 = new THREE.PointLight(0x00D4AA, 1.5, 20);
  pointLight2.position.set(-3, -2, 2);
  scene.add(pointLight2);

  camera.position.z = 4;

  let scrollY = 0;
  window.addEventListener('scroll', () => {
    scrollY = window.scrollY;
  });

  const clock = new THREE.Clock();
  let animId;

  function animate() {
    animId = requestAnimationFrame(animate);
    const t = clock.getElapsedTime();
    const scrollFactor = scrollY * 0.001;
    
    if (mesh.userData.isWave) {
      const pos = mesh.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, Math.sin(x * 2 + scrollFactor * 5.0) * 0.2 + Math.cos(y * 2 + scrollFactor * 3.0) * 0.15);
      }
      pos.needsUpdate = true;
    }
    if (mesh.userData.innerMesh) {
      mesh.userData.innerMesh.rotation.x = scrollY * 0.006;
      mesh.userData.innerMesh.rotation.z = scrollY * 0.003;
    }
    mesh.rotation.y = scrollY * 0.0035;
    mesh.rotation.x = scrollY * 0.0015;
    renderer.render(scene, camera);
  }
  animate();

  // Pause when not visible
  const visObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) cancelAnimationFrame(animId);
      else animate();
    });
  });
  visObserver.observe(container);
}
