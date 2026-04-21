
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
    return (d.textContent || d.innerText || '')
      .replace(/\s+/g, ' ')
      .trim();
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

  function el(tag, attrs, ...children) {
    const e = document.createElement(tag);
    if (attrs) {
      Object.entries(attrs).forEach(([k, v]) => {
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.startsWith('data-')) e.setAttribute(k, v);
        else if (k === 'html') e.innerHTML = v;
        else e[k] = v;
      });
    }
    children.forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  /* Extrait le préfixe et la valeur d'un tag "Prefix: Value" */
  function parseTag(tag) {
    const raw = String(tag || '');
    const idx = raw.indexOf(':');
    if (idx === -1) return { prefix: null, value: raw.trim() };
    return {
      prefix: raw.slice(0, idx).trim(),
      value: raw.slice(idx + 1).trim(),
    };
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

  const MEM_CACHE = new Map(); // clé → items[]

  function cacheGet(key) {
    if (MEM_CACHE.has(key)) return MEM_CACHE.get(key);
    try {
      const raw = sessionStorage.getItem(key);
      if (!raw) return null;
      const { ts, data, ttl } = JSON.parse(raw);
      if (Date.now() - ts > (ttl || 300) * 1000) {
        sessionStorage.removeItem(key);
        return null;
      }
      MEM_CACHE.set(key, data);
      return data;
    } catch (_) { return null; }
  }

  function cacheSet(key, data, ttl, useSession) {
    MEM_CACHE.set(key, data);
    if (!useSession) return;
    try {
      sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), ttl, data }));
    } catch (_) { noop(); }
  }

  async function fetchPage(url) {
    const res = await fetch(url, { credentials: 'same-origin' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  }

  function ensureJsonFormat(url) {
    if (!url) return url;
    if (url.includes('format=json')) return url;
    return url.includes('?') ? url + '&format=json' : url + '?format=json';
  }

  async function fetchAllItems(path, maxPages, useSession, ttl) {
    const cacheKey = 'sqb::' + path + '::' + maxPages;
    const cached = cacheGet(cacheKey);
    if (cached) return cached;

    const items = [];
    let url = ensureJsonFormat(path);
    for (let p = 0; p < (maxPages || 10); p++) {
      let data;
      try { data = await fetchPage(url); } catch (_) { break; }
      const batch = Array.isArray(data?.items) ? data.items
        : Array.isArray(data?.itemList) ? data.itemList : [];
      items.push(...batch);
      const next = data?.pagination?.nextPageUrl;
      if (!next) break;
      url = ensureJsonFormat(next);
    }

    cacheSet(cacheKey, items, ttl || 300, useSession !== false);
    return items;
  }

  /* ─────────────────────────────────────────────
   * 2. MAPPING ITEM
   * ───────────────────────────────────────────── */

  function mapItem(raw, sourcePath) {
    const assetUrl = raw.assetUrl || raw?.asset?.url || null;
    const fp = raw.mediaFocalPoint;
    const focalPoint = (fp && typeof fp.x === 'number' && typeof fp.y === 'number')
      ? `${Math.round(fp.x * 100)}% ${Math.round(fp.y * 100)}%`
      : '50% 50%';

    const excerpt = truncate(raw.excerpt || raw.body || '', 160);

    const location = raw.location
      ? cleanHTML(raw.location.addressTitle || raw.location.addressLine1 || '')
      : '';

    return {
      id: raw.id,
      title: cleanHTML(raw.title || ''),
      fullUrl: raw.fullUrl || (sourcePath + '/' + raw.urlId),
      urlId: raw.urlId || '',
      assetUrl,
      focalPoint,
      categories: (raw.categories || []).map(c => cleanHTML(c)).filter(Boolean),
      tags: (raw.tags || []).map(t => cleanHTML(t)).filter(Boolean),
      excerpt,
      location,
      displayIndex: Number(raw.displayIndex ?? 999999),
      timestamp: Number(raw.startDate || raw.publishOn || raw.addedOn || raw.updatedOn || 0),
      workflowState: raw.workflowState,
      publishOn: raw.publishOn,
      _raw: raw,
    };
  }

  /* ─────────────────────────────────────────────
   * 3. FILTRAGE & TRI
   * ───────────────────────────────────────────── */

  function matchesFilters(item, activeFilters, searchQuery) {
    // Catégorie
    if (activeFilters.category) {
      const want = norm(activeFilters.category);
      if (!item.categories.some(c => norm(c) === want)) return false;
    }

    // Tags préfixés
    if (activeFilters.tags && Object.keys(activeFilters.tags).length) {
      for (const [prefix, value] of Object.entries(activeFilters.tags)) {
        if (!value) continue;
        const values = getTagValuesByPrefix(item, prefix);
        if (!values.some(v => norm(v) === norm(value))) return false;
      }
    }

    // Recherche textuelle
    if (searchQuery) {
      const q = norm(searchQuery);
      const haystack = norm([
        item.title,
        item.excerpt,
        item.location,
        ...item.categories,
        ...item.tags,
      ].join(' '));
      if (!haystack.includes(q)) return false;
    }

    return true;
  }

  function sortItems(items, sort) {
    const { type = 'collection', direction = 'asc' } = sort || {};
    const dir = direction === 'desc' ? -1 : 1;
    return items.slice().sort((a, b) => {
      if (type === 'date') return (a.timestamp - b.timestamp) * dir;
      if (type === 'title') return norm(a.title).localeCompare(norm(b.title)) * dir;
      return (a.displayIndex - b.displayIndex) * dir; // collection
    });
  }

  /* ─────────────────────────────────────────────
   * 4. LAZY-LOAD IMAGES (IntersectionObserver)
   * ───────────────────────────────────────────── */

  const LAZY_OBSERVER = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          const img = entry.target;
          const src = img.dataset.src;
          if (src) {
            img.src = src;
            img.removeAttribute('data-src');
          }
          obs.unobserve(img);
        });
      }, { rootMargin: '200px 0px' })
    : null;

  function makeLazyImg(assetUrl, focalPoint, alt, ratio) {
    const WIDTHS = [300, 500, 750, 1000, 1500];
    const srcset = WIDTHS.map(w => `${assetUrl}?format=${w}w ${w}w`).join(', ');

    const wrapper = el('div', { class: 'sqb-card__img-wrap', style: `aspect-ratio:${ratio || '4/3'}` });
    const img = el('img', {
      class: 'sqb-card__img sqb-lazy',
      alt: alt || '',
      'data-src': assetUrl,
      'data-srcset': srcset,
      style: `object-position:${focalPoint}`,
      loading: 'lazy',
      decoding: 'async',
    });

    // Placeholder couleur
    wrapper.style.background = '#e8e4df';
    wrapper.appendChild(img);

    if (LAZY_OBSERVER) {
      LAZY_OBSERVER.observe(img);
      // Observer srcset aussi
      img.addEventListener('load', () => {
        if (img.dataset.srcset) {
          img.srcset = img.dataset.srcset;
          img.removeAttribute('data-srcset');
        }
      }, { once: true });
    } else {
      img.src = assetUrl;
      img.srcset = srcset;
      img.sizes = '(max-width:768px) 100vw, 50vw';
    }

    return wrapper;
  }

  /* ─────────────────────────────────────────────
   * 5. RENDU CARTE
   * ───────────────────────────────────────────── */

  function buildCard(item, cfg) {
    const disp = cfg.display || {};
    const style = disp.cardStyle || 'default';
    const tagFields = Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : [];

    const card = el('a', {
      class: `sqb-card sqb-card--${style}`,
      href: item.fullUrl,
    });

    if (disp.image !== false && item.assetUrl) {
      card.appendChild(makeLazyImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3'));
    }

    const body = el('div', { class: 'sqb-card__body' });

    if (disp.categories !== false && item.categories.length) {
      const meta = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(c => meta.appendChild(el('span', { class: 'sqb-card__cat' }, c)));
      body.appendChild(meta);
    }

    if (disp.title !== false) {
      body.appendChild(el('h3', { class: 'sqb-card__title' }, item.title));
    }

    tagFields.forEach(({ prefix, label }) => {
      const vals = getTagValuesByPrefix(item, prefix);
      if (!vals.length) return;
      const row = el('div', { class: 'sqb-card__tag-field', 'data-prefix': prefix });
      if (label) row.appendChild(el('span', { class: 'sqb-card__tag-label' }, label + ' '));
      row.appendChild(el('span', { class: 'sqb-card__tag-value' }, vals.join(', ')));
      body.appendChild(row);
    });

    if (disp.excerpt !== false && item.excerpt) {
      body.appendChild(el('p', { class: 'sqb-card__excerpt' }, item.excerpt));
    }

    if (disp.location && item.location) {
      body.appendChild(el('p', { class: 'sqb-card__location' }, item.location));
    }

    card.appendChild(body);
    return card;
  }

  /* ─────────────────────────────────────────────
   * 6. FILTRES UI
   * ───────────────────────────────────────────── */

  function buildFilterBar(allItems, cfg, onFilter) {
    const filterCfg = cfg.filters || {};
    const i18n = { all: 'Tout', searchPlaceholder: 'Rechercher…', ...(cfg.i18n || {}) };

    const bar = el('div', { class: 'sqb-filters sqb-filters--' + (filterCfg.layout || 'inline') });

    const state = {
      category: null,
      tags: {},
      search: '',
    };

    function emit() { onFilter({ ...state }); }

    // ── Catégories ──
    if (filterCfg.categories !== false) {
      const cats = uniqBy(
        allItems.flatMap(i => i.categories).filter(Boolean),
        c => norm(c)
      ).sort((a, b) => norm(a).localeCompare(norm(b)));

      if (cats.length) {
        const group = el('div', { class: 'sqb-filter-group sqb-filter-group--cats' });

        const allBtn = el('button', { class: 'sqb-filter-btn sqb-filter-btn--active', type: 'button' }, i18n.all);
        allBtn.addEventListener('click', () => {
          state.category = null;
          group.querySelectorAll('.sqb-filter-btn').forEach(b => b.classList.remove('sqb-filter-btn--active'));
          allBtn.classList.add('sqb-filter-btn--active');
          emit();
        });
        group.appendChild(allBtn);

        cats.forEach(cat => {
          const btn = el('button', { class: 'sqb-filter-btn', type: 'button' }, cat);
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

    // ── Tags par préfixe (dropdowns) ──
    const prefixes = Array.isArray(filterCfg.tagPrefixes) ? filterCfg.tagPrefixes : [];
    prefixes.forEach(prefix => {
      const vals = uniqBy(
        allItems.flatMap(i => getTagValuesByPrefix(i, prefix)).filter(Boolean),
        v => norm(v)
      ).sort((a, b) => norm(a).localeCompare(norm(b)));

      if (!vals.length) return;

      const group = el('div', { class: 'sqb-filter-group sqb-filter-group--tag', 'data-prefix': prefix });
      const sel = el('select', { class: 'sqb-filter-select', 'aria-label': prefix });

      sel.appendChild(el('option', { value: '' }, prefix + ' : ' + i18n.all));
      vals.forEach(v => sel.appendChild(el('option', { value: v }, v)));

      sel.addEventListener('change', () => {
        state.tags[prefix] = sel.value || null;
        emit();
      });

      group.appendChild(sel);
      bar.appendChild(group);
    });

    // ── Recherche ──
    if (filterCfg.search !== false) {
      const group = el('div', { class: 'sqb-filter-group sqb-filter-group--search' });
      const input = el('input', {
        class: 'sqb-filter-search',
        type: 'search',
        placeholder: i18n.searchPlaceholder,
        'aria-label': i18n.searchPlaceholder,
      });
      let debounce;
      input.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          state.search = input.value.trim();
          emit();
        }, 220);
      });
      group.appendChild(input);
      bar.appendChild(group);
    }

    return bar;
  }

  /* ─────────────────────────────────────────────
   * 7. RUNNER PAR CONFIG
   * ───────────────────────────────────────────── */

  async function runConfig(cfg) {
    if (!cfg || cfg.enabled === false) return;

    const target = document.querySelector(cfg.target || '');
    if (!target) return;

    const i18n = { loading: 'Chargement…', noResults: 'Aucun résultat', loadMoreLabel: 'Voir plus', endLabel: '', ...(cfg.i18n || {}), ...(cfg.pagination?.loadMoreLabel ? { loadMoreLabel: cfg.pagination.loadMoreLabel } : {}), ...(cfg.pagination?.endLabel ? { endLabel: cfg.pagination.endLabel } : {}) };

    const perf = cfg.performance || {};
    const pag = cfg.pagination || {};
    const perPage = Number(pag.perPage || 12);
    const paginationMode = pag.mode || 'load-more'; // 'load-more' | 'infinite' | 'none'

    // Ajoute la classe de bloc
    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');

    // ── Loader ──
    const loader = el('div', { class: 'sqb-loader', 'aria-live': 'polite' }, i18n.loading);
    target.appendChild(loader);

    // ── Fetch toutes les sources ──
    let allItems = [];
    const sources = Array.isArray(cfg.sources) ? cfg.sources : [];

    try {
      const results = await Promise.all(
        sources.map(src =>
          fetchAllItems(
            src.path,
            perf.maxPages || 10,
            perf.sessionCache !== false,
            perf.sessionCacheTTL || 300
          ).then(items => items.map(raw => mapItem(raw, src.path)))
        )
      );
      results.forEach(r => allItems.push(...r));
    } catch (err) {
      loader.textContent = '⚠ Erreur de chargement';
      return;
    }

    // Filtre items publiés uniquement
    allItems = allItems.filter(item => {
      if (item.workflowState !== 1 && item.workflowState !== 'PUBLISHED') return false;
      if (item.publishOn && Number(item.publishOn) > Date.now()) return false;
      return true;
    });

    allItems = uniqBy(sortItems(allItems, cfg.sort), i => i.fullUrl || i.id);

    loader.remove();

    // ── État courant ──
    let activeFilters = { category: null, tags: {}, search: '' };
    let currentPage = 1;

    function getFiltered() {
      return allItems.filter(item => matchesFilters(item, activeFilters, activeFilters.search));
    }

    // ── Structure principale ──
    const root = el('div', { class: 'sqb-root' });

    // Filtres
    if (cfg.filters) {
      const filterBar = buildFilterBar(allItems, cfg, (newFilters) => {
        activeFilters = newFilters;
        currentPage = 1;
        renderGrid();
      });
      root.appendChild(filterBar);
    }

    // Grille
    const cols = cfg.display?.columns || {};
    const gridStyle = [
      `--sqb-cols-mobile:${cols.mobile || 1}`,
      `--sqb-cols-tablet:${cols.tablet || 2}`,
      `--sqb-cols-desktop:${cols.desktop || 3}`,
    ].join(';');

    const grid = el('div', { class: 'sqb-grid', style: gridStyle });
    root.appendChild(grid);

    // Compteur
    const counter = el('p', { class: 'sqb-counter', 'aria-live': 'polite' });
    root.appendChild(counter);

    // Bouton / sentinel
    const footerZone = el('div', { class: 'sqb-footer' });
    root.appendChild(footerZone);

    target.appendChild(root);

    // ── Rendu grille ──
    function renderGrid() {
      const filtered = getFiltered();
      const total = filtered.length;
      const shown = filtered.slice(0, currentPage * perPage);

      // Vider
      grid.innerHTML = '';

      if (!shown.length) {
        grid.appendChild(el('p', { class: 'sqb-empty' }, i18n.noResults));
        counter.textContent = '';
        footerZone.innerHTML = '';
        return;
      }

      shown.forEach(item => grid.appendChild(buildCard(item, cfg)));

      // Compteur
      counter.textContent = `${shown.length} / ${total}`;

      // Pagination
      footerZone.innerHTML = '';
      const hasMore = shown.length < total;

      if (!hasMore) {
        if (i18n.endLabel) {
          footerZone.appendChild(el('p', { class: 'sqb-end-label' }, i18n.endLabel));
        }
        if (infiniteSentinel) infiniteSentinel = null;
        return;
      }

      if (paginationMode === 'load-more') {
        const btn = el('button', { class: 'sqb-load-more', type: 'button' }, i18n.loadMoreLabel);
        btn.addEventListener('click', () => {
          currentPage++;
          renderGrid();
        });
        footerZone.appendChild(btn);

      } else if (paginationMode === 'infinite') {
        const sentinel = el('div', { class: 'sqb-sentinel', 'aria-hidden': 'true' });
        footerZone.appendChild(sentinel);
        if ('IntersectionObserver' in window) {
          const obs = new IntersectionObserver(entries => {
            if (entries[0].isIntersecting) {
              obs.disconnect();
              currentPage++;
              renderGrid();
            }
          }, { rootMargin: '300px' });
          obs.observe(sentinel);
          infiniteSentinel = obs;
        }
      }
    }

    let infiniteSentinel = null;
    renderGrid();
  }

  /* ─────────────────────────────────────────────
   * 8. STYLES INJECTÉS
   * ───────────────────────────────────────────── */

  function injectStyles() {
    if (document.getElementById('sqb-styles')) return;
    const css = `
/* ── Squarespace Blog Block (SQB) ── */
.sqb-block { --sqb-gap: 1.5rem; --sqb-radius: 6px; --sqb-transition: 0.22s ease; }
.sqb-root { width: 100%; }

/* Loader */
.sqb-loader { padding: 2rem; text-align: center; opacity: 0.6; font-style: italic; }

/* Filtres */
.sqb-filters { display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin-bottom: 1.75rem; align-items: center; }
.sqb-filters--sidebar { flex-direction: column; }
.sqb-filter-group { display: flex; flex-wrap: wrap; gap: 0.375rem; align-items: center; }
.sqb-filter-btn {
  appearance: none; border: 1px solid currentColor; background: transparent;
  padding: 0.3em 0.85em; border-radius: 2em; font: inherit; font-size: 0.85em;
  cursor: pointer; opacity: 0.55; transition: opacity var(--sqb-transition), background var(--sqb-transition);
}
.sqb-filter-btn:hover { opacity: 0.9; }
.sqb-filter-btn--active { opacity: 1; background: currentColor; }
.sqb-filter-btn--active span, .sqb-filter-btn--active { color: var(--sqb-filter-btn-text, #fff); }
.sqb-filter-select {
  appearance: none; border: 1px solid currentColor; background: transparent; font: inherit;
  font-size: 0.85em; padding: 0.3em 2em 0.3em 0.75em; border-radius: 2em; cursor: pointer;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='currentColor'/%3E%3C/svg%3E");
  background-repeat: no-repeat; background-position: right 0.6em center; min-width: 8em;
}
.sqb-filter-search {
  border: 1px solid currentColor; background: transparent; font: inherit; font-size: 0.85em;
  padding: 0.3em 0.75em; border-radius: 2em; min-width: 12em; outline: none;
}
.sqb-filter-search:focus { outline: 2px solid currentColor; outline-offset: 2px; }

/* Grille */
.sqb-grid {
  display: grid;
  grid-template-columns: repeat(var(--sqb-cols-mobile, 1), 1fr);
  gap: var(--sqb-gap);
}
@media (min-width: 640px) {
  .sqb-grid { grid-template-columns: repeat(var(--sqb-cols-tablet, 2), 1fr); }
}
@media (min-width: 1024px) {
  .sqb-grid { grid-template-columns: repeat(var(--sqb-cols-desktop, 3), 1fr); }
}

/* Carte */
.sqb-card {
  display: flex; flex-direction: column; text-decoration: none; color: inherit;
  border-radius: var(--sqb-radius); overflow: hidden;
  transition: transform var(--sqb-transition), box-shadow var(--sqb-transition);
}
.sqb-card:hover { transform: translateY(-2px); }
.sqb-card__img-wrap { overflow: hidden; width: 100%; }
.sqb-card__img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 0.4s ease; opacity: 0; transition: opacity 0.3s; }
.sqb-card__img.loaded { opacity: 1; }
.sqb-card:hover .sqb-card__img { transform: scale(1.03); }
.sqb-card__body { padding: 1em 0; flex: 1; display: flex; flex-direction: column; gap: 0.4em; }
.sqb-card__cats { display: flex; flex-wrap: wrap; gap: 0.3em; }
.sqb-card__cat { font-size: 0.75em; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.6; }
.sqb-card__title { margin: 0; font-size: 1.05em; line-height: 1.3; }
.sqb-card__tag-field { font-size: 0.82em; opacity: 0.75; }
.sqb-card__tag-label { font-weight: 600; }
.sqb-card__excerpt { margin: 0; font-size: 0.88em; opacity: 0.7; line-height: 1.5; }
.sqb-card__location { margin: 0; font-size: 0.82em; opacity: 0.6; }

/* Style horizontal */
.sqb-card--horizontal { flex-direction: row; }
.sqb-card--horizontal .sqb-card__img-wrap { width: 40%; min-width: 120px; flex-shrink: 0; aspect-ratio: 1/1 !important; }
.sqb-card--horizontal .sqb-card__body { padding: 0.75em; }

/* Style minimal */
.sqb-card--minimal .sqb-card__img-wrap { display: none; }

/* Compteur */
.sqb-counter { font-size: 0.8em; opacity: 0.5; text-align: right; margin: 0.75rem 0; }

/* Pied */
.sqb-footer { text-align: center; margin-top: 1.5rem; }
.sqb-load-more {
  appearance: none; border: 1px solid currentColor; background: transparent; font: inherit;
  padding: 0.55em 2em; border-radius: 2em; cursor: pointer; font-size: 0.9em;
  transition: background var(--sqb-transition); opacity: 0.75;
}
.sqb-load-more:hover { opacity: 1; }
.sqb-end-label { font-size: 0.8em; opacity: 0.5; font-style: italic; }
.sqb-empty { opacity: 0.5; font-style: italic; text-align: center; padding: 2rem; }
.sqb-sentinel { height: 1px; }

/* Accessibilité */
@media (prefers-reduced-motion: reduce) {
  .sqb-card, .sqb-card__img { transition: none; }
}
    `;
    const style = document.createElement('style');
    style.id = 'sqb-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ─────────────────────────────────────────────
   * 9. POINT D'ENTRÉE
   * ───────────────────────────────────────────── */

  function init() {
    injectStyles();

    const configs = Array.isArray(window.SQB_CONFIGS) ? window.SQB_CONFIGS : [];
    if (!configs.length) return;

    configs.forEach(cfg => {
      runConfig(cfg).catch(err => {
        if (cfg.debug) console.warn('[SQB]', cfg.key, err);
      });
    });

    // Compat Turbolinks / Squarespace AJAX nav
    document.addEventListener('turbolinks:load', () => {
      configs.forEach(cfg => {
        const t = document.querySelector(cfg.target || '');
        if (t && !t.classList.contains('sqb-block')) {
          runConfig(cfg).catch(noop);
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
