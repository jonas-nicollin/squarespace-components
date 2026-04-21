(function () {
  'use strict';

  /* ─────────────────────────────────────────────
   * 0. UTILITAIRES
   * ───────────────────────────────────────────── */

  function noop() {}

  function norm(str) {
    return String(str || '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019']/g, "'")
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function cleanHTML(str) {
    const d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    const s = cleanHTML(str);
    if (!s || s.length <= max) return s;
    const cut = s.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '…';
  }

  function uniqBy(arr, fn) {
    const seen = new Set();
    return arr.filter(item => {
      const k = fn(item);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function el(tag, attrs) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (v == null) return;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('data-')) e.setAttribute(k, v);
        else e[k] = v;
      });
    }
    return e;
  }

  function parseTag(tag) {
    const raw = String(tag || '');
    const idx = raw.indexOf(':');
    if (idx === -1) return { prefix: null, value: raw.trim() };
    return { prefix: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
  }

  function getTagValuesByPrefix(item, prefix) {
    const pNorm = norm(String(prefix).replace(/:$/, ''));
    return (item.tags || []).reduce((acc, tag) => {
      const { prefix: p, value: v } = parseTag(tag);
      if (p && norm(p) === pNorm && v) acc.push(v);
      return acc;
    }, []);
  }

  /* ─────────────────────────────────────────────
   * 1. FETCH & CACHE
   * ───────────────────────────────────────────── */

  const MEM = new Map();

  function cacheGet(key) {
    if (MEM.has(key)) return MEM.get(key);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, ttl, data } = JSON.parse(raw);
      if (Date.now() - ts > (ttl || 300) * 1000) { sessionStorage.removeItem(key); return null; }
      MEM.set(key, data);
      return data;
    } catch (_) { return null; }
  }

  function cacheSet(key, data, ttl, useSession) {
    MEM.set(key, data);
    if (!useSession) return;
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), ttl, data })); } catch (_) { noop(); }
  }

  function ensureJson(url) {
    if (!url) return url;
    if (url.includes('format=json')) return url;
    return url.includes('?') ? url + '&format=json' : url + '?format=json';
  }

  async function fetchAllItems(path, maxPages, useSession, ttl) {
    const key = 'sqb::v2::' + path + '::' + maxPages;
    const cached = cacheGet(key);
    if (cached) return cached;

    const items = [];
    let url = ensureJson(path);
    for (let p = 0; p < (maxPages || 10); p++) {
      let data;
      try {
        const res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) break;
        data = await res.json();
      } catch (_) { break; }

      const batch = Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.itemList) ? data.itemList : [];
      items.push(...batch);

      const next = data?.pagination?.nextPageUrl;
      if (!next) break;
      url = ensureJson(next);
    }

    cacheSet(key, items, ttl || 300, useSession !== false);
    return items;
  }

  /* ─────────────────────────────────────────────
   * 2. MAPPING
   * Squarespace retourne uniquement les posts publiés
   * dans son JSON public — pas besoin de re-filtrer côté client.
   * ───────────────────────────────────────────── */

  function mapItem(raw, sourcePath) {
    const assetUrl = raw.assetUrl || raw?.asset?.url || null;
    const fp = raw.mediaFocalPoint;
    const focalPoint = (fp && typeof fp.x === 'number' && typeof fp.y === 'number')
      ? `${Math.round(fp.x * 100)}% ${Math.round(fp.y * 100)}%` : '50% 50%';

    const loc = raw.location;
    const location = loc ? cleanHTML(loc.addressTitle || loc.addressLine1 || '') : '';

    return {
      id: raw.id,
      title: cleanHTML(raw.title || ''),
      fullUrl: raw.fullUrl || (sourcePath + '/' + (raw.urlId || '')),
      urlId: raw.urlId || '',
      assetUrl,
      focalPoint,
      categories: (raw.categories || []).map(c => cleanHTML(c)).filter(Boolean),
      tags: (raw.tags || []).map(t => cleanHTML(t)).filter(Boolean),
      excerpt: truncate(raw.excerpt || raw.body || '', 160),
      location,
      displayIndex: Number(raw.displayIndex ?? 999999),
      timestamp: Number(raw.startDate || raw.publishOn || raw.addedOn || raw.updatedOn || 0),
    };
  }

  /* ─────────────────────────────────────────────
   * 3. FILTRAGE & TRI
   * ───────────────────────────────────────────── */

  function matchesFilters(item, state) {
    if (state.category) {
      if (!item.categories.some(c => norm(c) === norm(state.category))) return false;
    }
    for (const [prefix, value] of Object.entries(state.tags || {})) {
      if (!value) continue;
      if (!getTagValuesByPrefix(item, prefix).some(v => norm(v) === norm(value))) return false;
    }
    if (state.search) {
      const q = norm(state.search);
      const hay = norm([item.title, item.excerpt, item.location, ...item.categories, ...item.tags].join(' '));
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function sortItems(items, sort) {
    const { type = 'collection', direction = 'asc' } = sort || {};
    const dir = direction === 'desc' ? -1 : 1;
    return items.slice().sort((a, b) => {
      if (type === 'date') return (a.timestamp - b.timestamp) * dir;
      if (type === 'title') return norm(a.title).localeCompare(norm(b.title)) * dir;
      return (a.displayIndex - b.displayIndex) * dir;
    });
  }

  /* ─────────────────────────────────────────────
   * 4. LAZY-LOAD IMAGES
   * ───────────────────────────────────────────── */

  const IO_LAZY = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          if (img.dataset.src) img.src = img.dataset.src;
          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
          obs.unobserve(img);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  const SRCSET_WIDTHS = [300, 500, 750, 1000, 1500, 2500];

  function buildImg(assetUrl, focalPoint, alt, ratio) {
    const srcset = SRCSET_WIDTHS.map(w => `${assetUrl}?format=${w}w ${w}w`).join(', ');
    const wrap = el('div', {
      class: 'sqb-card__img-wrap',
      style: `aspect-ratio:${ratio || '4/3'}`,
    });
    const img = el('img', {
      class: 'sqb-card__img',
      alt: alt || '',
      sizes: '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw',
      decoding: 'async',
    });

    img.style.objectPosition = focalPoint;

    if (IO_LAZY) {
      // Lazy : stocker src/srcset dans data-attributes, observer déclenche le load
      img.dataset.src = assetUrl;
      img.dataset.srcset = srcset;
      IO_LAZY.observe(img);
    } else {
      // Pas d'IO : charge directement
      img.srcset = srcset;
      img.src = assetUrl;
    }

    img.addEventListener('load', () => img.classList.add('sqb-card__img--loaded'), { once: true });

    wrap.appendChild(img);
    return wrap;
  }

  /* ─────────────────────────────────────────────
   * 5. RENDU CARTE
   * ───────────────────────────────────────────── */

  function buildCard(item, cfg) {
    const disp = cfg.display || {};
    const cardStyle = disp.cardStyle || 'default';
    const tagFields = Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : [];

    const card = el('a', {
      class: `sqb-card sqb-card--${cardStyle}`,
      href: item.fullUrl,
    });

    if (disp.image !== false && item.assetUrl) {
      card.appendChild(buildImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3'));
    }

    const body = el('div', { class: 'sqb-card__body' });

    if (disp.categories !== false && item.categories.length) {
      const meta = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(c => {
        const s = el('span', { class: 'sqb-card__cat' });
        s.textContent = c;
        meta.appendChild(s);
      });
      body.appendChild(meta);
    }

    if (disp.title !== false && item.title) {
      const h = el('h3', { class: 'sqb-card__title' });
      h.textContent = item.title;
      body.appendChild(h);
    }

    tagFields.forEach(({ prefix, label }) => {
      const vals = getTagValuesByPrefix(item, prefix);
      if (!vals.length) return;
      const row = el('div', { class: 'sqb-card__tag-field', 'data-prefix': prefix });
      if (label) {
        const lbl = el('span', { class: 'sqb-card__tag-label' });
        lbl.textContent = label + '\u00A0';
        row.appendChild(lbl);
      }
      const val = el('span', { class: 'sqb-card__tag-value' });
      val.textContent = vals.join(', ');
      row.appendChild(val);
      body.appendChild(row);
    });

    if (disp.excerpt !== false && item.excerpt) {
      const p = el('p', { class: 'sqb-card__excerpt' });
      p.textContent = item.excerpt;
      body.appendChild(p);
    }

    if (disp.location && item.location) {
      const p = el('p', { class: 'sqb-card__location' });
      p.textContent = item.location;
      body.appendChild(p);
    }

    card.appendChild(body);
    return card;
  }

  /* ─────────────────────────────────────────────
   * 6. FILTRES UI
   * ───────────────────────────────────────────── */

  function buildFilterBar(allItems, cfg, onFilter) {
    const filterCfg = cfg.filters || {};
    const i18n = Object.assign({ all: 'Tout', searchPlaceholder: 'Rechercher…' }, cfg.i18n || {});

    const bar = el('div', { class: 'sqb-filters sqb-filters--' + (filterCfg.layout || 'inline') });
    const state = { category: null, tags: {}, search: '' };

    function emit() { onFilter(Object.assign({}, state, { tags: Object.assign({}, state.tags) })); }

    // Catégories
    if (filterCfg.categories !== false) {
      const cats = uniqBy(
        allItems.flatMap(i => i.categories).filter(Boolean),
        c => norm(c)
      ).sort((a, b) => norm(a).localeCompare(norm(b)));

      if (cats.length) {
        const group = el('div', { class: 'sqb-filter-group sqb-filter-group--cats' });

        const allBtn = el('button', { class: 'sqb-filter-btn sqb-filter-btn--active', type: 'button' });
        allBtn.textContent = i18n.all;
        allBtn.addEventListener('click', () => {
          state.category = null;
          group.querySelectorAll('.sqb-filter-btn').forEach(b => b.classList.remove('sqb-filter-btn--active'));
          allBtn.classList.add('sqb-filter-btn--active');
          emit();
        });
        group.appendChild(allBtn);

        cats.forEach(cat => {
          const btn = el('button', { class: 'sqb-filter-btn', type: 'button' });
          btn.textContent = cat;
          btn.addEventListener('click', () => {
            state.category = cat;
            group.querySelectorAll('.sqb-filter-btn').forEach(b => b.classList.remove('sqb-filter-btn--active'));
            btn.classList.add('sqb-filter-btn--active');
            emit();
          });
          group.appendChild(btn);
        });

        bar.appendChild(group);
      }
    }

    // Dropdowns par préfixe de tag
    const prefixes = Array.isArray(filterCfg.tagPrefixes) ? filterCfg.tagPrefixes : [];
    prefixes.forEach(prefix => {
      const vals = uniqBy(
        allItems.flatMap(i => getTagValuesByPrefix(i, prefix)).filter(Boolean),
        v => norm(v)
      ).sort((a, b) => norm(a).localeCompare(norm(b)));
      if (!vals.length) return;

      const group = el('div', { class: 'sqb-filter-group sqb-filter-group--tag', 'data-prefix': prefix });
      const sel = el('select', { class: 'sqb-filter-select', 'aria-label': prefix });

      const opt0 = el('option', { value: '' });
      opt0.textContent = prefix + '\u00A0: ' + i18n.all;
      sel.appendChild(opt0);

      vals.forEach(v => {
        const opt = el('option', { value: v });
        opt.textContent = v;
        sel.appendChild(opt);
      });

      sel.addEventListener('change', () => {
        state.tags[prefix] = sel.value || null;
        emit();
      });

      group.appendChild(sel);
      bar.appendChild(group);
    });

    // Recherche
    if (filterCfg.search !== false) {
      const group = el('div', { class: 'sqb-filter-group sqb-filter-group--search' });
      const input = el('input', {
        class: 'sqb-filter-search',
        type: 'search',
        placeholder: i18n.searchPlaceholder,
        'aria-label': i18n.searchPlaceholder,
      });
      let timer;
      input.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { state.search = input.value.trim(); emit(); }, 200);
      });
      group.appendChild(input);
      bar.appendChild(group);
    }

    return bar;
  }

  /* ─────────────────────────────────────────────
   * 7. RUNNER
   * ───────────────────────────────────────────── */

  async function runConfig(cfg) {
    if (!cfg || cfg.enabled === false) return;

    const target = document.querySelector(cfg.target || '');
    if (!target) return;

    const perf    = cfg.performance || {};
    const pag     = cfg.pagination  || {};
    const i18n    = Object.assign({ loading: 'Chargement…', noResults: 'Aucun résultat',
                    loadMoreLabel: 'Voir plus', endLabel: '' }, cfg.i18n || {},
                    pag.loadMoreLabel ? { loadMoreLabel: pag.loadMoreLabel } : {},
                    pag.endLabel      ? { endLabel: pag.endLabel }           : {});
    const perPage = Number(pag.perPage || 12);
    const mode    = pag.mode || 'load-more';

    // Classes sur le conteneur
    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');
    if (cfg.key) target.classList.add('sqb--' + cfg.key);
    if (cfg.classes) {
      cfg.classes.trim().split(/\s+/).forEach(c => c && target.classList.add(c));
    }

    // Loader
    const loader = el('div', { class: 'sqb-loader', 'aria-live': 'polite' });
    loader.textContent = i18n.loading;
    target.appendChild(loader);

    // Fetch
    let allItems = [];
    const sources = Array.isArray(cfg.sources) ? cfg.sources : [];
    try {
      const results = await Promise.all(
        sources.map(src =>
          fetchAllItems(src.path, perf.maxPages || 10, perf.sessionCache !== false, perf.sessionCacheTTL || 300)
            .then(items => items.map(raw => mapItem(raw, src.path)))
        )
      );
      results.forEach(r => allItems.push(...r));
    } catch (err) {
      if (cfg.debug) console.warn('[SQB]', cfg.key, err);
      loader.textContent = '⚠ Erreur de chargement';
      return;
    }

    if (cfg.debug) console.log('[SQB]', cfg.key, allItems.length, 'items fetched');

    // Déduplication + tri
    allItems = uniqBy(sortItems(allItems, cfg.sort), i => i.fullUrl || i.id);
    loader.remove();

    // État
    let activeFilters = { category: null, tags: {}, search: '' };
    let currentPage = 1;
    let ioInfinite = null;

    // Structure
    const root = el('div', { class: 'sqb-root' });

    if (cfg.filters) {
      root.appendChild(buildFilterBar(allItems, cfg, filters => {
        activeFilters = filters;
        currentPage = 1;
        render();
      }));
    }

    const cols = (cfg.display || {}).columns || {};
    const grid = el('div', {
      class: 'sqb-grid',
      style: [
        '--sqb-cols-mobile:'  + (cols.mobile  || 1),
        '--sqb-cols-tablet:'  + (cols.tablet  || 2),
        '--sqb-cols-desktop:' + (cols.desktop || 3),
      ].join(';'),
    });

    const counter  = el('p',   { class: 'sqb-counter',  'aria-live': 'polite' });
    const footerEl = el('div', { class: 'sqb-footer' });

    root.appendChild(grid);
    root.appendChild(counter);
    root.appendChild(footerEl);
    target.appendChild(root);

    function render() {
      if (ioInfinite) { ioInfinite.disconnect(); ioInfinite = null; }

      const filtered = allItems.filter(item => matchesFilters(item, activeFilters));
      const total    = filtered.length;
      const shown    = filtered.slice(0, currentPage * perPage);

      grid.innerHTML = '';
      footerEl.innerHTML = '';

      if (!shown.length) {
        const empty = el('p', { class: 'sqb-empty' });
        empty.textContent = i18n.noResults;
        grid.appendChild(empty);
        counter.textContent = '';
        return;
      }

      shown.forEach(item => grid.appendChild(buildCard(item, cfg)));
      counter.textContent = shown.length + ' / ' + total;

      const hasMore = shown.length < total;
      if (!hasMore) {
        if (i18n.endLabel) {
          const end = el('p', { class: 'sqb-end-label' });
          end.textContent = i18n.endLabel;
          footerEl.appendChild(end);
        }
        return;
      }

      if (mode === 'load-more') {
        const btn = el('button', { class: 'sqb-load-more', type: 'button' });
        btn.textContent = i18n.loadMoreLabel;
        btn.addEventListener('click', () => { currentPage++; render(); });
        footerEl.appendChild(btn);

      } else if (mode === 'infinite' && 'IntersectionObserver' in window) {
        const sentinel = el('div', { class: 'sqb-sentinel', 'aria-hidden': 'true' });
        footerEl.appendChild(sentinel);
        ioInfinite = new IntersectionObserver(entries => {
          if (!entries[0].isIntersecting) return;
          ioInfinite.disconnect(); ioInfinite = null;
          currentPage++;
          render();
        }, { rootMargin: '400px' });
        ioInfinite.observe(sentinel);
      }
    }

    render();
  }

  /* ─────────────────────────────────────────────
   * 8. POINT D'ENTRÉE
   * ───────────────────────────────────────────── */

  function init() {
    const configs = Array.isArray(window.SQB_CONFIGS) ? window.SQB_CONFIGS : [];
    if (!configs.length) return;
    configs.forEach(cfg => runConfig(cfg).catch(noop));

    document.addEventListener('turbolinks:load', () => {
      configs.forEach(cfg => {
        const t = document.querySelector(cfg.target || '');
        if (t && !t.classList.contains('sqb-block')) runConfig(cfg).catch(noop);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
