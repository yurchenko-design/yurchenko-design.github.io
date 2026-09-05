(() => {
  'use strict';

  /* ===== Footer year ===== */
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ===== Scroll-reveal animations ===== */
  const animated = document.querySelectorAll('[data-animate]');
  if ('IntersectionObserver' in window && animated.length) {
    // Задержки каскада ополовинены и ограничены сверху. В разметке они доходят
    // до 350 мс, а вместе с переходом в 0.5 с блок проявлялся почти секунду —
    // при быстрой прокрутке экран успевал уехать, и страница выглядела
    // сломанной. Значения в разметке не трогаем: порядок появления карточек
    // в них задан верно, длинным был только шаг
    const reveal = (el) => {
      const raw = Number(el.getAttribute('data-animate-delay')) || 0;
      el.style.transitionDelay = `${Math.min(raw * 0.5, 140)}ms`;
      el.classList.add('is-visible');
    };

    // threshold: 0 вместо 0.15 — высокому блоку больше не нужно показать
    // седьмую часть себя, хватает первого пикселя. Нижний отступ теперь
    // положительный, а не -40px: корень наблюдателя продлён на 20% высоты
    // экрана вниз, поэтому блок начинает проявляться ещё до того, как въедет
    // в кадр, и к моменту появления анимация уже отыграна
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        if (el.classList.contains('carousel-track')) {
          el.querySelectorAll('[data-animate]').forEach(reveal);
        } else {
          reveal(el);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 20% 0px' });

    // Карточки внутри карусели наблюдаем не поштучно, а через саму ленту.
    // Третий и четвёртый кейс стоят за правым краем экрана и обрезаны
    // overflow-x ленты, поэтому для наблюдателя они не пересекают окно никогда
    // и остаются прозрачными: пролистав карусель, посетитель упирался
    // в пустую карточку. Теперь вся лента проявляется разом, когда въезжает
    // в кадр по вертикали — как обычный блок
    animated.forEach((el) => io.observe(el.closest('.carousel-track') || el));
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

    /* Перед печатью досчитываем все счётчики до конца: иначе в PDF попадает
       случайное промежуточное значение вроде «1 495 ₽» вместо «1 500 ₽» */
    window.addEventListener('beforeprint', () => {
      counters.forEach((el) => { el.textContent = fmt(Number(el.dataset.countTo)); });
    });

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

  /* ===== Гигантская надпись в Hero =====
     Кегль подгоняется под ширину сцены, чтобы слово шло ровно от края до края
     при любой ширине экрана и при любом шрифте. */
  const heroWord = document.querySelector('[data-fit-word]');
  if (heroWord) {
    const stage = heroWord.parentElement;
    let lastWidth = 0;

    const ctx = document.createElement('canvas').getContext('2d');

    /* Считаем по ЧЕРНИЛАМ букв, а не по рамке строки. В рамку входят боковые
       полуапроши — у Big Shoulders это по 8px на кегле 200, то есть на странице
       слово недотягивалось до полей по 15px с каждой стороны и не сходилось
       с именем слева и меню справа. Рамку сдвигаем влево на левый полуапрош. */
    const fitWord = () => {
      const target = stage.clientWidth;
      if (!target) return; // блок ещё без ширины (скрытая вкладка) — пересчитаем позже
      const probe = 200;
      const cs = getComputedStyle(heroWord);
      let scale = null;
      let bearingLeft = 0;

      ctx.font = `${cs.fontWeight} ${probe}px ${cs.fontFamily}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const m = ctx.measureText(heroWord.textContent.trim());
      if (m && typeof m.actualBoundingBoxRight === 'number') {
        const ink = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
        if (ink > 0) {
          scale = target / ink;
          bearingLeft = -m.actualBoundingBoxLeft;
        }
      }

      if (scale === null) {
        // запасной путь, если браузер не отдаёт метрики чернил
        heroWord.style.fontSize = probe + 'px';
        const natural = heroWord.getBoundingClientRect().width;
        if (!natural) return;
        scale = target / natural;
      }

      heroWord.style.fontSize = (probe * scale) + 'px';
      heroWord.style.left = (-bearingLeft * scale) + 'px';
      lastWidth = target;
      // высотой слова CSS выравнивает контент под ним на мобильном
      stage.style.setProperty('--word-h', heroWord.getBoundingClientRect().height + 'px');
    };

    fitWord();
    window.addEventListener('resize', fitWord);
    window.addEventListener('load', fitWord);
    document.addEventListener('visibilitychange', fitWord);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitWord);

    if ('ResizeObserver' in window) {
      // пересчёт, когда сцена получает реальную ширину; сверка с lastWidth
      // нужна, чтобы правка --word-h не вызывала наблюдателя по кругу
      new ResizeObserver(() => {
        if (stage.clientWidth !== lastWidth) fitWord();
      }).observe(stage);
    }
  }

  /* ===== Карусели =====
     Листают ровно на ширину видимой области, то есть на «страницу» карточек.
     Сколько карточек в странице — решает CSS, скрипт про это не знает.
     Управление ищется внутри той же секции, поэтому каруселей может быть
     сколько угодно и они не мешают друг другу. */
  document.querySelectorAll('[data-carousel]').forEach((track) => {
    const scope = track.closest('section') || document;
    const prev = scope.querySelector('[data-carousel-prev]');
    const next = scope.querySelector('[data-carousel-next]');
    const dotsBox = scope.querySelector('[data-carousel-dots]');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

    // на мобильном карусель выключена в CSS: лента становится обычной колонкой
    const isCarousel = () => track.scrollWidth > track.clientWidth + 1;
    const pageCount = () => Math.max(1, Math.round(track.scrollWidth / track.clientWidth));
    const pageIndex = () => Math.round(track.scrollLeft / track.clientWidth);

    const buildDots = () => {
      if (!dotsBox) return;
      if (!isCarousel()) { dotsBox.textContent = ''; return; }
      const need = pageCount();
      if (dotsBox.children.length === need) return;
      dotsBox.textContent = '';
      if (need < 2) return;
      for (let i = 0; i < need; i += 1) {
        const dot = document.createElement('span');
        dot.className = 'carousel-dot';
        dotsBox.appendChild(dot);
      }
    };

    const sync = () => {
      // 1px запаса: дробные ширины иначе не дают доехать до самого края
      const atStart = track.scrollLeft <= 1;
      const atEnd = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
      if (prev) prev.disabled = atStart;
      if (next) next.disabled = atEnd;
      if (dotsBox) {
        const active = pageIndex();
        [...dotsBox.children].forEach((dot, i) => dot.classList.toggle('is-active', i === active));
      }
    };

    const go = (dir) => {
      track.scrollBy({
        left: dir * track.clientWidth,
        behavior: reduce.matches ? 'auto' : 'smooth',
      });
    };

    if (prev) prev.addEventListener('click', () => go(-1));
    if (next) next.addEventListener('click', () => go(1));
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', () => { buildDots(); sync(); });

    buildDots();
    sync();
  });

  /* ===== Lightbox ===== */
  const cases = {
    'inner-health': {
      title: 'Каталог продукции',
      images: ['images/gallery/inner-health-3.jpg', 'images/gallery/inner-health-2.jpg', 'images/gallery/inner-health-1.jpg'],
    },
    'webinar': {
      title: 'Презентация для вебинара',
      images: ['images/gallery/webinar-1.jpg?v=2', 'images/gallery/webinar-2.jpg?v=2', 'images/gallery/webinar-3.jpg?v=2'],
    },
    'marketing-strategy': {
      title: 'Маркетинговая стратегия',
      // Порядок 1-2-3, а не 3-2-1 как у других кейсов: новые слайды пришли
      // уже пронумерованными в нужной последовательности. Здесь он обязан
      // совпадать с разметкой — иначе лайтбокс листает не то, что в карточке
      images: ['images/gallery/marketing-strategy-1.jpg?v=3', 'images/gallery/marketing-strategy-2.jpg?v=3', 'images/gallery/marketing-strategy-3.jpg?v=3'],
    },
    'dashboards': {
      title: 'Примеры графиков и дашбордов',
      images: ['images/gallery/dashboards-1.jpg', 'images/gallery/dashboards-2.jpg', 'images/gallery/dashboards-3.jpg'],
    },
  };

  const lightbox = document.getElementById('lightbox');
  const lightboxSlides = document.getElementById('lightbox-slides');
  const lightboxClose = lightbox && lightbox.querySelector('.lightbox-close');
  let lastFocused = null;

  /* Просмотр кейса: сразу все три слайда, вписанные в экран.
     ⚠️ Листания по одному больше нет — по трём слайдам сразу видна
     стилистика презентации, а по одному она теряется (решение
     заказчицы 5 сентября 2026) */
  const openLightbox = (caseKey) => {
    const c = cases[caseKey];
    if (!c) return;
    lastFocused = document.activeElement;
    lightboxSlides.innerHTML = '';
    c.images.forEach((src, i) => {
      const img = document.createElement('img');
      img.src = src;
      img.alt = `${c.title} — слайд ${i + 1}`;
      lightboxSlides.appendChild(img);
    });
    lightbox.hidden = false;
    requestAnimationFrame(() => lightbox.classList.add('is-open'));
    document.body.style.overflow = 'hidden';
    if (lightboxClose) lightboxClose.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lightbox.hidden = true; }, 250);
    if (lastFocused) lastFocused.focus();
  };

  /* Per-card mini-carousel: стрелки и полоски переключают слайд,
     клик по превью открывает лайтбокс */
  document.querySelectorAll('.case-card').forEach((card) => {
    const caseKey = card.getAttribute('data-case');
    const slides = card.querySelectorAll('.case-slides img');
    const dots = card.querySelectorAll('[data-slide-dot]');
    let activeIndex = 0;

    const setActive = (index) => {
      activeIndex = index;
      slides.forEach((img, i) => img.classList.toggle('is-active', i === index));
      dots.forEach((dot, i) => dot.classList.toggle('is-active', i === index));
    };

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
    dots.forEach((dot) => {
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        setActive(Number(dot.getAttribute('data-slide-dot')));
      });
    });

    const preview = card.querySelector('.case-preview');
    preview.addEventListener('click', () => {
      openLightbox(caseKey);
    });
  });

  /* ===== Переключение кейса =====
     Наверху показан один кейс, остальные идут строкой снизу. Клик по строке
     поднимает её кейс наверх, а сама строка из списка уходит — она уже
     показана. Раскрытое описание при этом схлопывается: оно относилось
     к прошлому кейсу */
  const caseRest = document.querySelector('[data-case-rest]');
  if (caseRest) {
    const cards = [...document.querySelectorAll('.case-card')];
    const rows = [...caseRest.children];

    caseRest.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-go]');
      if (!btn) return;
      const index = Number(btn.getAttribute('data-go'));

      cards.forEach((card, i) => card.classList.toggle('is-active', i === index));
      rows.forEach((row, i) => row.classList.toggle('is-current', i === index));
      syncRestPositions();
    });

    /* Порядок и позиции строк.
       ⚠️ Порядок круговой, а не исходный: после активного кейса идут
       следующие по кругу. Открыт 02 — внизу 03, 04, 01; открыт 03 —
       внизу 04, 01, 02. С исходным порядком под открытым 02 первым
       оказывался 01, и список читался как «назад», а не «дальше».
       data-pos нужен CSS: по нему он решает, у какой колонки рисовать
       разделитель — «последний видимый» селектором не выражается */
    function syncRestPositions() {
      const active = rows.findIndex((row) => row.classList.contains('is-current'));
      rows.forEach((row, i) => {
        const shift = (i - active + rows.length) % rows.length;
        row.style.order = String(shift);
        if (shift === 0) row.removeAttribute('data-pos');
        else row.setAttribute('data-pos', String(shift - 1));
      });
    }
    syncRestPositions();
  }


  /* ===== Телефон: липкая кнопка =====
     Показываем, когда Hero уже уехал вверх, и убираем у формы — там своя
     кнопка отправки, две подряд читались бы как ошибка. Порог по ширине
     совпадает с CSS: ниже 640px */
  const stickyCta = document.querySelector('[data-sticky-cta]');
  if (stickyCta) {
    const hero = document.querySelector('.hero');
    const contact = document.getElementById('contact');
    const isPhone = () => window.matchMedia('(max-width: 639px)').matches;
    let ticking = false;
    const update = () => {
      ticking = false;
      if (!isPhone() || !hero || !contact) { stickyCta.classList.remove('is-on'); return; }
      const heroGone = hero.getBoundingClientRect().bottom < 0;
      const formNear = contact.getBoundingClientRect().top < window.innerHeight * 0.6;
      stickyCta.classList.toggle('is-on', heroGone && !formNear);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    update();
  }

  /* ===== Телефон: услуги аккордеоном =====
     Ниже 640px карточка услуги превращается в строку, описание раскрывается
     по тапу. Первая открыта по умолчанию — иначе приём неочевиден.
     На широких экранах обработчики просто ничего не делают */
  const serviceCards = document.querySelectorAll('.services .service-card');
  if (serviceCards.length) {
    const phoneQuery = window.matchMedia('(max-width: 639px)');
    const syncAccordion = () => {
      serviceCards.forEach((card, i) => {
        if (phoneQuery.matches) {
          card.setAttribute('role', 'button');
          card.setAttribute('tabindex', '0');
          card.setAttribute('aria-expanded', i === 0 ? 'true' : 'false');
          card.classList.toggle('is-open', i === 0);
        } else {
          card.removeAttribute('role');
          card.removeAttribute('tabindex');
          card.removeAttribute('aria-expanded');
          card.classList.remove('is-open');
        }
      });
    };
    /* Открыта всегда одна карточка: иначе шесть раскрытых описаний снова
       превращают раздел в стену текста, ради которой аккордеон и делался */
    const toggleCard = (card) => {
      if (!phoneQuery.matches) return;
      const willOpen = !card.classList.contains('is-open');
      serviceCards.forEach((other) => {
        other.classList.remove('is-open');
        other.setAttribute('aria-expanded', 'false');
      });
      if (willOpen) {
        card.classList.add('is-open');
        card.setAttribute('aria-expanded', 'true');
      }
    };
    serviceCards.forEach((card) => {
      card.addEventListener('click', () => toggleCard(card));
      card.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggleCard(card);
      });
    });
    syncAccordion();
    phoneQuery.addEventListener('change', syncAccordion);
  }

  document.querySelectorAll('[data-close-lightbox]').forEach((el) => {
    el.addEventListener('click', closeLightbox);
  });
  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
  });

  /* ===== Lead form ===== */
  const WEB3FORMS_ACCESS_KEY = 'e5d4e756-f6d4-47b0-9ca5-daa078340c32';
  /* ⚠️ Токен бота во фронтенде НЕ хранится: он лежит секретом в Cloudflare
     Worker `tg-lead-form`, сайт обращается только к адресу прокси.
     Токен и chat_id сюда не возвращать — см. telegram-proxy-nastroika.md.
     ⚠️ Эта строка один раз уже была затёрта старой версией файла из рабочей
     копии: правку вносили в saitvizitka/, а деплой копирует из
     saitvizitka-redesign/. Менять оба файла или копировать в одну сторону */
  const TELEGRAM_PROXY_URL = 'https://tg-lead-form.levcenkovitalia.workers.dev';

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
      // поле комментария убрано из формы 19 августа 2026 — читаем его
      // только если оно есть, иначе скрипт падал бы на form.message
      const message = form.message ? form.message.value.trim() : '';

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

      if (TELEGRAM_PROXY_URL) {
        tasks.push(
          fetch(TELEGRAM_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name,
              contact,
              project_type: projectType,
              message,
            }),
          })
        );
      }

      if (tasks.length === 0) {
        submitBtn.disabled = false;
        setStatus('Форма пока не настроена: добавьте ключ Web3Forms и/или адрес Telegram-прокси.', 'error');
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
