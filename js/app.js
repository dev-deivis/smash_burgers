/* =============================================
   SMASH & CO. — app.js
   ============================================= */

const FRAME_COUNT = 192;
const FRAME_SPEED = 1.5;
const IMAGE_SCALE = 0.86;
const frames = new Array(FRAME_COUNT).fill(null);

const isMobile = () => window.innerWidth <= 768;
const FRAMES_DIR = isMobile() ? 'frames_mobile' : 'frames';

let currentFrame = 0;
let bgColor = '#130800';

const canvas  = document.getElementById('canvas');
const ctx     = canvas.getContext('2d');
const loader  = document.getElementById('loader');
const loaderBar     = document.getElementById('loader-bar');
const loaderPercent = document.getElementById('loader-percent');
const scrollContainer = document.getElementById('scroll-container');

// ─── Canvas resize ────────────────────────────────────────────────────────────
function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width  = window.innerWidth  + 'px';
  canvas.style.height = window.innerHeight + 'px';
  ctx.scale(dpr, dpr);
  drawFrame(currentFrame);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// ─── Sample background color from frame edges ─────────────────────────────────
function sampleBgColor(img) {
  const offscreen = document.createElement('canvas');
  offscreen.width = 4; offscreen.height = 4;
  const oc = offscreen.getContext('2d');
  oc.drawImage(img, 0, 0, 4, 4);
  const px = oc.getImageData(0, 0, 1, 1).data;
  bgColor = `rgb(${px[0]},${px[1]},${px[2]})`;
}

// ─── Draw frame ───────────────────────────────────────────────────────────────
function drawFrame(index) {
  const img = frames[index];
  if (!img) return;

  const cw = canvas.width  / (window.devicePixelRatio || 1);
  const ch = canvas.height / (window.devicePixelRatio || 1);
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const scale = Math.max(cw / iw, ch / ih) * IMAGE_SCALE;
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = (cw - dw) / 2;
  const dy = (ch - dh) / 2;

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, cw, ch);
  ctx.drawImage(img, dx, dy, dw, dh);
}

// ─── Frame preloader ──────────────────────────────────────────────────────────
function loadFrame(index) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      frames[index] = img;
      if (index % 20 === 0) sampleBgColor(img);
      resolve();
    };
    img.onerror = resolve;
    img.src = `${FRAMES_DIR}/frame_${String(index + 1).padStart(4, '0')}.webp`;
  });
}

async function preloadFrames() {
  // Phase 1: first 10 frames for fast first paint
  const phase1 = [];
  for (let i = 0; i < Math.min(10, FRAME_COUNT); i++) phase1.push(loadFrame(i));
  await Promise.all(phase1);
  drawFrame(0);

  // Phase 2: remaining frames with progress bar
  let loaded = 10;
  const updateProgress = () => {
    const pct = Math.round((loaded / FRAME_COUNT) * 100);
    loaderBar.style.width = pct + '%';
    loaderPercent.textContent = pct + '%';
  };
  updateProgress();

  const remaining = [];
  for (let i = 10; i < FRAME_COUNT; i++) {
    remaining.push(
      loadFrame(i).then(() => {
        loaded++;
        updateProgress();
      })
    );
  }
  await Promise.all(remaining);

  // All loaded — hide loader
  loaderBar.style.width = '100%';
  loaderPercent.textContent = '100%';
  await new Promise(r => setTimeout(r, 300));
  loader.classList.add('hidden');

  initApp();
}

// ─── Init app after load ──────────────────────────────────────────────────────
function initApp() {
  gsap.registerPlugin(ScrollTrigger);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reducedMotion) {
    document.querySelectorAll('.scroll-section').forEach(s => s.classList.add('visible'));
    document.getElementById('hero-overlay').style.opacity = '0';
    initCounters();
    return;
  }

  // 1. Lenis smooth scroll
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  // 2. Frame-to-scroll binding
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const accelerated = Math.min(self.progress * FRAME_SPEED, 1);
      const index = Math.min(Math.floor(accelerated * FRAME_COUNT), FRAME_COUNT - 1);
      if (index !== currentFrame) {
        currentFrame = index;
        requestAnimationFrame(() => drawFrame(currentFrame));
      }
    }
  });

  // 3. Hero fade on scroll
  initHeroFade();

  // 4. Section animations
  document.querySelectorAll('.scroll-section').forEach(setupSectionAnimation);

  // 5. Dark overlay for stats
  const statsSection = document.querySelector('.section-stats');
  if (statsSection) {
    const enter = parseFloat(statsSection.dataset.enter) / 100;
    const leave = parseFloat(statsSection.dataset.leave) / 100;
    initDarkOverlay(enter, leave);
  }

  // 6. Sections overlay (002–004 dark tint)
  initSectionsOverlay();

  // 7. Counter animations
  initCounters();
}

// ─── Hero fade ────────────────────────────────────────────────────────────────
function initHeroFade() {
  const heroOverlay = document.getElementById('hero-overlay');
  const FADE_END = 0.15;
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      const opacity = Math.max(0, 1 - p / FADE_END);
      heroOverlay.style.opacity = opacity;
      heroOverlay.style.pointerEvents = opacity > 0 ? '' : 'none';
    }
  });
}

// ─── Sections overlay (002–004 tint) ─────────────────────────────────────────
function initSectionsOverlay() {
  const overlay = document.getElementById('sections-overlay');
  const fadeRange = 0.03;
  const enter = 0.06; // fade in just before section 002

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter && p < enter + fadeRange) {
        opacity = (p - enter) / fadeRange;
      } else if (p >= enter + fadeRange) {
        opacity = 1;
      }
      overlay.style.opacity = opacity;
    }
  });
}

// ─── Dark overlay ─────────────────────────────────────────────────────────────
function initDarkOverlay(enter, leave) {
  const overlay = document.getElementById('dark-overlay');
  const fadeRange = 0.04;
  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      let opacity = 0;
      if (p >= enter - fadeRange && p <= enter) {
        opacity = (p - (enter - fadeRange)) / fadeRange;
      } else if (p > enter && p < leave) {
        opacity = 0.92;
      } else if (p >= leave && p <= leave + fadeRange) {
        opacity = 0.92 * (1 - (p - leave) / fadeRange);
      }
      overlay.style.opacity = opacity;
    }
  });
}

// ─── Section animation system ─────────────────────────────────────────────────
function setupSectionAnimation(section) {
  const type    = section.dataset.animation;
  const persist = section.dataset.persist === 'true';
  const enter   = parseFloat(section.dataset.enter) / 100;
  const leave   = parseFloat(section.dataset.leave) / 100;

  // Position section at midpoint of enter/leave range
  // Usa % para que escale con la altura real del contenedor (cambia por breakpoint)
  const midpoint = (enter + leave) / 2;
  section.style.top = (midpoint * 100) + '%';
  section.style.transform = 'translateY(-50%)';

  const children = section.querySelectorAll(
    '.section-label, .section-heading, .section-body, .section-note, .cta-button, .stat'
  );

  const tl = gsap.timeline({ paused: true });
  const WINDOW = 0.04;

  switch (type) {
    case 'fade-up':
      tl.from(children, { y: 50, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'scale-up':
      tl.from(children, { y: 40, scale: 0.85, opacity: 0, stagger: 0.12, duration: 1.0, ease: 'power2.out' });
      break;
    case 'rotate-in':
      tl.from(children, { y: 40, rotation: 3, opacity: 0, stagger: 0.1, duration: 0.9, ease: 'power3.out' });
      break;
    case 'stagger-up':
      tl.from(children, { y: 60, opacity: 0, stagger: 0.15, duration: 0.8, ease: 'power3.out' });
      break;
    case 'clip-reveal':
      tl.from(children, { clipPath: 'inset(100% 0 0 0)', opacity: 0, stagger: 0.15, duration: 1.2, ease: 'power4.inOut' });
      break;
    case 'blur-up':
      tl.from(children, { y: 50, opacity: 0, filter: 'blur(8px)', stagger: 0.12, duration: 1.0, ease: 'power3.out' });
      break;
    case 'slide-right':
      tl.from(children, { x: 90, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
    case 'slide-left':
      tl.from(children, { x: -90, opacity: 0, stagger: 0.12, duration: 0.9, ease: 'power3.out' });
      break;
  }

  ScrollTrigger.create({
    trigger: scrollContainer,
    start: 'top top',
    end: 'bottom bottom',
    scrub: false,
    onUpdate: (self) => {
      const p = self.progress;

      if (p < enter - WINDOW) {
        // Before section — hidden
        section.classList.remove('visible');
        tl.progress(0);
      } else if (p >= enter - WINDOW && p < enter) {
        // Animating in
        section.classList.add('visible');
        tl.progress((p - (enter - WINDOW)) / WINDOW);
      } else if (p >= enter && p <= (persist ? 1 : leave)) {
        // Fully visible
        section.classList.add('visible');
        tl.progress(1);
      } else if (!persist && p > leave && p <= leave + WINDOW) {
        // Animating out (reverse)
        section.classList.add('visible');
        tl.progress(1 - (p - leave) / WINDOW);
      } else if (!persist && p > leave + WINDOW) {
        // Past section — hidden
        section.classList.remove('visible');
        tl.progress(0);
      }
    }
  });
}



// ─── Counter animations ───────────────────────────────────────────────────────
function initCounters() {
  document.querySelectorAll('.stat-number').forEach(el => {
    const target   = parseFloat(el.dataset.value);
    const decimals = parseInt(el.dataset.decimals || '0');
    const proxy    = { val: 0 };

    gsap.fromTo(
      proxy,
      { val: 0 },
      {
        val: target,
        duration: 2,
        ease: 'power2.out',
        onUpdate() {
          el.textContent = decimals > 0
            ? proxy.val.toFixed(decimals)
            : Math.round(proxy.val);
        },
        onComplete() {
          el.textContent = decimals > 0 ? target.toFixed(decimals) : target;
        },
        scrollTrigger: {
          trigger: el.closest('.scroll-section'),
          start: 'top 80%',
          toggleActions: 'play none none reset'
        }
      }
    );
  });
}

// ─── Sticky header ────────────────────────────────────────────────────────────
(function () {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
})();

// ─── Star rating in review form ───────────────────────────────────────────────
(function () {
  const stars = document.querySelectorAll('.rf-star');
  let selected = 0;

  stars.forEach(star => {
    star.addEventListener('mouseenter', () => {
      const val = parseInt(star.dataset.val);
      stars.forEach(s => {
        s.classList.toggle('hover', parseInt(s.dataset.val) <= val);
      });
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach(s => s.classList.remove('hover'));
    });
    star.addEventListener('click', () => {
      selected = parseInt(star.dataset.val);
      stars.forEach(s => {
        s.classList.toggle('active', parseInt(s.dataset.val) <= selected);
      });
    });
  });

  // File upload preview
  const fileInput = document.getElementById('rf-photo');
  const fileName  = document.getElementById('rf-file-name');
  const previewWrap = document.getElementById('rf-preview-wrap');
  const previewImg  = document.getElementById('rf-preview-img');
  const removeBtn   = document.getElementById('rf-remove-photo');

  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      if (!file) return;
      fileName.textContent = file.name;
      const reader = new FileReader();
      reader.onload = (e) => {
        previewImg.src = e.target.result;
        previewWrap.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      fileInput.value = '';
      fileName.textContent = 'Ningún archivo seleccionado';
      previewWrap.style.display = 'none';
      previewImg.src = '';
    });
  }

  const submitBtn = document.getElementById('rf-submit');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      const name = document.querySelector('.rf-input[placeholder*="Ana"]');
      const comment = document.querySelector('.rf-textarea');
      if (!name || !name.value.trim() || selected === 0) {
        submitBtn.textContent = 'Completa todos los campos';
        setTimeout(() => { submitBtn.textContent = 'ENVIAR RESEÑA'; }, 2000);
        return;
      }
      submitBtn.textContent = '¡Reseña enviada! Gracias 🙌';
      submitBtn.style.background = 'var(--accent-dark)';
      if (name) name.value = '';
      if (comment) comment.value = '';
      selected = 0;
      stars.forEach(s => s.classList.remove('active'));
    });
  }
})();

// ─── Hamburger menu ───────────────────────────────────────────────────────────
(function () {
  const hamburger = document.getElementById('nav-hamburger');
  const mobileNav = document.getElementById('mobile-nav');
  if (!hamburger || !mobileNav) return;

  function closeMobileNav() {
    hamburger.classList.remove('active');
    hamburger.setAttribute('aria-expanded', 'false');
    mobileNav.classList.remove('active');
    mobileNav.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  hamburger.addEventListener('click', () => {
    const isOpen = hamburger.classList.contains('active');
    if (isOpen) {
      closeMobileNav();
    } else {
      hamburger.classList.add('active');
      hamburger.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('active');
      mobileNav.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    }
  });

  mobileNav.querySelectorAll('.mobile-nav-link').forEach(link => {
    link.addEventListener('click', closeMobileNav);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileNav();
  });
})();

// ─── Touch interaction para burger cards ─────────────────────────────────────
(function () {
  const isTouch = () => 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  if (!isTouch()) return;

  document.querySelectorAll('.explode-hint').forEach(h => {
    h.textContent = 'Toca para ver';
  });

  let activeCard = null;

  document.querySelectorAll('.burger-card').forEach(card => {
    let startX, startY;

    card.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    }, { passive: true });

    card.addEventListener('touchend', (e) => {
      const dx = Math.abs(e.changedTouches[0].clientX - startX);
      const dy = Math.abs(e.changedTouches[0].clientY - startY);
      if (dx > 10 || dy > 10) return;

      if (activeCard && activeCard !== card) {
        activeCard.classList.remove('touch-active');
      }
      card.classList.toggle('touch-active');
      activeCard = card.classList.contains('touch-active') ? card : null;
    }, { passive: true });
  });

  document.addEventListener('touchend', (e) => {
    if (!activeCard) return;
    if (!activeCard.contains(e.target)) {
      activeCard.classList.remove('touch-active');
      activeCard = null;
    }
  }, { passive: true });
})();

// ─── Boot ─────────────────────────────────────────────────────────────────────
preloadFrames();
