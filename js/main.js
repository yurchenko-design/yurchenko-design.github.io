(() => {
  'use strict';

  /* ===== Footer year ===== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ===== Scroll-reveal animations ===== */
  const animated = document.querySelectorAll('[data-animate]');
  if ('IntersectionObserver' in window && animated.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const el = entry.target;
          const delay = el.getAttribute('data-animate-delay') || 0;
          el.style.transitionDelay = `${delay}ms`;
          el.classList.add('is-visible');
          io.unobserve(el);
        }
      });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    animated.forEach((el) => io.observe(el));
  } else {
    animated.forEach((el) => el.classList.add('is-visible'));
  }

  /* ===== Count-up для блоков с цифрами =====
     В разметке лежит уже готовое значение — если скрипт не отработает,
     посетитель увидит правильное число, а не ноль. На ноль сбрасываем
     только в момент старта анимации. */
  const counters = document.querySelectorAll('[data-count-to]');
  if (counters.length) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fmt = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

    const animate = (el) => {
      const to = Number(el.dataset.countTo);
      // requestAnimationFrame не тикает в скрытой вкладке — число застыло бы на нуле
      if (reduceMotion || document.hidden || !to) {
        el.textContent = fmt(to);
        return;
      }
      const dur = to > 100 ? 1100 : 700;
      const t0 = performance.now();
      const step = (t) => {
        const p = Math.min(1, (t - t0) / dur);
        el.textContent = fmt(Math.round(to * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };

    if ('IntersectionObserver' in window) {
      const co = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          co.unobserve(entry.target);
          animate(entry.target);
        });
      }, { threshold: 0.4 });
      counters.forEach((el) => co.observe(el));
    }
  }

  /* ===== Lightbox ===== */
  const cases = {
    'inner-health': {
      title: 'Каталог продукции',
      images: ['images/gallery/inner-health-3.jpg', 'images/gallery/inner-health-2.jpg', 'images/gallery/inner-health-1.jpg'],
    },
    'webinar': {
      title: 'Антикризисный sales-маркетинг',
      images: ['images/gallery/webinar-1.jpg', 'images/gallery/webinar-2.jpg', 'images/gallery/webinar-3.jpg'],
    },
    'marketing-strategy': {
      title: 'Маркетинговая стратегия',
      images: ['images/gallery/marketing-strategy-3.jpg', 'images/gallery/marketing-strategy-2.jpg', 'images/gallery/marketing-strategy-1.jpg'],
    },
    'aina': {
      title: 'Инструкция по продукту',
      images: ['images/gallery/aina-1.jpg', 'images/gallery/aina-2.jpg', 'images/gallery/aina-3.jpg'],
    },
  };

  const lightbox = document.getElementById('lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const btnPrev = document.getElementById('lightbox-prev');
  const btnNext = document.getElementById('lightbox-next');
  let currentCase = null;
  let currentIndex = 0;
  let lastFocused = null;

  const showSlide = () => {
    const c = cases[currentCase];
    lightboxImg.src = c.images[currentIndex];
    lightboxImg.alt = `${c.title} — слайд ${currentIndex + 1}`;
  };

  const openLightbox = (caseKey, startIndex) => {
    if (!cases[caseKey]) return;
    lastFocused = document.activeElement;
    currentCase = caseKey;
    currentIndex = startIndex || 0;
    showSlide();
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    btnPrev.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lightbox.hidden = true; }, 250);
    if (lastFocused) lastFocused.focus();
  };

  const step = (dir) => {
    const c = cases[currentCase];
    currentIndex = (currentIndex + dir + c.images.length) % c.images.length;
    showSlide();
  };

  /* Per-card mini-carousel: dots switch the active slide, image/expand opens the full lightbox */
  document.querySelectorAll('.case-card').forEach((card) => {
    const caseKey = card.getAttribute('data-case');
    const slides = card.querySelectorAll('.case-slides img');
    const dots = card.querySelectorAll('.case-dot');
    let activeIndex = 0;

    const setActive = (index) => {
      activeIndex = index;
      slides.forEach((img, i) => img.classList.toggle('is-active', i === index));
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-selected', i === index ? 'true' : 'false');
      });
    };

    dots.forEach((dot, i) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        setActive(i);
      });
    });

    const arrowPrev = card.querySelector('[data-slide-prev]');
    const arrowNext = card.querySelector('[data-slide-next]');
    if (arrowPrev) {
      arrowPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        setActive((activeIndex - 1 + slides.length) % slides.length);
      });
    }
    if (arrowNext) {
      arrowNext.addEventListener('click', (e) => {
        e.stopPropagation();
        setActive((activeIndex + 1) % slides.length);
      });
    }

    const preview = card.querySelector('.case-preview');
    preview.addEventListener('click', (e) => {
      if (e.target.closest('.case-dot')) return;
      openLightbox(caseKey, activeIndex);
    });
  });

  document.querySelectorAll('[data-close-lightbox]').forEach((el) => {
    el.addEventListener('click', closeLightbox);
  });
  btnPrev.addEventListener('click', () => step(-1));
  btnNext.addEventListener('click', () => step(1));
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') step(-1);
    if (e.key === 'ArrowRight') step(1);
  });

  /* ===== Lead form ===== */
  const WEB3FORMS_ACCESS_KEY = 'e5d4e756-f6d4-47b0-9ca5-daa078340c32';
  const TELEGRAM_BOT_TOKEN = '8987685732:AAGIyRRcJyP0zJ2_vDZu7dAwPZ10HvXJx2Y';
  const TELEGRAM_CHAT_ID = '1762557557';

  const form = document.getElementById('lead-form');
  const statusEl = document.getElementById('form-status');
  const submitBtn = document.getElementById('submit-btn');

  const setStatus = (message, type) => {
    statusEl.textContent = message;
    statusEl.className = `form-status is-visible ${type ? `is-${type}` : ''}`;
  };

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const name = form.name.value.trim();
      const contact = form.contact.value.trim();
      const projectType = form.project_type.value;
      const message = form.message.value.trim();

      if (!name || !contact || !projectType) {
        setStatus('Заполните, пожалуйста, обязательные поля.', 'error');
        return;
      }

      const configured = !WEB3FORMS_ACCESS_KEY.startsWith('YOUR_');

      submitBtn.disabled = true;
      setStatus('Отправляю заявку…', '');

      const tasks = [];

      if (configured) {
        tasks.push(
          fetch('https://api.web3forms.com/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
            body: JSON.stringify({
              access_key: WEB3FORMS_ACCESS_KEY,
              subject: `Новая заявка с сайта — ${projectType}`,
              from_name: name,
              name,
              contact,
              project_type: projectType,
              message,
            }),
          })
        );
      }

      if (!TELEGRAM_BOT_TOKEN.startsWith('YOUR_') && !TELEGRAM_CHAT_ID.startsWith('YOUR_')) {
        const text = [
          '📩 Новая заявка с сайта',
          `Имя: ${name}`,
          `Контакт: ${contact}`,
          `Тип проекта: ${projectType}`,
          message ? `Комментарий: ${message}` : null,
        ].filter(Boolean).join('\n');

        tasks.push(
          fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text }),
          })
        );
      }

      if (tasks.length === 0) {
        submitBtn.disabled = false;
        setStatus('Форма пока не настроена: добавьте ключ Web3Forms и/или данные Telegram-бота в js/main.js.', 'error');
        return;
      }

      try {
        const results = await Promise.allSettled(tasks);
        const anyOk = results.some((r) => r.status === 'fulfilled' && r.value.ok);
        if (anyOk) {
          form.reset();
          setStatus('Спасибо! Заявка отправлена — свяжусь с вами в ближайшее время. ✓', 'success');
        } else {
          setStatus('Не получилось отправить заявку. Попробуйте написать напрямую в Telegram или на почту.', 'error');
        }
      } catch (err) {
        setStatus('Не получилось отправить заявку. Попробуйте написать напрямую в Telegram или на почту.', 'error');
      } finally {
        submitBtn.disabled = false;
      }
    });
  }
})();
