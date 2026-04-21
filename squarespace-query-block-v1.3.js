/*!
 * Squarespace Query Block (SQB) v1.3.0
 * Fetch JSON paginé · tabs · groupBy · lazy-load · cache sessionStorage
 * Compatible Weglot · zéro dépendance
 *
 * ─── RÉFÉRENCE CONFIGURATION ─────────────────────────────────────────────────
 *
 * window.SQB_CONFIGS = [
 * {
 *   // ── Identité ─────────────────────────────────────────────────────────────
 *   key:     'programme',        // ID unique → classe sqb--programme sur le bloc
 *   target:  '#sqb-programme',   // Sélecteur CSS du conteneur dans la page
 *   classes: 'ma-classe',        // Classes custom supplémentaires (optionnel)
 *   enabled: true,
 *   debug:   false,
 *
 *   // ── Sources ───────────────────────────────────────────────────────────────
 *   sources: [{ path: '/programme-2026' }],
 *
 *   // ── Pré-filtre fixe (invisible dans l'UI) ────────────────────────────────
 *   preFilter: {
 *     categories:        ['Exposition'],
 *     excludeCategories: ['Brouillon'],
 *     tagValues:         [{ prefix: 'Sélection', value: 'Homepage' }],
 *   },
 *
 *   // ── Filtres UI ───────────────────────────────────────────────────────────
 *   // false = aucun filtre
 *   filters: {
 *     layout: 'pills',           // 'pills' | 'dropdowns' | 'sidebar'
 *     // pills    = boutons pour catégories ET tag-prefix (peu de valeurs)
 *     // dropdowns = selects pour tout (beaucoup de valeurs)
 *     // sidebar  = filtres en colonne à gauche, grille à droite
 *
 *     tabs: [
 *       { label: 'Expositions', filter: { categories: ['Exposition'] } },
 *       { label: 'Événements',  filter: { categories: ['Talk', 'Visite guidée'] } },
 *     ],
 *     defaultTab: 0,
 *
 *     categories:      true,
 *     defaultCategory: null,
 *
 *     tagPrefixes: ['Date', 'Zone', 'Lieu'],
 *     defaultTags: {},
 *     datePrefix:  'Date',       // trié chronologiquement
 *
 *     search: true,
 *   },
 *
 *   // ── Affichage ────────────────────────────────────────────────────────────
 *   display: {
 *     layout: 'grid',            // 'grid' | 'list'
 *     counter: true,
 *     cardLink: true,
 *     imageRatio: '4/3',
 *
 *     groupBy: null,             // null | 'category' | { tagPrefix: 'Date' }
 *     groupOrder: 'collection',  // 'collection' | 'alpha' | ['Val1', 'Val2', …]
 *
 *     // Rendu par groupes sémantiques (remplace le rendu plat si défini)
 *     // Rôles  : 'media' | 'header' | 'body' | 'meta' | 'footer'
 *     // Enfants: 'image' | 'title' | 'categories' | 'excerpt' | 'location'
 *     //          { type: 'tagPrefix', prefix: 'Artiste', label: 'Artiste·s' }
 *     groups: [
 *       { role: 'media', children: ['image'] },
 *       { role: 'body',  children: [
 *           'categories',
 *           'title',
 *           { type: 'tagPrefix', prefix: 'Numéro', label: 'Étape' },
 *           { type: 'tagPrefix', prefix: 'Artiste', label: 'Artiste·s' },
 *           { type: 'tagPrefix', prefix: 'Lieu',    label: 'Lieu' },
 *           'excerpt',
 *       ]},
 *     ],
 *
 *     // Rendu plat (si groups absent) :
 *     image: true, title: true, categories: true, excerpt: true, location: false,
 *     tagPrefixFields: [
 *       { prefix: 'Numéro',  label: 'Étape' },
 *       { prefix: 'Artiste', label: 'Artiste·s' },
 *     ],
 *   },
 *
 *   // ── Tri ──────────────────────────────────────────────────────────────────
 *   // type: 'collection' | 'date' | 'title' | 'category' | { tagPrefix: 'Numéro' }
 *   sort: { type: 'collection', direction: 'asc' },
 *
 *   // ── Pagination ───────────────────────────────────────────────────────────
 *   pagination: {
 *     mode:          'load-more',  // 'load-more' | 'infinite' | 'none'
 *     perPage:       12,
 *     loadMoreLabel: 'Voir plus',
 *     endLabel:      false,        // false | string
 *   },
 *
 *   // ── Performance ──────────────────────────────────────────────────────────
 *   performance: { maxPages: 10, sessionCache: true, sessionCacheTTL: 300 },
 *
 *   // ── Textes ───────────────────────────────────────────────────────────────
 *   // loading: false ou absent = animation trois points (défaut)
 *   // loading: 'Chargement…'  = texte à la place de l'animation
 *   i18n: {
 *     loading:           false,
 *     all:               'Tout',
 *     noResults:         'Aucun résultat',
 *     searchPlaceholder: 'Rechercher…',
 *   },
 * }
 * ];
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════
   * 0. UTILITAIRES
   * ═══════════════════════════════════════════════ */

  function noop() {}

  function norm(str) {
    return String(str || '')
      .replace(/\u00A0/g, ' ').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019']/g, "'").replace(/&/g, 'and')
      .replace(/\s+/g, ' ').trim();
  }

  function cleanHTML(str) {
    var d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    var s = cleanHTML(str);
    if (!s || s.length <= max) return s;
    var cut = s.slice(0, max);
    var sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '\u2026';
  }

  function uniqBy(arr, fn) {
    var seen = new Set();
    return arr.filter(function(item) {
      var k = fn(item);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
      var v = attrs[k];
      if (v == null) return;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.indexOf('data-') === 0) e.setAttribute(k, v);
      else e[k] = v;
    });
    return e;
  }

  function setText(elem, str) { elem.textContent = str; return elem; }

  function parseTag(tag) {
    var raw = String(tag || '');
    var idx = raw.indexOf(':');
    if (idx === -1) return { prefix: null, value: raw.trim() };
    return { prefix: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
  }

  function getTagValuesByPrefix(item, prefix) {
    var pNorm = norm(String(prefix).replace(/:$/, ''));
    return (item.tags || []).reduce(function(acc, tag) {
      var p = parseTag(tag);
      if (p.prefix && norm(p.prefix) === pNorm && p.value) acc.push(p.value);
      return acc;
    }, []);
  }

  /* ═══════════════════════════════════════════════
   * 1. STYLES INJECTÉS (loader uniquement)
   * Le reste du CSS est dans Custom CSS Squarespace.
   * ═══════════════════════════════════════════════ */

  function injectLoaderStyles() {
    if (document.getElementById('sqb-loader-styles')) return;
    var css = [
      '.sqb-loader{display:flex;align-items:center;justify-content:center;gap:16px;padding:3rem 1rem;min-height:6rem}',
      '.sqb-loader-dot{width:4px;height:4px;border-radius:50%;background:var(--paragraphMediumColor,currentColor);opacity:.2;animation:sqb-pulse 1.2s infinite ease-in-out}',
      '.sqb-loader-dot:nth-child(1){animation-delay:0s}',
      '.sqb-loader-dot:nth-child(2){animation-delay:.4s}',
      '.sqb-loader-dot:nth-child(3){animation-delay:.8s}',
      '@keyframes sqb-pulse{0%,100%{opacity:.2}33%{opacity:.7}66%{opacity:.4}}',
      '.sqb-loader--text{display:block;font-style:italic;opacity:.5;text-align:center;padding:3rem 1rem}',
    ].join('');
    var s = document.createElement('style');
    s.id = 'sqb-loader-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildLoader(loadingText) {
    // loadingText = false ou absent → animation points
    // loadingText = string non vide → texte
    if (loadingText) {
      var d = el('div', { class: 'sqb-loader sqb-loader--text', 'aria-live': 'polite' });
      d.textContent = loadingText;
      return d;
    }
    var wrap = el('div', { class: 'sqb-loader', 'aria-label': 'Chargement', role: 'status' });
    for (var i = 0; i < 3; i++) wrap.appendChild(el('span', { class: 'sqb-loader-dot', 'aria-hidden': 'true' }));
    return wrap;
  }

  /* ═══════════════════════════════════════════════
   * 2. FETCH & CACHE
   * ═══════════════════════════════════════════════ */

  var MEM = new Map();

  function cacheGet(key) {
    if (MEM.has(key)) return MEM.get(key);
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (Date.now() - p.ts > (p.ttl || 300) * 1000) { sessionStorage.removeItem(key); return null; }
      MEM.set(key, p.data); return p.data;
    } catch (_) { return null; }
  }

  function cacheSet(key, data, ttl, useSession) {
    MEM.set(key, data);
    if (!useSession) return;
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), ttl: ttl, data: data })); } catch (_) { noop(); }
  }

  function ensureJson(url) {
    if (!url) return url;
    return url.indexOf('format=json') !== -1 ? url : (url.indexOf('?') !== -1 ? url + '&format=json' : url + '?format=json');
  }

  async function fetchAllItems(path, maxPages, useSession, ttl) {
    var key = 'sqb::v3::' + path + '::' + (maxPages || 10);
    var cached = cacheGet(key);
    if (cached) return cached;
    var items = [], url = ensureJson(path);
    for (var p = 0; p < (maxPages || 10); p++) {
      var data;
      try {
        var res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) break;
        data = await res.json();
      } catch (_) { break; }
      var batch = Array.isArray(data && data.items) ? data.items : Array.isArray(data && data.itemList) ? data.itemList : [];
      items.push.apply(items, batch);
      var next = data && data.pagination && data.pagination.nextPageUrl;
      if (!next) break;
      url = ensureJson(next);
    }
    cacheSet(key, items, ttl || 300, useSession !== false);
    return items;
  }

  /* ═══════════════════════════════════════════════
   * 3. MAPPING
   * ═══════════════════════════════════════════════ */

  function mapItem(raw, sourcePath) {
    var assetUrl = raw.assetUrl || (raw.asset && raw.asset.url) || null;
    var fp = raw.mediaFocalPoint;
    var focalPoint = (fp && typeof fp.x === 'number' && typeof fp.y === 'number')
      ? (Math.round(fp.x * 100) + '% ' + Math.round(fp.y * 100) + '%') : '50% 50%';
    var loc = raw.location;
    return {
      id:           raw.id,
      title:        cleanHTML(raw.title || ''),
      fullUrl:      raw.fullUrl || (sourcePath + '/' + (raw.urlId || '')),
      urlId:        raw.urlId || '',
      assetUrl:     assetUrl,
      focalPoint:   focalPoint,
      categories:   (raw.categories || []).map(cleanHTML).filter(Boolean),
      tags:         (raw.tags || []).map(cleanHTML).filter(Boolean),
      excerpt:      truncate(raw.excerpt || raw.body || '', 160),
      location:     loc ? cleanHTML(loc.addressTitle || loc.addressLine1 || '') : '',
      displayIndex: Number(raw.displayIndex != null ? raw.displayIndex : 999999),
      timestamp:    Number(raw.startDate || raw.publishOn || raw.addedOn || raw.updatedOn || 0),
    };
  }

  /* ═══════════════════════════════════════════════
   * 4. FILTRAGE
   * ═══════════════════════════════════════════════ */

  function matchesCatFilter(item, cats) {
    if (!cats || !cats.length) return true;
    return item.categories.some(function(c) {
      return cats.some(function(w) { return norm(w) === norm(c); });
    });
  }

  function applyPreFilter(items, pf) {
    if (!pf) return items;
    return items.filter(function(item) {
      if (pf.categories && !matchesCatFilter(item, pf.categories)) return false;
      if (pf.excludeCategories && matchesCatFilter(item, pf.excludeCategories)) return false;
      if (pf.tagValues) {
        for (var i = 0; i < pf.tagValues.length; i++) {
          var tv = pf.tagValues[i];
          if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) { return norm(v) === norm(tv.value); })) return false;
        }
      }
      return true;
    });
  }

  function applyTabFilter(items, tabFilter) {
    if (!tabFilter) return items;
    return items.filter(function(item) {
      if (tabFilter.categories && !matchesCatFilter(item, tabFilter.categories)) return false;
      if (tabFilter.tagValues) {
        for (var i = 0; i < tabFilter.tagValues.length; i++) {
          var tv = tabFilter.tagValues[i];
          if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) { return norm(v) === norm(tv.value); })) return false;
        }
      }
      return true;
    });
  }

  function matchesUIFilters(item, state) {
    if (state.category && !item.categories.some(function(c) { return norm(c) === norm(state.category); })) return false;
    var tags = state.tags || {};
    for (var prefix in tags) {
      if (!Object.prototype.hasOwnProperty.call(tags, prefix) || !tags[prefix]) continue;
      if (!getTagValuesByPrefix(item, prefix).some(function(v) { return norm(v) === norm(tags[prefix]); })) return false;
    }
    if (state.search) {
      var q = norm(state.search);
      var hay = norm([item.title, item.excerpt, item.location].concat(item.categories, item.tags).join(' '));
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ═══════════════════════════════════════════════
   * 5. TRI
   * ═══════════════════════════════════════════════ */

  function tryNum(str) { var n = parseFloat(String(str || '').replace(',', '.')); return isFinite(n) ? n : null; }

  function sortItems(items, sort) {
    if (!sort) return items;
    var type = sort.type || 'collection';
    var dir  = (sort.direction || 'asc') === 'desc' ? -1 : 1;
    return items.slice().sort(function(a, b) {
      if (type === 'date')     return (a.timestamp - b.timestamp) * dir;
      if (type === 'title')    return norm(a.title).localeCompare(norm(b.title)) * dir;
      if (type === 'category') return norm(a.categories[0] || '').localeCompare(norm(b.categories[0] || '')) * dir;
      if (typeof type === 'object' && type.tagPrefix) {
        var av = getTagValuesByPrefix(a, type.tagPrefix)[0] || '';
        var bv = getTagValuesByPrefix(b, type.tagPrefix)[0] || '';
        var an = tryNum(av), bn = tryNum(bv);
        if (an !== null && bn !== null) return (an - bn) * dir;
        return norm(av).localeCompare(norm(bv)) * dir;
      }
      return (a.displayIndex - b.displayIndex) * dir;
    });
  }

  /* ═══════════════════════════════════════════════
   * 6. LAZY-LOAD
   * ═══════════════════════════════════════════════ */

  var IO_LAZY = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function(entries, obs) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          if (img.dataset.src)    img.src    = img.dataset.src;
          img.removeAttribute('data-src'); img.removeAttribute('data-srcset');
          obs.unobserve(img);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  var SRCSET_WIDTHS = [300, 500, 750, 1000, 1500, 2500];

  function buildImg(assetUrl, focalPoint, alt, ratio) {
    var srcset = SRCSET_WIDTHS.map(function(w) { return assetUrl + '?format=' + w + 'w ' + w + 'w'; }).join(', ');
    var wrap = el('div', { class: 'sqb-card__img-wrap', style: 'aspect-ratio:' + (ratio || '4/3') });
    var img  = el('img', { class: 'sqb-card__img', alt: alt || '', sizes: '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw', decoding: 'async' });
    img.style.objectPosition = focalPoint;
    if (IO_LAZY) { img.dataset.src = assetUrl; img.dataset.srcset = srcset; IO_LAZY.observe(img); }
    else         { img.srcset = srcset; img.src = assetUrl; }
    img.addEventListener('load', function() { img.classList.add('sqb-card__img--loaded'); }, { once: true });
    wrap.appendChild(img);
    return wrap;
  }

  /* ═══════════════════════════════════════════════
   * 7. RENDU CARTE
   * ═══════════════════════════════════════════════ */

  var ROLE_CLASS = { media: 'sqb-card__media', header: 'sqb-card__header', body: 'sqb-card__body', meta: 'sqb-card__meta', footer: 'sqb-card__footer' };

  function buildChild(def, item, disp) {
    var type = typeof def === 'string' ? def : (def && def.type);
    if (type === 'image')      return (disp.image !== false && item.assetUrl) ? buildImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3') : null;
    if (type === 'categories') {
      if (disp.categories === false || !item.categories.length) return null;
      var w = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) { var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; w.appendChild(s); });
      return w;
    }
    if (type === 'title')    return (disp.title !== false && item.title)    ? setText(el('h3', { class: 'sqb-card__title' }), item.title)    : null;
    if (type === 'excerpt')  return (disp.excerpt !== false && item.excerpt) ? setText(el('p',  { class: 'sqb-card__excerpt' }), item.excerpt) : null;
    if (type === 'location') return item.location                           ? setText(el('p',  { class: 'sqb-card__location' }), item.location) : null;
    if (type === 'tagPrefix') {
      var vals = getTagValuesByPrefix(item, def.prefix || '');
      if (!vals.length) return null;
      var row = el('div', { class: 'sqb-card__tag-field', 'data-prefix': def.prefix });
      if (def.label) { var lbl = el('span', { class: 'sqb-card__tag-label' }); lbl.textContent = def.label + '\u00A0'; row.appendChild(lbl); }
      var val = el('span', { class: 'sqb-card__tag-value' }); val.textContent = vals.join(', '); row.appendChild(val);
      return row;
    }
    return null;
  }

  function buildCard(item, cfg) {
    var disp = cfg.display || {};
    var link = disp.cardLink !== false;
    var card = el(link ? 'a' : 'div', { class: 'sqb-card' });
    if (link) card.href = item.fullUrl;

    var groups = Array.isArray(disp.groups) && disp.groups.length ? disp.groups : null;
    if (groups) {
      groups.forEach(function(grp) {
        var wrapper = el('div', { class: ROLE_CLASS[grp.role] || 'sqb-card__group' });
        (grp.children || []).forEach(function(def) {
          var node = buildChild(def, item, disp);
          if (node) wrapper.appendChild(node);
        });
        if (wrapper.hasChildNodes()) card.appendChild(wrapper);
      });
      return card;
    }

    // Rendu plat
    if (disp.image !== false && item.assetUrl) card.appendChild(buildImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3'));
    var body = el('div', { class: 'sqb-card__body' });
    if (disp.categories !== false && item.categories.length) {
      var meta = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) { var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; meta.appendChild(s); });
      body.appendChild(meta);
    }
    if (disp.title !== false && item.title) body.appendChild(setText(el('h3', { class: 'sqb-card__title' }), item.title));
    (Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : []).forEach(function(f) {
      var node = buildChild({ type: 'tagPrefix', prefix: f.prefix, label: f.label }, item, disp);
      if (node) body.appendChild(node);
    });
    if (disp.excerpt !== false && item.excerpt) body.appendChild(setText(el('p', { class: 'sqb-card__excerpt' }), item.excerpt));
    if (disp.location && item.location)         body.appendChild(setText(el('p', { class: 'sqb-card__location' }), item.location));
    card.appendChild(body);
    return card;
  }

  /* ═══════════════════════════════════════════════
   * 8. GROUPBY VISUEL
   * ═══════════════════════════════════════════════ */

  function getGroupKey(item, groupBy) {
    if (!groupBy) return null;
    if (groupBy === 'category') return item.categories[0] || '\u2014';
    if (typeof groupBy === 'object' && groupBy.tagPrefix) return getTagValuesByPrefix(item, groupBy.tagPrefix)[0] || '\u2014';
    return null;
  }

  function sortGroupKeys(keys, groupOrder) {
    if (Array.isArray(groupOrder)) {
      var om = new Map(groupOrder.map(function(v, i) { return [norm(v), i]; }));
      return keys.slice().sort(function(a, b) {
        var ai = om.has(norm(a)) ? om.get(norm(a)) : 9999, bi = om.has(norm(b)) ? om.get(norm(b)) : 9999;
        return ai !== bi ? ai - bi : norm(a).localeCompare(norm(b));
      });
    }
    if (groupOrder === 'alpha') return keys.slice().sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
    return keys;
  }

  function renderGrouped(items, cfg, grid) {
    var groupBy    = cfg.display && cfg.display.groupBy || null;
    var groupOrder = cfg.display && cfg.display.groupOrder || 'collection';
    if (!groupBy) { items.forEach(function(item) { grid.appendChild(buildCard(item, cfg)); }); return; }
    var orderedKeys = [], groups = new Map();
    items.forEach(function(item) {
      var key = getGroupKey(item, groupBy);
      if (!groups.has(key)) { groups.set(key, []); orderedKeys.push(key); }
      groups.get(key).push(item);
    });
    sortGroupKeys(orderedKeys, groupOrder).forEach(function(key) {
      var gi = groups.get(key) || [];
      if (!gi.length) return;
      var h = el('div', { class: 'sqb-group-heading', 'data-group': key, style: 'grid-column:1 / -1' });
      setText(h, key); grid.appendChild(h);
      gi.forEach(function(item) { grid.appendChild(buildCard(item, cfg)); });
    });
  }

  /* ═══════════════════════════════════════════════
   * 9. TRI CHRONOLOGIQUE DES TAGS DATE
   * ═══════════════════════════════════════════════ */

  var MONTH_MAP = {
    january:1,february:2,march:3,april:4,may:5,june:6,july:7,august:8,september:9,october:10,november:11,december:12,
    janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12,
  };

  function parseTagDate(str) {
    var s = String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var m = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (!m || !MONTH_MAP[m[2]]) return null;
    return new Date(parseInt(m[3], 10), MONTH_MAP[m[2]] - 1, parseInt(m[1], 10)).getTime();
  }

  function sortTagValues(vals, prefix, datePrefix) {
    var isDate = datePrefix && norm(prefix) === norm(datePrefix);
    if (!isDate) return vals.slice().sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
    return vals.slice().sort(function(a, b) {
      var at = parseTagDate(a), bt = parseTagDate(b);
      if (at !== null && bt !== null) return at - bt;
      return at !== null ? -1 : bt !== null ? 1 : norm(a).localeCompare(norm(b));
    });
  }

  /* ═══════════════════════════════════════════════
   * 10. FILTRES UI
   * ═══════════════════════════════════════════════ */

  function buildFilterBar(baseItems, cfg, onFilter) {
    if (cfg.filters === false) return null;
    var fc      = cfg.filters || {};
    var layout  = fc.layout || 'pills';
    var i18n    = Object.assign({ all: 'Tout', searchPlaceholder: 'Rechercher\u2026' }, cfg.i18n || {});
    var datePrefix = fc.datePrefix || null;
    var usePills   = layout !== 'dropdowns'; // pills & sidebar → boutons; dropdowns → selects

    var bar   = el('div', { class: 'sqb-filters sqb-filters--' + layout });
    var state = { tab: null, category: null, tags: {}, search: '' };
    var secondaryEl = null;

    function emit() {
      var t = {}; Object.keys(state.tags).forEach(function(k) { t[k] = state.tags[k]; });
      onFilter({ tab: state.tab, category: state.category, tags: t, search: state.search });
    }
    function tabPool() { return state.tab ? applyTabFilter(baseItems, state.tab) : baseItems; }
    function resetSec() { state.category = null; state.tags = {}; state.search = ''; }

    function buildCategoryControl(pool, container) {
      if (fc.categories === false) return;
      var cats = uniqBy(
        pool.reduce(function(a, i) { return a.concat(i.categories); }, []).filter(Boolean), norm
      ).sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
      if (cats.length < 2) return;

      var group = el('div', { class: 'sqb-filter-group sqb-filter-group--cats' });

      if (usePills) {
        // Boutons pills
        var allBtn = el('button', { class: 'sqb-filter-btn sqb-filter-btn--active', type: 'button' });
        setText(allBtn, i18n.all);
        allBtn.addEventListener('click', function() {
          state.category = null;
          group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
          allBtn.classList.add('sqb-filter-btn--active'); emit();
        });
        group.appendChild(allBtn);
        cats.forEach(function(cat) {
          var isDef = fc.defaultCategory && norm(cat) === norm(fc.defaultCategory);
          var btn = el('button', { class: 'sqb-filter-btn' + (isDef ? ' sqb-filter-btn--active' : ''), type: 'button' });
          setText(btn, cat);
          if (isDef) { state.category = cat; allBtn.classList.remove('sqb-filter-btn--active'); }
          btn.addEventListener('click', function() {
            state.category = cat;
            group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
            btn.classList.add('sqb-filter-btn--active'); emit();
          });
          group.appendChild(btn);
        });
      } else {
        // Select dropdown
        var sel = el('select', { class: 'sqb-filter-select', 'aria-label': 'Catégorie' });
        var o0 = el('option', { value: '' }); o0.textContent = 'Catégorie\u00a0: ' + i18n.all; sel.appendChild(o0);
        cats.forEach(function(cat) {
          var o = el('option', { value: cat }); o.textContent = cat;
          if (fc.defaultCategory && norm(cat) === norm(fc.defaultCategory)) { o.selected = true; state.category = cat; }
          sel.appendChild(o);
        });
        sel.addEventListener('change', function() { state.category = sel.value || null; emit(); });
        group.appendChild(sel);
      }
      container.appendChild(group);
    }

    function buildTagControl(pool, prefix, container) {
      var raw  = uniqBy(pool.reduce(function(a, i) { return a.concat(getTagValuesByPrefix(i, prefix)); }, []).filter(Boolean), norm);
      var vals = sortTagValues(raw, prefix, datePrefix);
      if (!vals.length) return;
      var group = el('div', { class: 'sqb-filter-group sqb-filter-group--tag', 'data-prefix': prefix });
      var defVal = fc.defaultTags && fc.defaultTags[prefix];

      if (usePills) {
        var allBtn = el('button', { class: 'sqb-filter-btn sqb-filter-btn--active', type: 'button' });
        setText(allBtn, prefix + '\u00a0: ' + i18n.all);
        allBtn.addEventListener('click', function() {
          state.tags[prefix] = null;
          group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
          allBtn.classList.add('sqb-filter-btn--active'); emit();
        });
        group.appendChild(allBtn);
        vals.forEach(function(v) {
          var isDef = defVal && norm(v) === norm(defVal);
          var btn = el('button', { class: 'sqb-filter-btn' + (isDef ? ' sqb-filter-btn--active' : ''), type: 'button' });
          setText(btn, v);
          if (isDef) { state.tags[prefix] = v; allBtn.classList.remove('sqb-filter-btn--active'); }
          btn.addEventListener('click', function() {
            state.tags[prefix] = v;
            group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
            btn.classList.add('sqb-filter-btn--active'); emit();
          });
          group.appendChild(btn);
        });
      } else {
        var sel = el('select', { class: 'sqb-filter-select', 'aria-label': prefix });
        var o0 = el('option', { value: '' }); o0.textContent = prefix + '\u00a0: ' + i18n.all; sel.appendChild(o0);
        vals.forEach(function(v) {
          var o = el('option', { value: v }); o.textContent = v;
          if (defVal && norm(v) === norm(defVal)) { o.selected = true; state.tags[prefix] = v; }
          sel.appendChild(o);
        });
        sel.addEventListener('change', function() { state.tags[prefix] = sel.value || null; emit(); });
        group.appendChild(sel);
      }
      container.appendChild(group);
    }

    function buildSearchControl(container) {
      if (fc.search === false) return;
      var group = el('div', { class: 'sqb-filter-group sqb-filter-group--search' });
      var input = el('input', { class: 'sqb-filter-search', type: 'search', placeholder: i18n.searchPlaceholder, 'aria-label': i18n.searchPlaceholder });
      var timer;
      input.addEventListener('input', function() {
        clearTimeout(timer);
        timer = setTimeout(function() { state.search = input.value.trim(); emit(); }, 200);
      });
      group.appendChild(input); container.appendChild(group);
    }

    function buildSecondary(pool, container) {
      buildCategoryControl(pool, container);
      (Array.isArray(fc.tagPrefixes) ? fc.tagPrefixes : []).forEach(function(p) { buildTagControl(pool, p, container); });
      buildSearchControl(container);
    }

    function rebuildSecondary() {
      if (!secondaryEl) return;
      secondaryEl.innerHTML = '';
      buildSecondary(tabPool(), secondaryEl);
    }

    // Tabs
    var tabs = Array.isArray(fc.tabs) ? fc.tabs : [];
    if (tabs.length) {
      var tabGroup = el('div', { class: 'sqb-filter-group sqb-filter-group--tabs' });
      var defIdx   = Number(fc.defaultTab != null ? fc.defaultTab : 0);
      tabs.forEach(function(tab, idx) {
        var active = idx === defIdx;
        var btn = el('button', { class: 'sqb-tab-btn' + (active ? ' sqb-tab-btn--active' : ''), type: 'button' });
        setText(btn, tab.label || 'Tab');
        if (active) state.tab = tab.filter || null;
        btn.addEventListener('click', function() {
          if (btn.classList.contains('sqb-tab-btn--active')) return;
          tabGroup.querySelectorAll('.sqb-tab-btn').forEach(function(b) { b.classList.remove('sqb-tab-btn--active'); });
          btn.classList.add('sqb-tab-btn--active');
          state.tab = tab.filter || null;
          resetSec(); rebuildSecondary(); emit();
        });
        tabGroup.appendChild(btn);
      });
      bar.appendChild(tabGroup);
    }

    secondaryEl = el('div', { class: 'sqb-filters-secondary' });
    buildSecondary(tabPool(), secondaryEl);
    bar.appendChild(secondaryEl);

    return bar;
  }

  /* ═══════════════════════════════════════════════
   * 11. RUNNER
   * ═══════════════════════════════════════════════ */

  async function runConfig(cfg) {
    if (!cfg || cfg.enabled === false) return;
    var target = document.querySelector(cfg.target || '');
    if (!target) return;

    var perf = cfg.performance || {}, pag = cfg.pagination || {}, disp = cfg.display || {};
    var i18n = Object.assign({ loading: false, all: 'Tout', noResults: 'Aucun r\u00e9sultat', loadMoreLabel: 'Voir plus', endLabel: '' }, cfg.i18n || {});
    if (pag.loadMoreLabel)           i18n.loadMoreLabel = pag.loadMoreLabel;
    if (pag.endLabel !== undefined)  i18n.endLabel      = pag.endLabel;

    var perPage = Number(pag.perPage || 12);
    var mode    = pag.mode || 'load-more';
    var displayLayout = disp.layout || 'grid'; // 'grid' | 'list'

    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');
    if (cfg.key)     target.classList.add('sqb--' + cfg.key);
    if (cfg.classes) cfg.classes.trim().split(/\s+/).forEach(function(c) { if (c) target.classList.add(c); });
    if (displayLayout === 'list') target.classList.add('sqb-block--list');

    injectLoaderStyles();
    var loader = buildLoader(i18n.loading);
    target.appendChild(loader);

    // Fetch
    var rawItems = [];
    var sources  = Array.isArray(cfg.sources) ? cfg.sources : [];
    try {
      var results = await Promise.all(sources.map(function(src) {
        return fetchAllItems(src.path, perf.maxPages || 10, perf.sessionCache !== false, perf.sessionCacheTTL || 300)
          .then(function(items) { return items.map(function(raw) { return mapItem(raw, src.path); }); });
      }));
      results.forEach(function(r) { rawItems.push.apply(rawItems, r); });
    } catch (err) {
      if (cfg.debug) console.warn('[SQB]', cfg.key, err);
      loader.remove();
      var errEl = el('p', { class: 'sqb-error' }); errEl.textContent = '\u26A0\uFE0F Erreur de chargement'; target.appendChild(errEl);
      return;
    }

    rawItems = uniqBy(rawItems, function(i) { return i.fullUrl || i.id; });
    rawItems = applyPreFilter(rawItems, cfg.preFilter || null);
    rawItems = sortItems(rawItems, cfg.sort);
    if (cfg.debug) console.log('[SQB]', cfg.key, rawItems.length, 'items');
    loader.remove();

    var activeFilters = { tab: null, category: null, tags: {}, search: '' };
    var currentPage   = 1;
    var ioInfinite    = null;

    // Init présélections
    var fc = (cfg.filters && cfg.filters !== false) ? cfg.filters : {};
    if (Array.isArray(fc.tabs) && fc.tabs.length) {
      var di = Number(fc.defaultTab != null ? fc.defaultTab : 0);
      if (fc.tabs[di]) activeFilters.tab = fc.tabs[di].filter || null;
    }
    if (fc.defaultCategory) activeFilters.category = fc.defaultCategory;
    if (fc.defaultTags)     Object.assign(activeFilters.tags, fc.defaultTags);

    var root     = el('div', { class: 'sqb-root' });
    var filterBar = buildFilterBar(rawItems, cfg, function(f) { activeFilters = f; currentPage = 1; render(); });
    if (filterBar) root.appendChild(filterBar);

    var gridClass = displayLayout === 'list' ? 'sqb-grid sqb-grid--list' : 'sqb-grid';
    var grid     = el('div', { class: gridClass });
    var counter  = el('p',  { class: 'sqb-counter', 'aria-live': 'polite' });
    var footerEl = el('div', { class: 'sqb-footer' });

    root.appendChild(grid);
    if (disp.counter !== false) root.appendChild(counter);
    root.appendChild(footerEl);
    target.appendChild(root);

    function render() {
      if (ioInfinite) { ioInfinite.disconnect(); ioInfinite = null; }
      var pool     = activeFilters.tab ? applyTabFilter(rawItems, activeFilters.tab) : rawItems;
      var filtered = pool.filter(function(item) { return matchesUIFilters(item, activeFilters); });
      var total    = filtered.length;
      var shown    = filtered.slice(0, currentPage * perPage);

      grid.innerHTML = ''; footerEl.innerHTML = '';

      if (!shown.length) {
        var empty = el('p', { class: 'sqb-empty' }); setText(empty, i18n.noResults); grid.appendChild(empty);
        if (disp.counter !== false) counter.textContent = '';
        return;
      }

      renderGrouped(shown, cfg, grid);
      if (disp.counter !== false) counter.textContent = shown.length + '\u00a0/\u00a0' + total;

      var hasMore = shown.length < total;
      if (!hasMore) {
        if (i18n.endLabel !== false && i18n.endLabel) footerEl.appendChild(setText(el('p', { class: 'sqb-end-label' }), i18n.endLabel));
        return;
      }
      if (mode === 'load-more') {
        var btn = el('button', { class: 'sqb-load-more', type: 'button' }); setText(btn, i18n.loadMoreLabel);
        btn.addEventListener('click', function() { currentPage++; render(); }); footerEl.appendChild(btn);
      } else if (mode === 'infinite' && 'IntersectionObserver' in window) {
        var sentinel = el('div', { class: 'sqb-sentinel', 'aria-hidden': 'true' }); footerEl.appendChild(sentinel);
        ioInfinite = new IntersectionObserver(function(entries) {
          if (!entries[0].isIntersecting) return;
          ioInfinite.disconnect(); ioInfinite = null; currentPage++; render();
        }, { rootMargin: '400px' });
        ioInfinite.observe(sentinel);
      }
    }

    render();
  }

  /* ═══════════════════════════════════════════════
   * 12. POINT D'ENTRÉE
   * ═══════════════════════════════════════════════ */

  function init() {
    var configs = Array.isArray(window.SQB_CONFIGS) ? window.SQB_CONFIGS : [];
    if (!configs.length) return;
    configs.forEach(function(cfg) {
      runConfig(cfg).catch(function(err) { if (cfg && cfg.debug) console.warn('[SQB]', cfg.key, err); });
    });
    document.addEventListener('turbolinks:load', function() {
      configs.forEach(function(cfg) {
        var t = document.querySelector(cfg.target || '');
        if (t && !t.classList.contains('sqb-block')) runConfig(cfg).catch(noop);
      });
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();

})();
