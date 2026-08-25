// Vyrn marketing website (browser only — not standalone PWA)
(function () {
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true ||
    new URLSearchParams(location.search).get('app') === '1';

  if (isStandalone) {
    // Hand off to app — load app shell
    document.documentElement.classList.add('mode-app');
    return;
  }

  document.documentElement.classList.add('mode-web');
  document.addEventListener('DOMContentLoaded', renderSite);

  function renderSite() {
    const root = document.getElementById('app');
    if (!root) return;
    root.innerHTML = `
    <div class="site">
      <div class="site-nav-wrap">
        <header class="site-nav">
          <img src="/assets/logo-mark.png" alt="Vyrn" class="site-nav-logo" />
          <div class="site-nav-links">
            <a href="#workouts">Workouts</a>
            <a href="#how">How it works</a>
            <a class="site-cta" href="/?app=1">Open app</a>
          </div>
        </header>
      </div>

      <div class="site-hero-wrap">
        <section class="site-hero">
          <div class="site-hero-copy">
            <p class="site-eyebrow">Equipment-free fitness</p>
            <h1 class="site-title">Show up.<br/>Put in the work.</h1>
            <p class="site-hero-sub">Training for home, office, and the playground. Timed sessions, history, and weekly challenges — no special gear.</p>
            <div class="site-hero-actions">
              <a class="btn primary" href="/?app=1">Start training</a>
              <a class="btn secondary" href="#workouts">See workouts</a>
            </div>
          </div>
          <img src="/assets/logo.png" alt="Vyrn" class="site-hero-logo" />
        </section>
      </div>

      <section class="site-section" id="workouts">
        <h2>Train anywhere</h2>
        <p class="site-lead">Bodyweight sessions designed for real life — no gym bag required.</p>
        <div class="site-grid">
          <article class="site-card">
            <div class="site-card-visual v-office"></div>
            <h3>Office</h3>
            <p>Quiet resets between meetings. No jumping, no sweat panic.</p>
          </article>
          <article class="site-card">
            <div class="site-card-visual v-home"></div>
            <h3>Home</h3>
            <p>Full body, core, mobility — living-room friendly circuits.</p>
          </article>
          <article class="site-card">
            <div class="site-card-visual v-park"></div>
            <h3>Playground</h3>
            <p>Benches, bars, open space. Take the work outside.</p>
          </article>
        </div>
      </section>

      <section class="site-section" id="how">
        <h2>How it works</h2>
        <div class="site-steps">
          <div><span>1</span><p>Pick a session for where you are</p></div>
          <div><span>2</span><p>Follow timed intervals with voice cues</p></div>
          <div><span>3</span><p>Track history and beat last time</p></div>
        </div>
      </section>

      <section class="site-section site-cta-block">
        <h2>Ready when you are</h2>
        <p class="site-lead">Install as an app on your phone, or open the training experience in the browser.</p>
        <a class="btn primary" href="/?app=1">Launch Vyrn</a>
        <p class="site-hint">On mobile: Share → Add to Home Screen for the full app feel.</p>
      </section>

      <footer class="site-footer">
        <img src="/assets/logo.png" alt="" class="site-footer-logo" />
        <div>
          <a href="/legal/privacy.html">Privacy</a> ·
          <a href="/legal/terms.html">Terms</a> ·
          <a href="/legal/disclaimer.html">Disclaimer</a>
        </div>
        <p>© 2026 Vyrn · Independent original product</p>
        <p class="site-credit">Photos via Unsplash &amp; Pexels (free licenses)</p>
      </footer>
    </div>`;
  }
})();
