// Anas Tanveer · portfolio interactions. No dependencies.
(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- nav: background on scroll, mobile menu ----
  const nav = document.querySelector('.nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

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
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 3) * 80}ms`;
      io.observe(el);
    });
  }

  // ---- stats: count up once visible ----
  const counters = document.querySelectorAll('[data-count]');
  if (!reduceMotion) {
    const countIo = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = Number(el.dataset.count);
        const start = performance.now();
        const step = (now) => {
          const t = Math.min((now - start) / 1200, 1);
          el.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
          if (t < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
        countIo.unobserve(el);
      });
    }, { threshold: 0.6 });
    counters.forEach((el) => countIo.observe(el));
  }

  // ---- hero: typing role rotator ----
  const rotator = document.getElementById('rotator');
  const roles = [
    'IT Infrastructure Engineer',
    'Windows Server & AD admin',
    'Cisco network engineer',
    'VoIP & data-center specialist',
    'automation engineer',
    '.NET & SQL Server developer',
  ];
  if (rotator && !reduceMotion) {
    let role = 0;
    let chars = roles[0].length;
    let deleting = true;
    const tick = () => {
      const word = roles[role];
      chars += deleting ? -1 : 1;
      rotator.textContent = word.slice(0, chars);
      let delay = deleting ? 38 : 70;
      if (!deleting && chars === word.length) { deleting = true; delay = 2200; }
      else if (deleting && chars === 0) { deleting = false; role = (role + 1) % roles.length; delay = 300; }
      setTimeout(tick, delay);
    };
    setTimeout(tick, 2600);
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
