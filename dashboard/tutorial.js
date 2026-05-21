// ============================================================
// Onboarding tutorial — spotlight overlay
// ============================================================
(function () {
  const LS_TUTORIAL_OFF = 'xhistory_tutorial_off';
  const LS_TUTORIAL_DONE = 'xhistory_tutorial_done';
  const LS_BRAND_UNLOCK = 'xhistory_brand_unlocked';

  const STEPS = [
    {
      id: 'welcome',
      title: 'Welcome to 𝕏 Multiplayer',
      body: 'Your 𝕏 History tracker is now 𝕏 Multiplayer — a cleaner, more professional dashboard for tracking what you see and sharing feeds with others.',
      target: '.header-logo',
      before: () => window.applyXTheme?.(),
    },
    {
      id: 'multiplayer-tab',
      title: 'Multiplayer',
      body: 'Open the Multiplayer tab to connect with someone else and browse side by side.',
      target: '[data-page="multiplayer"]',
      tab: 'multiplayer',
    },
    {
      id: 'conn-settings',
      title: 'Connection Settings',
      body: 'This is where you choose how to add multiplayer. You and whoever you invite — using your chosen relay option — will see each other\'s seen posts side by side: share, track, and discuss.',
      target: '#connSettingsToggle',
      tab: 'multiplayer',
      expandConn: true,
      cardCenter: true,
    },
    {
      id: 'partykit',
      title: 'PartyKit (recommended)',
      body: 'Turn on PartyKit for cross-internet multiplayer (free after deploy). Or leave all relays OFF — you can still track your own seen posts without multiplayer.',
      target: '[data-relay="partykit"]',
      tab: 'multiplayer',
      expandConn: true,
      cardCenter: true,
    },
    {
      id: 'raindrop',
      title: 'Raindrop bookmarks',
      body: 'Even without multiplayer, your seen posts are powerful. Send them to Raindrop.io for bookmarking, collections, and sync — API keys stay on your machine only.',
      target: '#raindropPage .rd-banner',
      tab: 'raindrop',
      cardCenter: true,
    },
    {
      id: 'source',
      title: 'Source code & API keys',
      body: 'Fork and edit the project on GitHub. Clone again anytime for updates. Open PRs freely. API keys are never in the repo — they live in your browser localStorage. Prefer not to paste keys locally? Try Infisical for secrets management.',
      target: '#sourceCodeCta',
      tab: 'multiplayer',
      expandConn: true,
      links: true,
      showPointer: true,
      cardCenter: true,
    },
    {
      id: 'done',
      title: 'You\'re set',
      body: 'Flag posts in multiplayer to discuss them in the shared strip. Use the large Tutorial toggle at the top right anytime to replay this walkthrough.',
      target: '#tutorialMaster',
      cardCenter: true,
    },
  ];

  let stepIndex = 0;
  let active = false;

  function isTutorialOff() {
    return localStorage.getItem(LS_TUTORIAL_OFF) === '1';
  }

  function shouldAutoStart() {
    return !isTutorialOff() && !localStorage.getItem(LS_TUTORIAL_DONE);
  }

  function unlockBrand() {
    if (!localStorage.getItem(LS_BRAND_UNLOCK)) {
      localStorage.setItem(LS_BRAND_UNLOCK, '1');
      window.applyXTheme?.();
    }
  }

  function navigateTab(page) {
    const btn = document.querySelector(`[data-page="${page}"]`);
    if (btn) btn.click();
  }

  function expandConnSettings() {
    const body = document.getElementById('connSettingsBody');
    const arrow = document.getElementById('connSettingsArrow');
    if (body && !body.classList.contains('open')) {
      body.classList.add('open');
      if (arrow) arrow.textContent = '▴ collapse';
    }
  }

  function scrollTargetIntoView(sel) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (el) {
      try {
        el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' });
      } catch {
        el.scrollIntoView(true);
      }
    }
  }

  function getRect(sel) {
    const el = typeof sel === 'string' ? document.querySelector(sel) : sel;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pad = 8;
    return {
      top: Math.max(0, r.top - pad),
      left: Math.max(0, r.left - pad),
      width: r.width + pad * 2,
      height: r.height + pad * 2,
    };
  }

  function renderSpotlight(rect) {
    const spot = document.getElementById('tutorialSpotlight');
    if (!spot) return;
    if (!rect) {
      spot.style.display = 'none';
      return;
    }
    spot.style.display = 'block';
    spot.style.top = `${rect.top}px`;
    spot.style.left = `${rect.left}px`;
    spot.style.width = `${rect.width}px`;
    spot.style.height = `${rect.height}px`;
  }

  function renderStep() {
    const step = STEPS[stepIndex];
    const title = document.getElementById('tutorialTitle');
    const body = document.getElementById('tutorialBody');
    const counter = document.getElementById('tutorialCounter');
    const links = document.getElementById('tutorialLinks');
    const nextBtn = document.getElementById('tutorialNext');
    const skipBtn = document.getElementById('tutorialSkip');

    if (title) title.textContent = step.title;
    if (body) body.textContent = step.body;
    if (counter) counter.textContent = `${stepIndex + 1} / ${STEPS.length}`;
    if (nextBtn) nextBtn.textContent = stepIndex === STEPS.length - 1 ? 'Finish' : 'Next';
    if (skipBtn) skipBtn.style.display = stepIndex === STEPS.length - 1 ? 'none' : 'inline-block';

    if (links) {
      links.innerHTML = step.links
        ? `<a href="https://github.com/jimbrend/XMultiplayer" target="_blank" rel="noopener">GitHub source ↗</a>
           <a href="https://infisical.com" target="_blank" rel="noopener">Infisical ↗</a>`
        : '';
      links.style.display = step.links ? 'flex' : 'none';
    }

    step.before?.();
    if (step.tab) navigateTab(step.tab);
    if (step.expandConn) setTimeout(expandConnSettings, 120);

    const delay = step.tab || step.expandConn ? 320 : 80;
    setTimeout(() => {
      if (step.target) scrollTargetIntoView(step.target);
      setTimeout(() => {
        const rect = step.target ? getRect(step.target) : null;
        renderSpotlight(rect);
        positionCard(rect, step);
        positionPointer(rect, step.showPointer && !step.cardCenter);
        requestAnimationFrame(() => positionCard(rect, step));
      }, step.expandConn ? 180 : 40);
    }, delay);
  }

  function positionPointer(rect, show) {
    const ptr = document.getElementById('tutorialPointer');
    if (!ptr) return;
    if (!show || !rect) {
      ptr.style.display = 'none';
      return;
    }
    ptr.style.display = 'block';
    ptr.style.left = `${rect.left + rect.width / 2 - 10}px`;
    ptr.style.top = `${rect.top - 18}px`;
  }

  function positionCard(rect, step) {
    const card = document.getElementById('tutorialCard');
    if (!card) return;

    const margin = 24;
    const cardW = Math.min(400, window.innerWidth - margin * 2);
    const cardH = card.offsetHeight || 260;

    const forceCenter = step?.cardCenter || !rect;
    const rectTooTall = rect && rect.height > window.innerHeight * 0.32;
    const wouldClipBelow = rect && rect.top + rect.height + cardH + 32 > window.innerHeight - margin;
    const wouldClipAbove = rect && rect.top - cardH - 32 < margin;
    const useCenter = forceCenter || rectTooTall || wouldClipBelow || wouldClipAbove;

    card.classList.toggle('tutorial-card-centered', useCenter);

    if (useCenter) {
      card.style.top = '50%';
      card.style.left = '50%';
      card.style.right = 'auto';
      card.style.bottom = 'auto';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    card.style.transform = 'none';
    const spaceBelow = window.innerHeight - (rect.top + rect.height);
    let top;
    let left = Math.max(margin, Math.min(rect.left, window.innerWidth - cardW - margin));

    if (spaceBelow >= cardH + 24) {
      top = rect.top + rect.height + 16;
    } else {
      top = Math.max(margin, rect.top - cardH - 16);
    }

    top = Math.max(margin, Math.min(top, window.innerHeight - cardH - margin));
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  }

  function showOverlay() {
    document.getElementById('tutorialOverlay')?.classList.add('active');
    document.body.classList.add('tutorial-active');
    active = true;
    updateToggleUi();
  }

  function hideOverlay(markDone) {
    document.getElementById('tutorialOverlay')?.classList.remove('active');
    document.body.classList.remove('tutorial-active');
    renderSpotlight(null);
    const ptr = document.getElementById('tutorialPointer');
    if (ptr) ptr.style.display = 'none';
    active = false;
    updateToggleUi();
    if (markDone) localStorage.setItem(LS_TUTORIAL_DONE, '1');
  }

  function updateToggleUi() {
    const sw = document.getElementById('tutorialSwitch');
    const master = document.getElementById('tutorialMaster');
    if (sw) sw.checked = active;
    if (master) {
      master.title = active
        ? 'Turn tutorial off'
        : isTutorialOff()
          ? 'Tutorial disabled — turn on to start walkthrough'
          : 'Turn tutorial on to start walkthrough';
    }
  }

  function start(fromStep = 0) {
    if (isTutorialOff()) return;
    unlockBrand();
    stepIndex = fromStep;
    showOverlay();
    renderStep();
  }

  function next() {
    if (stepIndex >= STEPS.length - 1) {
      hideOverlay(true);
      return;
    }
    stepIndex += 1;
    renderStep();
  }

  function prev() {
    if (stepIndex > 0) {
      stepIndex -= 1;
      renderStep();
    }
  }

  function skip() {
    hideOverlay(true);
  }

  function setTutorialEnabled(on) {
    if (on) {
      localStorage.removeItem(LS_TUTORIAL_OFF);
      updateToggleUi();
      start(0);
    } else {
      localStorage.setItem(LS_TUTORIAL_OFF, '1');
      hideOverlay(false);
      updateToggleUi();
    }
  }

  function onTutorialSwitchChange(checked) {
    if (checked) {
      localStorage.removeItem(LS_TUTORIAL_OFF);
      if (!active) start(0);
    } else {
      if (active) hideOverlay(false);
      else localStorage.setItem(LS_TUTORIAL_OFF, '1');
      updateToggleUi();
    }
  }

  function init() {
    const overlay = document.getElementById('tutorialOverlay');
    if (!overlay) return;

    document.getElementById('tutorialNext')?.addEventListener('click', next);
    document.getElementById('tutorialPrev')?.addEventListener('click', prev);
    document.getElementById('tutorialSkip')?.addEventListener('click', skip);
    document.getElementById('tutorialClose')?.addEventListener('click', () => hideOverlay(true));
    document.getElementById('tutorialSwitch')?.addEventListener('change', (e) => {
      onTutorialSwitchChange(e.target.checked);
    });

    document.getElementById('tutorialMaster')?.addEventListener('click', (e) => {
      if (e.target.closest('#tutorialSwitchLabel') || e.target.id === 'tutorialSwitch') return;
      const sw = document.getElementById('tutorialSwitch');
      if (sw) {
        sw.checked = !sw.checked;
        onTutorialSwitchChange(sw.checked);
      }
    });

    window.addEventListener('resize', () => {
      if (active) renderStep();
    });

    if (localStorage.getItem(LS_BRAND_UNLOCK)) {
      window.applyXTheme?.();
    }

    updateToggleUi();

    if (shouldAutoStart()) {
      setTimeout(() => start(0), 600);
    }
  }

  window.XTutorial = { init, start, toggleTutorial, setTutorialEnabled, unlockBrand };
})();
