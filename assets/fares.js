/*
 * Популярные направления: подставляет цены из assets/prices.json.
 *
 * Безопасно для страницы: если файла нет, он пустой, битый или по маршруту
 * нет цены — карточка остаётся с ценой, которая вписана в index.html.
 *
 * Формат assets/prices.json:
 * {
 *   "updated": "2026-10-09T13:00:00Z",
 *   "routes": {
 *     "dushanbe-moscow": { "price": 16482, "old_price": 17482, "currency": "RUB", "promo": true }
 *   }
 * }
 * Ключ маршрута = data-route-from + "-" + data-route-to карточки.
 * currency: "RUB" или "TJS"; пересчёт в выбранную валюту делает renderPrices().
 * old_price необязателен: без него зачёркнутая цена и бейдж скидки скрываются.
 * promo: true — бейдж показывает скидку в деньгах (как у INTAVIATUTU), иначе в процентах.
 */
(() => {
  const list = document.getElementById('fareCards');
  if (!list || !window.fetch) return;

  const fmt = n => new Intl.NumberFormat('ru-RU').format(Math.round(n)).replace(/ | /g, ' ');

  function setValue(el, currency, value) {
    el.removeAttribute('data-tjs');
    el.removeAttribute('data-rub');
    el.setAttribute(currency === 'TJS' ? 'data-tjs' : 'data-rub', String(Math.round(value)));
  }

  function setBadge(badge, text) {
    const inner = badge.firstElementChild || badge;
    // Новый текстовый узел, чтобы переключение языка не вернуло старое значение.
    inner.replaceChildren(document.createTextNode(text));
  }

  const PROMO_RU = 'С промокодом INTAVIATUTU';
  function translatePromo(el) {
    const select = document.getElementById('lang');
    const lang = select ? select.value : 'ru';
    let text = PROMO_RU;
    try {
      if (typeof translations === 'object' && translations[lang] && translations[lang][PROMO_RU]) {
        text = translations[lang][PROMO_RU];
      }
    } catch (e) { /* остаётся русский текст */ }
    el.textContent = text;
  }
  const langSelect = document.getElementById('lang');
  if (langSelect) {
    langSelect.addEventListener('change', () =>
      list.querySelectorAll('.fare-promo-label[data-dynamic="promo"]').forEach(translatePromo));
  }

  function apply(data) {
    const routes = data && data.routes;
    if (!routes || typeof routes !== 'object') return false;
    let changed = false;

    list.querySelectorAll('.fare-card').forEach(card => {
      const route = routes[card.dataset.routeFrom + '-' + card.dataset.routeTo];
      const price = route && Number(route.price);
      if (!(price > 0)) return;

      const row = card.querySelector('.fare-price-row');
      const current = row && row.querySelector('.price:not(.old)');
      if (!current) return;

      const currency = route.currency === 'TJS' ? 'TJS' : 'RUB';
      const oldEl = row.querySelector('.price.old');
      const badge = row.querySelector('.discount-badge');
      let promoLabel = row.querySelector('.fare-promo-label');
      if (!promoLabel && route.promo) {
        promoLabel = document.createElement('small');
        promoLabel.className = 'fare-promo-label';
        promoLabel.dataset.dynamic = 'promo';
        row.append(promoLabel);
        translatePromo(promoLabel);
      }
      const oldPrice = Number(route.old_price);

      setValue(current, currency, price);

      if (oldPrice > price) {
        if (oldEl) { setValue(oldEl, currency, oldPrice); oldEl.style.display = ''; }
        if (badge) {
          const text = route.promo
            ? '−' + fmt(oldPrice - price) + (currency === 'TJS' ? ' TJS' : ' ₽')
            : '−' + Math.round((1 - price / oldPrice) * 100) + '%';
          setBadge(badge, text);
          badge.style.display = '';
        }
        if (promoLabel) promoLabel.style.display = route.promo ? '' : 'none';
      } else {
        if (oldEl) oldEl.style.display = 'none';
        if (badge) badge.style.display = 'none';
        if (promoLabel) promoLabel.style.display = 'none';
      }

      if (typeof route.url === 'string' && /^https:\/\/([a-z0-9-]+\.)*tutu\.ru\//i.test(route.url)) {
        card.href = route.url;
      }
      changed = true;
    });

    return changed;
  }

  fetch('assets/prices.json', { cache: 'no-cache' })
    .then(r => (r.ok ? r.json() : null))
    .then(data => {
      if (apply(data) && typeof renderPrices === 'function') renderPrices();
    })
    .catch(() => { /* оставляем цены из вёрстки */ });
})();
