/*!
 * Squarespace Query Block (SQB) v1.2.0
 * Fetch JSON paginé · filtres · tabs · groupBy · lazy-load · cache
 * Compatible Weglot · zéro dépendance
 *
 * ─── RÉFÉRENCE CONFIGURATION ────────────────────────────────────────────────
 *
 * window.SQB_CONFIGS = [
 * {
 *   // ── Identité ──────────────────────────────────────────────────────────
 *   key:     'programme',        // ID unique → classe sqb--programme sur le bloc
 *   target:  '#sqb-programme',   // Sélecteur CSS du conteneur dans la page
 *   classes: 'custom autre',     // Classes supplémentaires sur le bloc (optionnel)
 *   enabled: true,               // false = désactive sans supprimer la config
 *   debug:   false,              // true = logs console
 *
 *   // ── Sources ───────────────────────────────────────────────────────────
 *   sources: [
 *     { path: '/programme-2026' },
 *     // { path: '/archive-2024' },
 *   ],
 *
 *   // ── Pré-filtre fixe (invisible dans l'UI) ─────────────────────────────
 *   preFilter: {
 *     categories:        ['Exposition'],
 *     excludeCategories: ['Brouillon'],
 *     tagValues:         [{ prefix: 'Sélection', value: 'Homepage' }],
 *   },
 *
 *   // ── Filtres UI ────────────────────────────────────────────────────────
 *   // false = aucun filtre affiché
 *   filters: {
 *     tabs: [
 *       { label: 'Expositions', filter: { categories: ['Exposition'] } },
 *       { label: 'Événements',  filter: { categories: ['Talk', 'Visite guidée', 'Concert', 'Événement'] } },
 *     ],
 *     defaultTab: 0,
 *
 *     categories:      true,
 *     defaultCategory: 'Talk',
 *
 *     tagPrefixes: ['Date', 'Zone', 'Artiste', 'Lieu'],
 *     defaultTags: { Date: 'Saturday 19 septembre 2026' },
 *     datePrefix:  'Date',   // ce préfixe est trié chronologiquement
 *
 *     search:  true,
 *     layout: 'inline',      // 'inline' | 'sidebar'
 *   },
 *
 *   // ── Affichage ─────────────────────────────────────────────────────────
 *   display: {
 *     counter: true,         // false = masque le compteur X / Y
 *
 *     groupBy:    null,      // null | 'category' | { tagPrefix: 'Date' }
 *     groupOrder: 'collection', // 'collection' | 'alpha' | ['Lundi', 'Mardi', …]
 *
 *     columns: { mobile: 1, tablet: 2, desktop: 3 },
 *     imageRatio: '4/3',
 *     cardLink: true,        // false = cartes non cliquables
 *
 *     // Rendu par groupes sémantiques (remplace le rendu plat si défini)
 *     // Rôles : 'media' | 'header' | 'body' | 'meta' | 'footer'
 *     // Enfants : 'image' | 'title' | 'categories' | 'excerpt' | 'location'
 *     //           | { type: 'tagPrefix', prefix: 'Artiste', label: 'Artiste·s' }
 *     groups: [
 *       { role: 'media', children: ['image'] },
 *       { role: 'body',  children: [
 *           'categories', 'title',
 *           { type: 'tagPrefix', prefix: 'Artiste', label: 'Artiste·s' },
 *           { type: 'tagPrefix', prefix: 'Lieu',    label: 'Lieu' },
 *           'excerpt',
 *       ]},
 *     ],
 *
 *     // Rendu plat (si groups n'est pas défini) :
 *     image:      true,
 *     title:      true,
 *     categories: true,
 *     excerpt:    true,
 *     location:   false,
 *     tagPrefixFields: [
 *       { prefix: 'Artiste', label: 'Artiste·s' },
 *       { prefix: 'Lieu',    label: 'Lieu' },
 *     ],
 *   },
 *
 *   // ── Tri ───────────────────────────────────────────────────────────────
 *   // type: 'collection' | 'date' | 'title' | 'category' | { tagPrefix: 'Numéro' }
 *   sort: { type: 'collection', direction: 'asc' },
 *
 *   // ── Pagination ────────────────────────────────────────────────────────
 *   pagination: {
 *     mode:          'load-more',  // 'load-more' | 'infinite' | 'none'
 *     perPage:       12,
 *     loadMoreLabel: 'Voir plus',
 *     endLabel:      false,        // false | string
 *   },
 *
 *   // ── Performance ───────────────────────────────────────────────────────
 *   performance: {
 *     maxPages:        10,
 *     sessionCache:    true,
 *     sessionCacheTTL: 300,
 *   },
 *
 *   // ── Textes ────────────────────────────────────────────────────────────
 *   i18n: {
 *     all:               'Tout',
 *     noResults:         'Aucun résultat',
 *     loading:           'Chargement…',
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
    const d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    const s = cleanHTML(str);
    if (!s || s.length <= max) return s;
    const cut = s.slice(0, max);
    const sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '\u2026';
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
      Object.entries(attrs).forEach(function(entry) {
        var k = entry[0], v = entry[1];
        if (v == null) return;
        if (k === 'class') e.className = v;
        else if (k === 'style') e.style.cssText = v;
        else if (k.indexOf('data-') === 0) e.setAttribute(k, v);
        else e[k] = v;
      });
    }
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
      var parsed = parseTag(tag);
      if (parsed.prefix && norm(parsed.prefix) === pNorm && parsed.value) acc.push(parsed.value);
      return acc;
    }, []);
  }

  /* ═══════════════════════════════════════════════
   * 1. FETCH & CACHE
   * ═══════════════════════════════════════════════ */

  var MEM = new Map();

  function cacheGet(key) {
    if (MEM.has(key)) return MEM.get(key);
    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.ts > (parsed.ttl || 300) * 1000) {
        sessionStorage.removeItem(key); return null;
      }
      MEM.set(key, parsed.data);
      return parsed.data;
    } catch (_) { return null; }
  }

  function cacheSet(key, data, ttl, useSession) {
    MEM.set(key, data);
    if (!useSession) return;
    try { sessionStorage.setItem(key, JSON.stringify({ ts: Date.now(), ttl: ttl, data: data })); } catch (_) { noop(); }
  }

  function ensureJson(url) {
    if (!url) return url;
    if (url.indexOf('format=json') !== -1) return url;
    return url.indexOf('?') !== -1 ? url + '&format=json' : url + '?format=json';
  }

  async function fetchAllItems(path, maxPages, useSession, ttl) {
    var key = 'sqb::v2::' + path + '::' + (maxPages || 10);
    var cached = cacheGet(key);
    if (cached) return cached;

    var items = [];
    var url = ensureJson(path);
    for (var p = 0; p < (maxPages || 10); p++) {
      var data;
      try {
        var res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) break;
        data = await res.json();
      } catch (_) { break; }
      var batch = Array.isArray(data && data.items) ? data.items
        : Array.isArray(data && data.itemList) ? data.itemList : [];
      items.push.apply(items, batch);
      var next = data && data.pagination && data.pagination.nextPageUrl;
      if (!next) break;
      url = ensureJson(next);
    }

    cacheSet(key, items, ttl || 300, useSession !== false);
    return items;
  }

  /* ═══════════════════════════════════════════════
   * 2. MAPPING
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
   * 3. FILTRAGE
   * ═══════════════════════════════════════════════ */

  function applyPreFilter(items, pf) {
    if (!pf) return items;
    return items.filter(function(item) {
      if (pf.categories && pf.categories.length) {
        if (!item.categories.some(function(c) {
          return pf.categories.some(function(w) { return norm(w) === norm(c); });
        })) return false;
      }
      if (pf.excludeCategories && pf.excludeCategories.length) {
        if (item.categories.some(function(c) {
          return pf.excludeCategories.some(function(w) { return norm(w) === norm(c); });
        })) return false;
      }
      if (pf.tagValues && pf.tagValues.length) {
        for (var i = 0; i < pf.tagValues.length; i++) {
          var tv = pf.tagValues[i];
          var vals = getTagValuesByPrefix(item, tv.prefix);
          if (!vals.some(function(v) { return norm(v) === norm(tv.value); })) return false;
        }
      }
      return true;
    });
  }

  function applyTabFilter(items, tabFilter) {
    if (!tabFilter) return items;
    return items.filter(function(item) {
      if (tabFilter.categories && tabFilter.categories.length) {
        if (!item.categories.some(function(c) {
          return tabFilter.categories.some(function(w) { return norm(w) === norm(c); });
        })) return false;
      }
      if (tabFilter.tagValues && tabFilter.tagValues.length) {
        for (var i = 0; i < tabFilter.tagValues.length; i++) {
          var tv = tabFilter.tagValues[i];
          if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) { return norm(v) === norm(tv.value); })) return false;
        }
      }
      return true;
    });
  }

  function matchesUIFilters(item, state) {
    if (state.category) {
      if (!item.categories.some(function(c) { return norm(c) === norm(state.category); })) return false;
    }
    var tags = state.tags || {};
    for (var prefix in tags) {
      if (!Object.prototype.hasOwnProperty.call(tags, prefix)) continue;
      var value = tags[prefix];
      if (!value) continue;
      if (!getTagValuesByPrefix(item, prefix).some(function(v) { return norm(v) === norm(value); })) return false;
    }
    if (state.search) {
      var q = norm(state.search);
      var hay = norm([item.title, item.excerpt, item.location].concat(item.categories).concat(item.tags).join(' '));
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ═══════════════════════════════════════════════
   * 4. TRI
   * ═══════════════════════════════════════════════ */

  function tryNum(str) {
    var n = parseFloat(String(str || '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

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
   * 5. LAZY-LOAD IMAGES
   * ═══════════════════════════════════════════════ */

  var IO_LAZY = ('IntersectionObserver' in window)
    ? new IntersectionObserver(function(entries, obs) {
        entries.forEach(function(entry) {
          if (!entry.isIntersecting) return;
          var img = entry.target;
          if (img.dataset.srcset) img.srcset = img.dataset.srcset;
          if (img.dataset.src)    img.src    = img.dataset.src;
          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
          obs.unobserve(img);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  var SRCSET_WIDTHS = [300, 500, 750, 1000, 1500, 2500];

  function buildImg(assetUrl, focalPoint, alt, ratio) {
    var srcset = SRCSET_WIDTHS.map(function(w) { return assetUrl + '?format=' + w + 'w ' + w + 'w'; }).join(', ');
    var wrap = el('div', { class: 'sqb-card__img-wrap', style: 'aspect-ratio:' + (ratio || '4/3') });
    var img  = el('img', {
      class:    'sqb-card__img',
      alt:      alt || '',
      sizes:    '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw',
      decoding: 'async',
    });
    img.style.objectPosition = focalPoint;
    if (IO_LAZY) { img.dataset.src = assetUrl; img.dataset.srcset = srcset; IO_LAZY.observe(img); }
    else         { img.srcset = srcset; img.src = assetUrl; }
    img.addEventListener('load', function() { img.classList.add('sqb-card__img--loaded'); }, { once: true });
    wrap.appendChild(img);
    return wrap;
  }

  /* ═══════════════════════════════════════════════
   * 6. RENDU CARTE
   * ═══════════════════════════════════════════════ */

  var ROLE_CLASS = {
    media:  'sqb-card__media',
    header: 'sqb-card__header',
    body:   'sqb-card__body',
    meta:   'sqb-card__meta',
    footer: 'sqb-card__footer',
  };

  function buildChild(def, item, disp) {
    var type = (typeof def === 'string') ? def : (def && def.type);

    if (type === 'image') {
      return (disp.image !== false && item.assetUrl)
        ? buildImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3') : null;
    }
    if (type === 'categories') {
      if (disp.categories === false || !item.categories.length) return null;
      var wrap = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) {
        var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; wrap.appendChild(s);
      });
      return wrap;
    }
    if (type === 'title') {
      if (disp.title === false || !item.title) return null;
      return setText(el('h3', { class: 'sqb-card__title' }), item.title);
    }
    if (type === 'excerpt') {
      if (disp.excerpt === false || !item.excerpt) return null;
      return setText(el('p', { class: 'sqb-card__excerpt' }), item.excerpt);
    }
    if (type === 'location') {
      if (!item.location) return null;
      return setText(el('p', { class: 'sqb-card__location' }), item.location);
    }
    if (type === 'tagPrefix') {
      var prefix = (def && def.prefix) || '';
      var label  = (def && def.label)  || '';
      var vals   = getTagValuesByPrefix(item, prefix);
      if (!vals.length) return null;
      var row = el('div', { class: 'sqb-card__tag-field', 'data-prefix': prefix });
      if (label) {
        var lbl = el('span', { class: 'sqb-card__tag-label' });
        lbl.textContent = label + '\u00A0'; row.appendChild(lbl);
      }
      var val = el('span', { class: 'sqb-card__tag-value' });
      val.textContent = vals.join(', '); row.appendChild(val);
      return row;
    }
    return null;
  }

  function buildCard(item, cfg) {
    var disp   = cfg.display || {};
    var link   = disp.cardLink !== false;
    var card   = el(link ? 'a' : 'div', { class: 'sqb-card' });
    if (link) card.href = item.fullUrl;

    // Rendu par groupes sémantiques
    var groups = Array.isArray(disp.groups) && disp.groups.length ? disp.groups : null;
    if (groups) {
      groups.forEach(function(grp) {
        var roleClass = ROLE_CLASS[grp.role] || 'sqb-card__group';
        var wrapper   = el('div', { class: roleClass });
        (grp.children || []).forEach(function(def) {
          var node = buildChild(def, item, disp);
          if (node) wrapper.appendChild(node);
        });
        if (wrapper.hasChildNodes()) card.appendChild(wrapper);
      });
      return card;
    }

    // Rendu plat
    if (disp.image !== false && item.assetUrl) {
      card.appendChild(buildImg(item.assetUrl, item.focalPoint, item.title, disp.imageRatio || '4/3'));
    }
    var body = el('div', { class: 'sqb-card__body' });
    if (disp.categories !== false && item.categories.length) {
      var meta = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) { var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; meta.appendChild(s); });
      body.appendChild(meta);
    }
    if (disp.title !== false && item.title) body.appendChild(setText(el('h3', { class: 'sqb-card__title' }), item.title));
    (Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : []).forEach(function(field) {
      var node = buildChild({ type: 'tagPrefix', prefix: field.prefix, label: field.label }, item, disp);
      if (node) body.appendChild(node);
    });
    if (disp.excerpt !== false && item.excerpt) body.appendChild(setText(el('p', { class: 'sqb-card__excerpt' }), item.excerpt));
    if (disp.location && item.location)         body.appendChild(setText(el('p', { class: 'sqb-card__location' }), item.location));
    card.appendChild(body);
    return card;
  }

  /* ═══════════════════════════════════════════════
   * 7. GROUPBY
   * ═══════════════════════════════════════════════ */

  function getGroupKey(item, groupBy) {
    if (!groupBy) return null;
    if (groupBy === 'category') return item.categories[0] || '\u2014';
    if (typeof groupBy === 'object' && groupBy.tagPrefix) {
      return getTagValuesByPrefix(item, groupBy.tagPrefix)[0] || '\u2014';
    }
    return null;
  }

  function sortGroupKeys(keys, groupOrder) {
    if (Array.isArray(groupOrder)) {
      var orderMap = new Map(groupOrder.map(function(v, i) { return [norm(v), i]; }));
      return keys.slice().sort(function(a, b) {
        var ai = orderMap.has(norm(a)) ? orderMap.get(norm(a)) : 9999;
        var bi = orderMap.has(norm(b)) ? orderMap.get(norm(b)) : 9999;
        if (ai !== bi) return ai - bi;
        return norm(a).localeCompare(norm(b));
      });
    }
    if (groupOrder === 'alpha') return keys.slice().sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
    return keys; // 'collection' = ordre d'apparition
  }

  function renderGrouped(items, cfg, grid) {
    var groupBy    = (cfg.display && cfg.display.groupBy) || null;
    var groupOrder = (cfg.display && cfg.display.groupOrder) || 'collection';
    if (!groupBy) { items.forEach(function(item) { grid.appendChild(buildCard(item, cfg)); }); return; }

    var orderedKeys = [], groups = new Map();
    items.forEach(function(item) {
      var key = getGroupKey(item, groupBy);
      if (!groups.has(key)) { groups.set(key, []); orderedKeys.push(key); }
      groups.get(key).push(item);
    });

    sortGroupKeys(orderedKeys, groupOrder).forEach(function(key) {
      var groupItems = groups.get(key) || [];
      if (!groupItems.length) return;
      var heading = el('div', { class: 'sqb-group-heading', 'data-group': key, style: 'grid-column:1 / -1' });
      setText(heading, key);
      grid.appendChild(heading);
      groupItems.forEach(function(item) { grid.appendChild(buildCard(item, cfg)); });
    });
  }

  /* ═══════════════════════════════════════════════
   * 8. TRI CHRONOLOGIQUE DES TAGS DATE
   * ═══════════════════════════════════════════════ */

  var MONTH_MAP = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    janvier:1,'\u00e9vrier':2,fevrier:2,mars:3,avril:4,mai:5,juin:6,
    juillet:7,'\u00e2t':8,aout:8,septembre:9,octobre:10,novembre:11,
    'd\u00e9cembre':12,decembre:12,
  };
  // Correction : noms complets
  var MONTH_MAP_FULL = {
    january:1,february:2,march:3,april:4,may:5,june:6,
    july:7,august:8,september:9,october:10,november:11,december:12,
    janvier:1,fevrier:2,mars:3,avril:4,mai:5,juin:6,
    juillet:7,aout:8,septembre:9,octobre:10,novembre:11,decembre:12,
  };

  function parseTagDate(str) {
    var s = String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var m = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);
    if (!m) return null;
    var month = MONTH_MAP_FULL[m[2]];
    if (!month) return null;
    return new Date(parseInt(m[3], 10), month - 1, parseInt(m[1], 10)).getTime();
  }

  function sortTagValues(vals, prefix, datePrefix) {
    var isDate = datePrefix && norm(prefix) === norm(datePrefix);
    if (!isDate) return vals.slice().sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
    return vals.slice().sort(function(a, b) {
      var at = parseTagDate(a), bt = parseTagDate(b);
      if (at !== null && bt !== null) return at - bt;
      if (at !== null) return -1;
      if (bt !== null) return 1;
      return norm(a).localeCompare(norm(b));
    });
  }

  /* ═══════════════════════════════════════════════
   * 9. FILTRES UI
   * ═══════════════════════════════════════════════ */

  function buildFilterBar(baseItems, cfg, onFilter) {
    if (cfg.filters === false) return null;
    var filterCfg  = cfg.filters || {};
    var i18n       = Object.assign({ all: 'Tout', searchPlaceholder: 'Rechercher\u2026' }, cfg.i18n || {});
    var datePrefix = filterCfg.datePrefix || null;

    var bar   = el('div', { class: 'sqb-filters sqb-filters--' + (filterCfg.layout || 'inline') });
    var state = { tab: null, category: null, tags: {}, search: '' };
    var secondaryContainer = null;

    function emit() {
      var tagsCopy = {};
      Object.keys(state.tags).forEach(function(k) { tagsCopy[k] = state.tags[k]; });
      onFilter({ tab: state.tab, category: state.category, tags: tagsCopy, search: state.search });
    }

    function tabItems() { return state.tab ? applyTabFilter(baseItems, state.tab) : baseItems; }

    function resetSecondaryState() { state.category = null; state.tags = {}; state.search = ''; }

    function appendSecondaryFilters(pool, container) {
      // Catégories
      if (filterCfg.categories !== false) {
        var cats = uniqBy(
          pool.reduce(function(acc, i) { return acc.concat(i.categories); }, []).filter(Boolean),
          norm
        ).sort(function(a, b) { return norm(a).localeCompare(norm(b)); });

        if (cats.length > 1) {
          var group  = el('div', { class: 'sqb-filter-group sqb-filter-group--cats' });
          var allBtn = el('button', { class: 'sqb-filter-btn sqb-filter-btn--active', type: 'button' });
          setText(allBtn, i18n.all);
          allBtn.addEventListener('click', function() {
            state.category = null;
            group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
            allBtn.classList.add('sqb-filter-btn--active');
            emit();
          });
          group.appendChild(allBtn);

          cats.forEach(function(cat) {
            var isDefault = filterCfg.defaultCategory && norm(cat) === norm(filterCfg.defaultCategory);
            var btn = el('button', { class: 'sqb-filter-btn' + (isDefault ? ' sqb-filter-btn--active' : ''), type: 'button' });
            setText(btn, cat);
            if (isDefault) { state.category = cat; allBtn.classList.remove('sqb-filter-btn--active'); }
            btn.addEventListener('click', function() {
              state.category = cat;
              group.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
              btn.classList.add('sqb-filter-btn--active');
              emit();
            });
            group.appendChild(btn);
          });
          container.appendChild(group);
        }
      }

      // Tag-prefix dropdowns
      var prefixes = Array.isArray(filterCfg.tagPrefixes) ? filterCfg.tagPrefixes : [];
      prefixes.forEach(function(prefix) {
        var raw  = uniqBy(
          pool.reduce(function(acc, i) { return acc.concat(getTagValuesByPrefix(i, prefix)); }, []).filter(Boolean),
          norm
        );
        var vals = sortTagValues(raw, prefix, datePrefix);
        if (!vals.length) return;

        var group = el('div', { class: 'sqb-filter-group sqb-filter-group--tag', 'data-prefix': prefix });
        var sel   = el('select', { class: 'sqb-filter-select', 'aria-label': prefix });
        var opt0  = el('option', { value: '' });
        opt0.textContent = prefix + '\u00a0: ' + i18n.all;
        sel.appendChild(opt0);

        var defaultVal = filterCfg.defaultTags && filterCfg.defaultTags[prefix];
        vals.forEach(function(v) {
          var opt = el('option', { value: v });
          opt.textContent = v;
          if (defaultVal && norm(v) === norm(defaultVal)) { opt.selected = true; state.tags[prefix] = v; }
          sel.appendChild(opt);
        });

        sel.addEventListener('change', function() { state.tags[prefix] = sel.value || null; emit(); });
        group.appendChild(sel);
        container.appendChild(group);
      });

      // Recherche
      if (filterCfg.search !== false) {
        var sgroup = el('div', { class: 'sqb-filter-group sqb-filter-group--search' });
        var input  = el('input', {
          class: 'sqb-filter-search', type: 'search',
          placeholder: i18n.searchPlaceholder, 'aria-label': i18n.searchPlaceholder,
        });
        var timer;
        input.addEventListener('input', function() {
          clearTimeout(timer);
          timer = setTimeout(function() { state.search = input.value.trim(); emit(); }, 200);
        });
        sgroup.appendChild(input);
        container.appendChild(sgroup);
      }
    }

    function rebuildSecondary() {
      if (!secondaryContainer) return;
      secondaryContainer.innerHTML = '';
      appendSecondaryFilters(tabItems(), secondaryContainer);
    }

    // ── Tabs ───────────────────────────────────────────────────────────────
    var tabs = Array.isArray(filterCfg.tabs) ? filterCfg.tabs : [];
    if (tabs.length) {
      var tabGroup      = el('div', { class: 'sqb-filter-group sqb-filter-group--tabs' });
      var defaultTabIdx = Number(filterCfg.defaultTab != null ? filterCfg.defaultTab : 0);

      tabs.forEach(function(tab, idx) {
        var isActive = idx === defaultTabIdx;
        var btn = el('button', { class: 'sqb-tab-btn' + (isActive ? ' sqb-tab-btn--active' : ''), type: 'button' });
        setText(btn, tab.label || ('Tab ' + (idx + 1)));
        if (isActive) state.tab = tab.filter || null;

        btn.addEventListener('click', function() {
          if (btn.classList.contains('sqb-tab-btn--active')) return;
          tabGroup.querySelectorAll('.sqb-tab-btn').forEach(function(b) { b.classList.remove('sqb-tab-btn--active'); });
          btn.classList.add('sqb-tab-btn--active');
          state.tab = tab.filter || null;
          resetSecondaryState();
          rebuildSecondary();
          emit();
        });
        tabGroup.appendChild(btn);
      });
      bar.appendChild(tabGroup);
    }

    // ── Filtres secondaires ────────────────────────────────────────────────
    secondaryContainer = el('div', { class: 'sqb-filters-secondary' });
    appendSecondaryFilters(tabItems(), secondaryContainer);
    bar.appendChild(secondaryContainer);

    return bar;
  }

  /* ═══════════════════════════════════════════════
   * 10. RUNNER
   * ═══════════════════════════════════════════════ */

  async function runConfig(cfg) {
    if (!cfg || cfg.enabled === false) return;

    var target = document.querySelector(cfg.target || '');
    if (!target) return;

    var perf = cfg.performance || {};
    var pag  = cfg.pagination  || {};
    var disp = cfg.display     || {};
    var i18n = Object.assign({
      loading: 'Chargement\u2026', noResults: 'Aucun r\u00e9sultat',
      loadMoreLabel: 'Voir plus', endLabel: '',
    }, cfg.i18n || {});
    if (pag.loadMoreLabel)        i18n.loadMoreLabel = pag.loadMoreLabel;
    if (pag.endLabel !== undefined) i18n.endLabel    = pag.endLabel;

    var perPage = Number(pag.perPage || 12);
    var mode    = pag.mode || 'load-more';

    // Classes sur le conteneur
    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');
    if (cfg.key)     target.classList.add('sqb--' + cfg.key);
    if (cfg.classes) cfg.classes.trim().split(/\s+/).forEach(function(c) { if (c) target.classList.add(c); });

    // Loader
    var loader = el('div', { class: 'sqb-loader', 'aria-live': 'polite' });
    setText(loader, i18n.loading);
    target.appendChild(loader);

    // ── Fetch ──────────────────────────────────────────────────────────────
    var rawItems = [];
    var sources = Array.isArray(cfg.sources) ? cfg.sources : [];
    try {
      var results = await Promise.all(
        sources.map(function(src) {
          return fetchAllItems(src.path, perf.maxPages || 10, perf.sessionCache !== false, perf.sessionCacheTTL || 300)
            .then(function(items) { return items.map(function(raw) { return mapItem(raw, src.path); }); });
        })
      );
      results.forEach(function(r) { rawItems.push.apply(rawItems, r); });
    } catch (err) {
      if (cfg.debug) console.warn('[SQB]', cfg.key, err);
      setText(loader, '\u26a0 Erreur de chargement');
      return;
    }

    rawItems = uniqBy(rawItems, function(i) { return i.fullUrl || i.id; });
    rawItems = applyPreFilter(rawItems, cfg.preFilter || null);
    rawItems = sortItems(rawItems, cfg.sort);

    if (cfg.debug) console.log('[SQB]', cfg.key, rawItems.length, 'items apr\u00e8s preFilter');
    loader.remove();

    // ── État ───────────────────────────────────────────────────────────────
    var activeFilters = { tab: null, category: null, tags: {}, search: '' };
    var currentPage   = 1;
    var ioInfinite    = null;

    // Initialiser les présélections
    var filterCfg = (cfg.filters && cfg.filters !== false) ? cfg.filters : {};
    if (Array.isArray(filterCfg.tabs) && filterCfg.tabs.length) {
      var defIdx = Number(filterCfg.defaultTab != null ? filterCfg.defaultTab : 0);
      if (filterCfg.tabs[defIdx]) activeFilters.tab = filterCfg.tabs[defIdx].filter || null;
    }
    if (filterCfg.defaultCategory) activeFilters.category = filterCfg.defaultCategory;
    if (filterCfg.defaultTags)     Object.assign(activeFilters.tags, filterCfg.defaultTags);

    // ── Structure ──────────────────────────────────────────────────────────
    var root = el('div', { class: 'sqb-root' });

    var filterBar = buildFilterBar(rawItems, cfg, function(filters) {
      activeFilters = filters;
      currentPage   = 1;
      render();
    });
    if (filterBar) root.appendChild(filterBar);

    var cols = disp.columns || {};
    var grid = el('div', {
      class: 'sqb-grid',
      style: '--sqb-cols-mobile:' + (cols.mobile||1) + ';--sqb-cols-tablet:' + (cols.tablet||2) + ';--sqb-cols-desktop:' + (cols.desktop||3),
    });

    var counter  = el('p',   { class: 'sqb-counter', 'aria-live': 'polite' });
    var footerEl = el('div', { class: 'sqb-footer' });

    root.appendChild(grid);
    if (disp.counter !== false) root.appendChild(counter);
    root.appendChild(footerEl);
    target.appendChild(root);

    // ── Render ─────────────────────────────────────────────────────────────
    function render() {
      if (ioInfinite) { ioInfinite.disconnect(); ioInfinite = null; }

      var poolTab  = activeFilters.tab ? applyTabFilter(rawItems, activeFilters.tab) : rawItems;
      var filtered = poolTab.filter(function(item) { return matchesUIFilters(item, activeFilters); });
      var total    = filtered.length;
      var shown    = filtered.slice(0, currentPage * perPage);

      grid.innerHTML     = '';
      footerEl.innerHTML = '';

      if (!shown.length) {
        var empty = el('p', { class: 'sqb-empty' });
        setText(empty, i18n.noResults);
        grid.appendChild(empty);
        if (disp.counter !== false) counter.textContent = '';
        return;
      }

      renderGrouped(shown, cfg, grid);
      if (disp.counter !== false) counter.textContent = shown.length + '\u00a0/\u00a0' + total;

      var hasMore = shown.length < total;
      if (!hasMore) {
        if (i18n.endLabel !== false && i18n.endLabel) {
          footerEl.appendChild(setText(el('p', { class: 'sqb-end-label' }), i18n.endLabel));
        }
        return;
      }

      if (mode === 'load-more') {
        var btn = el('button', { class: 'sqb-load-more', type: 'button' });
        setText(btn, i18n.loadMoreLabel);
        btn.addEventListener('click', function() { currentPage++; render(); });
        footerEl.appendChild(btn);

      } else if (mode === 'infinite' && 'IntersectionObserver' in window) {
        var sentinel = el('div', { class: 'sqb-sentinel', 'aria-hidden': 'true' });
        footerEl.appendChild(sentinel);
        ioInfinite = new IntersectionObserver(function(entries) {
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

  /* ═══════════════════════════════════════════════
   * 11. POINT D'ENTRÉE
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
