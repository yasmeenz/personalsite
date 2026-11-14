/* Presentation behaviour: entrance, navigation, reveal, counters, rotator,
   hero interaction, tabs, footer year. No data access here. */
import { reduceMotion, finePointer } from '../lib/motion.js';

export function initEntrance() {
  const markLoaded = () => requestAnimationFrame(() => document.body.classList.add('is-loaded'));
  const heroImg = document.querySelector('.portrait img');
  if (heroImg && !heroImg.complete) {
    heroImg.addEventListener('load', markLoaded, { once: true });
    heroImg.addEventListener('error', markLoaded, { once: true });
    setTimeout(markLoaded, 2500); // never hold the page hostage
  } else {
    markLoaded();
  }
}

export function initNav() {
  const nav = document.querySelector('.nav');
  const toggle = document.querySelector('.nav__toggle');
  const menu = document.getElementById('nav-menu');
  const navLinks = [...menu.querySelectorAll('a[href^="#"]')];

  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  navLinks.forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && nav.classList.contains('is-open')) { setMenu(false); toggle.focus(); }
  });

  // Scrolled state, scroll-to-top, timeline progress: one rAF-throttled handler
  const toTop = document.querySelector('.to-top');
  const timeline = document.querySelector('.timeline');
  const timelineItems = timeline ? [...timeline.querySelectorAll('.timeline__item')] : [];
  let ticking = false;

  const onScroll = () => {
    const y = window.scrollY;
    nav.classList.toggle('is-scrolled', y > 24);
    toTop.classList.toggle('is-shown', y > window.innerHeight * 0.9);

    if (timeline) {
      const r = timeline.getBoundingClientRect();
      const anchor = window.innerHeight * 0.6;
      const p = Math.min(1, Math.max(0, (anchor - r.top) / r.height));
      timeline.style.setProperty('--progress', p.toFixed(4));
      timelineItems.forEach((item) => {
        item.classList.toggle('is-passed', item.getBoundingClientRect().top + 12 < anchor);
      });
    }
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
  }, { passive: true });
  onScroll();

  // Active section highlighting
  const linkFor = (id) => navLinks.find((a) => a.getAttribute('href') === `#${id}`);
  const clearActive = () => navLinks.forEach((a) => { a.classList.remove('is-active'); a.removeAttribute('aria-current'); });
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      clearActive();
      const link = linkFor(entry.target.id);
      if (link) { link.classList.add('is-active'); link.setAttribute('aria-current', 'true'); }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navLinks
    .map((a) => document.querySelector(a.getAttribute('href')))
    .filter(Boolean)
    .forEach((s) => spy.observe(s));
  // Sections without a nav entry clear the highlight
  ['skills', 'dashboard'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) spy.observe(el);
  });
}

export function initReveal(root = document) {
  const reveals = root.querySelectorAll('.reveal:not(.is-visible)');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    reveals.forEach((el) => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  reveals.forEach((el) => io.observe(el));
}

export function initCounters() {
  const run = (el) => {
    const target = Number(el.dataset.count);
    if (reduceMotion) { el.textContent = target; return; }
    const dur = 1400;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - t, 4)));
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      run(entry.target);
      io.unobserve(entry.target);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((c) => io.observe(c));
}

export function initRotator() {
  const rotator = document.querySelector('.rotator');
  if (!rotator || reduceMotion) return;
  const words = JSON.parse(rotator.dataset.words);
  let i = 0;
  setInterval(() => {
    if (document.hidden) return;
    rotator.classList.add('is-out');
    setTimeout(() => {
      i = (i + 1) % words.length;
      rotator.textContent = words[i];
      rotator.classList.remove('is-out');
    }, 380);
  }, 2800);
}

export function initHeroMotion() {
  const hero = document.querySelector('.hero');
  const aurora = document.querySelector('.hero__aurora');
  const slash = document.querySelector('.hero__slash');
  const portrait = document.querySelector('[data-tilt]');
  if (!hero || !finePointer || reduceMotion) return;
  let raf = 0;
  hero.addEventListener('pointermove', (e) => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const r = hero.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width;
      const ny = (e.clientY - r.top) / r.height;
      aurora.style.setProperty('--mx', `${(nx * 100).toFixed(1)}%`);
      aurora.style.setProperty('--my', `${(ny * 100).toFixed(1)}%`);
      slash.style.setProperty('--px', `${((nx - 0.5) * -24).toFixed(1)}px`);
      slash.style.setProperty('--py', `${((ny - 0.5) * -18).toFixed(1)}px`);
      portrait.style.setProperty('--ry', `${((nx - 0.5) * 6).toFixed(2)}deg`);
      portrait.style.setProperty('--rx', `${((ny - 0.5) * -5).toFixed(2)}deg`);
    });
  });
  hero.addEventListener('pointerleave', () => {
    ['--px', '--py'].forEach((p) => slash.style.removeProperty(p));
    ['--rx', '--ry'].forEach((p) => portrait.style.removeProperty(p));
  });
}

/* WAI-ARIA tabs */
export function initTabs() {
  document.querySelectorAll('[data-tabs]').forEach((wrap) => {
    const tabs = [...wrap.querySelectorAll('[role="tab"]')];
    const indicator = wrap.querySelector('.tabs__indicator');
    const moveIndicator = (tab) => {
      indicator.style.setProperty('--w', `${tab.offsetWidth}px`);
      indicator.style.setProperty('--x', `${tab.offsetLeft}px`);
    };
    const select = (tab, focus = true) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      moveIndicator(tab);
      if (focus) tab.focus();
    };
    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const next = {
          ArrowRight: tabs[(idx + 1) % tabs.length],
          ArrowLeft: tabs[(idx - 1 + tabs.length) % tabs.length],
          Home: tabs[0],
          End: tabs[tabs.length - 1],
        }[e.key];
        if (next) { e.preventDefault(); select(next); }
      });
    });
    const current = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true');
    moveIndicator(current());
    window.addEventListener('resize', () => moveIndicator(current()));
    document.fonts?.ready.then(() => moveIndicator(current()));
  });
}

export function initYear() {
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
}
