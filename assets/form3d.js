/**
 * Vyrn Form3D — realistic Mixamo Soldier (GLB) via Three.js
 * Robust load + photo fallback if WebGL/modules fail.
 */
(function (global) {
  const MODEL_URL = '/assets/models/soldier.glb';
  // Prefer jsDelivr (often more reliable on mobile than unpkg)
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const LOADER_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';

  let mods = null;
  let modelCache = null;

  function loadModules() {
    if (mods) return Promise.resolve(mods);
    return Promise.all([
      import(/* webpackIgnore: true */ THREE_URL),
      import(/* webpackIgnore: true */ LOADER_URL),
    ]).then(([THREE, loaderMod]) => {
      mods = { THREE, GLTFLoader: loaderMod.GLTFLoader };
      return mods;
    });
  }

  function loadModel(THREE, GLTFLoader) {
    if (modelCache) return Promise.resolve(modelCache);
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      loader.load(
        MODEL_URL + '?v=1',
        (gltf) => {
          modelCache = { scene: gltf.scene, animations: gltf.animations || [] };
          resolve(modelCache);
        },
        undefined,
        (err) => reject(err || new Error('GLB load failed'))
      );
    });
  }

  function pickClip(animations, exercise) {
    const find = (...cands) =>
      animations.find((a) =>
        cands.some((c) => (a.name || '').toLowerCase().includes(c.toLowerCase()))
      );
    const ex = (exercise || '').toLowerCase();
    let clip;
    let timeScale = 1;
    if (/run|jog|sprint|jump|burpee|jack|climber/.test(ex)) {
      clip = find('run') || find('walk');
      timeScale = /jump|burpee/.test(ex) ? 1.3 : 1.1;
    } else if (/lunge|step|march|walk/.test(ex)) {
      clip = find('walk') || find('idle');
      timeScale = 0.9;
    } else {
      clip = find('idle') || animations[0];
      timeScale = 0.7;
    }
    return { clip: clip || animations[0], timeScale };
  }

  function showFallback(container, exerciseKey) {
    const key = (exerciseKey || 'default').replace(/[^a-z0-9]/gi, '') || 'default';
    const src = '/assets/exercises/' + key + '.jpg?v=23';
    container.innerHTML =
      '<div class="ex-motion" style="width:100%;height:100%;border:none;box-shadow:none;border-radius:0">' +
      '<img class="photo-stage motion-loop" src="' +
      src +
      '" alt="" style="width:100%;height:100%;border:none;border-radius:0;object-fit:cover" onerror="this.src=\'/assets/exercises/default.jpg?v=23\'" />' +
      '</div>';
  }

  function createViewer(container, exerciseKey) {
    let stopped = false;
    let raf = 0;
    let renderer = null;
    let mixer = null;

    // Show loading state briefly
    container.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#737373;font-size:12px">Loading form…</div>';

    const start = async () => {
      // Feature detect
      if (!global.WebGLRenderingContext) {
        throw new Error('No WebGL');
      }
      const { THREE, GLTFLoader } = await loadModules();
      const data = await loadModel(THREE, GLTFLoader);

      if (stopped) return;

      const w = container.clientWidth || 220;
      const h = container.clientHeight || 220;

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c0a0a);

      const camera = new THREE.PerspectiveCamera(32, w / h, 0.1, 40);
      camera.position.set(1.4, 1.15, 2.2);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(global.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      if (THREE.SRGBColorSpace) renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.borderRadius = '24px';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 0.7));
      const key = new THREE.DirectionalLight(0xff8a6a, 1.4);
      key.position.set(2.5, 4, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x6688ff, 0.45);
      fill.position.set(-2, 2, -1);
      scene.add(fill);
      const rim = new THREE.DirectionalLight(0xff3b2f, 0.4);
      rim.position.set(0, 2, -3);
      scene.add(rim);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(1.5, 40),
        new THREE.MeshStandardMaterial({ color: 0x141010, roughness: 1 })
      );
      ground.rotation.x = -Math.PI / 2;
      scene.add(ground);

      const model = data.scene.clone(true);
      model.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = false;
          o.frustumCulled = false;
        }
      });
      model.scale.setScalar(1.0);
      model.rotation.y = Math.PI;
      scene.add(model);

      mixer = new THREE.AnimationMixer(model);
      const { clip, timeScale } = pickClip(data.animations, exerciseKey);
      if (clip) {
        const action = mixer.clipAction(clip);
        action.reset().setEffectiveTimeScale(timeScale).play();
      }

      const box = new THREE.Box3().setFromObject(model);
      const center = box.getCenter(new THREE.Vector3());
      const lookY = Math.max(0.85, center.y * 0.85);
      const clock = new THREE.Clock();

      function frame() {
        if (stopped) return;
        raf = requestAnimationFrame(frame);
        const dt = clock.getDelta();
        if (mixer) mixer.update(dt);
        const t = clock.elapsedTime * 0.4;
        camera.position.x = Math.sin(t) * 2.0;
        camera.position.z = Math.cos(t) * 2.0;
        camera.position.y = lookY + 0.3;
        camera.lookAt(0, lookY, 0);
        renderer.render(scene, camera);
      }
      frame();
    };

    start().catch((err) => {
      console.warn('[VyrnForm3D]', err);
      if (!stopped) showFallback(container, exerciseKey);
    });

    return {
      destroy() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        try {
          if (mixer) mixer.stopAllAction();
        } catch (_) {}
        try {
          if (renderer) {
            renderer.dispose();
            if (renderer.domElement && renderer.domElement.parentNode) {
              renderer.domElement.parentNode.removeChild(renderer.domElement);
            }
          }
        } catch (_) {}
      },
    };
  }

  global.VyrnForm3D = { createViewer, MODEL_URL };
})(typeof window !== 'undefined' ? window : globalThis);
