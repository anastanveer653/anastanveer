// Anas Tanveer · portfolio interactions. No dependencies. The 3D rack is in rack.js.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const narrow = window.matchMedia('(max-width: 1000px)');

  // ---- nav: background on scroll, mobile menu ----
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  // ---- nav: highlight the section in view ----
  const navLinks = [...links.querySelectorAll('a[href^="#"]')];
  const sections = navLinks.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  // ---- rack steps: the text block crossing the reading line picks the device rack.js pulls out ----
  const steps = [...document.querySelectorAll('.step')];
  let currentStep = null;
  const setStep = (name) => {
    if (name === currentStep) return;
    currentStep = name;
    document.documentElement.dataset.rackStep = name || '';
    steps.forEach((s) => s.classList.toggle('is-active', s.dataset.step === name));
    window.dispatchEvent(new CustomEvent('rack:step', { detail: name }));
  };
  const pickStep = () => {
    // On narrow screens the rack covers the top half, so the reading line sits lower.
    const line = window.innerHeight * (narrow.matches ? 0.74 : 0.5);
    let found = null;
    for (const s of steps) {
      const r = s.getBoundingClientRect();
      if (r.top <= line && r.bottom > line) { found = s.dataset.step; break; }
    }
    if (!found && steps.length && steps[steps.length - 1].getBoundingClientRect().bottom <= line) {
      found = steps[steps.length - 1].dataset.step;
    }
    setStep(found);
  };

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      nav.classList.toggle('is-scrolled', window.scrollY > 12);
      pickStep();
    });
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll);

  // ---- rack: if the 3D scene has not started after a while (blocked script, slow network), show the still image ----
  const rack = document.getElementById('rack');
  if (rack) setTimeout(() => { if (!rack.classList.contains('is-live')) rack.classList.add('is-static'); }, 6000);

  // ---- reveal on scroll ----
  const reveals = document.querySelectorAll('.reveal');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-visible'));
  } else {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach((el) => io.observe(el));
  }

  // ---- tilt: the pass and the project screenshots lean towards the pointer ----
  if (!reduceMotion && finePointer) {
    document.querySelectorAll('[data-tilt]').forEach((el) => {
      const max = Number(el.dataset.tilt) || 6;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        el.style.setProperty('--ry', `${(x * max * 2).toFixed(2)}deg`);
        el.style.setProperty('--rx', `${(-y * max * 2).toFixed(2)}deg`);
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  // ---- contact: copy email ----
  const copyBtn = document.getElementById('copy-email');
  if (copyBtn && navigator.clipboard) {
    const label = copyBtn.querySelector('span');
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(copyBtn.dataset.email);
        label.textContent = 'Copied!';
      } catch {
        label.textContent = copyBtn.dataset.email;
      }
      setTimeout(() => { label.textContent = 'Copy email'; }, 2000);
    });
  } else if (copyBtn) {
    copyBtn.hidden = true;
  }

  // ---- hero: show "Download CV" only if the PDF is actually deployed ----
  const cvBtn = document.getElementById('cv-btn');
  if (cvBtn) {
    fetch(cvBtn.getAttribute('href'), { method: 'HEAD' })
      .then((res) => {
        const type = res.headers.get('content-type') || '';
        if (res.ok && type.includes('pdf')) cvBtn.hidden = false;
      })
      .catch(() => {});
  }

  // ---- footer year ----
  const year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();
