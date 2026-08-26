/**
 * Vyrn Form3D — realistic Mixamo-style skinned character (GLB)
 * Uses Three.js r160 + GLTFLoader. Character: Soldier (Mixamo via three.js examples).
 */
(function (global) {
  const THREE_URL = 'https://unpkg.com/three@0.160.0/build/three.module.js';
  const LOADER_URL = 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
  // Prefer local Soldier (Idle / Walk / Run)
  const MODEL_URL = '/assets/models/soldier.glb';

  let mods = null; // { THREE, GLTFLoader }
  let loadPromise = null;
  let modelCache = null; // { scene, animations }

  function loadModules() {
    if (mods) return Promise.resolve(mods);
    if (loadPromise) return loadPromise;
    loadPromise = (async () => {
      const THREE = await import(THREE_URL);
      const { GLTFLoader } = await import(LOADER_URL);
      mods = { THREE, GLTFLoader };
      return mods;
    })();
    return loadPromise;
  }

  function loadModel(THREE, GLTFLoader) {
    if (modelCache) return Promise.resolve(modelCache);
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL,
        (gltf) => {
          modelCache = { scene: gltf.scene, animations: gltf.animations || [] };
          resolve(modelCache);
        },
        undefined,
        reject
      );
    });
  }

  // Map exercise keys → best available clip + playback tweaks
  function pickClip(animations, exercise) {
    const names = animations.map((a) => a.name);
    const find = (...cands) =>
      animations.find((a) => cands.some((c) => a.name.toLowerCase().includes(c.toLowerCase())));

    const ex = (exercise || 'default').toLowerCase();
    let clip = null;
    let timeScale = 1;

    if (/run|jog|sprint|march|cardio/.test(ex)) {
      clip = find('run', 'Run') || find('walk', 'Walk');
      timeScale = 1.1;
    } else if (/jump|burpee|jack|climber/.test(ex)) {
      clip = find('run', 'Run') || find('walk', 'Walk');
      timeScale = 1.35;
    } else if (/lunge|step/.test(ex)) {
      clip = find('walk', 'Walk') || find('idle', 'Idle');
      timeScale = 0.85;
    } else if (/squat|push|plank|core|stretch|office|yoga|strength|home|park/.test(ex)) {
      // True form clips need Mixamo exports — idle is realistic hold / stance until then
      clip = find('idle', 'Idle') || animations[0];
      timeScale = 0.6;
    } else {
      clip = find('idle', 'Idle') || animations[0];
      timeScale = 0.8;
    }

    if (!clip && animations.length) clip = animations[0];
    return { clip, timeScale };
  }

  function createViewer(container, exerciseKey) {
    let stopped = false;
    let raf = 0;
    let renderer, scene, camera, mixer, clock, model;

    const start = async () => {
      const { THREE, GLTFLoader } = await loadModules();
      const w = container.clientWidth || 220;
      const h = container.clientHeight || 220;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c0a0a);
      scene.fog = new THREE.Fog(0x0c0a0a, 6, 14);

      camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
      camera.position.set(1.6, 1.2, 2.4);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.borderRadius = '24px';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const amb = new THREE.AmbientLight(0xffffff, 0.65);
      scene.add(amb);
      const key = new THREE.DirectionalLight(0xff8a6a, 1.35);
      key.position.set(2.5, 4, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x6688ff, 0.4);
      fill.position.set(-2, 2, -1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xff3b2f, 0.35);
      rim.position.set(0, 2, -3);
      scene.add(rim);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(1.4, 48),
        new THREE.MeshStandardMaterial({ color: 0x161010, roughness: 0.95, metalness: 0 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      const data = await loadModel(THREE, GLTFLoader);
      model = data.scene.clone(true);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = true;
          o.receiveShadow = true;
          if (o.material) {
            o.material = o.material.clone();
            o.material.roughness = 0.55;
            o.material.metalness = 0.1;
          }
        }
      });
      // Fit character in frame
      model.scale.setScalar(1.05);
      model.position.set(0, 0, 0);
      model.rotation.y = Math.PI;
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      const { clip, timeScale } = pickClip(data.animations, exerciseKey);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset();
        action.setEffectiveTimeScale(timeScale);
        action.setEffectiveWeight(1);
        action.play();
      }

      clock = new THREE.Clock();
      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const lookY = Math.max(0.9, center.y * 0.9);

      function frame() {
        if (stopped) return;
        raf = requestAnimationFrame(frame);
        const dt = clock.getDelta();
        if (mixer) mixer.update(dt);
        const t = clock.elapsedTime * 0.35;
        camera.position.x = Math.sin(t) * 2.2;
        camera.position.z = Math.cos(t) * 2.2;
        camera.position.y = lookY + 0.35;
        camera.lookAt(0, lookY, 0);
        renderer.render(scene, camera);
      }
      frame();
    };

    start().catch((err) => {
      console.warn('Form3D failed', err);
      container.innerHTML =
        '<div style="color:#a3a3a3;font-size:12px;padding:16px;text-align:center;line-height:1.4">Loading 3D form…<br><span style="color:#737373">Check connection</span></div>';
    });

    return {
      destroy() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (mixer) mixer.stopAllAction();
        if (renderer) {
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        }
      },
    };
  }

  global.VyrnForm3D = {
    createViewer,
    loadModules,
    /** Call after user drops Mixamo exercise GLBs into /assets/models/exercises/ */
    MODEL_URL,
  };
})(typeof window !== 'undefined' ? window : globalThis);
