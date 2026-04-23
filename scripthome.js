


(function () {
  'use strict';

  /* ── INTERSECTION OBSERVER — Scroll Reveal ── */
  const revealEls = document.querySelectorAll('.reveal');
  const io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
      } else {
        entry.target.classList.remove('in-view');
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  revealEls.forEach(function (el) { io.observe(el); });

  /* ── NAV SCROLL OPACITY ── */
  const nav = document.querySelector('nav');
  window.addEventListener('scroll', function () {
    if (window.scrollY > 60) {
      nav.style.boxShadow = '0 8px 40px rgba(0,0,0,0.25)';
    } else {
      nav.style.boxShadow = 'none';
    }
  }, { passive: true });

  /* ── FOOTER REVEAL ── */
  const footer = document.querySelector('footer');
  if (footer) {
    footer.classList.add('reveal');
    io.observe(footer);
  }

})();


