/*!
 * Squarespace Query Block (Squarespace Collection Block (SQB) v12.0.0
 * Fetch JSON paginé · tabs · groupBy · sticky · hooks · lazy-load · cache
 * Compatible Weglot · zéro dépendance
 *
 * ─── RÉFÉRENCE CONFIGURATION ─────────────────────────────────────────────────
 *
 * window.SQB_CONFIGS = [{
 *   key:     'programme',
 *   target:  '#sqb-programme',
 *   classes: 'ma-classe',
 *   enabled: true,
 *   debug:   false,
 *
 *   sources: [{ path: '/programme-2026' }],
 *
 *   preFilter: {
 *     categories:        ['Exposition'],
 *     excludeCategories: ['Brouillon'],
 *     tagValues:         [{ prefix: 'Sélection', value: 'Homepage' }],
 *   },
 *
 *   filters: false,  // ou :
 *   filters: {
 *     position:  'top',         // 'top' | 'sidebar'
 *     sticky:    true,
 *     stickyTop: '0px',
 *     scrollOnFilter: true,     // scroll vers la grille au changement de filtre
 *
 *     mobilePanel:           true,   // panneau mobile (défaut true)
 *     mobilePanelBreakpoint: 768,    // px sous lequel le panneau s'active
 *
 *     tabs: [
 *       { label: 'Expositions', filter: { categories: ['Exposition'] } },
 *       { label: 'Événements',  filter: { categories: ['Talk'] } },
 *     ],
 *     defaultTab: 0,
 *
 *     categories:      true,
 *     defaultCategory: null,
 *
 *     // tagPrefixes : string[] ou object[] avec layout individuel
 *     tagPrefixes: [
 *       { prefix: 'Zone', layout: 'pills',    showLabel: true },
 *       { prefix: 'Date', layout: 'pills',    showLabel: true },
 *       { prefix: 'Lieu', layout: 'dropdown', showLabel: true },
 *     ],
 *     datePrefix: 'Date',
 *     defaultTags: {},
 *     search: true,
 *   },
 *
 *   display: {
 *     layout:   'grid',   // 'grid' | 'list'
 *     counter:  true,
 *     cardLink: true,
 *
 *     groupBy:    null,   // null | 'category' | { tagPrefix: 'Date' }
 *     groupOrder: 'collection',
 *
 *     // Rendu par groupes sémantiques
 *     // Enfants : 'image' | 'title' | 'categories' | 'excerpt' | 'location'
 *     //   { type: 'tagPrefix', prefix: 'Lieu', label: 'Lieu', labelIcon: 'pin_drop', joinWith: '\n' }
 *     groups: [
 *       { role: 'media', children: ['image'] },
 *       { role: 'body',  children: [
 *           'categories', 'title',
 *           { type: 'tagPrefix', prefix: 'Numéro', label: 'Étape' },
 *           { type: 'tagPrefix', prefix: 'Lieu',   labelIcon: 'pin_drop' },
 *           { type: 'tagPrefix', prefix: 'Date',   labelIcon: 'event', joinWith: '\n' },
 *       ]},
 *     ],
 *
 *     // Rendu plat (si groups absent) :
 *     image: true, title: true, categories: true, excerpt: true, location: false,
 *     tagPrefixFields: [{ prefix: 'Lieu', label: '', labelIcon: 'pin_drop' }],
 *   },
 *
 *   // type: 'collection'|'date'|'title'|'category'|'random'|{ tagPrefix: 'Numéro' }
 *   sort: { type: { tagPrefix: 'Numéro' }, direction: 'asc' },
 *
 *   pagination: {
 *     mode:          'load-more',  // 'load-more' | 'infinite' | 'none'
 *     perPage:       12,
 *     loadMoreLabel: 'Voir plus',
 *     endLabel:      false,
 *   },
 *
 *   performance: { maxPages: 10, sessionCache: true, sessionCacheTTL: 300 },
 *
 *   i18n: {
 *     loading:           false,   // false = animation | string = texte
 *     all:               'Tout',
 *     noResults:         'Aucun résultat',
 *     searchPlaceholder: 'Rechercher…',
 *     filterToggle:      'Filtrer',
 *     filterClose:       'close',  // nom icône Material Symbols ou texte
 *   },
 * }];
 *
 * window.SQB_HOOKS = { 'key': function(grid, items, cfg) {} };
 */

(function () {
  'use strict';

  /* ════════════════════════════════════
   * 0. UTILITAIRES
   * ════════════════════════════════════ */

  function noop() {}

  function norm(str) {
    return String(str || '')
      .replace(/\u00A0/g, ' ').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019']/g, "'").replace(/&/g, 'and')
      .replace(/\s+/g, ' ').trim();
  }

  function slugify(str) {
    return norm(str).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function cleanHTML(str) {
    var d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    var s = cleanHTML(str);
    if (!s || s.length <= max) return s;
    var cut = s.slice(0, max), sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '\u2026';
  }

  function uniqBy(arr, fn) {
    var seen = new Set();
    return arr.filter(function(x) {
      var k = fn(x); if (seen.has(k)) return false; seen.add(k); return true;
    });
  }

  function el(tag, attrs) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function(k) {
      var v = attrs[k]; if (v == null) return;
      if (k === 'class') e.className = v;
      else if (k === 'style') e.style.cssText = v;
      else if (k.indexOf('data-') === 0) e.setAttribute(k, v);
      else e[k] = v;
    });
    return e;
  }

  function setText(e, s) { e.textContent = s; return e; }

  function parseTag(tag) {
    var raw = String(tag || ''), idx = raw.indexOf(':');
    if (idx === -1) return { prefix: null, value: raw.trim() };
    return { prefix: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
  }

  function getTagValuesByPrefix(item, prefix) {
    var pn = norm(String(prefix).replace(/:$/, ''));
    return (item.tags || []).reduce(function(acc, tag) {
      var p = parseTag(tag);
      if (p.prefix && norm(p.prefix) === pn && p.value) acc.push(p.value);
      return acc;
    }, []);
  }

  // Applique un ordre custom : les valeurs listées d'abord, les autres après en alpha
  function applyCustomOrder(vals, order) {
    if (!Array.isArray(order) || !order.length) return vals;
    var orderMap = new Map(order.map(function(v, i) { return [norm(v), i]; }));
    return vals.slice().sort(function(a, b) {
      var ai = orderMap.has(norm(a)) ? orderMap.get(norm(a)) : 9999;
      var bi = orderMap.has(norm(b)) ? orderMap.get(norm(b)) : 9999;
      if (ai !== bi) return ai - bi;
      return norm(a).localeCompare(norm(b));
    });
  }

  function normalizePrefixes(tagPrefixes, globalLayout) {
    if (!Array.isArray(tagPrefixes)) return [];
    return tagPrefixes.map(function(p) {
      if (typeof p === 'string') return { prefix: p, layout: globalLayout || 'pills', showLabel: true, order: null, filterFormat: null };
      return {
        prefix:       p.prefix,
        layout:       p.layout       || globalLayout || 'pills',
        showLabel:    p.showLabel    !== false,
        order:        p.order        || null,
        filterFormat: p.filterFormat || null,  // format des valeurs dans le filtre
      };
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ════════════════════════════════════
   * 1. LOADER
   * ════════════════════════════════════ */

  function injectLoaderStyles() {
    if (document.getElementById('sqb-loader-styles')) return;
    var css = [
      '.sqb-loader{display:flex;align-items:center;justify-content:center;gap:16px;padding:3rem 1rem;min-height:6rem}',
      '.sqb-loader-dot{width:4px;height:4px;border-radius:50%;background:var(--paragraphMediumColor,currentColor);opacity:.2;animation:sqb-pulse 1.2s infinite ease-in-out}',
      '.sqb-loader-dot:nth-child(1){animation-delay:0s}',
      '.sqb-loader-dot:nth-child(2){animation-delay:.4s}',
      '.sqb-loader-dot:nth-child(3){animation-delay:.8s}',
      '@keyframes sqb-pulse{0%,100%{opacity:.2}33%{opacity:.7}66%{opacity:.4}}',
      '.sqb-loader--text{display:block;opacity:.5;text-align:center;padding:3rem 1rem}',
    ].join('');
    var s = document.createElement('style');
    s.id = 'sqb-loader-styles'; s.textContent = css;
    document.head.appendChild(s);
  }

  function buildLoader(loadingText) {
    if (loadingText) return setText(el('div', { class: 'sqb-loader sqb-loader--text', 'aria-live': 'polite' }), loadingText);
    var w = el('div', { class: 'sqb-loader', role: 'status', 'aria-label': 'Chargement' });
    for (var i = 0; i < 3; i++) w.appendChild(el('span', { class: 'sqb-loader-dot', 'aria-hidden': 'true' }));
    return w;
  }

  /* ════════════════════════════════════
   * 2. FETCH & CACHE
   * ════════════════════════════════════ */

  var MEM = new Map();

  function cacheGet(key) {
    if (MEM.has(key)) return MEM.get(key);
    try {
      var raw = sessionStorage.getItem(key); if (!raw) return null;
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
    var key = 'sqb::v12::' + path + '::' + (maxPages || 10);
    var cached = cacheGet(key); if (cached) return cached;
    var items = [], url = ensureJson(path);
    for (var p = 0; p < (maxPages || 10); p++) {
      var data;
      try {
        var res = await fetch(url, { credentials: 'same-origin' });
        if (!res.ok) break; data = await res.json();
      } catch (_) { break; }
      var batch = Array.isArray(data && data.items) ? data.items : Array.isArray(data && data.itemList) ? data.itemList : [];
      items.push.apply(items, batch);
      var next = data && data.pagination && data.pagination.nextPageUrl;
      if (!next) break; url = ensureJson(next);
    }
    cacheSet(key, items, ttl || 300, useSession !== false);
    return items;
  }

  /* ════════════════════════════════════
   * 3. MAPPING
   * ════════════════════════════════════ */

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

  /* ════════════════════════════════════
   * 4. FILTRAGE
   * ════════════════════════════════════ */

  function matchesCats(item, cats) {
    return !cats || !cats.length || item.categories.some(function(c) {
      return cats.some(function(w) { return norm(w) === norm(c); });
    });
  }

  function applyPreFilter(items, pf) {
    if (!pf) return items;
    return items.filter(function(item) {
      if (!matchesCats(item, pf.categories)) return false;
      if (pf.excludeCategories && matchesCats(item, pf.excludeCategories)) return false;
      if (pf.tagValues) for (var i = 0; i < pf.tagValues.length; i++) {
        var tv = pf.tagValues[i];
        if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) { return norm(v) === norm(tv.value); })) return false;
      }
      return true;
    });
  }

  function applyTabFilter(items, tf) {
    if (!tf) return items;
    return items.filter(function(item) {
      if (!matchesCats(item, tf.categories)) return false;
      if (tf.excludeCategories && matchesCats(item, tf.excludeCategories)) return false;
      if (tf.tagValues) for (var i = 0; i < tf.tagValues.length; i++) {
        var tv = tf.tagValues[i];
        if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) { return norm(v) === norm(tv.value); })) return false;
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
      if (norm([item.title, item.excerpt, item.location].concat(item.categories, item.tags).join(' ')).indexOf(q) === -1) return false;
    }
    return true;
  }

  /* ════════════════════════════════════
   * 5. TRI
   * ════════════════════════════════════ */

  function tryNum(s) { var n = parseFloat(String(s || '').replace(',', '.')); return isFinite(n) ? n : null; }

  function sortItems(items, sort) {
    if (!sort) return items;
    var type = sort.type || 'collection', dir = (sort.direction || 'asc') === 'desc' ? -1 : 1;
    if (type === 'random') return shuffle(items);
    return items.slice().sort(function(a, b) {
      if (type === 'date')     return (a.timestamp - b.timestamp) * dir;
      if (type === 'title')    return norm(a.title).localeCompare(norm(b.title)) * dir;
      if (type === 'category') return norm(a.categories[0] || '').localeCompare(norm(b.categories[0] || '')) * dir;
      if (typeof type === 'object' && type.tagPrefix) {
        var av = getTagValuesByPrefix(a, type.tagPrefix)[0] || '', bv = getTagValuesByPrefix(b, type.tagPrefix)[0] || '';
        var an = tryNum(av), bn = tryNum(bv);
        if (an !== null && bn !== null) return (an - bn) * dir;
        return norm(av).localeCompare(norm(bv)) * dir;
      }
      return (a.displayIndex - b.displayIndex) * dir;
    });
  }

  /* ════════════════════════════════════
   * 6. LAZY-LOAD
   * ════════════════════════════════════ */

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

  function buildImg(assetUrl, focalPoint, alt) {
    var srcset = SRCSET_WIDTHS.map(function(w) { return assetUrl + '?format=' + w + 'w ' + w + 'w'; }).join(', ');
    var wrap = el('div', { class: 'sqb-card__img-wrap' });
    var img  = el('img', {
      class: 'sqb-card__img', alt: alt || '',
      sizes: '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw', decoding: 'async',
    });
    img.style.objectPosition = focalPoint;
    if (IO_LAZY) { img.dataset.src = assetUrl; img.dataset.srcset = srcset; IO_LAZY.observe(img); }
    else         { img.srcset = srcset; img.src = assetUrl; }
    img.addEventListener('load', function() { img.classList.add('sqb-card__img--loaded'); }, { once: true });
    wrap.appendChild(img);
    return wrap;
  }

  /* ════════════════════════════════════
   * 7. RENDU CARTE
   * labelIcon : nom d'icône Material Symbols
   * ════════════════════════════════════ */

  var ROLE_CLASS = {
    media: 'sqb-card__media', header: 'sqb-card__header',
    body:  'sqb-card__body',  meta:   'sqb-card__meta', footer: 'sqb-card__footer',
  };

  function buildLabelNode(label, labelIcon) {
    if (labelIcon) {
      var ic = el('span', { class: 'sqb-icon sqb-tag-icon' });
      ic.textContent = labelIcon;
      return ic;
    }
    if (label) {
      var lbl = el('span', { class: 'sqb-card__tag-label' });
      lbl.textContent = label + '\u00A0';
      return lbl;
    }
    return null;
  }

  function buildChild(def, item) {
    var type = typeof def === 'string' ? def : (def && def.type);
    if (type === 'image') return item.assetUrl ? buildImg(item.assetUrl, item.focalPoint, item.title) : null;
    if (type === 'categories') {
      if (!item.categories.length) return null;
      var w = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) { var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; w.appendChild(s); });
      return w;
    }
    if (type === 'title') {
      if (!item.title) return null;
      var t = el('div', { class: 'sqb-card__title', role: 'heading', 'aria-level': '3' });
      t.textContent = item.title; return t;
    }
    if (type === 'excerpt') {
      if (!item.excerpt) return null;
      var p = el('p', { class: 'sqb-card__excerpt' }); p.textContent = item.excerpt; return p;
    }
    if (type === 'location') {
      if (!item.location) return null;
      var pl = el('p', { class: 'sqb-card__location' }); pl.textContent = item.location; return pl;
    }
    if (type === 'tagPrefix') {
      var prefix   = (def && def.prefix)   || '';
      var label    = (def && def.label != null) ? def.label : '';
      var labelIcon = (def && def.labelIcon) || null;
      var joinWith = (def && def.joinWith != null) ? def.joinWith : ', ';
      var displayFmt = (def && def.displayFormat) || null;
      var locale = (def && def.locale) || null;
      var rawVals = getTagValuesByPrefix(item, prefix);
      var vals = displayFmt ? rawVals.map(function(v) { return formatISOTag(v, displayFmt, locale); }) : rawVals;
      if (!vals.length) return null;
      var row = el('div', { class: 'sqb-card__tag-field', 'data-prefix': prefix });
      var labelNode = buildLabelNode(label, labelIcon);
      if (labelNode) row.appendChild(labelNode);
      if (joinWith === '\n') {
        var vw = el('span', { class: 'sqb-card__tag-value sqb-card__tag-value--multiline' });
        vals.forEach(function(v, i) { if (i > 0) vw.appendChild(document.createElement('br')); vw.appendChild(document.createTextNode(v)); });
        row.appendChild(vw);
      } else {
        setText(row.appendChild(el('span', { class: 'sqb-card__tag-value' })), vals.join(joinWith));
      }
      return row;
    }
    return null;
  }

  function buildCard(item, cfg, index) {
    var disp = cfg.display || {};
    var link = disp.cardLink !== false;
    var card = el(link ? 'a' : 'div', { class: 'sqb-card', 'data-sqb-index': String(index) });
    if (link) card.href = item.fullUrl;

    // cardClasses : ajouter des classes selon catégories et tag-prefixes
    var cardClassesCfg = disp.cardClasses || null;
    if (cardClassesCfg) {
      if (cardClassesCfg.categories) {
        item.categories.forEach(function(cat) {
          card.classList.add('sqb-cat--' + slugify(cat));
        });
      }
      var tagPfxList = Array.isArray(cardClassesCfg.tagPrefixes) ? cardClassesCfg.tagPrefixes : [];
      tagPfxList.forEach(function(pfx) {
        getTagValuesByPrefix(item, pfx).forEach(function(val) {
          card.classList.add('sqb-tag--' + slugify(pfx) + '--' + slugify(val));
        });
      });
    }

    var groups = Array.isArray(disp.groups) && disp.groups.length ? disp.groups : null;
    if (groups) {
      groups.forEach(function(grp) {
        var wrapper = el('div', { class: ROLE_CLASS[grp.role] || 'sqb-card__group' });
        (grp.children || []).forEach(function(def) {
          var node = buildChild(def, item);
          if (node) wrapper.appendChild(node);
        });
        if (wrapper.hasChildNodes()) card.appendChild(wrapper);
      });
      return card;
    }
    // Rendu plat
    if (item.assetUrl) card.appendChild(buildImg(item.assetUrl, item.focalPoint, item.title));
    var body = el('div', { class: 'sqb-card__body' });
    if (item.categories.length) {
      var meta = el('div', { class: 'sqb-card__cats' });
      item.categories.forEach(function(c) { var s = el('span', { class: 'sqb-card__cat' }); s.textContent = c; meta.appendChild(s); });
      body.appendChild(meta);
    }
    if (item.title) { var tt = el('div', { class: 'sqb-card__title', role: 'heading', 'aria-level': '3' }); tt.textContent = item.title; body.appendChild(tt); }
    (Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : []).forEach(function(f) {
      var node = buildChild({ type: 'tagPrefix', prefix: f.prefix, label: f.label, labelIcon: f.labelIcon, joinWith: f.joinWith }, item);
      if (node) body.appendChild(node);
    });
    if (disp.excerpt !== false && item.excerpt) { var ep = el('p', { class: 'sqb-card__excerpt' }); ep.textContent = item.excerpt; body.appendChild(ep); }
    if (disp.location && item.location)         { var lp = el('p', { class: 'sqb-card__location' }); lp.textContent = item.location; body.appendChild(lp); }
    card.appendChild(body);
    return card;
  }


  /* ════════════════════════════════════
   * 7b. HEADING DU BLOC
   * heading: { text, tag, cta: { text, href, newTab } }
   * ════════════════════════════════════ */

  function buildHeading(headingCfg) {
    if (!headingCfg || !headingCfg.text) return { headingEl: null, ctaBelowEl: null };
    var wrap = el('div', { class: 'sqb-heading' });
    var tag  = headingCfg.tag || 'h3';
    var h    = el(tag, { class: 'sqb-heading__text' });
    h.textContent = headingCfg.text;
    wrap.appendChild(h);
    var cta        = headingCfg.cta;
    var ctaBelow   = null;
    var ctaPos     = (cta && cta.position) || 'inline';
    if (cta && cta.text && cta.href) {
      var a = el('a', { href: cta.href });
      if (cta.newTab) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      a.textContent = cta.text;
      if (ctaPos === 'below') {
        a.className = 'sqb-heading__cta-below sqb-load-more';
        var ctaBelowWrapper = el('div', { class: 'sqb-footer--cta' });
        ctaBelowWrapper.appendChild(a);
        ctaBelow = ctaBelowWrapper;
      } else {
        a.className = 'sqb-heading__cta';
        wrap.appendChild(a);
      }
    }
    return { headingEl: wrap, ctaBelowEl: ctaBelow };
  }


  /* ════════════════════════════════════
   * DATE UTILITIES
   * Format ISO 2026-09-19T15:00 → affichage localisé
   * filterDate: extrait YYYY-MM-DD pour le groupement
   * ════════════════════════════════════ */

  function parseISO(str) {
    // Accepte 2026-09-19T15:00 ou 2026-09-19
    var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return null;
    return {
      year: parseInt(m[1], 10), month: parseInt(m[2], 10) - 1,
      day:  parseInt(m[3], 10), hour: m[4] ? parseInt(m[4], 10) : null,
      min:  m[5] ? parseInt(m[5], 10) : null,
      ts:   new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10),
                     m[4] ? parseInt(m[4],10) : 0, m[5] ? parseInt(m[5],10) : 0).getTime(),
    };
  }

  function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  // Formate une valeur de tag ISO en texte lisible
  // Supporte les intervalles : 2026-09-14/2026-09-22 → '14–22 septembre 2026'
  // format: 'datetime' | 'date' | 'day' | 'time'
  function formatISOTag(str, format, locale) {
    // Détecter intervalle
    if (String(str || '').indexOf('/') !== -1) {
      var parts = str.split('/');
      var d1 = parseISO(parts[0]), d2 = parseISO(parts[1]);
      if (d1 && d2) {
        var loc = locale || document.documentElement.lang || 'fr-CH';
        try {
          var dt1 = new Date(d1.year, d1.month, d1.day);
          var dt2 = new Date(d2.year, d2.month, d2.day);
          // Même mois : '14–22 septembre 2026'
          if (d1.month === d2.month && d1.year === d2.year) {
            var m = dt1.toLocaleDateString(loc, { month: 'long' });
            var y = d1.year;
            return d1.day + '\u2013' + d2.day + '\u00a0' + m + '\u00a0' + y;
          }
          return dt1.toLocaleDateString(loc, { day: 'numeric', month: 'long' }) +
                 '\u00a0\u2013\u00a0' +
                 dt2.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (_) { return str; }
      }
    }
    var d = parseISO(str);
    if (!d) return str;
    var dt = new Date(d.year, d.month, d.day, d.hour || 0, d.min || 0);
    var loc = locale || document.documentElement.lang || 'fr-CH';
    try {
      if (format === 'time' && d.hour !== null) {
        return dt.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      if (format === 'day') {
        return dt.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
      }
      if (format === 'date') {
        return dt.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      }
      // 'datetime' (défaut) : jour + heure si heure présente
      var dayStr = dt.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' });
      if (d.hour !== null) {
        var timeStr = dt.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit', hour12: false });
        return capitalize(dayStr) + ', ' + timeStr;
      }
      return capitalize(dayStr);
    } catch (_) { return str; }
  }

  // Extrait la partie date (YYYY-MM-DD) d'un tag ISO pour le groupement
  function getISODatePart(str) {
    var m = String(str || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  // Formate une date YYYY-MM-DD en label de groupe lisible
  function formatGroupDate(dateStr, locale) {
    var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dateStr;
    var dt = new Date(parseInt(m[1],10), parseInt(m[2],10)-1, parseInt(m[3],10));
    var loc = locale || document.documentElement.lang || 'fr-CH';
    try {
      return capitalize(dt.toLocaleDateString(loc, { weekday: 'long', day: 'numeric', month: 'long' }));
    } catch (_) { return dateStr; }
  }

  /* ════════════════════════════════════
   * 8. GROUPBY VISUEL
   * ════════════════════════════════════ */

  function getGroupKey(item, groupBy) {
    if (!groupBy) return null;
    if (groupBy === 'category') return item.categories[0] || '\u2014';
    if (typeof groupBy === 'object' && groupBy.tagPrefix) {
      var val = getTagValuesByPrefix(item, groupBy.tagPrefix)[0] || '\u2014';
      // Si groupByDay, extraire seulement la partie date (YYYY-MM-DD)
      if (groupBy.groupByDay && val !== '\u2014') {
        var datePart = getISODatePart(val);
        return datePart || val;
      }
      return val;
    }
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

  function renderGrouped(items, cfg, grid, activeGroupFilter) {
    var groupBy = (cfg.display && cfg.display.groupBy) || null;
    var groupOrder = (cfg.display && cfg.display.groupOrder) || 'collection';
    var idx = 0;
    if (!groupBy) { items.forEach(function(item) { grid.appendChild(buildCard(item, cfg, idx++)); }); return; }
    var orderedKeys = [], groups = new Map();
    items.forEach(function(item) {
      // Multi-placement : si groupByDay et item a plusieurs dates,
      // l'insérer dans chaque groupe jour (pas de duplication des données)
      var keys = [];
      if (groupBy.groupByDay && groupBy.tagPrefix) {
        var allVals = getTagValuesByPrefix(item, groupBy.tagPrefix);
        allVals.forEach(function(v) {
          var part = getISODatePart(v) || v;
          if (keys.indexOf(part) === -1) keys.push(part);
        });
      }
      if (!keys.length) keys = [getGroupKey(item, groupBy)];
      keys.forEach(function(key) {
        // Si un filtre de groupe est actif, ne placer l'item que dans le groupe correspondant
        if (activeGroupFilter && norm(key) !== norm(activeGroupFilter)) return;
        if (!groups.has(key)) { groups.set(key, []); orderedKeys.push(key); }
        groups.get(key).push(item);
      });
    });
    sortGroupKeys(orderedKeys, groupOrder).forEach(function(key) {
      var gi = groups.get(key) || []; if (!gi.length) return;
      var h = el('div', { class: 'sqb-group-heading', 'data-group': key, style: 'grid-column:1 / -1' });
      // Formater les clés date ISO (YYYY-MM-DD) en texte lisible
      var headingLabel = /^\d{4}-\d{2}-\d{2}$/.test(key) ? formatGroupDate(key) : key;
      setText(h, headingLabel); grid.appendChild(h);
      gi.forEach(function(item) { grid.appendChild(buildCard(item, cfg, idx++)); });
    });
  }

  /* ════════════════════════════════════
   * 9. TRI CHRONOLOGIQUE DATES
   * ════════════════════════════════════ */

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
      // Essayer ISO d'abord, puis l'ancien parser
      var ap = parseISO(a), bp = parseISO(b);
      if (ap && bp) return ap.ts - bp.ts;
      var at = parseTagDate(a), bt = parseTagDate(b);
      if (at !== null && bt !== null) return at - bt;
      return at !== null ? -1 : bt !== null ? 1 : norm(a).localeCompare(norm(b));
    });
  }

  /* ════════════════════════════════════
   * 10. STICKY
   * ════════════════════════════════════ */

  function setupSticky(sentinel, wrapper, stickyTop) {
    if (!('IntersectionObserver' in window)) return;
    // Appliquer sticky via classe CSS — top défini par variable CSS
    // → permet à --header-height de s'appliquer dynamiquement sans JS
    wrapper.classList.add('sqb-filters-wrapper--sticky');
    if (stickyTop && stickyTop !== '0px') {
      // Valeur custom (ex: 'var(--header-height, 0px)') → injectée comme var CSS locale
      wrapper.style.setProperty('--sqb-sticky-top', stickyTop);
    }
    new IntersectionObserver(function(entries) {
      wrapper.classList.toggle('sqb-filters-wrapper--is-sticky', !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ════════════════════════════════════
   * 11. PANNEAU MOBILE (téléporté dans body)
   * ════════════════════════════════════ */

  function buildMobilePanel(appendSecondary, tabPool, i18n) {
    var panel = el('div', { class: 'sqb-mobile-panel', 'aria-hidden': 'true', role: 'dialog', 'aria-modal': 'true' });
    var inner = el('div', { class: 'sqb-mobile-panel-inner' });

    // Barre de titre + croix
    var header = el('div', { class: 'sqb-mobile-panel-header' });
    var closeBtn = el('button', { class: 'sqb-mobile-panel-close sqb-icon-btn', type: 'button', 'aria-label': 'Fermer' });
    var closeIcon = el('span', { class: 'sqb-icon' });
    closeIcon.textContent = i18n.filterClose || 'close';
    closeBtn.appendChild(closeIcon);
    header.appendChild(closeBtn);
    inner.appendChild(header);

    // Zone filtres (remplie dynamiquement)
    var filtersZone = el('div', { class: 'sqb-mobile-filters-zone' });
    inner.appendChild(filtersZone);
    panel.appendChild(inner);

    // Backdrop
    var backdrop = el('div', { class: 'sqb-backdrop' });
    backdrop.addEventListener('click', close);

    function open() {
      if (!panel.parentNode || panel.parentNode !== document.body) {
        document.body.appendChild(panel);
      }
      if (!backdrop.parentNode || backdrop.parentNode !== document.body) {
        document.body.insertBefore(backdrop, panel);
      }
      backdrop.classList.add('sqb-backdrop--visible');
      // Hériter du thème de couleur de la section
      var sourceBlock = document.querySelector('[data-sqb-key]');
      if (sourceBlock) {
        var section = sourceBlock.closest('[data-section-theme]');
        if (section) panel.setAttribute('data-section-theme', section.getAttribute('data-section-theme'));
        else panel.removeAttribute('data-section-theme');
      }
      // Remplir les filtres au moment de l'ouverture
      filtersZone.innerHTML = '';
      appendSecondary(tabPool(), filtersZone);
      panel.setAttribute('aria-hidden', 'false');
      panel.classList.add('sqb-mobile-panel--open');
      document.body.classList.add('sqb-panel-open');
      closeBtn.focus();
    }

    function close() {
      panel.setAttribute('aria-hidden', 'true');
      panel.classList.remove('sqb-mobile-panel--open');
      backdrop.classList.remove('sqb-backdrop--visible');
      document.body.classList.remove('sqb-panel-open');
    }

    closeBtn.addEventListener('click', close);
    panel.addEventListener('click', function(e) { if (e.target === panel) close(); });

    // Echap
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('sqb-mobile-panel--open')) close();
    });

    return { panel: panel, open: open, close: close };
  }

  /* ════════════════════════════════════
   * 12. FILTRES UI
   * ════════════════════════════════════ */

  function buildFilterBar(baseItems, cfg, onFilter, onTabChange, getTabPrefixes) {
    if (cfg.filters === false) return null;
    var fc           = cfg.filters || {};
    var globalLayout = fc.layout || 'pills';
    var datePrefix   = fc.datePrefix || null;
    var i18n         = Object.assign({
      all: 'Tout', searchPlaceholder: 'Rechercher\u2026',
      filterToggle: 'Filtrer', filterClose: 'close',
    }, cfg.i18n || {});
    // Passer clearAll au panneau mobile via i18n interne
    if (fc.clearAll) {
      i18n._hasClearAll  = true;
      i18n._clearAllText = typeof fc.clearAll === 'string' ? fc.clearAll : 'R\u00e9initialiser';
    }
    var prefixDefs   = normalizePrefixes(fc.tagPrefixes, globalLayout);
    var useMobilePanel     = fc.mobilePanel === true;
    var mobilePanelBp      = fc.mobilePanelBreakpoint === 'always' ? Infinity : Number(fc.mobilePanelBreakpoint || 768);

    var wrapper = el('div', { class: 'sqb-filters-wrapper' });
    var bar     = el('div', { class: 'sqb-filters' });
    wrapper.appendChild(bar);

    var state       = { tab: null, category: null, tags: {}, search: '' };
    var secondaryEl = null;
    var mobileObj   = null;
    var toggleBtn   = null;

    function emit() {
      var t = {}; Object.keys(state.tags).forEach(function(k) { t[k] = state.tags[k]; });
      onFilter({ tab: state.tab, category: state.category, tags: t, search: state.search });
      updateToggleBadge();
      var hasActive = countActive() > 0;
      // clearAllBtn dans la barre : masqué si le panneau est toujours actif (tout passe par le panneau)
      if (clearAllBtn) {
        var alwaysPanel = mobilePanelBp === Infinity;
        clearAllBtn.style.display = (hasActive && !alwaysPanel) ? '' : 'none';
      }
      if (typeof panelClearBtn !== 'undefined' && panelClearBtn) panelClearBtn.style.display = hasActive ? '' : 'none';
    }

    // resetOtherFilters : si fc.resetOthers === true, vide catégorie + tags + search sauf le filtre courant
    function resetOtherFilters(exceptType, exceptKey) {
      if (!fc.resetOthers) return;
      if (exceptType !== 'category') state.category = null;
      // Utiliser les tagPrefixes du tab actif si définis
      var activePrefixDefs = (getTabPrefixes && getTabPrefixes()) ? normalizePrefixes(getTabPrefixes(), globalLayout) : prefixDefs;
      activePrefixDefs.forEach(function(pd) {
        if (exceptType !== 'tag' || exceptKey !== pd.prefix) state.tags[pd.prefix] = null;
      });
      if (exceptType !== 'search') state.search = '';
      // Mettre à jour visuellement les boutons (on rebuild)
      if (secondaryEl) { secondaryEl.innerHTML = ''; appendSecondary(tabPool(), secondaryEl); }
    }

    function countActive() {
      var n = 0; if (state.category) n++;
      Object.keys(state.tags).forEach(function(k) { if (state.tags[k]) n++; });
      if (state.search) n++; return n;
    }

    function updateToggleBadge() {
      if (!toggleBtn) return;
      var n = countActive();
      var badge = toggleBtn.querySelector('.sqb-mobile-toggle-badge');
      if (n > 0) {
        if (!badge) { badge = el('span', { class: 'sqb-mobile-toggle-badge' }); toggleBtn.appendChild(badge); }
        badge.textContent = String(n);
      } else { if (badge) badge.remove(); }
    }

    function tabPool() { return state.tab ? applyTabFilter(baseItems, state.tab) : baseItems; }
    function resetSec() { state.category = null; state.tags = {}; state.search = ''; }

    // ── Pills ──────────────────────────────────────────────────────────────
    function buildPillGroup(vals, displayVals, label, showLabel, getCurrent, onSelect) {
      var wrap = el('div', { class: 'sqb-filter-group sqb-filter-group--pills' });
      if (showLabel && label) { var lbl = el('span', { class: 'sqb-filter-label' }); lbl.textContent = label; wrap.appendChild(lbl); }
      vals.forEach(function(v, vi) {
        var dv = (displayVals && displayVals[vi]) ? displayVals[vi] : v;
        var active = getCurrent() !== null && norm(String(v)) === norm(String(getCurrent()));
        var btn = el('button', { class: 'sqb-filter-btn' + (active ? ' sqb-filter-btn--active' : ''), type: 'button' });
        setText(btn, dv);
        btn.addEventListener('click', function() {
          var isCurrent = norm(String(v)) === norm(String(getCurrent() || ''));
          onSelect(isCurrent ? null : v);
          wrap.querySelectorAll('.sqb-filter-btn').forEach(function(b) { b.classList.remove('sqb-filter-btn--active'); });
          if (!isCurrent) btn.classList.add('sqb-filter-btn--active');
          emit();
        });
        wrap.appendChild(btn);
      });
      return wrap;
    }

    // ── Dropdown ───────────────────────────────────────────────────────────
    function buildDropdown(vals, displayVals, label, getCurrent, onSelect) {
      var wrap = el('div', { class: 'sqb-filter-group sqb-filter-group--dropdown' });
      var sel  = el('select', { class: 'sqb-filter-select', 'aria-label': label });
      var o0   = el('option', { value: '' }); o0.textContent = label + ': ' + i18n.all; sel.appendChild(o0);
      vals.forEach(function(v, vi) {
        var dv = (displayVals && displayVals[vi]) ? displayVals[vi] : v;
        var o = el('option', { value: v }); o.textContent = dv;
        if (getCurrent() && norm(v) === norm(getCurrent())) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function() { onSelect(sel.value || null); emit(); });
      wrap.appendChild(sel); return wrap;
    }

    // ── Filtres secondaires ─────────────────────────────────────────────────
    function appendSecondary(pool, container) {
      // Catégories
      // fc.categories : false = masqué | true = affiché avec label | { order, showLabel } = config détaillée
      if (fc.categories !== false) {
        var catsCfg      = (fc.categories && typeof fc.categories === 'object') ? fc.categories : {};
        var catsOrder    = catsCfg.order    || null;
        var catsShowLbl  = catsCfg.showLabel !== false;
        var catsLabel    = catsCfg.label    || 'Cat\u00e9gorie';
        var cats = uniqBy(pool.reduce(function(a, i) { return a.concat(i.categories); }, []).filter(Boolean), norm)
          .sort(function(a, b) { return norm(a).localeCompare(norm(b)); });
        if (catsOrder) cats = applyCustomOrder(cats, catsOrder);
        if (cats.length > 1) {
          if (fc.defaultCategory && state.category == null) state.category = fc.defaultCategory;
          var grp = buildPillGroup(cats, null, catsLabel, catsShowLbl,
            function() { return state.category; },
            function(v) { state.category = v; resetOtherFilters('category', null); });
          grp.classList.add('sqb-filter-group--cats'); container.appendChild(grp);
        }
      }
      // Utiliser les tagPrefixes du tab actif si définis
      var activePrefixDefs = (getTabPrefixes && getTabPrefixes()) ? normalizePrefixes(getTabPrefixes(), globalLayout) : prefixDefs;
      activePrefixDefs.forEach(function(pd) {
        var raw  = uniqBy(pool.reduce(function(a, i) { return a.concat(getTagValuesByPrefix(i, pd.prefix)); }, []).filter(Boolean), norm);
        var vals = sortTagValues(raw, pd.prefix, datePrefix);
        if (pd.order) vals = applyCustomOrder(vals, pd.order);
        // Formater les valeurs pour l'affichage dans le filtre (tout en gardant la valeur brute pour le match)
        var fmt = pd.filterFormat || (datePrefix && norm(pd.prefix) === norm(datePrefix) ? 'day' : null);
        var displayVals = fmt ? vals.map(function(v) { return formatISOTag(v, fmt) || v; }) : vals;
        if (!vals.length) return;
        var defVal = fc.defaultTags && fc.defaultTags[pd.prefix];
        if (defVal && !state.tags[pd.prefix]) state.tags[pd.prefix] = defVal;
        var grp;
        (function(prefix) {
          if (pd.layout === 'dropdown') {
            grp = buildDropdown(vals, displayVals, prefix,
              function() { return state.tags[prefix] || null; },
              function(v) { state.tags[prefix] = v; resetOtherFilters('tag', prefix); });
          } else {
            grp = buildPillGroup(vals, displayVals, prefix, pd.showLabel,
              function() { return state.tags[prefix] || null; },
              function(v) { state.tags[prefix] = v; resetOtherFilters('tag', prefix); });
          }
        })(pd.prefix);
        grp.classList.add('sqb-filter-group--tag');
        grp.setAttribute('data-prefix', pd.prefix);
        container.appendChild(grp);
      });
      if (fc.search !== false) {
        var sg = el('div', { class: 'sqb-filter-group sqb-filter-group--search' });
        var inp = el('input', { class: 'sqb-filter-search', type: 'search',
          placeholder: i18n.searchPlaceholder, 'aria-label': i18n.searchPlaceholder });
        var timer;
        inp.addEventListener('input', function() {
          clearTimeout(timer);
          timer = setTimeout(function() { state.search = inp.value.trim(); emit(); }, 200);
        });
        sg.appendChild(inp); container.appendChild(sg);
      }
    }

    function rebuildSecondary() {
      if (secondaryEl) { secondaryEl.innerHTML = ''; appendSecondary(tabPool(), secondaryEl); }
    }

    // ── Tabs ──────────────────────────────────────────────────────────────
    var tabs = Array.isArray(fc.tabs) ? fc.tabs : [];
    if (tabs.length) {
      var tabGroup = el('div', { class: 'sqb-filter-group sqb-filter-group--tabs' });
      var defIdx   = Number(fc.defaultTab != null ? fc.defaultTab : 0);
      tabs.forEach(function(tab, idx) {
        var active = idx === defIdx;
        var btn = el('button', { class: 'sqb-tab-btn' + (active ? ' sqb-tab-btn--active' : ''), type: 'button' });
        if (tab.labelIcon) {
          var ic = el('span', { class: 'sqb-icon' }); ic.textContent = tab.labelIcon; btn.appendChild(ic);
        } else {
          setText(btn, tab.label || 'Tab');
        }
        if (active) { state.tab = tab.filter || null; if (onTabChange) onTabChange(tab); }
        btn.addEventListener('click', function() {
          if (btn.classList.contains('sqb-tab-btn--active')) return;
          tabGroup.querySelectorAll('.sqb-tab-btn').forEach(function(b) { b.classList.remove('sqb-tab-btn--active'); });
          btn.classList.add('sqb-tab-btn--active');
          state.tab = tab.filter || null;
          resetSec(); rebuildSecondary();
          if (onTabChange) onTabChange(tab);
          emit();
        });
        tabGroup.appendChild(btn);
      });
      bar.appendChild(tabGroup);
    }

    // ── Filtres secondaires desktop ────────────────────────────────────────
    secondaryEl = el('div', { class: 'sqb-filters-secondary' });
    appendSecondary(tabPool(), secondaryEl);
    bar.appendChild(secondaryEl);

    // ── Bouton clearAll (optionnel) ─────────────────────────────────────────
    var clearAllBtn = null;
    if (fc.clearAll) {
      clearAllBtn = el('button', { class: 'sqb-clear-all', type: 'button' });
      clearAllBtn.textContent = typeof fc.clearAll === 'string' ? fc.clearAll : 'R\u00e9initialiser';
      clearAllBtn.style.display = 'none';
      clearAllBtn.addEventListener('click', function() {
        state.category = null; state.tags = {}; state.search = '';
        secondaryEl.innerHTML = ''; appendSecondary(tabPool(), secondaryEl);
        emit();
      });
      bar.appendChild(clearAllBtn);
    }

    // ── Bouton mobile ─────────────────────────────────────────────────────
    if (useMobilePanel) {
      toggleBtn = el('button', { class: 'sqb-mobile-toggle', type: 'button' });
      toggleBtn.textContent = i18n.filterToggle;
      toggleBtn.style.display = 'none'; // masqué jusqu'à checkBreakpoint

      // Si tabs présents, placer le bouton à côté — sinon en ligne séparée
      var tabsGroupEl = bar.querySelector('.sqb-filter-group--tabs');
      if (tabsGroupEl) {
        var tabsRow = el('div', { class: 'sqb-tabs-row' });
        bar.replaceChild(tabsRow, tabsGroupEl);
        tabsRow.appendChild(tabsGroupEl);
        tabsRow.appendChild(toggleBtn);
      } else {
        var mobileRow = el('div', { class: 'sqb-mobile-filter-row' });
        mobileRow.appendChild(toggleBtn);
        bar.appendChild(mobileRow);
      }

      mobileObj = buildMobilePanel(appendSecondary, tabPool, i18n);

      toggleBtn.addEventListener('click', function() { mobileObj.open(); });

      // ResizeObserver pour activer/désactiver selon breakpoint
      var isMobileMode = false;
      function checkBreakpoint() {
        var shouldBeMobile = window.innerWidth < mobilePanelBp;
        if (shouldBeMobile === isMobileMode) return;
        isMobileMode = shouldBeMobile;
        wrapper.classList.toggle('sqb-filters--mobile-mode', isMobileMode);
        // Afficher/masquer le toggle selon le mode
        if (toggleBtn) toggleBtn.style.display = isMobileMode ? '' : 'none';
      }
      checkBreakpoint();
      if ('ResizeObserver' in window) {
        new ResizeObserver(checkBreakpoint).observe(document.body);
      } else {
        window.addEventListener('resize', checkBreakpoint);
      }
    }

    return wrapper;
  }

  /* ════════════════════════════════════
   * 13. RUNNER
   * ════════════════════════════════════ */

  async function runConfig(cfg) {
    if (!cfg || cfg.enabled === false) return;
    var target = document.querySelector(cfg.target || '');
    if (!target) return;

    var perf = cfg.performance || {}, pag = cfg.pagination || {}, disp = cfg.display || {};
    var fc   = (cfg.filters && cfg.filters !== false) ? cfg.filters : {};
    var i18n = Object.assign({
      loading: false, all: 'Tout', noResults: 'Aucun r\u00e9sultat',
      loadMoreLabel: 'Voir plus', endLabel: '', filterToggle: 'Filtrer', filterClose: 'close',
    }, cfg.i18n || {});
    if (pag.loadMoreLabel)          i18n.loadMoreLabel = pag.loadMoreLabel;
    if (pag.endLabel !== undefined) i18n.endLabel      = pag.endLabel;

    var perPage    = Number(pag.perPage || 12);
    var mode       = pag.mode || 'load-more';
    var dispLayout = disp.layout  || 'grid';

    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');
    // data-sqb-label : défini dans la config ou dans le HTML du conteneur
    if (cfg.label) target.setAttribute('data-sqb-label', cfg.label);
    if (cfg.key)     target.classList.add('sqb--' + cfg.key);
    if (cfg.classes) cfg.classes.trim().split(/\s+/).forEach(function(c) { if (c) target.classList.add(c); });
    if (dispLayout === 'list') target.classList.add('sqb-block--list');
    target.classList.add('sqb-block--loading');

    injectLoaderStyles();
    target.appendChild(buildLoader(i18n.loading));

    var rawItems = [];
    try {
      var results = await Promise.all((Array.isArray(cfg.sources) ? cfg.sources : []).map(function(src) {
        return fetchAllItems(src.path, perf.maxPages || 10, perf.sessionCache !== false, perf.sessionCacheTTL || 300)
          .then(function(items) { return items.map(function(raw) { return mapItem(raw, src.path); }); });
      }));
      results.forEach(function(r) { rawItems.push.apply(rawItems, r); });
    } catch (err) {
      if (cfg.debug) console.warn('[SQB]', cfg.key, err);
      target.querySelector('.sqb-loader, .sqb-loader--text') && target.querySelector('.sqb-loader, .sqb-loader--text').remove();
      setText(target.appendChild(el('p', { class: 'sqb-error' })), '\u26A0 Erreur de chargement');
      return;
    }

    rawItems = uniqBy(rawItems, function(i) { return i.fullUrl || i.id; });
    rawItems = applyPreFilter(rawItems, cfg.preFilter || null);
    rawItems = sortItems(rawItems, cfg.sort);
    if (cfg.debug) console.log('[SQB]', cfg.key, rawItems.length, 'items');

    var loaderEl = target.querySelector('.sqb-loader, .sqb-loader--text');
    if (loaderEl) loaderEl.remove();
    target.classList.remove('sqb-block--loading');

    var activeFilters = { tab: null, category: null, tags: {}, search: '' };
    var currentPage = 1, ioInfinite = null;

    if (Array.isArray(fc.tabs) && fc.tabs.length) {
      var di = Number(fc.defaultTab != null ? fc.defaultTab : 0);
      if (fc.tabs[di]) activeFilters.tab = fc.tabs[di].filter || null;
    }
    if (fc.defaultCategory) activeFilters.category = fc.defaultCategory;
    if (fc.defaultTags)     Object.assign(activeFilters.tags, fc.defaultTags);

    var root = el('div', { class: 'sqb-root' });

    // Heading
    var headingResult = buildHeading(cfg.heading || null);
    if (headingResult.headingEl) root.appendChild(headingResult.headingEl);

    // Scroll vers la grille au changement de filtre
    var scrollOnFilter = fc.scrollOnFilter !== false;
    function scrollToGrid() {
      if (!scrollOnFilter) return;
      var rect = grid.getBoundingClientRect();
      // Scroller seulement si la grille est hors du viewport (au-dessus ou en dessous)
      var isAbove = rect.top < 0;
      var isBelow = rect.top > window.innerHeight;
      if (isAbove || isBelow) {
        var scrollTarget = (filterWrapper && filterWrapper.parentNode) ? filterWrapper : grid;
        scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

    // Sort, layout, groups et groupBy courants (peuvent changer par tab)
    var currentSort       = cfg.sort || null;
    var currentLayout     = dispLayout;
    var currentGroups     = (disp.groups && disp.groups.length) ? disp.groups : null;
    var currentGroupBy    = disp.groupBy    || null;
    var currentGroupOrder = disp.groupOrder || 'collection';
    var currentTagPrefixes = null; // null = utiliser fc.tagPrefixes

    function onTabChange(tab) {
      updateTabClass(tab.labelIcon ? (tab.label || '') : (tab.label || ''));
      if (tab.sort   !== undefined) { currentSort   = tab.sort;   } else { currentSort   = cfg.sort || null; }
      if (tab.layout !== undefined) { currentLayout = tab.layout; } else { currentLayout = dispLayout; }
      if (tab.groups    !== undefined) { currentGroups    = tab.groups;    } else { currentGroups    = (disp.groups && disp.groups.length) ? disp.groups : null; }
      if (tab.groupBy   !== undefined) { currentGroupBy   = tab.groupBy;   } else { currentGroupBy   = disp.groupBy    || null; }
      if (tab.groupOrder   !== undefined) { currentGroupOrder  = tab.groupOrder;   } else { currentGroupOrder  = disp.groupOrder  || 'collection'; }
      if (tab.tagPrefixes !== undefined) { currentTagPrefixes = tab.tagPrefixes; } else { currentTagPrefixes = null; }
      // grid sera mis à jour dans render() via currentLayout
    }

    var filterWrapper = buildFilterBar(rawItems, cfg, function(f) {
      activeFilters = f; currentPage = 1; render(true);
    }, onTabChange, function() { return currentTagPrefixes; });

    var gridClass = dispLayout === 'list' ? 'sqb-grid sqb-grid--list' : 'sqb-grid';
    var grid    = el('div', { class: gridClass });
    var counter = el('p',   { class: 'sqb-counter', 'aria-live': 'polite' });
    var footer  = el('div', { class: 'sqb-footer' });

    if (filterWrapper) root.appendChild(filterWrapper);
    root.appendChild(grid);
    if (disp.counter !== false) root.appendChild(counter);
    root.appendChild(footer);
    target.appendChild(root);

    // Sticky
    if (filterWrapper && fc.sticky) {
      var sentinel = el('div', { style: 'height:1px;pointer-events:none;visibility:hidden' });
      filterWrapper.parentNode.insertBefore(sentinel, filterWrapper);
      setupSticky(sentinel, filterWrapper, fc.stickyTop || '0px');
    }

    // Classe tab sur le bloc
    function updateTabClass(tabLabel) {
      Array.from(target.classList).forEach(function(c) {
        if (c.indexOf('sqb-tab--') === 0) target.classList.remove(c);
      });
      if (tabLabel) target.classList.add('sqb-tab--' + slugify(tabLabel));
    }
    // Init classe tab
    if (Array.isArray(fc.tabs) && fc.tabs.length) {
      var initTab = fc.tabs[Number(fc.defaultTab != null ? fc.defaultTab : 0)];
      if (initTab) {
        updateTabClass(initTab.label || '');
        if (initTab.sort   !== undefined) currentSort   = initTab.sort;
        if (initTab.layout !== undefined) currentLayout = initTab.layout;
        if (initTab.groups     !== undefined) currentGroups    = initTab.groups;
        if (initTab.groupBy   !== undefined) currentGroupBy   = initTab.groupBy;
        if (initTab.groupOrder   !== undefined) currentGroupOrder  = initTab.groupOrder;
        if (initTab.tagPrefixes !== undefined) currentTagPrefixes = initTab.tagPrefixes;
      }
    }

    // Intercept tab changes pour mettre à jour la classe
    // (se fait via le onFilter callback — on ajoute le label du tab dans l'état)
    var tabLabels = (Array.isArray(fc.tabs) ? fc.tabs : []).map(function(t) { return t.label || ''; });

    var hook = window.SQB_HOOKS && window.SQB_HOOKS[cfg.key];

    function render(fromFilter, fromPagination) {
      if (ioInfinite) { ioInfinite.disconnect(); ioInfinite = null; }
      grid.className = currentLayout === 'list' ? 'sqb-grid sqb-grid--list' : 'sqb-grid';
      target.classList.toggle('sqb-block--list', currentLayout === 'list');
      if (fromFilter) scrollToGrid();

      var pool     = activeFilters.tab ? applyTabFilter(rawItems, activeFilters.tab) : rawItems;
      var poolSorted = currentSort ? sortItems(pool, currentSort) : pool;
      var filtered = poolSorted.filter(function(item) { return matchesUIFilters(item, activeFilters); });
      var total    = filtered.length;
      var shown    = filtered.slice(0, currentPage * perPage);

      if (!fromPagination) grid.innerHTML = '';
      footer.innerHTML = '';

      if (!shown.length) {
        setText(grid.appendChild(el('p', { class: 'sqb-empty' })), i18n.noResults);
        if (disp.counter !== false) counter.textContent = '';
        if (hook) hook(grid, [], cfg);
        return;
      }

      // Appliquer les groups du tab actif si définis
      var cfgForRender = (currentGroups || currentGroupBy !== (disp.groupBy || null))
        ? Object.assign({}, cfg, { display: Object.assign({}, disp, {
            groups:     currentGroups    || disp.groups,
            groupBy:    currentGroupBy,
            groupOrder: currentGroupOrder,
          }) })
        : cfg;
      // Filtre de groupe actif : si on filtre par le datePrefix, ne montrer que ce groupe
      var activeGroupFilter = null;
      if (currentGroupBy && currentGroupBy.tagPrefix && activeFilters.tags) {
        activeGroupFilter = activeFilters.tags[currentGroupBy.tagPrefix] || null;
        // Si la valeur est ISO, extraire la date part pour correspondre au groupe
        if (activeGroupFilter && currentGroupBy.groupByDay) {
          activeGroupFilter = getISODatePart(activeGroupFilter) || activeGroupFilter;
        }
      }
      renderGrouped(shown, cfgForRender, grid, activeGroupFilter);
      if ((cfgForRender.display || disp).fadeIn !== false) {
        var cards = grid.querySelectorAll('.sqb-card');
        cards.forEach(function(c, i) {
          c.style.animationDelay = (i * 0.04) + 's';
          c.classList.add('sqb-card--fade-in');
        });
      }
      if (disp.counter !== false) counter.textContent = shown.length + '\u00a0/\u00a0' + total;
      if (hook) hook(grid, shown, cfg);

      // CTA below heading (ajouté après le contenu)
      if (headingResult.ctaBelowEl) {
        var existing = root.querySelector('.sqb-heading__cta-below');
        if (!existing) root.appendChild(headingResult.ctaBelowEl);
      }

      var hasMore = shown.length < total;
      if (!hasMore) {
        if (i18n.endLabel !== false && i18n.endLabel) setText(footer.appendChild(el('p', { class: 'sqb-end-label' })), i18n.endLabel);
        return;
      }
      if (mode === 'load-more') {
        var btn = setText(el('button', { class: 'sqb-load-more', type: 'button' }), i18n.loadMoreLabel);
        btn.addEventListener('click', function() { currentPage++; render(false, true); });
        footer.appendChild(btn);
      } else if (mode === 'infinite' && 'IntersectionObserver' in window) {
        var infS = el('div', { class: 'sqb-sentinel', 'aria-hidden': 'true' });
        footer.appendChild(infS);
        ioInfinite = new IntersectionObserver(function(entries) {
          if (!entries[0].isIntersecting) return;
          ioInfinite.disconnect(); ioInfinite = null; currentPage++; render(false, true);
        }, { rootMargin: '400px' });
        ioInfinite.observe(infS);
      }
    }

    render(false);
  }

  /* ════════════════════════════════════
   * 14. POINT D'ENTRÉE
   * ════════════════════════════════════ */

  function init() {
    var configs = Array.isArray(window.SQB_CONFIGS) ? window.SQB_CONFIGS : [];
    if (!configs.length) return;
    // Trier par position DOM (order visuel) — targets absents en dernier
    configs = configs.slice().sort(function(a, b) {
      var ta = document.querySelector(a.target || '');
      var tb = document.querySelector(b.target || '');
      var ya = ta ? ta.getBoundingClientRect().top + window.scrollY : Infinity;
      var yb = tb ? tb.getBoundingClientRect().top + window.scrollY : Infinity;
      return ya - yb;
    });
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
