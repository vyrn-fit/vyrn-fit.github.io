// Vyrn — Solo-first PWA with auth, voice, SFX, motion
const SUPABASE_URL = 'https://qgbpghtgcgzghpzoehrl.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_QkkE85SWWUNpSmvAK6R8kg_oB2bHJvQ';

let supabaseClient = null;
let currentUser = null;
let currentScreen = 'welcome';
let activeWorkout = null;
let exerciseIndex = 0;
let phase = 'ready';
let phaseSeconds = 0;
let totalSeconds = 0;
let tickTimer = null;
let isPro = false;
let voiceEnabled = true;
let sfxEnabled = true;
let musicHintDismissed = false;
let audioCtx = null;
let trainerGender = 'female';
let _voicesReady = false;
let _lastCoachFive = false;
let socialCache = { challenges: [], mine: [], activity: [], board: [], activeChallenge: null, loading: false };
let pendingJoinCode = null;
let authProviders = { google: false, apple: false, email: true };

const store = {
  get(key) {
    try { return JSON.parse(localStorage.getItem('vyrn_' + key)); } catch { return null; }
  },
  set(key, val) {
    localStorage.setItem('vyrn_' + key, JSON.stringify(val));
  }
};

// Exercise photos (free stock — Unsplash / Pexels)
function photoKey(name) {
  const n = (name || '').toLowerCase();
  // Specific exercises first (avoid office catch-all for chair/wall)
  if (/wall sit/.test(n)) return 'office';
  if (/sit-?to-?stand|chair stand|desk chair|bench sit/.test(n)) return 'squat';
  if (/wall push|push|dip|pike|diamond|incline/.test(n)) return 'pushup';
  if (/squat|sumo|pulse|air squat/.test(n)) return 'squat';
  if (/plank|hollow|dead bug|bird|shoulder tap/.test(n)) return 'plank';
  if (/lunge|step-up|step up/.test(n)) return 'lunge';
  if (/jog|run|march|high knee|walk|sprint|perimeter/.test(n)) return 'run';
  if (/calf/.test(n)) return 'strength';
  if (/bridge|superman|tabletop|glute/.test(n)) return 'core';
  if (/jump|burpee|jack|climber|broad/.test(n)) return 'jump';
  if (/chin tuck|neck|shoulder roll|shoulder blade|scap|thoracic|seated cat|chest opener|arm circle|hip circle|ankle|side bend/.test(n)) return 'stretch';
  if (/seated torso|russian/.test(n)) return 'core';
  if (/hang|bench step|park/.test(n)) return 'park';
  if (/open|roll|fold|circle|breath|hamstring|hip flexor|cool|toe reach|stretch/.test(n)) return 'stretch';
  // Workout titles
  if (/office|desk|posture|afternoon energy/.test(n)) return 'office';
  if (/playground|park power/.test(n)) return 'park';
  if (/full body|morning|wake|hotel|travel|micro/.test(n)) return 'home';
  if (/core focus|\bcore\b/.test(n)) return 'core';
  if (/mobility|yoga/.test(n)) return 'stretch';
  if (/hiit|express|legs|upper|strength/.test(n)) return 'strength';
  return 'default';
}


// Effective form guides — max 3 short steps (fitness-app pattern)
const FORM_GUIDE = {
  squat: {
    focus: 'Sit hips back · chest up',
    steps: ['Feet shoulder-width, toes slightly out', 'Sit hips back until thighs ~parallel', 'Drive through heels; stand tall'],
    avoid: 'Knees caving in'
  },
  pushup: {
    focus: 'Body in one straight line',
    steps: ['Hands under shoulders, core tight', 'Lower chest toward floor', 'Press up without hips sagging'],
    avoid: 'Hips piked or sagging'
  },
  plank: {
    focus: 'Hips level · brace core',
    steps: ['Elbows under shoulders', 'Squeeze glutes, ribs down', 'Breathe steady; hold the line'],
    avoid: 'Hips too high or low'
  },
  lunge: {
    focus: 'Front knee over ankle',
    steps: ['Step back into a long stance', 'Drop back knee toward floor', 'Push through front heel to stand'],
    avoid: 'Front knee past toes'
  },
  run: {
    focus: 'Light feet · upright torso',
    steps: ['Soft knees, quick cadence', 'Arms swing opposite legs', 'Stay tall; land quietly'],
    avoid: 'Heavy heel striking'
  },
  jump: {
    focus: 'Soft landing',
    steps: ['Bend knees, arms ready', 'Explode up; full extension', 'Land quietly with bent knees'],
    avoid: 'Locking knees on landing'
  },
  stretch: {
    focus: 'Slow · no bouncing',
    steps: ['Ease into the range', 'Breathe out into the stretch', 'Hold without forcing'],
    avoid: 'Bouncing or pain'
  },
  core: {
    focus: 'Controlled core',
    steps: ['Lower back pressed down', 'Move slow and deliberate', 'Exhale on effort'],
    avoid: 'Yank with momentum'
  },
  office: {
    focus: 'Back flat to wall',
    steps: ['Feet forward, back against wall', 'Slide down to ~90° if able', 'Hold; knees track over toes'],
    avoid: 'Knees past toes'
  },
  sitstand: {
    focus: 'Stand tall · sit with control',
    steps: ['Feet flat, sit near the edge of the chair', 'Drive through heels to stand fully', 'Sit back down with control — no plop'],
    avoid: 'Using momentum or only the toes'
  },
  park: {
    focus: 'Control the step',
    steps: ['Whole foot on the step', 'Drive through heel to stand', 'Step down with control'],
    avoid: 'Pushing off toes only'
  },
  home: {
    focus: 'Quality over speed',
    steps: ['Full range you can control', 'Steady tempo', 'Stop if form breaks'],
    avoid: 'Rushing reps'
  },
  strength: {
    focus: 'Straight body line',
    steps: ['Hands under shoulders', 'Lower with control', 'Full lockout at top'],
    avoid: 'Partial range'
  },
  burpee: {
    focus: 'Smooth sequence',
    steps: ['Hands down, jump feet back', 'Chest toward floor', 'Jump feet in, stand or jump'],
    avoid: 'Collapsing in the middle'
  },
  yoga: {
    focus: 'Breathe with the move',
    steps: ['Stack joints carefully', 'Move with the breath', 'Never force end range'],
    avoid: 'Holding breath'
  },
  gym: {
    focus: 'Brace · full control',
    steps: ['Set core before the rep', 'Own the full range', 'Stop one rep before form fails'],
    avoid: 'Ego range'
  },
  default: {
    focus: 'Control the tempo',
    steps: ['Set your start position', 'Move through full range', 'Finish each rep clean'],
    avoid: 'Broken form'
  }
};

function formGuideFor(name) {
  const n = (name || '').toLowerCase();
  if (/sit-?to-?stand|chair stand|desk chair|bench sit/.test(n)) return FORM_GUIDE.sitstand || FORM_GUIDE.squat;
  if (/wall sit/.test(n)) return FORM_GUIDE.office;
  return FORM_GUIDE[photoKey(name)] || FORM_GUIDE.default;
}
function formTipFor(name) {
  return formGuideFor(name).focus;
}
function formStepsHtml(name) {
  const g = formGuideFor(name);
  const steps = (g.steps || []).map((s, i) =>
    `<li><span class="fs-num">${i + 1}</span><span class="fs-text">${s}</span></li>`
  ).join('');
  return `<div class="form-guide">
    <p class="form-focus">${g.focus}</p>
    <ol class="form-steps">${steps}</ol>
    ${g.avoid ? `<p class="form-avoid">Avoid: ${g.avoid}</p>` : ''}
  </div>`;
}

// Workout Guide (CC BY-SA 4.0) — polished 3-frame form demos
const WG_CDN = 'https://cdn.jsdelivr.net/npm/@bryllim/workout-guide@1.0.0/assets';

const EXERCISE_GUIDE = {
  "Air Squats": { type: "cdn", key: "bodyweight-squat" },
  "Ankle rocks": { type: "cdn", key: "toe-touch" },
  "Arm circles": { type: "cdn", key: "arm-circles" },
  "Bench dips": { type: "cdn", key: "chair-dip" },
  "Bench sit-to-stand": { type: "cdn", key: "bodyweight-squat" },
  "Bench step-ups": { type: "cdn", key: "step-up" },
  "Bird dog": { type: "cdn", key: "bird-dog" },
  "Bodyweight squats": { type: "cdn", key: "bodyweight-squat" },
  "Broad jumps (or long steps)": { type: "cdn", key: "jump-squat" },
  "Burpees": { type: "cdn", key: "burpee" },
  "Calf raises": { type: "cdn", key: "bodyweight-squat" },
  "Calf raises on curb": { type: "cdn", key: "bodyweight-squat" },
  "Chin tucks": { type: "cdn", key: "arm-circles" },
  "Cool-down stretch": { type: "cdn", key: "worlds-greatest-stretch" },
  "Cool-down walk": { type: "cdn", key: "high-knees" },
  "Cool-down walk in place": { type: "cdn", key: "high-knees" },
  "Dead bugs": { type: "cdn", key: "dead-bug" },
  "Dead hangs or scap pulls": { type: "cdn", key: "reverse-snow-angel" },
  "Deep squat hold": { type: "cdn", key: "bodyweight-squat" },
  "Desk chair sit-to-stand": { type: "cdn", key: "bodyweight-squat" },
  "Diamond or narrow push-ups": { type: "cdn", key: "diamond-push-up" },
  "Easy breathing stretch": { type: "cdn", key: "worlds-greatest-stretch" },
  "Easy jog / walk lap": { type: "cdn", key: "high-knees" },
  "Easy jog warm-up": { type: "cdn", key: "high-knees" },
  "Easy stretch flow": { type: "cdn", key: "worlds-greatest-stretch" },
  "Easy stretch on grass": { type: "cdn", key: "worlds-greatest-stretch" },
  "Gentle side lunges": { type: "cdn", key: "lateral-lunge" },
  "Glute bridge march": { type: "cdn", key: "glute-bridge-march" },
  "Glute bridges": { type: "cdn", key: "glute-bridge" },
  "Hamstring fold": { type: "cdn", key: "toe-touch" },
  "High knees": { type: "cdn", key: "high-knees" },
  "High knees (or marches)": { type: "cdn", key: "high-knees" },
  "Hip circles": { type: "cdn", key: "arm-circles" },
  "Hip flexor stretch L": { type: "cdn", key: "kneeling-hip-flexor-stretch" },
  "Hip flexor stretch R": { type: "cdn", key: "kneeling-hip-flexor-stretch" },
  "Hollow hold (or tuck)": { type: "cdn", key: "hollow-body-hold" },
  "Incline or knee push-ups": { type: "cdn", key: "knee-push-up" },
  "Incline push-ups": { type: "cdn", key: "knee-push-up" },
  "Incline push-ups (bench)": { type: "cdn", key: "knee-push-up" },
  "Incline push-ups (desk/bed)": { type: "cdn", key: "knee-push-up" },
  "Jump squats (or squats)": { type: "cdn", key: "jump-squat" },
  "Jumping jacks": { type: "cdn", key: "jumping-jack" },
  "Jumping jacks (or step-jacks)": { type: "cdn", key: "jumping-jack" },
  "Lunges": { type: "cdn", key: "reverse-lunge" },
  "March in place": { type: "cdn", key: "high-knees" },
  "March or jog in place": { type: "cdn", key: "high-knees" },
  "Mountain Climbers": { type: "cdn", key: "mountain-climber" },
  "Mountain climbers": { type: "cdn", key: "mountain-climber" },
  "Neck & shoulder rolls": { type: "cdn", key: "arm-circles" },
  "Park-bench step-ups": { type: "cdn", key: "step-up" },
  "Pike push-ups (or wall)": { type: "cdn", key: "pike-push-up" },
  "Plank": { type: "cdn", key: "plank" },
  "Plank on grass": { type: "cdn", key: "plank" },
  "Plank shoulder taps": { type: "cdn", key: "plank-shoulder-tap" },
  "Push-ups": { type: "cdn", key: "push-up" },
  "Push-ups (knee OK)": { type: "cdn", key: "knee-push-up" },
  "Push-ups or wall push-ups": { type: "cdn", key: "wall-push-up" },
  "Reverse lunges": { type: "cdn", key: "reverse-lunge" },
  "Reverse tabletop holds": { type: "cdn", key: "glute-bridge" },
  "Seated cat-cow": { type: "cdn", key: "cat-cow-stretch" },
  "Seated thoracic openers": { type: "cdn", key: "torso-twist-stretch" },
  "Seated torso twists": { type: "cdn", key: "russian-twist" },
  "Shoulder CARs slow": { type: "cdn", key: "arm-circles" },
  "Shoulder blade squeezes": { type: "cdn", key: "reverse-snow-angel" },
  "Shoulder taps in plank": { type: "cdn", key: "plank-shoulder-tap" },
  "Side plank (left)": { type: "cdn", key: "side-plank" },
  "Side plank (right)": { type: "cdn", key: "side-plank" },
  "Single-leg glute bridge L": { type: "cdn", key: "glute-bridge" },
  "Single-leg glute bridge R": { type: "cdn", key: "glute-bridge" },
  "Slow mountain climbers": { type: "cdn", key: "mountain-climber" },
  "Slow neck rolls": { type: "cdn", key: "arm-circles" },
  "Sprint or fast walk intervals": { type: "cdn", key: "high-knees" },
  "Squat jumps (or squats)": { type: "cdn", key: "jump-squat" },
  "Squat pulses": { type: "cdn", key: "bodyweight-squat" },
  "Squats": { type: "cdn", key: "bodyweight-squat" },
  "Standing chest opener": { type: "cdn", key: "torso-twist-stretch" },
  "Standing hip circles": { type: "cdn", key: "arm-circles" },
  "Standing marches": { type: "cdn", key: "high-knees" },
  "Standing side bends": { type: "cdn", key: "torso-twist-stretch" },
  "Standing toe reaches": { type: "cdn", key: "toe-touch" },
  "Stretch & breathe": { type: "cdn", key: "worlds-greatest-stretch" },
  "Sumo squats": { type: "cdn", key: "bodyweight-squat" },
  "Superman holds": { type: "cdn", key: "superman" },
  "Thoracic rotations": { type: "cdn", key: "torso-twist-stretch" },
  "Walk the perimeter": { type: "cdn", key: "high-knees" },
  "Walking Lunges": { type: "cdn", key: "walking-lunge" },
  "Walking lunges": { type: "cdn", key: "walking-lunge" },
  "Wall push-ups": { type: "cdn", key: "wall-push-up" },
  "Wall push-ups finisher": { type: "cdn", key: "wall-push-up" },
  "Wall sit": { type: "cdn", key: "wall-sit" },
  "World greatest stretch flow": { type: "cdn", key: "worlds-greatest-stretch" },
};

const WG_MAP = {
  squat: 'bodyweight-squat',
  pushup: 'push-up',
  plank: 'plank',
  lunge: 'walking-lunge',
  run: 'running',
  jump: 'jumping-jack',
  stretch: 'worlds-greatest-stretch',
  core: 'plank',
  office: 'wall-sit',
  park: 'step-up',
  home: 'bodyweight-squat',
  default: 'push-up',
  strength: 'push-up',
  burpee: 'burpee',
  yoga: 'cat-cow-stretch',
  gym: 'push-up'
};
// Prefer pure bodyweight squat if available

// —— Bodyweight-only form demos ——
// Prefer custom SVG when CDN art shows machines/bands/dumbbells/treadmills.

const WG_SAFE = new Set([
  'bodyweight-squat','push-up','knee-push-up','wall-push-up','diamond-push-up','pike-push-up',
  'plank','side-plank','plank-shoulder-tap','mountain-climber','burpee','jumping-jack','jump-squat',
  'reverse-lunge','walking-lunge','lateral-lunge','step-up','glute-bridge','glute-bridge-march',
  'bird-dog','dead-bug','superman','hollow-body-hold','russian-twist','high-knees',
  'cat-cow-stretch','worlds-greatest-stretch','toe-touch','kneeling-hip-flexor-stretch',
  'torso-twist-stretch','wall-sit','chair-dip','inchworm','bicycle-crunch','bear-crawl'
]);

function customKey(name) {
  const g = EXERCISE_GUIDE[name] || EXERCISE_GUIDE[(name || '').trim()];
  if (g && g.type === 'custom') return g.key;
  // fuzzy fallback for slight name variants
  const n = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(EXERCISE_GUIDE)) {
    if (k.toLowerCase() === n && v.type === 'custom') return v.key;
  }
  return null;
}

function wgSlug(name) {
  const g = EXERCISE_GUIDE[name];
  if (g && g.type === 'cdn') return g.key;
  if (g && g.type === 'custom') {
    // safe CDN fallback only if custom renderer missing
    const fallbacks = {
      march: 'high-knees', walk_place: 'high-knees', calf: 'bodyweight-squat',
      sit_stand: 'bodyweight-squat', squat_hold: 'bodyweight-squat', squat_pulse: 'bodyweight-squat',
      sumo_squat: 'bodyweight-squat', broad_jump: 'jump-squat', single_glute: 'glute-bridge',
      tabletop: 'glute-bridge', incline_push: 'knee-push-up'
    };
    return fallbacks[g.key] || 'bodyweight-squat';
  }
  const n = (name || '').toLowerCase();
  for (const [k, v] of Object.entries(EXERCISE_GUIDE)) {
    if (k.toLowerCase() === n) return v.type === 'cdn' ? v.key : 'bodyweight-squat';
  }
  return 'bodyweight-squat';
}

function wgFrameUrl(slug, frame) {
  return `${WG_CDN}/${slug}/frame-${frame}.png`;
}

/** In-memory URL set so we only hit network once per frame per session */
const _wgPreloaded = new Set();

function resolveGuideSlug(name) {
  const g = EXERCISE_GUIDE[name] || null;
  let slug = (g && g.type === 'cdn') ? g.key : (typeof wgSlug === 'function' ? wgSlug(name) : 'bodyweight-squat');
  const banned = new Set([
    'walking','running','standing-calf-raise','calf-raise','dumbbell-side-bend',
    'band-pull-apart','active-hang','dead-hang','seated-calf-raise'
  ]);
  if (!slug || banned.has(slug)) slug = 'high-knees';
  return slug;
}

/** Preload 3 frames for a slug (browser + HTTP cache). Idempotent. */
function preloadGuideSlug(slug) {
  if (!slug) return;
  for (let n = 1; n <= 3; n++) {
    const url = wgFrameUrl(slug, n);
    if (_wgPreloaded.has(url)) continue;
    _wgPreloaded.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
  }
}

/** Preload current + next N exercises in an active workout */

function preloadPopularGuides() {
  try {
    const free = Object.values(WORKOUTS).filter((w) => w.free).slice(0, 4);
    free.forEach((w) => preloadWorkoutGuides(w, 0, 2));
  } catch (_) {}
}

function preloadWorkoutGuides(workout, fromIndex, ahead) {
  if (!workout || !workout.exercises) return;
  const start = Math.max(0, fromIndex | 0);
  const end = Math.min(workout.exercises.length, start + (ahead || 2));
  for (let i = start; i < end; i++) {
    preloadGuideSlug(resolveGuideSlug(workout.exercises[i].name));
  }
}





function customDemoHtml(name, key) {
  const frames = customFrames(key);
  const labels = ['Setup', 'Move', 'Finish'];
  const strip = frames.map((f, i) => `
    <div class="wg-cell">
      <div class="wg-cell-frame custom-frame">${f}</div>
      <span class="wg-label">${labels[i]}</span>
    </div>`).join('');
  return `<div class="wg-demo custom-demo" data-custom="${key}" role="img" aria-label="Form guide for ${name}">
    <div class="wg-stage wg-stage-hero custom-stage">
      <div class="wg-frame f1 custom-frame">${frames[0]}</div>
      <div class="wg-frame f2 custom-frame">${frames[1]}</div>
      <div class="wg-frame f3 custom-frame">${frames[2]}</div>
      <div class="wg-glow"></div>
    </div>
    <div class="wg-strip" aria-hidden="true">${strip}</div>
    <p class="wg-credit">Equipment-free form · Setup → Move → Finish</p>
  </div>`;
}

function prVideoUrl(name) { return null; }

function prDemoHtml(name) { return null; }

function wgDemoHtml(name, opts = {}) {
  const slug = resolveGuideSlug(name);
  preloadGuideSlug(slug); // warm cache while rendering

  const labels = ['Setup', 'Move', 'Finish'];
  // Hero: 3 animated frames. Strip reuses same URLs (browser cache — no extra network).
  const strip = [1, 2, 3].map((n) => `
    <div class="wg-cell">
      <div class="wg-cell-frame">
        <img src="${wgFrameUrl(slug, n)}" alt="${labels[n - 1]}" decoding="async" loading="lazy" width="120" height="120" />
      </div>
      <span class="wg-label">${labels[n - 1]}</span>
    </div>`).join('');
  return `<div class="wg-demo" data-wg="${slug}" role="img" aria-label="Form guide for ${name}">
    <div class="wg-stage wg-stage-hero">
      <img class="wg-frame f1" src="${wgFrameUrl(slug, 1)}" alt="" decoding="async" fetchpriority="high" width="280" height="280"
        onerror="this.onerror=null;this.src='${wgFrameUrl('bodyweight-squat', 1)}'" />
      <img class="wg-frame f2" src="${wgFrameUrl(slug, 2)}" alt="" decoding="async" width="280" height="280"
        onerror="this.onerror=null;this.src='${wgFrameUrl('bodyweight-squat', 2)}'" />
      <img class="wg-frame f3" src="${wgFrameUrl(slug, 3)}" alt="" decoding="async" width="280" height="280"
        onerror="this.onerror=null;this.src='${wgFrameUrl('bodyweight-squat', 3)}'" />
      <div class="wg-glow"></div>
    </div>
    <div class="wg-strip" aria-hidden="true">${strip}</div>
    <p class="wg-credit">Animated form · Setup → Move → Finish</p>
  </div>`;
}


function photoUrl(name) {
  return '/assets/exercises/' + photoKey(name) + '.jpg?v=23';
}
function videoUrl(name) {
  return '/assets/videos/' + photoKey(name) + '.mp4?v=3';
}
function iconFor(name) {
  return `<img class="photo-thumb" src="${photoUrl(name)}" alt="" loading="lazy" />`;
}
function iconSvg(name, sizeClass) {
  // compatibility: large photo for stage
  if (sizeClass && sizeClass.includes('lg')) {
    return `<img class="photo-stage" src="${photoUrl(name)}" alt="" />`;
  }
  return iconFor(name);
}

const WORKOUTS = {
  office_10: {
    id: 'office_10', title: 'Office Reset', durationLabel: '10 min', place: 'Office', free: true,
    description: 'Quiet moves between meetings. No jumping.',
    exercises: [
      { name: 'Desk chair sit-to-stand', duration: 40, rest: 15 },
      { name: 'Wall push-ups', duration: 40, rest: 15 },
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Calf raises', duration: 40, rest: 15 },
      { name: 'Seated torso twists', duration: 40, rest: 15 },
      { name: 'Standing hip circles', duration: 40, rest: 15 },
      { name: 'Wall sit', duration: 40, rest: 15 },
      { name: 'Neck & shoulder rolls', duration: 40, rest: 0 }
    ]
  },
  office_posture: {
    id: 'office_posture', title: 'Desk Posture Fix', durationLabel: '7 min', place: 'Office', free: true,
    description: 'Undo hunching. Quiet, chair-friendly.',
    exercises: [
      { name: 'Seated cat-cow', duration: 40, rest: 10 },
      { name: 'Chin tucks', duration: 30, rest: 10 },
      { name: 'Seated thoracic openers', duration: 40, rest: 10 },
      { name: 'Standing chest opener', duration: 30, rest: 10 },
      { name: 'Hip flexor stretch L', duration: 30, rest: 5 },
      { name: 'Hip flexor stretch R', duration: 30, rest: 10 },
      { name: 'Shoulder blade squeezes', duration: 40, rest: 10 },
      { name: 'Slow neck rolls', duration: 40, rest: 0 }
    ]
  },
  office_energy: {
    id: 'office_energy', title: 'Afternoon Energy', durationLabel: '8 min', place: 'Office', free: false,
    description: 'Wake up without sweating through your shirt.',
    exercises: [
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Wall push-ups', duration: 40, rest: 15 },
      { name: 'Calf raises', duration: 40, rest: 15 },
      { name: 'Standing side bends', duration: 40, rest: 15 },
      { name: 'Arm circles', duration: 30, rest: 10 },
      { name: 'Wall sit', duration: 40, rest: 0 }
    ]
  },
  home_12: {
    id: 'home_12', title: 'Home Full Body', durationLabel: '12 min', place: 'Home', free: true,
    description: 'Classic bodyweight circuit. Living room friendly.',
    exercises: [
      { name: 'Jumping jacks (or step-jacks)', duration: 40, rest: 20 },
      { name: 'Push-ups (knee OK)', duration: 40, rest: 20 },
      { name: 'Bodyweight squats', duration: 40, rest: 20 },
      { name: 'Mountain climbers', duration: 40, rest: 20 },
      { name: 'Glute bridges', duration: 40, rest: 20 },
      { name: 'Plank', duration: 40, rest: 20 },
      { name: 'Reverse lunges', duration: 40, rest: 20 },
      { name: 'Superman holds', duration: 40, rest: 20 },
      { name: 'High knees (or marches)', duration: 40, rest: 20 },
      { name: 'Cool-down stretch', duration: 40, rest: 0 }
    ]
  },
  home_core: {
    id: 'home_core', title: 'Core Focus', durationLabel: '8 min', place: 'Home', free: true,
    description: 'Short core session. Mat optional.',
    exercises: [
      { name: 'Dead bugs', duration: 40, rest: 15 },
      { name: 'Glute bridge march', duration: 40, rest: 15 },
      { name: 'Side plank (left)', duration: 30, rest: 10 },
      { name: 'Side plank (right)', duration: 30, rest: 15 },
      { name: 'Bird dog', duration: 40, rest: 15 },
      { name: 'Hollow hold (or tuck)', duration: 30, rest: 15 },
      { name: 'Slow mountain climbers', duration: 40, rest: 0 }
    ]
  },
  home_am: {
    id: 'home_am', title: 'Morning Wake-Up', durationLabel: '9 min', place: 'Home', free: true,
    description: 'Gentle-to-strong start. No equipment.',
    exercises: [
      { name: 'March in place', duration: 40, rest: 15 },
      { name: 'Arm circles', duration: 30, rest: 10 },
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Incline or knee push-ups', duration: 40, rest: 15 },
      { name: 'Glute bridges', duration: 40, rest: 15 },
      { name: 'Standing toe reaches', duration: 30, rest: 10 },
      { name: 'Plank', duration: 30, rest: 15 },
      { name: 'Easy stretch flow', duration: 45, rest: 0 }
    ]
  },
  home_hiit: {
    id: 'home_hiit', title: 'Home HIIT Blast', durationLabel: '14 min', place: 'Home', free: false,
    description: 'Higher intensity. Scale jumps to steps anytime.',
    exercises: [
      { name: 'Jumping jacks', duration: 40, rest: 20 },
      { name: 'Squat pulses', duration: 40, rest: 20 },
      { name: 'Push-ups', duration: 40, rest: 20 },
      { name: 'High knees', duration: 40, rest: 20 },
      { name: 'Reverse lunges', duration: 40, rest: 20 },
      { name: 'Mountain climbers', duration: 40, rest: 20 },
      { name: 'Burpees', duration: 35, rest: 25 },
      { name: 'Plank shoulder taps', duration: 40, rest: 20 },
      { name: 'Jump squats (or squats)', duration: 40, rest: 20 },
      { name: 'Cool-down walk in place', duration: 45, rest: 0 }
    ]
  },
  home_legs: {
    id: 'home_legs', title: 'Legs & Glutes', durationLabel: '10 min', place: 'Home', free: false,
    description: 'Lower body strength without weights.',
    exercises: [
      { name: 'Bodyweight squats', duration: 45, rest: 20 },
      { name: 'Reverse lunges', duration: 45, rest: 20 },
      { name: 'Glute bridges', duration: 45, rest: 20 },
      { name: 'Wall sit', duration: 45, rest: 20 },
      { name: 'Single-leg glute bridge L', duration: 30, rest: 10 },
      { name: 'Single-leg glute bridge R', duration: 30, rest: 20 },
      { name: 'Sumo squats', duration: 45, rest: 20 },
      { name: 'Calf raises', duration: 40, rest: 0 }
    ]
  },
  home_upper: {
    id: 'home_upper', title: 'Upper Body Pump', durationLabel: '11 min', place: 'Home', free: false,
    description: 'Push, pull, and hold — floor and wall only.',
    exercises: [
      { name: 'Push-ups', duration: 40, rest: 20 },
      { name: 'Pike push-ups (or wall)', duration: 35, rest: 20 },
      { name: 'Superman holds', duration: 40, rest: 15 },
      { name: 'Diamond or narrow push-ups', duration: 35, rest: 20 },
      { name: 'Plank', duration: 40, rest: 15 },
      { name: 'Reverse tabletop holds', duration: 30, rest: 15 },
      { name: 'Shoulder taps in plank', duration: 40, rest: 20 },
      { name: 'Wall push-ups finisher', duration: 40, rest: 0 }
    ]
  },
  home_mobility: {
    id: 'home_mobility', title: 'Mobility Flow', durationLabel: '10 min', place: 'Home', free: true,
    description: 'Move better. Great on rest days or after sitting.',
    exercises: [
      { name: 'World greatest stretch flow', duration: 45, rest: 15 },
      { name: 'Hip circles', duration: 40, rest: 10 },
      { name: 'Deep squat hold', duration: 40, rest: 15 },
      { name: 'Thoracic rotations', duration: 40, rest: 10 },
      { name: 'Hamstring fold', duration: 40, rest: 10 },
      { name: 'Shoulder CARs slow', duration: 40, rest: 10 },
      { name: 'Ankle rocks', duration: 30, rest: 10 },
      { name: 'Easy breathing stretch', duration: 40, rest: 0 }
    ]
  },
  playground_15: {
    id: 'playground_15', title: 'Playground Circuit', durationLabel: '15 min', place: 'Playground', free: true,
    description: 'Bars, benches, open space. Optional pull-up bar.',
    exercises: [
      { name: 'Park-bench step-ups', duration: 45, rest: 20 },
      { name: 'Incline push-ups (bench)', duration: 45, rest: 20 },
      { name: 'Walking lunges', duration: 45, rest: 20 },
      { name: 'Bench dips', duration: 45, rest: 20 },
      { name: 'Squat jumps (or squats)', duration: 45, rest: 20 },
      { name: 'Dead hangs or scap pulls', duration: 30, rest: 25 },
      { name: 'Plank on grass', duration: 45, rest: 20 },
      { name: 'Burpees', duration: 40, rest: 25 },
      { name: 'Easy jog / walk lap', duration: 60, rest: 0 }
    ]
  },
  playground_sprint: {
    id: 'playground_sprint', title: 'Park Power', durationLabel: '12 min', place: 'Playground', free: false,
    description: 'Open space power. Scale intensity to how you feel.',
    exercises: [
      { name: 'Easy jog warm-up', duration: 60, rest: 20 },
      { name: 'Walking lunges', duration: 45, rest: 20 },
      { name: 'Bench step-ups', duration: 45, rest: 20 },
      { name: 'Incline push-ups', duration: 40, rest: 20 },
      { name: 'Broad jumps (or long steps)', duration: 30, rest: 25 },
      { name: 'Bench dips', duration: 40, rest: 20 },
      { name: 'Sprint or fast walk intervals', duration: 50, rest: 30 },
      { name: 'Plank', duration: 40, rest: 15 },
      { name: 'Cool-down walk', duration: 60, rest: 0 }
    ]
  },
  playground_family: {
    id: 'playground_family', title: 'Playground Easy', durationLabel: '10 min', place: 'Playground', free: true,
    description: 'Light outdoor session. Good with kids nearby.',
    exercises: [
      { name: 'Walk the perimeter', duration: 60, rest: 15 },
      { name: 'Bench sit-to-stand', duration: 40, rest: 15 },
      { name: 'Incline push-ups', duration: 35, rest: 20 },
      { name: 'Standing marches', duration: 40, rest: 15 },
      { name: 'Calf raises on curb', duration: 40, rest: 15 },
      { name: 'Gentle side lunges', duration: 40, rest: 15 },
      { name: 'Easy stretch on grass', duration: 45, rest: 0 }
    ]
  },
  express_6: {
    id: 'express_6', title: 'Express 6', durationLabel: '6 min', place: 'Anywhere', free: false,
    description: 'Maximum density when you only have minutes.',
    exercises: [
      { name: 'Squats', duration: 40, rest: 10 },
      { name: 'Push-ups', duration: 40, rest: 10 },
      { name: 'Lunges', duration: 40, rest: 10 },
      { name: 'Plank', duration: 40, rest: 10 },
      { name: 'Burpees', duration: 40, rest: 10 },
      { name: 'Mountain climbers', duration: 40, rest: 0 }
    ]
  },
  express_4: {
    id: 'express_4', title: 'Micro 4', durationLabel: '4 min', place: 'Anywhere', free: true,
    description: 'Tiny session beats no session.',
    exercises: [
      { name: 'Squats', duration: 40, rest: 15 },
      { name: 'Push-ups or wall push-ups', duration: 40, rest: 15 },
      { name: 'Plank', duration: 30, rest: 15 },
      { name: 'March or jog in place', duration: 40, rest: 0 }
    ]
  },
  hotel_10: {
    id: 'hotel_10', title: 'Travel / Hotel', durationLabel: '10 min', place: 'Anywhere', free: true,
    description: 'Small room friendly. Quiet enough for hotels.',
    exercises: [
      { name: 'Bodyweight squats', duration: 40, rest: 15 },
      { name: 'Incline push-ups (desk/bed)', duration: 40, rest: 15 },
      { name: 'Glute bridges', duration: 40, rest: 15 },
      { name: 'Reverse lunges', duration: 40, rest: 15 },
      { name: 'Plank', duration: 35, rest: 15 },
      { name: 'Superman holds', duration: 35, rest: 15 },
      { name: 'Calf raises', duration: 35, rest: 10 },
      { name: 'Stretch & breathe', duration: 40, rest: 0 }
    ]
  }
};

const DEFAULT_CHALLENGE = {
  id: 'local-1',
  title: 'Forge Circuit #1',
  description: 'Timed bodyweight circuit. Complete for time.',
  exercises: [
    { name: 'Air Squats', reps: 40 },
    { name: 'Push-ups', reps: 30 },
    { name: 'Walking Lunges', reps: 40 },
    { name: 'Burpees', reps: 20 },
    { name: 'Mountain Climbers', reps: 50 },
    { name: 'Plank', duration_seconds: 60 }
  ]
};

// —— Audio ——
function ensureAudio() {
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  }
  if (audioCtx?.state === 'suspended') audioCtx.resume();
}

function beep(freq = 880, dur = 0.08, type = 'sine', gain = 0.08) {
  if (!sfxEnabled) return;
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const o = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g); g.connect(audioCtx.destination);
  o.start(t); o.stop(t + dur);
}

function sfxStart() { beep(660, 0.1); setTimeout(() => beep(880, 0.12), 90); }
function sfxRest() { beep(440, 0.15, 'triangle', 0.06); }
function sfxDone() { beep(523, 0.1); setTimeout(() => beep(659, 0.1), 100); setTimeout(() => beep(784, 0.2), 200); }
function sfxTick() { beep(1200, 0.04, 'square', 0.04); }

function speakForTts(text) {
  let s = String(text || '');
  const replacements = [
    [/push-?ups?/gi, 'push ups'],
    [/sit-?ups?/gi, 'sit ups'],
    [/pull-?ups?/gi, 'pull ups'],
    [/chin-?ups?/gi, 'chin ups'],
    [/jumping jacks?/gi, 'jumping jacks'],
    [/high knees?/gi, 'high knees'],
    [/mountain climbers?/gi, 'mountain climbers'],
    [/glute bridges?/gi, 'glute bridges'],
    [/dead bugs?/gi, 'dead bugs'],
    [/bird dogs?/gi, 'bird dogs'],
    [/wall sits?/gi, 'wall sits'],
    [/calf raises?/gi, 'calf raises'],
    [/hip circles?/gi, 'hip circles'],
    [/step-?ups?/gi, 'step ups'],
    [/sit-?to-?stand/gi, 'sit to stand'],
    [/cool-?down/gi, 'cool down'],
    [/wake-?up/gi, 'wake up'],
    [/HIIT/g, 'hit'],
    [/\bL\b/g, 'left'],
    [/\bR\b/g, 'right'],
    [/\(knee OK\)/gi, 'knees okay'],
    [/\(or [^)]+\)/gi, ''],
    [/-/g, ' '],
    [/\s+/g, ' ']
  ];
  for (const [re, rep] of replacements) s = s.replace(re, rep);
  return s.trim();
}

function inferReps(name) {
  const n = (name || '').toLowerCase();
  if (!n) return null;
  if (/plank|wall sit|hold|hang|hollow|stretch|roll|opener|breath|walk|jog|march|run|sprint|cool-?down|circle|cars|chin tuck|side bend|hip flexor|thoracic|cat-?cow|neck|shoulder car|ankle|fold|toe reach|chest opener|breathing/.test(n)) return null;
  if (/burpee/.test(n)) return 8;
  if (/diamond|narrow push|pike push|incline push|wall push|push-?up/.test(n)) return 12;
  if (/sit-?to-?stand|chair stand|bench sit/.test(n)) return 15;
  if (/jump squat|squat jump|squat pulse|sumo|air squat|bodyweight squat|\bsquats?\b/.test(n)) return 15;
  if (/lunge/.test(n)) return 12;
  if (/mountain climber|jumping jack|step-?jack|high knee|broad jump/.test(n)) return 20;
  if (/bridge|dead bug|bird dog|superman|dip|calf|step-?up/.test(n)) return 12;
  if (/twist|squeeze|pulse|shoulder tap|russian/.test(n)) return 16;
  return null;
}

function exerciseMeta(ex) {
  if (!ex) return { name: '', duration: 0, rest: 0, reps: null, mode: 'time' };
  const reps = (ex.reps != null && ex.reps > 0) ? ex.reps : inferReps(ex.name);
  return { name: ex.name, duration: ex.duration || 0, rest: ex.rest || 0, reps, mode: reps ? 'reps' : 'time' };
}

function metaLabel(ex) {
  const m = exerciseMeta(ex);
  if (m.reps && m.duration) return m.reps + ' reps · ' + m.duration + 's';
  if (m.reps) return m.reps + ' reps';
  return m.duration + 's';
}

function pickCoachVoice() {
  if (!window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  if (!voices.length) return null;
  const gender = trainerGender === 'male' ? 'male' : 'female';
  const scored = voices.map((v) => {
    const name = (v.name || '') + ' ' + (v.lang || '');
    let score = 0;
    if (/en(-|_)?(us|gb|au|nz|ie)/i.test(v.lang || '')) score += 5;
    if (gender === 'female') {
      if (/female|woman|samantha|karen|moira|susan|zira|victoria|fiona|tessa|google.*female|microsoft.*(zira|susan)/i.test(name)) score += 10;
      if (/male|david|daniel|alex|fred|mark|google.*male/i.test(name) && !/female/i.test(name)) score -= 8;
    } else {
      if (/male|man|david|daniel|alex|fred|mark|ravi|google.*male|microsoft.*(david|mark|guy)/i.test(name) && !/female/i.test(name)) score += 10;
      if (/female|samantha|karen|zira|susan/i.test(name)) score -= 8;
    }
    if (/premium|enhanced|neural|natural/i.test(name)) score += 2;
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0] && scored[0].score > 0 ? scored[0].v : (voices.find(v => /^en/i.test(v.lang || '')) || voices[0]);
}

function speak(text, opts) {
  opts = opts || {};
  if (!voiceEnabled || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(speakForTts(text));
    const voice = pickCoachVoice();
    if (voice) u.voice = voice;
    const energetic = opts.energy !== false;
    if (trainerGender === 'male') {
      u.rate = energetic ? 1.12 : 1.05;
      u.pitch = energetic ? 0.95 : 1.0;
    } else {
      u.rate = energetic ? 1.14 : 1.06;
      u.pitch = energetic ? 1.12 : 1.05;
    }
    u.volume = 1;
    window.speechSynthesis.speak(u);
  } catch (_) {}
}

const COACH_LINES = {
  workReps: [
    function(n, r) { return "Let's go! " + r + " " + n + ". You've got this!"; },
    function(n, r) { return "Come on — " + r + " solid " + n + ". Make every rep count!"; },
    function(n, r) { return "Time to work! " + r + " " + n + ". Push it!"; },
    function(n, r) { return "Here we go! " + r + " " + n + ". Stay strong!"; }
  ],
  workTime: [
    function(n) { return "Let's go! " + n + ". Stay locked in!"; },
    function(n) { return "Work time — " + n + ". You've got this!"; },
    function(n) { return "Come on! " + n + ". Give it everything!"; },
    function(n) { return "Here we go — " + n + ". Own it!"; }
  ],
  rest: [
    function() { return "Yes! Rest up. Breathe. You're crushing it."; },
    function() { return "Nice work! Shake it out. Recover strong."; },
    function() { return "Great set! Catch your breath — next one's coming."; },
    function() { return "Beautiful! Rest. Stay loose. You're doing amazing."; }
  ],
  ready: [
    function(n) { return "Get ready. " + n + ". Let's make it count!"; },
    function(n) { return "Next up — " + n + ". Bring the energy!"; }
  ],
  five: [
    function() { return "Five seconds — finish strong!"; },
    function() { return "Almost there — dig deep!"; },
    function() { return "Final five — don't quit now!"; }
  ],
  done: [
    function() { return "Session complete! Outstanding work. Be proud of that."; },
    function() { return "That's a wrap! You showed up and put in the work. Amazing."; },
    function() { return "Done! Incredible effort. See you next session."; }
  ]
};

function coachLine(bucket) {
  var args = Array.prototype.slice.call(arguments, 1);
  var arr = COACH_LINES[bucket] || [];
  if (!arr.length) return '';
  var fn = arr[Math.floor(Math.random() * arr.length)];
  return fn.apply(null, args);
}

function speakExerciseStart(ex) {
  var m = exerciseMeta(ex);
  var n = speakForTts(m.name);
  if (m.reps) speak(coachLine('workReps', n, m.reps));
  else speak(coachLine('workTime', n));
}

function speakRest() { speak(coachLine('rest')); }
function speakDone() { speak(coachLine('done')); }
function speakReady(ex) {
  var n = speakForTts((ex && ex.name) || 'your first move');
  speak(coachLine('ready', n));
}

function warmVoices() {
  if (!window.speechSynthesis) return;
  var kick = function() { _voicesReady = true; window.speechSynthesis.getVoices(); };
  kick();
  window.speechSynthesis.onvoiceschanged = kick;
}

function renderMusicBar(compact) {
  const spotifyUrl = 'https://open.spotify.com/search/workout%20focus';
  const appleUrl = 'https://music.apple.com/search?term=workout';
  if (compact) {
    return `<div class="music-bar compact">
      <span class="music-label">Music</span>
      <a class="music-chip" href="${spotifyUrl}" target="_blank" rel="noopener">Spotify</a>
      <a class="music-chip" href="${appleUrl}" target="_blank" rel="noopener">Apple Music</a>
    </div>`;
  }
  return `<div class="music-card">
    <h3>Soundtrack</h3>
    <p class="muted mb">Play your own music in the background — works great with headphones.</p>
    <div class="music-actions">
      <a class="btn secondary music-link" href="${spotifyUrl}" target="_blank" rel="noopener">Open Spotify</a>
      <a class="btn secondary music-link" href="${appleUrl}" target="_blank" rel="noopener">Open Apple Music</a>
    </div>
    <p class="music-tip muted">Tip: start a playlist, return here, then hit Begin. Voice cues stay on top.</p>
  </div>`;
}

// —— Helpers ——
function $(sel) { return document.querySelector(sel); }
function $all(sel) { return document.querySelectorAll(sel); }
function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function todayKey() { return new Date().toISOString().slice(0, 10); }
function getHistory() { return store.get('history') || []; }
function getStats() {
  const history = getHistory();
  const today = todayKey();
  return {
    total: history.length,
    today: history.filter(h => h.date === today).length,
    streak: store.get('streak') || 0
  };
}
function lastSameWorkout(workoutId) {
  const history = getHistory().filter(h => h.workoutId === workoutId);
  return history.length ? history[history.length - 1] : null;
}

/** Merge cloud workout rows into local history (dedupe by cloudId or title+time). */
function mergeCloudHistory(rows) {
  if (!rows || !rows.length) return 0;
  const history = getHistory();
  const existingIds = new Set(history.map(h => h.cloudId).filter(Boolean));
  const existingKeys = new Set(history.map(h => `${h.title}|${h.duration}|${h.date}`));
  let added = 0;
  rows.forEach((r) => {
    if (r.id && existingIds.has(r.id)) return;
    const date = (r.completed_at || r.created_at || '').slice(0, 10) || todayKey();
    const key = `${r.title}|${r.duration_seconds || 0}|${date}`;
    if (existingKeys.has(key)) return;
    history.push({
      cloudId: r.id,
      title: r.title || 'Workout',
      workoutId: r.workout_id || null,
      duration: r.duration_seconds || 0,
      totalReps: r.total_reps || 0,
      exercises: r.exercises || [],
      date,
      completedAt: r.completed_at || r.created_at
    });
    if (r.id) existingIds.add(r.id);
    existingKeys.add(key);
    added++;
  });
  if (added) {
    history.sort((a, b) => String(a.completedAt || a.date).localeCompare(String(b.completedAt || b.date)));
    store.set('history', history);
    // recompute streak
    const dates = [...new Set(history.map(h => h.date))].sort();
    let streak = dates.length ? 1 : 0;
    for (let i = dates.length - 1; i > 0; i--) {
      const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
      if (diff <= 1.5) streak++; else break;
    }
    store.set('streak', streak);
  }
  return added;
}

async function pullCloudHistory() {
  if (!isSignedIn()) return { added: 0 };
  try {
    const { data, error } = await supabaseClient
      .from('workouts')
      .select('id, title, workout_id, duration_seconds, total_reps, exercises, completed_at, created_at')
      .eq('user_id', currentUser.id)
      .order('completed_at', { ascending: false })
      .limit(100);
    if (error) throw error;
    const added = mergeCloudHistory(data || []);
    store.set('lastSyncAt', new Date().toISOString());
    return { added, total: (data || []).length };
  } catch (e) {
    console.warn('pullCloudHistory', e.message || e);
    return { added: 0, error: e.message || String(e) };
  }
}

async function syncNow() {
  await ensureProfile();
  const result = await pullCloudHistory();
  await refreshSocial();
  return result;
}


async function saveWorkoutSession(session) {
  const history = getHistory();
  history.push(session);
  store.set('history', history);
  const dates = [...new Set(history.map(h => h.date))].sort();
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    const diff = (new Date(dates[i]) - new Date(dates[i - 1])) / 86400000;
    if (diff <= 1.5) streak++; else break;
  }
  store.set('streak', streak);

  // Always try cloud session write for signed-in users (Phase B)
  if (supabaseClient && currentUser && !currentUser.isGuest) {
    try {
      const row = {
        user_id: currentUser.id,
        title: session.title,
        workout_id: session.workoutId || null,
        duration_seconds: session.duration,
        total_reps: session.totalReps || 0,
        exercises: session.exercises || [],
        completed_at: new Date().toISOString()
      };
      const { data: saved, error } = await supabaseClient.from('workouts').insert(row).select('id').single();
      if (error) throw error;
      if (saved?.id) {
        const hist = getHistory();
        const last = hist[hist.length - 1];
        if (last && !last.cloudId) {
          last.cloudId = saved.id;
          store.set('history', hist);
        }
      }
      store.set('lastSyncAt', new Date().toISOString());
      await postActivity('session_complete', {
        title: session.title,
        duration: session.duration,
        totalReps: session.totalReps || 0,
        workoutId: session.workoutId || null
      });
    } catch (e) {
      console.warn('Cloud save skipped', e.message || e);
    }
  }
}

function displayName() {
  if (!currentUser) return 'Athlete';
  if (currentUser.user_metadata?.full_name) return currentUser.user_metadata.full_name;
  if (currentUser.email) return currentUser.email.split('@')[0];
  return 'Athlete';
}

function isSignedIn() {
  return !!(currentUser && !currentUser.isGuest && supabaseClient);
}

function inviteLink(code) {
  return location.origin + '/?app=1&join=' + encodeURIComponent(code);
}

function genLocalCode() {
  return Math.random().toString(36).slice(2, 10).toUpperCase();
}

async function postActivity(kind, payload) {
  if (!isSignedIn()) return;
  try {
    await supabaseClient.from('activity').insert({
      user_id: currentUser.id,
      kind,
      payload: payload || {}
    });
  } catch (e) {
    console.warn('activity', e.message || e);
  }
}

async function ensureProfile() {
  if (!isSignedIn()) return;
  try {
    const name = displayName();
    await supabaseClient.from('profiles').upsert({
      id: currentUser.id,
      full_name: name,
      display_name: name,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' });
  } catch (e) {
    console.warn('profile', e.message || e);
  }
}

async function refreshSocial() {
  if (!supabaseClient) return;
  socialCache.loading = true;
  try {
    const { data: challenges } = await supabaseClient
      .from('challenges')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(30);
    socialCache.challenges = challenges || [];

    const { data: activity } = await supabaseClient
      .from('activity')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    socialCache.activity = activity || [];

    if (isSignedIn()) {
      const { data: memberships } = await supabaseClient
        .from('challenge_members')
        .select('challenge_id')
        .eq('user_id', currentUser.id);
      const ids = (memberships || []).map(m => m.challenge_id);
      socialCache.mine = (socialCache.challenges || []).filter(c => ids.includes(c.id) || c.creator_id === currentUser.id);
    } else {
      socialCache.mine = [];
    }
  } catch (e) {
    console.warn('refreshSocial', e.message || e);
  }
  socialCache.loading = false;
}

async function loadLeaderboard(challengeId) {
  if (!supabaseClient || !challengeId) { socialCache.board = []; return; }
  try {
    const { data } = await supabaseClient
      .from('challenge_entries')
      .select('id, user_id, score_seconds, completed_at, notes')
      .eq('challenge_id', challengeId)
      .order('score_seconds', { ascending: true })
      .limit(50);
    const rows = data || [];
    // attach names from profiles
    const uids = [...new Set(rows.map(r => r.user_id))];
    let names = {};
    if (uids.length) {
      const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, display_name, full_name, username')
        .in('id', uids);
      (profiles || []).forEach(p => {
        names[p.id] = p.display_name || p.full_name || p.username || 'Athlete';
      });
    }
    socialCache.board = rows.map((r, i) => ({
      ...r,
      rank: i + 1,
      name: names[r.user_id] || (r.user_id === currentUser?.id ? displayName() : 'Athlete')
    }));
  } catch (e) {
    console.warn('board', e.message || e);
    socialCache.board = [];
  }
}

async function createFriendsChallenge({ title, description, workoutId, days }) {
  if (!isSignedIn()) throw new Error('Sign in to create a challenge');
  await ensureProfile();
  const code = genLocalCode();
  const start = new Date();
  const end = new Date(Date.now() + (days || 7) * 86400000);
  const w = workoutId && WORKOUTS[workoutId];
  const exercise_list = w
    ? w.exercises.map(e => {
        const m = exerciseMeta(e);
        return m.reps
          ? { name: m.name, reps: m.reps }
          : { name: m.name, duration_seconds: m.duration };
      })
    : [
        { name: 'Bodyweight squats', reps: 20 },
        { name: 'Push-ups', reps: 15 },
        { name: 'Reverse lunges', reps: 16 },
        { name: 'Plank', duration_seconds: 40 }
      ];
  const row = {
    title: title || ((w && w.title) ? w.title + ' Challenge' : 'Friends Challenge'),
    description: description || 'Friends-only. Best time ranks higher. Honor system.',
    start_date: start.toISOString(),
    end_date: end.toISOString(),
    exercise_list,
    is_active: true,
    creator_id: currentUser.id,
    invite_code: code,
    kind: 'friends',
    workout_id: workoutId || null,
    goal: 'best_time'
  };
  const { data, error } = await supabaseClient.from('challenges').insert(row).select().single();
  if (error) throw error;
  await supabaseClient.from('challenge_members').insert({
    challenge_id: data.id,
    user_id: currentUser.id
  });
  await postActivity('challenge_create', { challengeId: data.id, title: data.title, code: data.invite_code });
  return data;
}

async function joinChallengeByCode(code) {
  if (!isSignedIn()) throw new Error('Sign in to join a challenge');
  await ensureProfile();
  const clean = String(code || '').trim().toUpperCase();
  if (!clean) throw new Error('Enter an invite code');
  const { data: ch, error } = await supabaseClient
    .from('challenges')
    .select('*')
    .eq('invite_code', clean)
    .maybeSingle();
  if (error) throw error;
  if (!ch) throw new Error('Challenge not found');
  const { error: mErr } = await supabaseClient.from('challenge_members').upsert({
    challenge_id: ch.id,
    user_id: currentUser.id
  }, { onConflict: 'challenge_id,user_id' });
  if (mErr) throw mErr;
  await postActivity('challenge_join', { challengeId: ch.id, title: ch.title, code: clean });
  return ch;
}

async function submitChallengeTime(challengeId, scoreSeconds, notes) {
  if (!isSignedIn()) throw new Error('Sign in required');
  const { data: existing } = await supabaseClient
    .from('challenge_entries')
    .select('id, score_seconds')
    .eq('challenge_id', challengeId)
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (existing && existing.score_seconds != null && existing.score_seconds <= scoreSeconds) {
    // Keep better (lower) time — do not overwrite with a slower run
    await loadLeaderboard(challengeId);
    return { kept: existing.score_seconds, improved: false };
  }
  const { error } = await supabaseClient.from('challenge_entries').upsert({
    challenge_id: challengeId,
    user_id: currentUser.id,
    score_seconds: scoreSeconds,
    notes: notes || null,
    completed_at: new Date().toISOString()
  }, { onConflict: 'challenge_id,user_id' });
  if (error) throw error;
  await postActivity('challenge_result', {
    challengeId,
    scoreSeconds,
    title: socialCache.activeChallenge?.title || 'Challenge'
  });
  return { kept: scoreSeconds, improved: true };
}

function formatActivity(a) {
  const p = a.payload || {};
  const when = new Date(a.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (a.kind === 'session_complete') {
    return { icon: '✓', text: `Finished ${p.title || 'a workout'} · ${formatTime(p.duration || 0)}`, when };
  }
  if (a.kind === 'challenge_join') {
    return { icon: '+', text: `Joined ${p.title || 'a challenge'}`, when };
  }
  if (a.kind === 'challenge_create') {
    return { icon: '⚡', text: `Created ${p.title || 'a challenge'}`, when };
  }
  if (a.kind === 'challenge_result') {
    return { icon: '🏆', text: `Posted ${formatTime(p.scoreSeconds || 0)} on ${p.title || 'challenge'}`, when };
  }
  return { icon: '•', text: a.kind, when };
}


function isAppMode() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    new URLSearchParams(location.search).get('app') === '1'
  );
}

async function init() {
  // Browser without ?app=1 → marketing site (site.js). App / PWA → this shell.
  if (!isAppMode()) return;

  isPro = !!store.get('isPro');
  voiceEnabled = store.get('voiceEnabled') !== false;
  sfxEnabled = store.get('sfxEnabled') !== false;
  musicHintDismissed = !!store.get('musicHintDismissed');
  trainerGender = store.get('trainerGender') === 'male' ? 'male' : 'female';
  warmVoices();

  if (window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
    // Detect which OAuth providers are enabled on this project
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/settings', {
        headers: { apikey: SUPABASE_ANON_KEY }
      });
      if (res.ok) {
        const settings = await res.json();
        authProviders.google = !!(settings.external && settings.external.google);
        authProviders.apple = !!(settings.external && settings.external.apple);
        authProviders.email = settings.external ? settings.external.email !== false : true;
      }
    } catch (_) {}
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user) {
      currentUser = session.user;
      if (currentUser.email?.toLowerCase().includes('pro')) {
        isPro = true; store.set('isPro', true);
      }
    }
    supabaseClient.auth.onAuthStateChange((_e, s) => {
      currentUser = s?.user || null;
      if (currentUser?.email?.toLowerCase().includes('pro')) {
        isPro = true; store.set('isPro', true);
      }
      if (currentScreen !== 'workoutRun') render();
    });
  }
  if (!currentUser && store.get('guest')) {
    const g = store.get('guest');
    currentUser = { id: g.id || 'guest', email: g.email || 'guest@vyrn.app', isGuest: true };
  }
  // OAuth return hash
  // Deep link: ?join=CODE
  const params = new URLSearchParams(location.search);
  const join = params.get('join');
  if (join) pendingJoinCode = join.trim().toUpperCase();

  if (window.location.hash.includes('access_token') || window.location.search.includes('code=')) {
    currentScreen = 'home';
  }
  if (currentUser && !currentUser.isGuest) {
    currentScreen = currentScreen === 'welcome' ? 'home' : currentScreen;
    ensureProfile().then(() => Promise.all([refreshSocial(), pullCloudHistory()])).then(() => { if (currentScreen === 'home' || currentScreen === 'profile') render(); });
    if (pendingJoinCode) {
      currentScreen = 'challenge';
    }
  }
  render();
}

function navigate(screen) {
  if (tickTimer && screen !== 'workoutRun' && screen !== 'challengeRun') {
    clearInterval(tickTimer);
    tickTimer = null;
  }
  currentScreen = screen;
  render();
  window.scrollTo(0, 0);
  if (screen === 'challenge' || screen === 'home') {
    refreshSocial().then(() => {
      if (currentScreen === screen) render();
      if (pendingJoinCode && isSignedIn() && screen === 'challenge') {
        const code = pendingJoinCode;
        pendingJoinCode = null;
        joinChallengeByCode(code).then(ch => {
          socialCache.activeChallenge = ch;
          loadLeaderboard(ch.id).then(() => {
            alert('Joined: ' + ch.title);
            refreshSocial().then(() => render());
          });
        }).catch(e => alert(e.message || 'Could not join'));
      }
    });
  }
}

function render() {
  const app = $('#app');
  if (!app) return;
  if (!currentUser && !['welcome', 'login'].includes(currentScreen)) currentScreen = 'welcome';
  const map = {
    welcome: renderWelcome, login: renderLogin, home: renderHome,
    library: renderLibrary, workoutDetail: renderWorkoutDetail, workoutRun: renderWorkoutRun,
    history: renderHistory, challenge: renderChallenge, challengeDetail: renderChallengeDetail,
    challengeRun: renderChallengeRun, profile: renderProfile
  };
  app.innerHTML = (map[currentScreen] || renderWelcome)();
  bindEvents();

  document.querySelectorAll('video.pr-video').forEach(v => {
    v.muted = true;
    v.playsInline = true;
    const play = () => v.play().catch(() => {});
    v.addEventListener('loadeddata', play, { once: true });
    play();
  });
  // Autoplay exercise loops (muted required by browsers)
  document.querySelectorAll('video.ex-video').forEach(v => {
    v.muted = true;
    v.setAttribute('muted', '');
    v.playsInline = true;
    const tryPlay = () => v.play().catch(() => {});
    v.addEventListener('loadeddata', tryPlay, { once: true });
    tryPlay();
  });
}

function renderLegalFooter() {
  return `<div class="legal-footer">
    <div>
      <a href="/legal/privacy.html">Privacy</a> ·
      <a href="/legal/terms.html">Terms</a> ·
      <a href="/legal/disclaimer.html">Disclaimer</a>
    </div>
    <div style="margin-top:8px">© 2026 Vyrn · Independent original product</div>
  </div>`;
}

function renderTabBar(active) {
  return `<nav class="tabbar">
    <button class="tab ${active==='home'?'active':''}" data-go="home">Home</button>
    <button class="tab ${active==='library'?'active':''}" data-go="library">Workouts</button>
    <button class="tab ${active==='challenge'?'active':''}" data-go="challenge">Community</button>
    <button class="tab ${active==='history'?'active':''}" data-go="history">History</button>
    <button class="tab ${active==='profile'?'active':''}" data-go="profile">Profile</button>
  </nav>`;
}

function renderWelcome() {
  return `<div class="screen center fade-in">
    <img class="brand-logo" src="/assets/logo.png" alt="Vyrn — show up. put in the work" />
    <p class="muted">Home · Office · Playground — no special gear</p>
    <div class="btn-stack">
      <button class="btn primary" data-go="login">Sign in / Sign up</button>
      <button class="btn ghost" data-action="guest">Continue as Guest</button>
    </div>
  </div>`;
}

function renderLogin() {
  const gOn = !!authProviders.google;
  const aOn = !!authProviders.apple;
  return `<div class="screen center fade-in">
    <img class="brand-logo-sm" src="/assets/logo.png" alt="Vyrn" />
    <h2>Welcome</h2>
    <p class="muted mb">Sign in to sync history and join challenges</p>
    <div class="btn-stack" style="max-width:340px">
      <button class="btn oauth google ${gOn ? '' : 'oauth-disabled'}" data-action="oauth-google" ${gOn ? '' : 'aria-disabled="true"'}>
        <span class="oauth-ico">G</span> Continue with Google
      </button>
      <button class="btn oauth apple ${aOn ? '' : 'oauth-disabled'}" data-action="oauth-apple" ${aOn ? '' : 'aria-disabled="true"'}>
        <span class="oauth-ico"></span> Continue with Apple
      </button>
    </div>
    ${(!gOn || !aOn) ? `<p class="muted center" style="font-size:12px;max-width:320px;margin:8px auto 0">
      ${!gOn && !aOn ? 'Google & Apple sign-in are not enabled on this project yet.' : (!gOn ? 'Google sign-in is not enabled yet.' : 'Apple sign-in is not enabled yet.')}
      Use email below, or enable providers in Supabase Auth.
    </p>` : ''}
    <div class="divider"><span>or email</span></div>
    <div class="form">
      <input id="email" type="email" placeholder="Email" autocomplete="email" />
      <input id="password" type="password" placeholder="Password (min 6)" autocomplete="current-password" />
      <button class="btn primary" data-action="signin">Sign In</button>
      <button class="btn secondary" data-action="signup">Create Account</button>
    </div>
    <p id="auth-msg" class="msg"></p>
    <div class="divider"><span>or try instantly</span></div>
    <div class="btn-stack" style="max-width:340px;margin-top:0">
      <button class="btn secondary" data-action="guest">Continue as guest</button>
      <details class="demo-details" style="margin-top:8px;text-align:left">
        <summary class="muted" style="cursor:pointer;font-size:12px;list-style:none;text-align:center">Test accounts</summary>
        <div class="btn-stack" style="margin-top:8px">
          <button class="btn secondary" data-action="demo-free">Demo Free</button>
          <button class="btn secondary" data-action="demo-pro">Demo Pro</button>
        </div>
      </details>
      <button class="btn ghost" data-go="welcome">← Back</button>
    </div>
  </div>`;
}

function renderHome() {
  const stats = getStats();
  const name = currentUser?.email?.split('@')[0] || 'Athlete';
  const freeList = Object.values(WORKOUTS).filter(w => w.free);
  return `<div class="screen fade-in">
    <div class="topbar">
      <div>
        <p class="muted">Ready to Vyrn?</p>
        <h2>${name}</h2>
      </div>
      ${currentUser?.isGuest ? '<span class="badge">Guest</span>' : (isPro ? '<span class="badge pro">Pro</span>' : '')}
    </div>
    <div class="stats mb">
      <div class="stat"><div class="num">${stats.today}</div><div class="lbl">Today</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">All-time</div></div>
    </div>
    <div class="card">
      <h3>Quick start</h3>
      <p class="muted mb">Pick a free session for where you are</p>
      ${freeList.map(w => `
        <button class="list-btn" data-workout="${w.id}">
          ${iconFor(w.title)}
          <span class="list-text"><strong>${w.title}</strong><span class="muted">${w.place} · ${w.durationLabel}</span></span>
          <span class="chev">›</span>
        </button>
      `).join('')}
    </div>
    <button class="btn secondary" data-go="library">Browse all workouts</button>
    ${renderLegalFooter()}
    ${renderTabBar('home')}
  </div>`;
}

function renderLibrary() {
  const places = ['Office', 'Home', 'Playground', 'Anywhere'];
  return `<div class="screen fade-in">
    <div class="topbar"><h2>Workouts</h2></div>
    <p class="muted mb">All sessions work with bodyweight only</p>
    ${places.map(place => {
      const items = Object.values(WORKOUTS).filter(w => w.place === place);
      if (!items.length) return '';
      return `<h3 class="section">${place}</h3>
        <div class="card">
          ${items.map(w => `
            <button class="list-btn" data-workout="${w.id}">
              ${iconFor(w.title)}
              <span class="list-text">
                <strong>${w.title}${!w.free && !isPro ? ' <span class="pro-tag">PRO</span>' : ''}</strong>
                <span class="muted">${w.durationLabel}</span>
              </span>
              <span class="chev">›</span>
            </button>
          `).join('')}
        </div>`;
    }).join('')}
    ${renderLegalFooter()}
    ${renderTabBar('library')}
  </div>`;
}

function renderWorkoutDetail() {
  const w = WORKOUTS[store.get('selectedWorkout')];
  if (!w) return renderLibrary();
  const prev = lastSameWorkout(w.id);
  const locked = !w.free && !isPro;
  return `<div class="screen fade-in">
    <div class="topbar">
      <button class="back" data-go="library">←</button>
      <h2>${w.title}</h2>
    </div>
    <img class="photo-hero" src="${photoUrl(w.title)}" alt="${w.title}" />
    <p class="muted center">${w.place} · ${w.durationLabel}</p>
    <p class="mb center">${w.description}</p>
    ${prev ? `<div class="card highlight">
      <p class="muted">Last time</p>
      <p><strong>${formatTime(prev.duration)}</strong> · ${prev.date}</p>
      <p class="muted" style="font-size:12px">Finish faster to beat your best</p>
    </div>` : '<p class="muted mb center">First time — set your baseline</p>'}
    <div class="exercise-list">
      ${w.exercises.map((e, i) => `
        <div class="ex-item">
          ${iconFor(e.name)}
          <span class="ex-item-text"><strong>${i + 1}. ${e.name}</strong><span class="muted form-line">${formGuideFor(e.name).focus}</span></span>
          <span class="muted">${metaLabel(e)}</span>
        </div>
      `).join('')}
    </div>
    ${renderMusicBar(false)}
    ${locked
      ? `<button class="btn primary" data-action="upgrade">Unlock with Pro</button>
         <p class="muted center mt">Pro unlocks full library + longer history</p>`
      : `<button class="btn primary" data-action="start-session">Start</button>`}
  </div>`;
}

function renderWorkoutRun() {
  const w = activeWorkout;
  if (!w) return renderHome();
  const ex = w.exercises[exerciseIndex];
  const total = w.exercises.length;
  const meta = exerciseMeta(ex);
  const label = phase === 'work' ? (ex?.name || '') : phase === 'rest' ? 'Rest' : phase === 'done' ? 'Session complete' : 'Get ready';
  const mediaName = ex?.name || w.title;
  let stageMedia;
  if (phase === 'done') {
    stageMedia = '<div class="ex-done-mark">✓</div>';
  } else if (phase === 'rest') {
    const next = w.exercises[exerciseIndex + 1];
    const nr = next ? inferReps(next.name) : null;
    const nextHint = next ? `<p class="rest-next">Up next · ${next.name}${nr ? ' · ' + nr + ' reps' : ''}</p>` : '';
    stageMedia = `<div class="rest-card" role="img" aria-label="Rest">
      <div class="rest-icon">◉</div>
      <p class="rest-title">Rest</p>
      <p class="rest-sub">Shake out · breathe · reset</p>
      ${nextHint}
    </div>`;
  } else {
    stageMedia = wgDemoHtml(ex?.name || mediaName);
  }
  const pct = ((exerciseIndex + (phase === 'rest' ? 0.5 : phase === 'done' ? 1 : 0)) / total) * 100;
  const targetChip = (phase === 'work' || phase === 'ready')
    ? (meta.reps
        ? `<div class="target-chip"><span class="target-reps">${meta.reps} reps</span><span class="target-sep">·</span><span class="target-time">${meta.duration}s cap</span></div>`
        : `<div class="target-chip"><span class="target-time">Hold · ${meta.duration}s</span></div>`)
    : '';
  return `<div class="screen center workout-focus fade-in phase-${phase}">
    <p class="muted">${w.title} · ${Math.min(exerciseIndex + 1, total)}/${total}</p>
    <div class="ex-stage ${phase}">
      ${stageMedia}
    </div>
    <div class="timer-display big${phaseSeconds <= 5 && phase !== 'ready' && phase !== 'done' ? ' urgent' : ''}" id="phase-timer">${formatTime(phaseSeconds)}</div>
    <h2 id="phase-label">${label}</h2>
    ${targetChip}
    ${
      phase === 'ready' || phase === 'work'
        ? formStepsHtml(ex?.name || mediaName)
        : phase === 'rest'
          ? '<p class="form-focus rest-cue">Rest · shake out · breathe</p>'
          : phase === 'done'
            ? '<p class="form-focus rest-cue">Nice work — form over speed</p>'
            : ''
    }
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    ${phase === 'ready' ? renderMusicBar(true) : ''}
    <div class="btn-stack">
      ${phase === 'ready' ? `<button class="btn primary" data-action="begin-timer">Begin</button>` : ''}
      ${phase === 'done' ? `<button class="btn primary" data-action="save-session">Save & finish</button>` : ''}
      ${phase !== 'done' && phase !== 'ready' ? `<button class="btn ghost" data-action="skip-phase">Skip</button>` : ''}
      <button class="btn ghost" data-action="abort-session">Quit</button>
    </div>
  </div>`;
}

function renderHistory() {
  const history = getHistory().slice().reverse();
  const byDate = {};
  history.forEach(h => {
    if (!byDate[h.date]) byDate[h.date] = [];
    byDate[h.date].push(h);
  });
  const dates = Object.keys(byDate);
  return `<div class="screen fade-in">
    <div class="topbar"><h2>History</h2></div>
    ${!currentUser || currentUser.isGuest
      ? `<p class="muted mb">Guest data stays on this device. <a href="#" data-go="login" style="color:#ff3b2f">Sign in</a> to sync.</p>`
      : `<p class="muted mb">Signed in — cloud sync when available</p>`}
    ${dates.length === 0
      ? `<div class="card"><p class="muted center">No sessions yet. Complete a workout to see it here.</p></div>`
      : dates.map(date => `
        <h3 class="section">${date === todayKey() ? 'Today' : date}</h3>
        ${byDate[date].map(h => {
          const prev = getHistory().filter(x => x.workoutId === h.workoutId && x.at < h.at).pop();
          let cmp = '';
          if (prev) {
            const diff = h.duration - prev.duration;
            if (diff < 0) cmp = `<span class="better">−${formatTime(Math.abs(diff))} vs last</span>`;
            else if (diff > 0) cmp = `<span class="slower">+${formatTime(diff)} vs last</span>`;
            else cmp = `<span class="muted">Same as last</span>`;
          }
          return `<div class="card tight-pad">
            <div class="lb-row" style="border:none;padding:4px 0">
              <span class="ex-ico-sm">${iconFor(h.title)}</span>
              <span class="name"><strong>${h.title}</strong><br><span class="muted">${formatTime(h.duration)}</span></span>
              <span>${cmp}</span>
            </div>
          </div>`;
        }).join('')}
      `).join('')}
    ${renderLegalFooter()}
    ${renderTabBar('history')}
  </div>`;
}

function renderChallenge() {
  const signed = isSignedIn();
  const list = socialCache.challenges || [];
  const mine = socialCache.mine || [];
  const activity = (socialCache.activity || []).slice(0, 8);
  const freeWorkouts = Object.values(WORKOUTS).filter(w => w.free).slice(0, 8);

  return `<div class="screen fade-in">
    <div class="topbar"><h2>Community</h2></div>
    <p class="muted mb">Friends challenges · share a code · climb the board. Honor system.</p>

    ${!signed ? `<div class="card highlight mb">
      <p><strong>Sign in to create or join</strong></p>
      <p class="muted">Cloud challenges need an account (email or Google).</p>
      <button class="btn primary" data-go="login">Sign in</button>
    </div>` : ''}

    ${pendingJoinCode ? `<div class="card highlight mb">
      <p>Invite code waiting: <strong>${pendingJoinCode}</strong></p>
      ${signed
        ? `<button class="btn primary" data-action="join-pending">Join now</button>`
        : `<button class="btn primary" data-go="login">Sign in to join</button>`}
    </div>` : ''}

    <div class="card mb">
      <h3>Join with code</h3>
      <div class="join-row">
        <input id="join-code" class="input" placeholder="e.g. 1B498EF4" maxlength="12" value="" />
        <button class="btn primary" data-action="join-code" ${signed?'':'disabled'}>Join</button>
      </div>
    </div>

    <div class="card mb">
      <h3>Create friends challenge</h3>
      <p class="muted mb" style="font-size:13px">Pick a workout, get a share link, invite friends.</p>
      <label class="muted" style="font-size:12px">Workout</label>
      <select id="create-workout" class="input mb">
        ${(isPro ? Object.values(WORKOUTS) : freeWorkouts).map(w => `<option value="${w.id}">${w.title} · ${w.durationLabel}${!w.free ? ' · Pro' : ''}</option>`).join('')}
      </select>
      <label class="muted" style="font-size:12px">Days open</label>
      <select id="create-days" class="input mb">
        <option value="3">3 days</option>
        <option value="7" selected>7 days</option>
        <option value="14">14 days</option>
      </select>
      <button class="btn primary" data-action="create-challenge" ${signed?'':'disabled'} style="width:100%">Create & get link</button>
    </div>

    ${mine.length ? `<h3 class="mb">Your challenges</h3>
      <div class="list mb">${mine.map(c => `
        <button class="list-row" data-action="open-challenge" data-id="${c.id}">
          <span class="list-text">
            <strong>${c.title}</strong>
            <span class="muted">${c.kind || 'public'} · code ${c.invite_code || '—'}</span>
          </span>
          <span class="chev">›</span>
        </button>`).join('')}
      </div>` : ''}

    <h3 class="mb">Open challenges</h3>
    <div class="list mb">
      ${list.length ? list.map(c => `
        <button class="list-row" data-action="open-challenge" data-id="${c.id}">
          <span class="list-text">
            <strong>${c.title}</strong>
            <span class="muted">${c.kind || 'public'} · ends ${new Date(c.end_date).toLocaleDateString()}</span>
          </span>
          <span class="chev">›</span>
        </button>`).join('') : '<p class="muted">No active challenges yet — create one.</p>'}
    </div>

    <h3 class="mb">Activity</h3>
    <div class="activity-feed mb">
      ${activity.length ? activity.map(a => {
        const f = formatActivity(a);
        return `<div class="activity-row"><span class="activity-icon">${f.icon}</span><div><p>${f.text}</p><p class="muted" style="font-size:11px">${f.when}</p></div></div>`;
      }).join('') : '<p class="muted">Finish a workout or join a challenge to see activity.</p>'}
    </div>
    ${renderTabBar('challenge')}
  </div>`;
}

function renderChallengeDetail() {
  const c = socialCache.activeChallenge;
  if (!c) return renderChallenge();
  const board = socialCache.board || [];
  const signed = isSignedIn();
  const link = c.invite_code ? inviteLink(c.invite_code) : '';
  const now = Date.now();
  const end = c.end_date ? new Date(c.end_date).getTime() : 0;
  const start = c.start_date ? new Date(c.start_date).getTime() : 0;
  const expired = end && now > end;
  const notStarted = start && now < start;
  const daysLeft = end ? Math.max(0, Math.ceil((end - now) / 86400000)) : null;
  const myRow = board.find(r => r.user_id === currentUser?.id);
  const entries = board.length;
  const statusLine = expired
    ? 'Closed'
    : notStarted
      ? 'Starts ' + new Date(c.start_date).toLocaleDateString()
      : (daysLeft != null ? (daysLeft === 0 ? 'Ends today' : daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + ' left') : 'Open');
  const workoutMeta = c.workout_id && WORKOUTS[c.workout_id] ? WORKOUTS[c.workout_id] : null;
  return `<div class="screen fade-in">
    <div class="topbar">
      <button class="back" data-go="challenge">←</button>
      <h2>${c.title}</h2>
    </div>
    <div class="stats mb">
      <div class="stat"><div class="num" style="font-size:16px">${statusLine}</div><div class="lbl">Status</div></div>
      <div class="stat"><div class="num">${entries}</div><div class="lbl">Entries</div></div>
      <div class="stat"><div class="num">${myRow ? '#' + myRow.rank : '—'}</div><div class="lbl">Your rank</div></div>
    </div>
    <p class="muted mb">${c.description || 'Friends challenge · best time wins · honor system.'}</p>
    ${myRow ? `<div class="card highlight mb"><p><strong>Your best</strong> · ${formatTime(myRow.score_seconds)}</p>
      <p class="muted" style="font-size:12px">Only faster times replace your score.</p></div>` : ''}
    <div class="card mb">
      <p class="muted" style="font-size:12px">Invite code</p>
      <p><strong style="letter-spacing:0.12em;font-size:1.25rem">${c.invite_code || '—'}</strong></p>
      ${c.end_date ? `<p class="muted" style="font-size:12px">Ends ${new Date(c.end_date).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>` : ''}
      ${workoutMeta ? `<p class="muted" style="font-size:12px">Based on ${workoutMeta.title} · ${workoutMeta.durationLabel} · ${workoutMeta.place}</p>` : ''}
      ${link ? `<p class="muted" style="font-size:11px;word-break:break-all;margin-top:8px">${link}</p>
      <div class="btn-stack" style="margin-top:8px">
        <button class="btn secondary" data-action="copy-invite">Copy link</button>
        <button class="btn secondary" data-action="share-invite">Share</button>
        <button class="btn ghost" data-action="copy-code">Copy code</button>
      </div>` : ''}
    </div>
    <div class="card mb">
      <h3>Rules</h3>
      <ul class="muted" style="font-size:13px;padding-left:18px;line-height:1.5">
        <li>Complete the full circuit in one run</li>
        <li>Lower total time ranks higher</li>
        <li>Friends honor system — race fair</li>
        <li>You can re-race; only your best time counts</li>
      </ul>
    </div>
    <div class="card mb">
      <h3>Circuit</h3>
      ${(c.exercise_list || []).map((e, i) =>
        `<div class="ex-item"><span class="ex-item-text"><strong>${i + 1}. ${e.name}</strong></span>
         <span class="muted">${e.reps ? e.reps + ' reps' : ((e.duration_seconds || e.duration || '') + 's')}</span></div>`
      ).join('') || '<p class="muted">No exercises listed.</p>'}
    </div>
    <div class="card mb">
      <h3>Leaderboard</h3>
      <p class="muted mb" style="font-size:12px">Best time · lower is better</p>
      ${board.length ? board.map(r => `
        <div class="board-row ${r.user_id === currentUser?.id ? 'me' : ''}">
          <span class="board-rank">#${r.rank}</span>
          <span class="board-name">${r.name}${r.user_id === currentUser?.id ? ' · you' : ''}</span>
          <span class="board-score">${formatTime(r.score_seconds)}</span>
        </div>`).join('') : '<p class="muted">No times yet — be first.</p>'}
    </div>
    <div class="btn-stack">
      <button class="btn primary" data-action="run-challenge" ${signed && !expired ? '' : 'disabled'}>${expired ? 'Challenge closed' : (myRow ? 'Race again' : 'Race it')}</button>
      <button class="btn ghost" data-go="challenge">Back</button>
    </div>
  </div>`;
}

function renderChallengeRun() {
  const c = socialCache.activeChallenge || DEFAULT_CHALLENGE;
  const list = c.exercise_list || DEFAULT_CHALLENGE.exercises || [];
  return `<div class="screen center fade-in">
    <p class="muted">${c.title}</p>
    <div class="timer-display big" id="c-timer">00:00</div>
    <p class="muted mb">Tap start, finish the circuit, submit your time.</p>
    <div class="exercise-list mb">
      ${list.map(e =>
        `<div class="ex-item"><span class="ex-item-text"><strong>${e.name}</strong></span>
         <span class="muted">${e.reps ? e.reps + ' reps' : (e.duration_seconds || e.duration || '') + 's'}</span></div>`
      ).join('')}
    </div>
    <div class="btn-stack">
      <button class="btn primary" id="c-toggle" data-action="toggle-challenge">Start Timer</button>
      <button class="btn secondary hidden" id="c-finish" data-action="finish-challenge">Submit Time</button>
      <button class="btn ghost" data-action="open-challenge" data-id="${c.id || ''}">Cancel</button>
    </div>
  </div>`;
}

function renderProfile() {
  const stats = getStats();
  const signed = isSignedIn();
  const lastSync = store.get('lastSyncAt');
  const syncLabel = signed
    ? (lastSync ? 'Synced · ' + new Date(lastSync).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Signed in · sync on')
    : 'Local only · sign in to sync across devices';
  return `<div class="screen fade-in">
    <div class="center mb">
      <div class="avatar">${(currentUser?.email?.[0] || 'V').toUpperCase()}</div>
      <p class="muted">${currentUser?.email || 'Guest'}</p>
      <p class="muted" style="font-size:12px">${syncLabel}</p>
    </div>
    <div class="card">
      <h3>${isPro ? 'Pro' : 'Free'} plan</h3>
      <p class="muted mb">${isPro
        ? 'Full library, cloud history, comparisons, and friends challenges.'
        : 'Free: guided workouts + history on this device. Pro ($7/mo): full library, sync, challenges + more.'}</p>
      ${!isPro
        ? `<button class="btn primary" data-action="upgrade">Upgrade to Pro — $7/mo</button>`
        : `<button class="btn ghost" data-action="downgrade">Manage (demo: switch to Free)</button>`}
      ${signed ? `<button class="btn secondary mt" data-action="sync-now" style="width:100%;margin-top:8px">Sync now</button>` : ''}
    </div>
    <div class="card">
      <h3>Coach</h3>
      <p class="muted mb" style="font-size:13px">Pick your trainer. Cues stay loud, clear, and fired up.</p>
      <div class="trainer-pick">
        <button type="button" class="trainer-btn ${trainerGender==='female'?'active':''}" data-action="set-trainer" data-gender="female">
          <span class="trainer-emoji">♀</span>
          <span>Female</span>
        </button>
        <button type="button" class="trainer-btn ${trainerGender==='male'?'active':''}" data-action="set-trainer" data-gender="male">
          <span class="trainer-emoji">♂</span>
          <span>Male</span>
        </button>
      </div>
      <button type="button" class="btn secondary mt" data-action="preview-coach" style="width:100%">Preview coach voice</button>
      <div class="toggle-row mt">
        <span>Voice coaching</span>
        <button class="toggle ${voiceEnabled?'on':''}" data-action="toggle-voice">${voiceEnabled?'On':'Off'}</button>
      </div>
      <div class="toggle-row">
        <span>Sound effects</span>
        <button class="toggle ${sfxEnabled?'on':''}" data-action="toggle-sfx">${sfxEnabled?'On':'Off'}</button>
      </div>
      <p class="muted" style="margin-top:12px;font-size:13px">Music: use Spotify or Apple Music in the background.</p>
      <div class="music-actions" style="margin-top:10px">
        <a class="btn secondary music-link" href="https://open.spotify.com/search/workout%20focus" target="_blank" rel="noopener">Spotify</a>
        <a class="btn secondary music-link" href="https://music.apple.com/search?term=workout" target="_blank" rel="noopener">Apple Music</a>
      </div>
    </div>
    <div class="stats mt">
      <div class="stat"><div class="num">${stats.total}</div><div class="lbl">Sessions</div></div>
      <div class="stat"><div class="num">${stats.streak}</div><div class="lbl">Streak</div></div>
    </div>
    <button class="btn ghost mt" data-go="challenge">Weekly Challenge</button>
    <button class="btn ghost" data-action="signout">Sign Out</button>
    ${renderLegalFooter()}
    ${renderTabBar('profile')}
  </div>`;
}

function bindEvents() {
  $all('[data-go]').forEach(el => el.onclick = (e) => { e.preventDefault(); navigate(el.dataset.go); });
  $all('[data-action]').forEach(el => el.onclick = () => handleAction(el.dataset.action, el));
  $all('[data-workout]').forEach(el => el.onclick = () => {
    store.set('selectedWorkout', el.dataset.workout);
    navigate('workoutDetail');
  });
}

function startPhaseTimer() {
  clearInterval(tickTimer);
  _lastCoachFive = false;
  tickTimer = setInterval(() => {
    phaseSeconds--;
    totalSeconds++;
    const el = $('#phase-timer');
    if (el) {
      el.textContent = formatTime(Math.max(0, phaseSeconds));
      if (phaseSeconds <= 5 && phase !== 'ready' && phase !== 'done') el.classList.add('urgent');
      else el.classList.remove('urgent');
    }
    if (phase === 'work' && phaseSeconds === 5 && !_lastCoachFive) {
      _lastCoachFive = true;
      speak(coachLine('five'));
    }
    if (phaseSeconds === 3 || phaseSeconds === 2 || phaseSeconds === 1) sfxTick();
    if (phaseSeconds <= 0) advancePhase();
  }, 1000);
}

function advancePhase() {
  clearInterval(tickTimer);
  const w = activeWorkout;
  if (!w) return;

  if (phase === 'work') {
    const rest = w.exercises[exerciseIndex]?.rest || 0;
    if (rest > 0) {
      phase = 'rest';
      phaseSeconds = rest;
      sfxRest();
      speakRest();
      render();
      startPhaseTimer();
      return;
    }
  }

  if (phase === 'work' || phase === 'rest') {
    exerciseIndex++;
    if (exerciseIndex >= w.exercises.length) {
      phase = 'done';
      sfxDone();
      speakDone();
      render();
      return;
    }
    phase = 'work';
    phaseSeconds = w.exercises[exerciseIndex].duration;
    sfxStart();
    speakExerciseStart(w.exercises[exerciseIndex]);
    render();
    startPhaseTimer();
  }
}

async function handleAction(action, el) {
  el = el || document.querySelector(`[data-action="${action}"]`);
  const msg = $('#auth-msg');

  if (action === 'guest') {
    store.set('guest', { email: 'guest@vyrn.app', id: 'guest' });
    currentUser = { id: 'guest', email: 'guest@vyrn.app', isGuest: true };
    isPro = false; store.set('isPro', false);
    navigate('home');
    return;
  }
  if (action === 'demo-free') {
    store.set('guest', { email: 'free@vyrn.demo', id: 'demo-free' });
    currentUser = { id: 'demo-free', email: 'free@vyrn.demo', isGuest: true };
    isPro = false; store.set('isPro', false);
    navigate('home');
    return;
  }
  if (action === 'demo-pro') {
    store.set('guest', { email: 'pro@vyrn.demo', id: 'demo-pro' });
    currentUser = { id: 'demo-pro', email: 'pro@vyrn.demo', isGuest: true };
    isPro = true; store.set('isPro', true);
    navigate('home');
    return;
  }
  if (action === 'demo-pro2') {
    store.set('guest', { email: 'pro2@vyrn.demo', id: 'demo-pro-2' });
    currentUser = { id: 'demo-pro-2', email: 'pro2@vyrn.demo', isGuest: true };
    isPro = true; store.set('isPro', true);
    navigate('home');
    return;
  }

  if (action === 'oauth-google' || action === 'oauth-apple') {
    const provider = action === 'oauth-google' ? 'google' : 'apple';
    const label = provider === 'google' ? 'Google' : 'Apple';
    if (!supabaseClient) {
      if (msg) msg.textContent = 'Auth unavailable. Use email or Demo.';
      return;
    }
    if (provider === 'google' && !authProviders.google) {
      if (msg) msg.textContent = 'Google is not enabled in Supabase Auth yet. Use email (pro1@vyrn.test) or enable Google in the dashboard.';
      return;
    }
    if (provider === 'apple' && !authProviders.apple) {
      if (msg) msg.textContent = 'Apple is not enabled in Supabase Auth yet. Use email or enable Apple in the dashboard (requires Apple Developer account).';
      return;
    }
    if (msg) msg.textContent = 'Redirecting to ' + label + '…';
    try {
      const redirectTo = window.location.origin + '/?app=1';
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: false,
          queryParams: provider === 'google' ? { access_type: 'offline', prompt: 'select_account' } : undefined
        }
      });
      if (error) throw error;
      // Fallback if client did not navigate
      if (data && data.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      const hint = (e && e.message) ? e.message : 'Provider error';
      if (msg) msg.textContent = hint + ' — enable ' + label + ' under Supabase → Authentication → Providers, and add redirect URL: ' + window.location.origin + '/?app=1';
    }
    return;
  }

  if (action === 'signin' || action === 'signup') {
    const email = $('#email')?.value?.trim();
    const password = $('#password')?.value;
    if (!email || !password) { if (msg) msg.textContent = 'Fill in all fields'; return; }
    if (!supabaseClient) {
      store.set('guest', { email });
      currentUser = { id: 'local', email, isGuest: true };
      navigate('home');
      return;
    }
    try {
      if (action === 'signup') {
        const { error } = await supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        if (msg) msg.textContent = 'Check email to confirm, or try Sign In.';
      } else {
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        navigate('home');
      }
    } catch (e) {
      if (msg) msg.textContent = e.message || 'Auth error';
    }
    return;
  }

  if (action === 'signout') {
    if (supabaseClient) await supabaseClient.auth.signOut();
    currentUser = null;
    store.set('guest', null);
    navigate('welcome');
    return;
  }

  if (action === 'sync-now') {
    if (!isSignedIn()) { navigate('login'); return; }
    try {
      const r = await syncNow();
      alert(r.error ? ('Sync issue: ' + r.error) : ('Synced · ' + (r.added || 0) + ' new session' + ((r.added===1)?'':'s') + ' from cloud'));
      render();
    } catch (e) {
      alert(e.message || 'Sync failed');
    }
    return;
  }
  if (action === 'copy-code') {
    const code = socialCache.activeChallenge?.invite_code;
    if (!code) return;
    try { await navigator.clipboard.writeText(code); alert('Code copied: ' + code); }
    catch { alert(code); }
    return;
  }
  if (action === 'upgrade') {
    isPro = true; store.set('isPro', true);
    alert('Pro unlocked (demo). Full library available.');
    render();
    return;
  }
  if (action === 'downgrade') {
    isPro = false; store.set('isPro', false);
    render();
    return;
  }
  if (action === 'set-trainer') {
    const g = el.dataset.gender === 'male' ? 'male' : 'female';
    trainerGender = g;
    store.set('trainerGender', g);
    warmVoices();
    speak(g === 'male'
      ? "Male coach locked in. Let's get after it!"
      : "Female coach locked in. Let's get after it!");
    render();
    return;
  }
  if (action === 'preview-coach') {
    warmVoices();
    speak("Let's go! Twelve push ups. You've got this! Stay strong!");
    return;
  }
  if (action === 'toggle-voice') {
    voiceEnabled = !voiceEnabled;
    store.set('voiceEnabled', voiceEnabled);
    if (voiceEnabled) speak("Voice on. Let's train!");
    render();
    return;
  }
  if (action === 'toggle-sfx') {
    sfxEnabled = !sfxEnabled;
    store.set('sfxEnabled', sfxEnabled);
    if (sfxEnabled) sfxStart();
    render();
    return;
  }


  if (action === 'create-challenge') {
    if (!isSignedIn()) { navigate('login'); return; }
    const workoutId = $('#create-workout')?.value;
    const days = parseInt($('#create-days')?.value || '7', 10);
    try {
      const ch = await createFriendsChallenge({ workoutId, days });
      socialCache.activeChallenge = ch;
      await refreshSocial();
      await loadLeaderboard(ch.id);
      const link = inviteLink(ch.invite_code);
      try { await navigator.clipboard.writeText(link); } catch (_) {}
      alert('Challenge created.\\nCode: ' + ch.invite_code + '\\nLink copied (if allowed):\\n' + link);
      navigate('challengeDetail');
    } catch (e) {
      alert(e.message || 'Could not create challenge');
    }
    return;
  }

  if (action === 'join-code' || action === 'join-pending') {
    if (!isSignedIn()) { navigate('login'); return; }
    const code = action === 'join-pending'
      ? pendingJoinCode
      : ($('#join-code')?.value || '').trim();
    try {
      const ch = await joinChallengeByCode(code);
      pendingJoinCode = null;
      socialCache.activeChallenge = ch;
      await refreshSocial();
      await loadLeaderboard(ch.id);
      alert('Joined ' + ch.title);
      navigate('challengeDetail');
    } catch (e) {
      alert(e.message || 'Join failed');
    }
    return;
  }

  if (action === 'open-challenge') {
    const id = el.dataset.id;
    const ch = (socialCache.challenges || []).find(c => c.id === id)
      || (socialCache.mine || []).find(c => c.id === id)
      || socialCache.activeChallenge;
    if (!ch && id) {
      // fetch one
      if (supabaseClient) {
        const { data } = await supabaseClient.from('challenges').select('*').eq('id', id).maybeSingle();
        socialCache.activeChallenge = data;
      }
    } else {
      socialCache.activeChallenge = ch;
    }
    if (!socialCache.activeChallenge) { navigate('challenge'); return; }
    await loadLeaderboard(socialCache.activeChallenge.id);
    navigate('challengeDetail');
    return;
  }

  if (action === 'copy-invite') {
    const c = socialCache.activeChallenge;
    if (!c?.invite_code) return;
    const link = inviteLink(c.invite_code);
    try {
      await navigator.clipboard.writeText(link);
      alert('Link copied');
    } catch (_) {
      prompt('Copy this link', link);
    }
    return;
  }

  if (action === 'share-invite') {
    const c = socialCache.activeChallenge;
    if (!c?.invite_code) return;
    const link = inviteLink(c.invite_code);
    if (navigator.share) {
      try {
        await navigator.share({ title: c.title, text: 'Join my Vyrn challenge', url: link });
      } catch (_) {}
    } else {
      try {
        await navigator.clipboard.writeText(link);
        alert('Link copied');
      } catch (_) {
        prompt('Share this link', link);
      }
    }
    return;
  }

  if (action === 'run-challenge') {
    if (!isSignedIn()) { navigate('login'); return; }
    window._cRunning = false;
    window._cSec = 0;
    clearInterval(window._cTimer);
    navigate('challengeRun');
    return;
  }

  if (action === 'start-session') {
    const id = store.get('selectedWorkout');
    const w = WORKOUTS[id];
    if (!w) return;
    if (!w.free && !isPro) { handleAction('upgrade'); return; }
    activeWorkout = w;
    exerciseIndex = 0;
    try { preloadWorkoutGuides(activeWorkout, 0, 3); } catch (_) {}
    phase = 'ready';
    phaseSeconds = w.exercises[0].duration;
    totalSeconds = 0;
    navigate('workoutRun');
    setTimeout(() => speakReady(w.exercises[0]), 280);
    return;
  }

  if (action === 'begin-timer') {
    ensureAudio();
    phase = 'work';
    phaseSeconds = activeWorkout.exercises[0].duration;
    totalSeconds = 0;
    sfxStart();
    speakExerciseStart(activeWorkout.exercises[0]);
    startPhaseTimer();
    render();
    return;
  }

  if (action === 'skip-phase') {
    phaseSeconds = 0;
    advancePhase();
    return;
  }

  if (action === 'abort-session') {
    clearInterval(tickTimer);
    window.speechSynthesis?.cancel();
    activeWorkout = null;
    navigate('home');
    return;
  }

  if (action === 'save-session') {
    clearInterval(tickTimer);
    const w = activeWorkout;
    const session = {
      workoutId: w.id,
      title: w.title,
      duration: totalSeconds,
      date: todayKey(),
      at: Date.now(),
      exercises: w.exercises.map(e => {
        const m = exerciseMeta(e);
        return { name: m.name, duration: m.duration, reps: m.reps };
      }),
      totalReps: w.exercises.reduce((sum, e) => sum + (exerciseMeta(e).reps || 0), 0)
    };
    await saveWorkoutSession(session);
    const prev = getHistory().filter(h => h.workoutId === w.id && h.at < session.at).pop();
    let extra = '';
    if (prev) {
      const diff = session.duration - prev.duration;
      if (diff < 0) extra = `\nYou were ${formatTime(Math.abs(diff))} faster than last time.`;
      else if (diff > 0) extra = `\n${formatTime(diff)} slower than last time — still counts.`;
      else extra = '\nMatched your last time.';
    }
    alert(`Saved · ${formatTime(totalSeconds)}${extra}`);
    activeWorkout = null;
    navigate('history');
    return;
  }

  if (action === 'toggle-challenge') {
    if (!window._cRunning) {
      window._cRunning = true;
      window._cSec = 0;
      ensureAudio();
      sfxStart();
      speak("Let's go! Challenge started. Push for your best time!");
      $('#c-toggle').textContent = 'Pause';
      $('#c-finish').classList.remove('hidden');
      window._cTimer = setInterval(() => {
        window._cSec++;
        $('#c-timer').textContent = formatTime(window._cSec);
      }, 1000);
    } else {
      window._cRunning = false;
      clearInterval(window._cTimer);
      $('#c-toggle').textContent = 'Resume';
    }
    return;
  }

  if (action === 'finish-challenge') {
    clearInterval(window._cTimer);
    window._cRunning = false;
    sfxDone();
    const secs = window._cSec || 0;
    const ch = socialCache.activeChallenge;
    if (ch && ch.id && isSignedIn()) {
      try {
        await submitChallengeTime(ch.id, secs);
        speak('Time submitted. Great work!');
        await loadLeaderboard(ch.id);
        alert('Submitted · ' + formatTime(secs));
        navigate('challengeDetail');
      } catch (e) {
        alert(e.message || 'Submit failed — saved locally');
        const entries = store.get('entries') || [];
        entries.push({ user_id: currentUser.id, name: displayName(), score_seconds: secs, at: Date.now(), challenge_id: ch.id });
        store.set('entries', entries);
        navigate('challengeDetail');
      }
      return;
    }
    speak('Time submitted. Great work!');
    const entries = store.get('entries') || [];
    const name = displayName();
    const filtered = entries.filter(e => e.user_id !== (currentUser?.id || 'guest'));
    filtered.push({ user_id: currentUser?.id || 'guest', name, score_seconds: secs, at: Date.now() });
    store.set('entries', filtered);
    alert('Submitted · ' + formatTime(secs));
    navigate('challenge');
    return;
  }
}

document.addEventListener('DOMContentLoaded', init);
