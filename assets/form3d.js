/**
 * Vyrn Form3D — lightweight procedural humanoid for exercise form demos.
 * Three.js from CDN. No external model files required.
 */
(function (global) {
  const CDN = 'https://unpkg.com/three@0.160.0/build/three.min.js';
  let THREE = null;
  let loading = null;

  function loadThree() {
    if (THREE) return Promise.resolve(THREE);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (global.THREE) {
        THREE = global.THREE;
        resolve(THREE);
        return;
      }
      const s = document.createElement('script');
      s.src = CDN;
      s.onload = () => {
        THREE = global.THREE;
        resolve(THREE);
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
    return loading;
  }

  function makeMat(color) {
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.05,
    });
  }

  function limb(w, h, d, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), makeMat(color));
    m.castShadow = true;
    return m;
  }

  function buildHumanoid(T) {
    const root = new T.Group();
    const skin = 0xc4a484;
    const dark = 0x1a1a1a;

    const torso = limb(0.42, 0.55, 0.22, dark);
    torso.position.y = 1.15;
    root.add(torso);

    const head = new T.Mesh(new T.SphereGeometry(0.16, 16, 16), makeMat(skin));
    head.position.y = 1.58;
    root.add(head);

    // Hips pivot
    const hips = new T.Group();
    hips.position.y = 0.88;
    root.add(hips);

    // Legs
    function leg(side) {
      const g = new T.Group();
      g.position.x = side * 0.12;
      const thigh = limb(0.14, 0.38, 0.14, dark);
      thigh.position.y = -0.19;
      g.add(thigh);
      const shin = limb(0.12, 0.36, 0.12, dark);
      shin.position.y = -0.55;
      g.add(shin);
      const foot = limb(0.12, 0.06, 0.22, 0x222222);
      foot.position.set(0, -0.76, 0.04);
      g.add(foot);
      g.userData = { thigh, shin, foot };
      hips.add(g);
      return g;
    }
    const leftLeg = leg(-1);
    const rightLeg = leg(1);

    // Shoulders + arms
    const shoulders = new T.Group();
    shoulders.position.y = 1.35;
    root.add(shoulders);

    function arm(side) {
      const g = new T.Group();
      g.position.x = side * 0.28;
      const upper = limb(0.11, 0.32, 0.11, dark);
      upper.position.y = -0.16;
      g.add(upper);
      const lower = limb(0.1, 0.3, 0.1, skin);
      lower.position.y = -0.46;
      g.add(lower);
      g.userData = { upper, lower };
      shoulders.add(g);
      return g;
    }
    const leftArm = arm(-1);
    const rightArm = arm(1);

    root.userData = { torso, head, hips, leftLeg, rightLeg, leftArm, rightArm, shoulders };
    return root;
  }

  // t in [0,1] loop
  function applyPose(parts, exercise, t) {
    const { torso, hips, leftLeg, rightLeg, leftArm, rightArm, shoulders, head } = parts;
    // reset
    [leftLeg, rightLeg, leftArm, rightArm].forEach((g) => {
      g.rotation.set(0, 0, 0);
      if (g.userData.thigh) g.userData.thigh.rotation.set(0, 0, 0);
      if (g.userData.shin) g.userData.shin.rotation.set(0, 0, 0);
      if (g.userData.upper) g.userData.upper.rotation.set(0, 0, 0);
      if (g.userData.lower) g.userData.lower.rotation.set(0, 0, 0);
    });
    torso.rotation.set(0, 0, 0);
    hips.rotation.set(0, 0, 0);
    hips.position.y = 0.88;
    shoulders.position.y = 1.35;
    head.position.y = 1.58;
    torso.position.y = 1.15;

    const s = Math.sin(t * Math.PI * 2);
    const wave = (s + 1) / 2; // 0..1

    if (exercise === 'squat') {
      const d = wave * 0.85;
      hips.position.y = 0.88 - d * 0.35;
      torso.position.y = 1.15 - d * 0.35;
      shoulders.position.y = 1.35 - d * 0.35;
      head.position.y = 1.58 - d * 0.35;
      leftLeg.userData.thigh.rotation.x = d * 1.2;
      rightLeg.userData.thigh.rotation.x = d * 1.2;
      leftLeg.userData.shin.rotation.x = -d * 1.1;
      rightLeg.userData.shin.rotation.x = -d * 1.1;
      leftArm.rotation.x = -0.4 - d * 0.3;
      rightArm.rotation.x = -0.4 - d * 0.3;
      torso.rotation.x = d * 0.15;
    } else if (exercise === 'pushup') {
      // horizontal body
      rootOrientPushup(parts, wave);
    } else if (exercise === 'plank') {
      rootOrientPlank(parts);
    } else if (exercise === 'lunge') {
      const d = wave * 0.9;
      leftLeg.userData.thigh.rotation.x = d * 1.1;
      leftLeg.userData.shin.rotation.x = -d * 1.0;
      rightLeg.userData.thigh.rotation.x = -d * 0.35;
      rightLeg.position.z = d * 0.15;
      leftLeg.position.z = -d * 0.25;
      hips.position.y = 0.88 - d * 0.12;
      torso.position.y = 1.15 - d * 0.12;
      shoulders.position.y = 1.35 - d * 0.12;
      head.position.y = 1.58 - d * 0.12;
      leftArm.rotation.x = -0.2;
      rightArm.rotation.x = -0.2;
    } else if (exercise === 'jump') {
      const up = Math.max(0, Math.sin(t * Math.PI * 2));
      hips.position.y = 0.88 + up * 0.4;
      torso.position.y = 1.15 + up * 0.4;
      shoulders.position.y = 1.35 + up * 0.4;
      head.position.y = 1.58 + up * 0.4;
      leftLeg.userData.thigh.rotation.x = (1 - up) * 0.8;
      rightLeg.userData.thigh.rotation.x = (1 - up) * 0.8;
      leftArm.rotation.x = -up * 1.2;
      rightArm.rotation.x = -up * 1.2;
    } else if (exercise === 'stretch') {
      leftArm.rotation.x = -Math.PI * 0.9;
      rightArm.rotation.x = -Math.PI * 0.9;
      leftArm.rotation.z = 0.15;
      rightArm.rotation.z = -0.15;
    } else {
      // idle / default slight breathe
      shoulders.position.y = 1.35 + s * 0.02;
      leftArm.rotation.x = -0.15;
      rightArm.rotation.x = -0.15;
    }
  }

  function rootOrientPushup(parts, wave) {
    const { torso, hips, leftLeg, rightLeg, leftArm, rightArm, shoulders, head } = parts;
    // Lay horizontal facing +Z-ish via rotating root externally - handled by pose angles
    const dip = wave * 0.35;
    torso.rotation.x = Math.PI / 2;
    hips.rotation.x = Math.PI / 2;
    shoulders.rotation.x = 0;
    torso.position.set(0, 0.55 - dip, 0);
    hips.position.set(0, 0.55 - dip, -0.35);
    shoulders.position.set(0, 0.55 - dip, 0.25);
    head.position.set(0, 0.55 - dip, 0.45);
    leftArm.position.set(-0.28, 0, 0);
    rightArm.position.set(0.28, 0, 0);
    leftArm.rotation.x = Math.PI / 2 + dip;
    rightArm.rotation.x = Math.PI / 2 + dip;
    leftLeg.userData.thigh.rotation.x = 0;
    rightLeg.userData.thigh.rotation.x = 0;
  }

  function rootOrientPlank(parts) {
    const { torso, hips, leftLeg, rightLeg, leftArm, rightArm, shoulders, head } = parts;
    torso.rotation.x = Math.PI / 2;
    hips.rotation.x = Math.PI / 2;
    torso.position.set(0, 0.5, 0);
    hips.position.set(0, 0.5, -0.35);
    shoulders.position.set(0, 0.5, 0.25);
    head.position.set(0, 0.5, 0.45);
    leftArm.rotation.x = Math.PI / 2;
    rightArm.rotation.x = Math.PI / 2;
  }

  function createViewer(container, exerciseKey) {
    let stopped = false;
    let raf = 0;
    let renderer, scene, camera, human, clock;

    const start = async () => {
      await loadThree();
      const w = container.clientWidth || 220;
      const h = container.clientHeight || 220;

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x0c0a0a);

      camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 50);
      camera.position.set(2.2, 1.4, 2.6);
      camera.lookAt(0, 1.0, 0);

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.borderRadius = '24px';
      container.innerHTML = '';
      container.appendChild(renderer.domElement);

      const amb = new THREE.AmbientLight(0xffffff, 0.55);
      scene.add(amb);
      const key = new THREE.DirectionalLight(0xff6b4a, 1.1);
      key.position.set(3, 5, 2);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x4466ff, 0.35);
      fill.position.set(-2, 2, -1);
      scene.add(fill);

      const ground = new THREE.Mesh(
        new THREE.CircleGeometry(1.2, 32),
        new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.9 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = 0;
      scene.add(ground);

      human = buildHumanoid(THREE);
      scene.add(human);

      clock = new THREE.Clock();
      const keyName = (exerciseKey || 'default').toLowerCase();

      function frame() {
        if (stopped) return;
        raf = requestAnimationFrame(frame);
        const t = clock.getElapsedTime() * 0.45; // loop speed
        applyPose(human.userData, keyName, t % 1);
        // slow orbit
        const a = clock.getElapsedTime() * 0.25;
        camera.position.x = Math.cos(a) * 2.8;
        camera.position.z = Math.sin(a) * 2.8;
        camera.position.y = 1.35;
        camera.lookAt(0, 0.95, 0);
        renderer.render(scene, camera);
      }
      frame();
    };

    start().catch(() => {
      container.innerHTML = '<div style="color:#737373;font-size:12px;padding:20px;text-align:center">3D form unavailable</div>';
    });

    return {
      destroy() {
        stopped = true;
        if (raf) cancelAnimationFrame(raf);
        if (renderer) {
          renderer.dispose();
          if (renderer.domElement && renderer.domElement.parentNode) {
            renderer.domElement.parentNode.removeChild(renderer.domElement);
          }
        }
      },
    };
  }

  global.VyrnForm3D = { createViewer, loadThree };
})(typeof window !== 'undefined' ? window : globalThis);
