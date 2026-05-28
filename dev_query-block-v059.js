(function () {
  'use strict';

  /* ════════════════════════════════════
   * 0. UTILITAIRES
   * ════════════════════════════════════ */

  function noop() {}

  function getCollectionBlocks() {
    return window.CollectionBlocks || null;
  }

  function getCollectionUtils() {
    var cb = getCollectionBlocks();
    return cb && (cb.utils || cb);
  }

  function getCollectionDataAPI() {
    var cb = getCollectionBlocks();

    if (cb && cb.data && typeof cb.data.get === 'function') {
      return cb.data;
    }

    if (cb && typeof cb.get === 'function') {
      return cb;
    }

    if (window.CollectionData && typeof window.CollectionData.get === 'function') {
      return window.CollectionData;
    }

    return null;
  }

  function norm(str) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.norm === 'function') return utils.norm(str);

    return String(str || '')
      .replace(/\u00A0/g, ' ').trim().toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019']/g, "'").replace(/&/g, 'and')
      .replace(/\s+/g, ' ').trim();
  }

  function slugify(str) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.slugify === 'function') return utils.slugify(str);

    return norm(str).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function cleanHTML(str) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.cleanHTML === 'function') return utils.cleanHTML(str);

    var d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.truncate === 'function') return utils.truncate(str, max);

    var s = cleanHTML(str);
    if (!s || s.length <= max) return s;
    var cut = s.slice(0, max), sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '\u2026';
  }

  function uniqBy(arr, fn) {
    var seen = new Set();
    return arr.filter(function(x) {
      var k = fn(x);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
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

  function setText(e, s) {
    e.textContent = s;
    return e;
  }

  function qCardClass(shared, specific, legacy) {
    return [shared, specific, legacy].filter(Boolean).join(' ');
  }

  function addUiClasses(node, classes) {
    String(classes || '').split(/\s+/).forEach(function(cls) {
      if (cls) node.classList.add(cls);
    });
  }

  function removeUiClasses(node, classes) {
    String(classes || '').split(/\s+/).forEach(function(cls) {
      if (cls) node.classList.remove(cls);
    });
  }

  function toggleUiClasses(node, classes, force) {
    String(classes || '').split(/\s+/).forEach(function(cls) {
      if (cls) node.classList.toggle(cls, force);
    });
  }

  function withUiState(baseClasses, stateClasses, enabled) {
    return baseClasses + (enabled ? ' ' + stateClasses : '');
  }

  var CLS_LOADER = 'cb-loader qb-loader sqb-loader';
  var CLS_LOADER_TEXT = 'cb-loader--text qb-loader--text sqb-loader--text';
  var CLS_LOADER_DOT = 'cb-loader__dot qb-loader__dot sqb-loader-dot';
  var CLS_FILTERS_WRAPPER = 'cb-filters-wrapper qb-filters-wrapper sqb-filters-wrapper';
  var CLS_FILTERS_WRAPPER_STICKY = 'cb-filters-wrapper--sticky qb-filters-wrapper--sticky sqb-filters-wrapper--sticky';
  var CLS_FILTERS_WRAPPER_STUCK = 'cb-filters-wrapper--is-sticky qb-filters-wrapper--is-sticky sqb-filters-wrapper--is-sticky';
  var CLS_FILTERS = 'cb-filters qb-filters sqb-filters';
  var CLS_FILTERS_MOBILE_MODE = 'cb-filters--mobile-mode qb-filters--mobile-mode sqb-filters--mobile-mode';
  var CLS_FILTERS_SECONDARY = 'cb-filters-secondary qb-filters-secondary sqb-filters-secondary';
  var CLS_FILTER_GROUP = 'cb-filter-group qb-filter-group sqb-filter-group';
  var CLS_FILTER_GROUP_PILLS = 'cb-filter-group--pills qb-filter-group--pills sqb-filter-group--pills';
  var CLS_FILTER_GROUP_DROPDOWN = 'cb-filter-group--dropdown qb-filter-group--dropdown sqb-filter-group--dropdown';
  var CLS_FILTER_GROUP_CATS = 'cb-filter-group--cats qb-filter-group--cats sqb-filter-group--cats';
  var CLS_FILTER_GROUP_TAG = 'cb-filter-group--tag qb-filter-group--tag sqb-filter-group--tag';
  var CLS_FILTER_GROUP_SEARCH = 'cb-filter-group--search qb-filter-group--search sqb-filter-group--search';
  var CLS_FILTER_GROUP_TABS = 'cb-filter-group--tabs qb-filter-group--tabs sqb-filter-group--tabs';
  var CLS_FILTER_LABEL = 'cb-filter-label qb-filter-label sqb-filter-label';
  var CLS_FILTER_BTN = 'cb-filter-btn qb-filter-btn sqb-filter-btn';
  var CLS_FILTER_BTN_ACTIVE = 'cb-filter-btn--active qb-filter-btn--active sqb-filter-btn--active';
  var CLS_FILTER_SELECT = 'cb-filter-select qb-filter-select sqb-filter-select';
  var CLS_FILTER_SEARCH = 'cb-filter-search qb-filter-search sqb-filter-search';
  var CLS_TAB_BTN = 'cb-tab-btn qb-tab-btn sqb-tab-btn';
  var CLS_TAB_BTN_ACTIVE = 'cb-tab-btn--active qb-tab-btn--active sqb-tab-btn--active';
  var CLS_CLEAR_ALL = 'cb-clear-all qb-clear-all sqb-clear-all';
  var CLS_CLEAR_ALL_PANEL = 'cb-clear-all--panel qb-clear-all--panel sqb-clear-all--panel';
  var CLS_ICON = 'cb-icon qb-icon sqb-icon';
  var CLS_ICON_BTN = 'cb-icon-btn qb-icon-btn sqb-icon-btn';
  var CLS_MOBILE_PANEL = 'cb-mobile-panel qb-mobile-panel sqb-mobile-panel';
  var CLS_MOBILE_PANEL_OPEN = 'cb-mobile-panel--open qb-mobile-panel--open sqb-mobile-panel--open';
  var CLS_MOBILE_PANEL_INNER = 'cb-mobile-panel__inner qb-mobile-panel__inner sqb-mobile-panel-inner';
  var CLS_MOBILE_PANEL_HEADER = 'cb-mobile-panel__header qb-mobile-panel__header sqb-mobile-panel-header';
  var CLS_MOBILE_PANEL_CLOSE = 'cb-mobile-panel__close qb-mobile-panel__close sqb-mobile-panel-close';
  var CLS_MOBILE_FILTERS_ZONE = 'cb-mobile-filters-zone qb-mobile-filters-zone sqb-mobile-filters-zone';
  var CLS_BACKDROP = 'cb-backdrop qb-backdrop sqb-backdrop';
  var CLS_BACKDROP_VISIBLE = 'cb-backdrop--visible qb-backdrop--visible sqb-backdrop--visible';
  var CLS_PANEL_OPEN_BODY = 'cb-panel-open qb-panel-open sqb-panel-open';
  var CLS_MOBILE_TOGGLE = 'cb-mobile-toggle qb-mobile-toggle sqb-mobile-toggle';
  var CLS_MOBILE_TOGGLE_BADGE = 'cb-mobile-toggle__badge qb-mobile-toggle__badge sqb-mobile-toggle-badge';
  var CLS_TABS_ROW = 'cb-tabs-row qb-tabs-row sqb-tabs-row';
  var CLS_MOBILE_FILTER_ROW = 'cb-mobile-filter-row qb-mobile-filter-row sqb-mobile-filter-row';

  function parseTag(tag) {
    var raw = String(tag || ''), idx = raw.indexOf(':');
    if (idx === -1) return { prefix: null, value: raw.trim() };
    return { prefix: raw.slice(0, idx).trim(), value: raw.slice(idx + 1).trim() };
  }

  function getTagValuesByPrefix(item, prefix) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.getTagValuesByPrefix === 'function') {
      return utils.getTagValuesByPrefix(item, prefix);
    }

    var pn = norm(String(prefix).replace(/:$/, ''));
    return (item.tags || []).reduce(function(acc, tag) {
      var p = parseTag(tag);
      if (p.prefix && norm(p.prefix) === pn && p.value) acc.push(p.value);
      return acc;
    }, []);
  }

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
      if (typeof p === 'string') {
        return {
          prefix: p,
          layout: globalLayout || 'pills',
          showLabel: true,
          order: null,
          filterFormat: null,
        };
      }
      return {
        prefix:       p.prefix,
        layout:       p.layout       || globalLayout || 'pills',
        showLabel:    p.showLabel    !== false,
        order:        p.order        || null,
        filterFormat: p.filterFormat || null,
      };
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i];
      a[i] = a[j];
      a[j] = tmp;
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
    s.id = 'sqb-loader-styles';
    s.textContent = css;
    document.head.appendChild(s);
  }

  function buildLoader(loadingText) {
    if (loadingText) return setText(el('div', {
      class: CLS_LOADER + ' ' + CLS_LOADER_TEXT,
      'aria-live': 'polite',
    }), loadingText);

    var w = el('div', {
      class: CLS_LOADER,
      role: 'status',
      'aria-label': 'Chargement',
    });

    for (var i = 0; i < 3; i++) {
      w.appendChild(el('span', {
        class: CLS_LOADER_DOT,
        'aria-hidden': 'true',
      }));
    }

    return w;
  }

  /* ════════════════════════════════════
   * 2. FETCH & CACHE
   * ════════════════════════════════════ */


    function stripItemFields(items, fields) {
    if (!Array.isArray(fields) || !fields.length) return items;

    return (Array.isArray(items) ? items : []).map(function(item) {
      if (!item || typeof item !== 'object') return item;

      var clone = Object.assign({}, item);

      fields.forEach(function(field) {
        delete clone[field];
      });

      return clone;
    });
  }

  function ensureJson(url) {
    if (!url) return url;
    return url.indexOf('format=json') !== -1
      ? url
      : (url.indexOf('?') !== -1 ? url + '&format=json' : url + '?format=json');
  }

function buildCollectionOptions(maxPages, useSession, ttl, stripFields) {
  return {
    maxPages: maxPages || 1,
    ttl: ttl || 300,
    memoryCache: true,
    sessionCache: useSession !== false,
    credentials: 'same-origin',
    stripFields: stripFields || [],
  };
}

async function fetchCollectionState(path, maxPages, useSession, ttl, stripFields) {
  var dataApi = getCollectionDataAPI();

  if (!dataApi || typeof dataApi.get !== 'function') {
    throw new Error('CollectionBlocks ou CollectionData requis pour Query Block');
  }

  var options = buildCollectionOptions(maxPages, useSession, ttl, stripFields);

  if (typeof dataApi.getState === 'function') {
    return dataApi.getState(path, options);
  }

  return dataApi.get(path, options).then(function(items) {
    return {
      items: items,
      pagesLoaded: Number(maxPages || 1),
      complete: maxPages === 'all',
      fetchError: null,
      hasNext: maxPages !== 'all',
    };
  });
}

  /* ════════════════════════════════════
   * 3. MAPPING
   * ════════════════════════════════════ */

  function mapItem(raw, sourcePath) {
    var assetUrl = raw.assetUrl || (raw.asset && raw.asset.url) || null;
    var fp = raw.mediaFocalPoint;

    var focalPoint = (fp && typeof fp.x === 'number' && typeof fp.y === 'number')
      ? (Math.round(fp.x * 100) + '% ' + Math.round(fp.y * 100) + '%')
      : '50% 50%';

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
      excerptRaw:   raw.excerpt || raw.body || '',
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
      return cats.some(function(w) {
        return norm(w) === norm(c);
      });
    });
  }

  function applyPreFilter(items, pf) {
    if (!pf) return items;

    return items.filter(function(item) {
      if (!matchesCats(item, pf.categories)) return false;
      if (pf.excludeCategories && matchesCats(item, pf.excludeCategories)) return false;

      if (pf.tagValues) {
        for (var i = 0; i < pf.tagValues.length; i++) {
          var tv = pf.tagValues[i];
          if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) {
            return norm(v) === norm(tv.value);
          })) return false;
        }
      }

      return true;
    });
  }

  function applyTabFilter(items, tf) {
    if (!tf) return items;

    return items.filter(function(item) {
      if (!matchesCats(item, tf.categories)) return false;
      if (tf.excludeCategories && matchesCats(item, tf.excludeCategories)) return false;

      if (tf.tagValues) {
        for (var i = 0; i < tf.tagValues.length; i++) {
          var tv = tf.tagValues[i];
          if (!getTagValuesByPrefix(item, tv.prefix).some(function(v) {
            return norm(v) === norm(tv.value);
          })) return false;
        }
      }

      return true;
    });
  }

  function matchesUIFilters(item, state) {
    if (state.category && !item.categories.some(function(c) {
      return norm(c) === norm(state.category);
    })) return false;

    var tags = state.tags || {};
    for (var prefix in tags) {
      if (!Object.prototype.hasOwnProperty.call(tags, prefix) || !tags[prefix]) continue;
      if (!getTagValuesByPrefix(item, prefix).some(function(v) {
        return norm(v) === norm(tags[prefix]);
      })) return false;
    }

    if (state.search) {
      var q = norm(state.search);
      if (norm([item.title, item.excerpt, item.location].concat(item.categories, item.tags).join(' ')).indexOf(q) === -1) {
        return false;
      }
    }

    return true;
  }

  /* ════════════════════════════════════
   * 5. TRI
   * ════════════════════════════════════ */

  function tryNum(s) {
    var n = parseFloat(String(s || '').replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function sortItems(items, sort) {
    if (!sort) return items;

    var type = sort.type || 'collection';
    var dir = (sort.direction || 'asc') === 'desc' ? -1 : 1;

    if (type === 'random') return shuffle(items);

    return items.slice().sort(function(a, b) {
      if (type === 'date') return (a.timestamp - b.timestamp) * dir;
      if (type === 'title') return norm(a.title).localeCompare(norm(b.title)) * dir;
      if (type === 'category') return norm(a.categories[0] || '').localeCompare(norm(b.categories[0] || '')) * dir;

      if (typeof type === 'object' && type.tagPrefix) {
        var av = getTagValuesByPrefix(a, type.tagPrefix)[0] || '';
        var bv = getTagValuesByPrefix(b, type.tagPrefix)[0] || '';
        var an = tryNum(av);
        var bn = tryNum(bv);

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
          if (img.dataset.src) img.src = img.dataset.src;

          img.removeAttribute('data-src');
          img.removeAttribute('data-srcset');
          obs.unobserve(img);
        });
      }, { rootMargin: '300px 0px' })
    : null;

  var SRCSET_WIDTHS = [300, 500, 750, 1000, 1500];
var SQB_RENDER_IMAGE_INDEX = 0;

  function buildImg(assetUrl, focalPoint, alt, priority) {
  var imgIndex = SQB_RENDER_IMAGE_INDEX++;
var isPriority = priority === true || imgIndex < 3;

  var srcset = SRCSET_WIDTHS.map(function(w) {
    return assetUrl + '?format=' + w + 'w ' + w + 'w';
  }).join(', ');

  var fallbackSrc = assetUrl + '?format=750w';

  var wrap = el('div', { class: qCardClass('cb-card__img-wrap', 'qb-card__img-wrap', 'sqb-card__img-wrap') });

  var img = el('img', {
    class: qCardClass('cb-card__img', 'qb-card__img', 'sqb-card__img'),
    alt: alt || '',
    sizes: '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw',
    decoding: 'async',
  });

  img.style.objectPosition = focalPoint;
    
    if (isPriority) {
      img.loading = 'eager';
  img.fetchPriority = 'high';
  img.srcset = srcset;
  img.src = fallbackSrc;
} else {
  img.fetchPriority = 'low';
  img.loading = 'lazy';

    if (IO_LAZY) {
      img.dataset.src = fallbackSrc;
      img.dataset.srcset = srcset;
      IO_LAZY.observe(img);
    } else {
      img.srcset = srcset;
      img.src = fallbackSrc;
    }
  }

  img.addEventListener('load', function() {
    img.classList.add('sqb-card__img--loaded');
    img.classList.add('cb-card__img--loaded');
    img.classList.add('qb-card__img--loaded');
  }, { once: true });

  wrap.appendChild(img);
  return wrap;
}

  /* ════════════════════════════════════
   * 7. RENDU CARTE
   * ════════════════════════════════════ */

  var ROLE_CLASS = {
    media: qCardClass('cb-card__media', 'qb-card__media', 'sqb-card__media'),
    header: qCardClass('cb-card__header', 'qb-card__header', 'sqb-card__header'),
    body:  qCardClass('cb-card__body', 'qb-card__body', 'sqb-card__body'),
    meta:  qCardClass('cb-card__meta', 'qb-card__meta', 'sqb-card__meta'),
    footer:qCardClass('cb-card__footer', 'qb-card__footer', 'sqb-card__footer'),
  };

  function buildLabelNode(label, labelIcon) {
    if (labelIcon) {
      var ic = el('span', { class: 'cb-icon qb-icon sqb-icon cb-tag-icon qb-tag-icon sqb-tag-icon' });
      ic.textContent = labelIcon;
      return ic;
    }

    if (label) {
      var lbl = el('span', { class: qCardClass('cb-card__tag-label', 'qb-card__tag-label', 'sqb-card__tag-label') });
      lbl.textContent = label + '\u00A0';
      return lbl;
    }

    return null;
  }

  function buildChild(def, item, cardIndex) {
    var type = typeof def === 'string' ? def : (def && def.type);

    if (type === 'image') {
      return item.assetUrl ? buildImg(item.assetUrl, item.focalPoint, item.title, cardIndex < 3) : null;
    }

    if (type === 'categories') {
      if (!item.categories.length) return null;

      var w = el('div', { class: qCardClass('cb-card__categories', 'qb-card__categories', 'sqb-card__cats') });
      item.categories.forEach(function(c) {
        var s = el('span', { class: qCardClass('cb-card__category', 'qb-card__category', 'sqb-card__cat') });
        s.textContent = c;
        w.appendChild(s);
      });

      return w;
    }

    if (type === 'title') {
      if (!item.title) return null;

      var t = el('div', {
        class: qCardClass('cb-card__title', 'qb-card__title', 'sqb-card__title'),
        role: 'heading',
        'aria-level': '3',
      });

      t.textContent = item.title;
      return t;
    }

    if (type === 'excerpt') {
      if (!item.excerpt) return null;

      var p = el('p', { class: qCardClass('cb-card__excerpt', 'qb-card__excerpt', 'sqb-card__excerpt') });

      if (def && def.excerptPlain) {
        p.textContent = item.excerpt;
      } else {
        p.innerHTML = sanitizeHTML(item.excerptRaw || item.excerpt);
      }

      return p;
    }

    if (type === 'location') {
      if (!item.location) return null;

      var pl = el('p', { class: qCardClass('cb-card__location', 'qb-card__location', 'sqb-card__location') });
      pl.textContent = item.location;
      return pl;
    }

    if (type === 'tagPrefix') {
      var prefix = (def && def.prefix) || '';
      var label = (def && def.label != null) ? def.label : '';
      var labelIcon = (def && def.labelIcon) || null;

      var joinWith = (def && def.joinWith != null) ? def.joinWith
        : (def && def.inlineSeparator != null) ? def.inlineSeparator
        : ', ';

      if (def && def.displayInline) joinWith = def.inlineSeparator || joinWith || ', ';

      var displayFmt = (def && def.displayFormat) || null;
      var locale = (def && def.locale) || null;
      var rawVals = getTagValuesByPrefix(item, prefix);
      var vals = displayFmt
        ? rawVals.map(function(v) { return formatISOTag(v, displayFmt, locale); })
        : rawVals;

      if (!vals.length) return null;

      var row = el('div', {
        class: qCardClass('cb-card__tag-field', 'qb-card__tag-field', 'sqb-card__tag-field'),
        'data-prefix': prefix,
      });

      var labelNode = buildLabelNode(label, labelIcon);
      if (labelNode) row.appendChild(labelNode);

      if (joinWith === '\n') {
        var vw = el('span', {
          class: qCardClass('cb-card__tag-value cb-card__tag-value--multiline', 'qb-card__tag-value qb-card__tag-value--multiline', 'sqb-card__tag-value sqb-card__tag-value--multiline'),
        });

        vals.forEach(function(v, i) {
          if (i > 0) vw.appendChild(document.createElement('br'));
          vw.appendChild(document.createTextNode(v));
        });

        row.appendChild(vw);
      } else {
        setText(row.appendChild(el('span', { class: qCardClass('cb-card__tag-value', 'qb-card__tag-value', 'sqb-card__tag-value') })), vals.join(joinWith));
      }

      return row;
    }

    return null;
  }

  function buildCard(item, cfg, index) {
    var disp = cfg.display || {};
    var link = disp.cardLink !== false;
    var card = el(link ? 'a' : 'div', {
      class: qCardClass('cb-card', 'qb-card', 'sqb-card'),
      'data-sqb-index': String(index),
    });

    if (link) {
      card.href = item.fullUrl;
      if (disp.cardLinkNewTab) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
    }

    var cardClassesCfg = disp.cardClasses || null;

    if (cardClassesCfg) {
      if (cardClassesCfg.categories) {
        item.categories.forEach(function(cat) {
          card.classList.add('sqb-cat--' + slugify(cat));
        });
      }

      var tagPfxList = Array.isArray(cardClassesCfg.tagPrefixes)
        ? cardClassesCfg.tagPrefixes
        : [];

      tagPfxList.forEach(function(pfx) {
        getTagValuesByPrefix(item, pfx).forEach(function(val) {
          card.classList.add('sqb-tag--' + slugify(pfx) + '--' + slugify(val));
        });
      });
    }

    var groups = Array.isArray(disp.groups) && disp.groups.length ? disp.groups : null;

    if (groups) {
      groups.forEach(function(grp) {
        var wrapper = el('div', {
          class: ROLE_CLASS[grp.role] || qCardClass('cb-card__group', 'qb-card__group', 'sqb-card__group'),
        });

        var sep = grp.separator || ' ';
        var useInline = grp.inline === true;
        var children = grp.children || [];

        if (useInline) {
          wrapper.classList.add('sqb-card__group--inline');
          wrapper.classList.add('cb-card__group--inline');
          wrapper.classList.add('qb-card__group--inline');

          var built = children.map(function(def) {
            return buildChild(def, item, index);
          }).filter(Boolean);

          built.forEach(function(node, ni) {
            wrapper.appendChild(node);

            if (ni < built.length - 1 && sep) {
              var sepNode = el('span', { class: 'cb-inline-sep qb-inline-sep sqb-inline-sep' });
              sepNode.textContent = sep;
              wrapper.appendChild(sepNode);
            }
          });
        } else {
          children.forEach(function(def) {
            var node = buildChild(def, item, index);
            if (node) wrapper.appendChild(node);
          });
        }

        if (wrapper.hasChildNodes()) card.appendChild(wrapper);
      });

      return card;
    }

    if (item.assetUrl) card.appendChild(buildImg(item.assetUrl, item.focalPoint, item.title, index < 3));

    var body = el('div', { class: qCardClass('cb-card__body', 'qb-card__body', 'sqb-card__body') });

    if (item.categories.length) {
      var meta = el('div', { class: qCardClass('cb-card__categories', 'qb-card__categories', 'sqb-card__cats') });

      item.categories.forEach(function(c) {
        var s = el('span', { class: qCardClass('cb-card__category', 'qb-card__category', 'sqb-card__cat') });
        s.textContent = c;
        meta.appendChild(s);
      });

      body.appendChild(meta);
    }

    if (item.title) {
      var tt = el('div', {
        class: qCardClass('cb-card__title', 'qb-card__title', 'sqb-card__title'),
        role: 'heading',
        'aria-level': '3',
      });

      tt.textContent = item.title;
      body.appendChild(tt);
    }

    (Array.isArray(disp.tagPrefixFields) ? disp.tagPrefixFields : []).forEach(function(f) {
      var node = buildChild({
        type: 'tagPrefix',
        prefix: f.prefix,
        label: f.label,
        labelIcon: f.labelIcon,
        joinWith: f.joinWith,
      }, item);

      if (node) body.appendChild(node);
    });

    if (disp.excerpt !== false && item.excerpt) {
      var ep = el('p', { class: qCardClass('cb-card__excerpt', 'qb-card__excerpt', 'sqb-card__excerpt') });
      ep.textContent = item.excerpt;
      body.appendChild(ep);
    }

    if (disp.location && item.location) {
      var lp = el('p', { class: qCardClass('cb-card__location', 'qb-card__location', 'sqb-card__location') });
      lp.textContent = item.location;
      body.appendChild(lp);
    }

    card.appendChild(body);
    return card;
  }

  /* ════════════════════════════════════
   * 7b. HEADING DU BLOC
   * ════════════════════════════════════ */

  function buildHeading(headingCfg) {
    if (!headingCfg) return { headingEl: null, ctaBelowEl: null };

    var wrap = el('div', { class: 'cb-heading qb-heading sqb-heading' });

    if (headingCfg.text) {
      var tag = headingCfg.tag || 'h3';
      var h = el(tag, { class: 'cb-heading__text qb-heading__text sqb-heading__text' });
      h.textContent = headingCfg.text;
      wrap.appendChild(h);
    }

    var cta = headingCfg.cta;
    var ctaBelow = null;
    var ctaPos = (cta && cta.position) || 'inline';

    if (cta && cta.text && cta.href) {
      var a = el('a', { href: cta.href });

      if (cta.newTab) {
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
      }

      a.textContent = cta.text;

      if (ctaPos === 'below') {
        a.className = 'cb-heading__cta-below qb-heading__cta-below sqb-heading__cta-below cb-load-more qb-load-more sqb-load-more';
        var ctaBelowWrapper = el('div', { class: 'cb-footer cb-footer--cta qb-footer qb-footer--cta sqb-footer--cta' });
        ctaBelowWrapper.appendChild(a);
        ctaBelow = ctaBelowWrapper;
      } else {
        a.className = 'cb-heading__cta qb-heading__cta sqb-heading__cta';
        wrap.appendChild(a);
      }
    }

    return { headingEl: wrap, ctaBelowEl: ctaBelow };
  }

  /* ════════════════════════════════════
   * DATE UTILITIES
   * ════════════════════════════════════ */

  function parseISO(str) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.parseISO === 'function') return utils.parseISO(str);

    var m = String(str || '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return null;

    return {
      year: parseInt(m[1], 10),
      month: parseInt(m[2], 10) - 1,
      day: parseInt(m[3], 10),
      hour: m[4] ? parseInt(m[4], 10) : null,
      min: m[5] ? parseInt(m[5], 10) : null,
      ts: new Date(
        parseInt(m[1], 10),
        parseInt(m[2], 10) - 1,
        parseInt(m[3], 10),
        m[4] ? parseInt(m[4], 10) : 0,
        m[5] ? parseInt(m[5], 10) : 0
      ).getTime(),
    };
  }

  var SQB_TZ = (function() {
    try {
      var ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
      return (ctx && ctx.websiteTimeZone) ? ctx.websiteTimeZone : null;
    } catch (_) {
      return null;
    }
  })();

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function formatISOTag(str, format, locale) {
    var utils = getCollectionUtils();
    if (utils && typeof utils.formatISOTag === 'function') {
      return utils.formatISOTag(str, format, locale);
    }

    if (String(str || '').indexOf('/') !== -1) {
      var parts = str.split('/');
      var d1 = parseISO(parts[0]);
      var d2 = parseISO(parts[1]);

      if (d1 && d2) {
        var loc = locale || document.documentElement.lang || 'fr-CH';

        try {
          var dt1 = new Date(d1.year, d1.month, d1.day);
          var dt2 = new Date(d2.year, d2.month, d2.day);

          if (d1.month === d2.month && d1.year === d2.year) {
            var m = dt1.toLocaleDateString(loc, { month: 'long' });
            var y = d1.year;
            return d1.day + '\u2013' + d2.day + '\u00a0' + m + '\u00a0' + y;
          }

          return dt1.toLocaleDateString(loc, { day: 'numeric', month: 'long' }) +
            '\u00a0\u2013\u00a0' +
            dt2.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (_) {
          return str;
        }
      }
    }

    var d = parseISO(str);
    if (!d) return str;

    var dt = new Date(d.year, d.month, d.day, d.hour || 0, d.min || 0);
    var loc2 = locale || document.documentElement.lang || 'fr-CH';

    try {
      if (format && typeof format === 'object') {
        return capitalize(dt.toLocaleDateString(loc2, format));
      }

      var tzOpt = SQB_TZ ? { timeZone: SQB_TZ } : {};

      if (format === 'time' && d.hour !== null) {
        return dt.toLocaleTimeString(loc2, Object.assign({
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        }, tzOpt));
      }

      if (format === 'day') {
        return capitalize(dt.toLocaleDateString(loc2, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }));
      }

      if (format === 'short') {
        return capitalize(dt.toLocaleDateString(loc2, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }));
      }

      if (format === 'numeric') {
        return dt.toLocaleDateString(loc2, Object.assign({
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        }, tzOpt));
      }

      if (format === 'date') {
        return capitalize(dt.toLocaleDateString(loc2, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }));
      }

      var dayStr = dt.toLocaleDateString(loc2, Object.assign({
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }, tzOpt));

      if (d.hour !== null) {
        var timeStr = dt.toLocaleTimeString(loc2, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        });

        return capitalize(dayStr) + ', ' + timeStr;
      }

      return capitalize(dayStr);
    } catch (_) {
      return str;
    }
  }

  function getISODatePart(str) {
    var m = String(str || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function formatGroupDate(dateStr, locale, groupLabelFormat) {
    var m = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return dateStr;

    var dt = new Date(
      parseInt(m[1], 10),
      parseInt(m[2], 10) - 1,
      parseInt(m[3], 10)
    );

    var loc = locale || document.documentElement.lang || 'fr-CH';
    var fmt = groupLabelFormat || 'day';

    try {
      if (fmt && typeof fmt === 'object') return capitalize(dt.toLocaleDateString(loc, fmt));

      if (fmt === 'date') {
        return capitalize(dt.toLocaleDateString(loc, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }));
      }

      if (fmt === 'short') {
        return capitalize(dt.toLocaleDateString(loc, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        }));
      }

      return capitalize(dt.toLocaleDateString(loc, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      }));
    } catch (_) {
      return dateStr;
    }
  }

  function sanitizeHTML(html) {
    var allowed = /^(br|p|h[1-6]|strong|em|b|i|u|a|ul|ol|li|span|div)$/i;
    var d = document.createElement('div');
    d.innerHTML = String(html || '');

    (function clean(node) {
      var toRemove = [];

      node.childNodes.forEach(function(child) {
        if (child.nodeType === 1) {
          if (!allowed.test(child.tagName)) {
            toRemove.push(child);
          } else {
            ['onclick', 'onerror', 'onload', 'src', 'href'].forEach(function(attr) {
              if (attr === 'href') return;
              child.removeAttribute(attr);
            });

            clean(child);
          }
        }
      });

      toRemove.forEach(function(n) {
        n.parentNode.replaceChild(document.createTextNode(n.textContent), n);
      });
    })(d);

    return d.innerHTML;
  }

  /* ════════════════════════════════════
   * 8. GROUPBY VISUEL
   * ════════════════════════════════════ */

  function getGroupKey(item, groupBy) {
    if (!groupBy) return null;
    if (groupBy === 'category') return item.categories[0] || '\u2014';

    if (typeof groupBy === 'object' && groupBy.tagPrefix) {
      var val = getTagValuesByPrefix(item, groupBy.tagPrefix)[0] || '\u2014';

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
      var om = new Map(groupOrder.map(function(v, i) {
        return [norm(v), i];
      }));

      return keys.slice().sort(function(a, b) {
        var ai = om.has(norm(a)) ? om.get(norm(a)) : 9999;
        var bi = om.has(norm(b)) ? om.get(norm(b)) : 9999;
        return ai !== bi ? ai - bi : norm(a).localeCompare(norm(b));
      });
    }

    if (groupOrder === 'alpha') {
      return keys.slice().sort(function(a, b) {
        return norm(a).localeCompare(norm(b));
      });
    }

    return keys;
  }

  function renderGrouped(items, cfg, grid, activeGroupFilter) {
    var groupBy = (cfg.display && cfg.display.groupBy) || null;
    var groupOrder = (cfg.display && cfg.display.groupOrder) || 'collection';
    var idx = 0;

    if (!groupBy) {
      items.forEach(function(item) {
        grid.appendChild(buildCard(item, cfg, idx++));
      });
      return;
    }

    var orderedKeys = [];
    var groups = new Map();

    items.forEach(function(item) {
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
        if (activeGroupFilter && norm(key) !== norm(activeGroupFilter)) return;

        if (!groups.has(key)) {
          groups.set(key, []);
          orderedKeys.push(key);
        }

        groups.get(key).push(item);
      });
    });

    var isDateKey = function(k) {
      return /^\d{4}-\d{2}-\d{2}$/.test(k);
    };

    var todayStr = (function() {
      var dbg = cfg.debug;
      var now = (dbg && typeof dbg === 'object' && dbg.mockDate)
        ? new Date(dbg.mockDate + 'T00:00:00')
        : new Date();

      return now.getFullYear() + '-' +
        String(now.getMonth() + 1).padStart(2, '0') + '-' +
        String(now.getDate()).padStart(2, '0');
    })();

    var gbCfg = cfg.display && cfg.display.groupBy;
    var useSmartDate = gbCfg &&
      gbCfg.groupByDay &&
      gbCfg.highlightToday !== false &&
      isDateKey(orderedKeys[0] || '');

    var sortedKeys;

    if (useSmartDate) {
      var futureKeys = orderedKeys.filter(function(k) {
        return k >= todayStr;
      }).sort();

      var pastKeys = orderedKeys.filter(function(k) {
        return k < todayStr;
      }).sort().reverse();

      sortedKeys = futureKeys.concat(pastKeys);
    } else {
      sortedKeys = sortGroupKeys(orderedKeys, groupOrder);
    }

    var labelFmt = (gbCfg && gbCfg.groupLabelFormat) || 'date';

    sortedKeys.forEach(function(key) {
      var gi = groups.get(key) || [];
      if (!gi.length) return;

      var h = el('div', {
        class: 'cb-group-heading qb-group-heading sqb-group-heading',
        'data-group': key,
        style: 'grid-column:1 / -1',
      });

      var headingLabel;

      if (isDateKey(key)) {
        if (useSmartDate && key === todayStr) {
          headingLabel = 'Aujourd\u2019hui';
        } else if (useSmartDate && key < todayStr) {
          headingLabel = formatGroupDate(key, null, labelFmt);
          h.classList.add('cb-group-heading--past', 'qb-group-heading--past', 'sqb-group-heading--past');
        } else {
          headingLabel = formatGroupDate(key, null, labelFmt);
        }
      } else {
        headingLabel = key;
      }

      setText(h, headingLabel);
      grid.appendChild(h);

      gi.forEach(function(item) {
        grid.appendChild(buildCard(item, cfg, idx++));
      });
    });
  }


function appendPlainItemsProgressive(items, cfg, grid, startIndex, batchSize, done) {
  var utils = getCollectionUtils();

  if (utils && typeof utils.appendProgressiveDOM === 'function') {
    return utils.appendProgressiveDOM(items, grid, function(item, cardIndex) {
      return buildCard(item, cfg, cardIndex);
    }, {
      startIndex: startIndex,
      batchSize: batchSize,
      done: done,
    });
  }

  var index = 0;
  var size = Math.max(1, Number(batchSize || 8));

  function appendBatch() {
    var frag = document.createDocumentFragment();
    var end = Math.min(index + size, items.length);

    for (; index < end; index++) {
      frag.appendChild(buildCard(items[index], cfg, startIndex + index));
    }

    grid.appendChild(frag);

    if (index < items.length) {
      requestAnimationFrame(appendBatch);
    } else if (typeof done === 'function') {
      done();
    }
  }

  appendBatch();
}

  /* ════════════════════════════════════
   * 9. TRI CHRONOLOGIQUE DATES
   * ════════════════════════════════════ */

  var MONTH_MAP = {
    january:1, february:2, march:3, april:4, may:5, june:6, july:7, august:8, september:9, october:10, november:11, december:12,
    janvier:1, fevrier:2, mars:3, avril:4, mai:5, juin:6, juillet:7, aout:8, septembre:9, octobre:10, novembre:11, decembre:12,
  };

  function parseTagDate(str) {
    var s = String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    var m = s.match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})/);

    if (!m || !MONTH_MAP[m[2]]) return null;

    return new Date(
      parseInt(m[3], 10),
      MONTH_MAP[m[2]] - 1,
      parseInt(m[1], 10)
    ).getTime();
  }

  function sortTagValues(vals, prefix, datePrefix) {
    var isDate = datePrefix && norm(prefix) === norm(datePrefix);

    if (!isDate) {
      return vals.slice().sort(function(a, b) {
        return norm(a).localeCompare(norm(b));
      });
    }

    return vals.slice().sort(function(a, b) {
      var ap = parseISO(a);
      var bp = parseISO(b);

      if (ap && bp) return ap.ts - bp.ts;

      var at = parseTagDate(a);
      var bt = parseTagDate(b);

      if (at !== null && bt !== null) return at - bt;
      return at !== null ? -1 : bt !== null ? 1 : norm(a).localeCompare(norm(b));
    });
  }

  /* ════════════════════════════════════
   * 10. STICKY
   * ════════════════════════════════════ */

  function setupSticky(sentinel, wrapper, stickyTop) {
    if (!('IntersectionObserver' in window)) return;

    addUiClasses(wrapper, CLS_FILTERS_WRAPPER_STICKY);

    if (stickyTop && stickyTop !== '0px') {
      wrapper.style.setProperty('--sqb-sticky-top', stickyTop);
    }

    new IntersectionObserver(function(entries) {
      toggleUiClasses(wrapper, CLS_FILTERS_WRAPPER_STUCK, !entries[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }

  /* ════════════════════════════════════
   * 11. PANNEAU MOBILE
   * ════════════════════════════════════ */

  function buildMobilePanel(appendSecondary, tabPool, i18n, ownerBlock) {
    var panel = el('div', {
      class: CLS_MOBILE_PANEL,
      'aria-hidden': 'true',
      role: 'dialog',
      'aria-modal': 'true',
    });

    var inner = el('div', { class: CLS_MOBILE_PANEL_INNER });

    var header = el('div', { class: CLS_MOBILE_PANEL_HEADER });

    var panelClearBtn = null;

    if (i18n._hasClearAll) {
      panelClearBtn = el('button', {
        class: CLS_CLEAR_ALL + ' ' + CLS_CLEAR_ALL_PANEL,
        type: 'button',
      });

      var panelClearIcon = el('span', { class: CLS_ICON });
      panelClearIcon.textContent = 'refresh';

      panelClearBtn.appendChild(panelClearIcon);
      panelClearBtn.appendChild(document.createTextNode(' ' + (i18n._clearAllText || 'Réinitialiser')));
      panelClearBtn.style.display = 'none';

      header.appendChild(panelClearBtn);
    }

    var closeBtn = el('button', {
      class: CLS_MOBILE_PANEL_CLOSE + ' ' + CLS_ICON_BTN,
      type: 'button',
      'aria-label': 'Fermer',
    });

    var closeIcon = el('span', { class: CLS_ICON });
    closeIcon.textContent = i18n.filterClose || 'close';
    closeBtn.appendChild(closeIcon);
    header.appendChild(closeBtn);

    inner.appendChild(header);

    var filtersZone = el('div', { class: CLS_MOBILE_FILTERS_ZONE });
    inner.appendChild(filtersZone);
    panel.appendChild(inner);

    var backdrop = el('div', { class: CLS_BACKDROP });
    backdrop.addEventListener('click', close);

    function syncContext() {
      if (!ownerBlock) return;

      Array.from(panel.classList).forEach(function(c) {
        if (
          c.indexOf('cb--') === 0 ||
          c.indexOf('qb--') === 0 ||
          c.indexOf('sqb--') === 0 ||
          c.indexOf('cb-tab--') === 0 ||
          c.indexOf('qb-tab--') === 0 ||
          c.indexOf('sqb-tab--') === 0 ||
          c.indexOf('cb-block--') === 0 ||
          c.indexOf('qb-block--') === 0 ||
          c.indexOf('sqb-block--') === 0
        ) {
          panel.classList.remove(c);
        }
      });

      ['data-sqb-key', 'data-sqb-label', 'data-sqb-tab'].forEach(function(attr) {
        if (ownerBlock.hasAttribute(attr)) {
          panel.setAttribute(attr, ownerBlock.getAttribute(attr));
        } else {
          panel.removeAttribute(attr);
        }
      });

      Array.from(ownerBlock.classList).forEach(function(c) {
        if (
          c.indexOf('cb--') === 0 ||
          c.indexOf('qb--') === 0 ||
          c.indexOf('sqb--') === 0 ||
          c.indexOf('cb-tab--') === 0 ||
          c.indexOf('qb-tab--') === 0 ||
          c.indexOf('sqb-tab--') === 0 ||
          c.indexOf('cb-block--') === 0 ||
          c.indexOf('qb-block--') === 0 ||
          c.indexOf('sqb-block--') === 0
        ) {
          panel.classList.add(c);
        }
      });

      var section = ownerBlock.closest('[data-section-theme]');
      if (section) {
        panel.setAttribute('data-section-theme', section.getAttribute('data-section-theme'));
      } else {
        panel.removeAttribute('data-section-theme');
      }
    }

    function open() {
      if (!panel.parentNode || panel.parentNode !== document.body) {
        document.body.appendChild(panel);
      }

      if (!backdrop.parentNode || backdrop.parentNode !== document.body) {
        document.body.insertBefore(backdrop, panel);
      }

      addUiClasses(backdrop, CLS_BACKDROP_VISIBLE);

      syncContext();

      filtersZone.innerHTML = '';
      appendSecondary(tabPool(), filtersZone);

      panel.setAttribute('aria-hidden', 'false');
      addUiClasses(panel, CLS_MOBILE_PANEL_OPEN);

      addUiClasses(document.body, CLS_PANEL_OPEN_BODY);

      closeBtn.focus();
    }

    function close() {
      panel.setAttribute('aria-hidden', 'true');
      removeUiClasses(panel, CLS_MOBILE_PANEL_OPEN);
      removeUiClasses(backdrop, CLS_BACKDROP_VISIBLE);
      removeUiClasses(document.body, CLS_PANEL_OPEN_BODY);
    }

    closeBtn.addEventListener('click', close);

    panel.addEventListener('click', function(e) {
      if (e.target === panel) close();
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && panel.classList.contains('sqb-mobile-panel--open')) {
        close();
      }
    });

    return {
      panel: panel,
      open: open,
      close: close,
      panelClearBtn: panelClearBtn,
      syncContext: syncContext,
    };
  }

  /* ════════════════════════════════════
   * 12. FILTRES UI
   * ════════════════════════════════════ */

  function buildFilterBar(baseItems, cfg, onFilter, onTabChange, getTabPrefixes, ownerBlock) {
    if (cfg.filters === false) return null;

    var fc = cfg.filters || {};
    var globalLayout = fc.layout || 'pills';
    var datePrefix = fc.datePrefix || null;

    var i18n = Object.assign({
      all: 'Tout',
      searchPlaceholder: 'Rechercher\u2026',
      filterToggle: 'Filtrer',
      filterClose: 'close',
    }, cfg.i18n || {});

    if (fc.clearAll) {
      i18n._hasClearAll = true;
      i18n._clearAllText = typeof fc.clearAll === 'string' ? fc.clearAll : 'R\u00e9initialiser';
    }

    var prefixDefs = normalizePrefixes(fc.tagPrefixes, globalLayout);
    var useMobilePanel = fc.mobilePanel === true;
    var mobilePanelBp = fc.mobilePanelBreakpoint === 'always'
      ? Infinity
      : Number(fc.mobilePanelBreakpoint || 768);

    var wrapper = el('div', { class: CLS_FILTERS_WRAPPER });
    var bar = el('div', { class: CLS_FILTERS });
    wrapper.appendChild(bar);

    var state = {
      tab: null,
      category: null,
      tags: {},
      search: '',
    };

    var secondaryEl = null;
    var mobileObj = null;
    var toggleBtn = null;
    var panelClearBtn = null;
    var clearAllBtn = null;

    function emit() {
      var t = {};

      Object.keys(state.tags).forEach(function(k) {
        t[k] = state.tags[k];
      });

      onFilter({
        tab: state.tab,
        category: state.category,
        tags: t,
        search: state.search,
      });

      updateToggleBadge();

      var hasActive = countActive() > 0;
      var alwaysPanel = mobilePanelBp === Infinity;

      if (clearAllBtn) {
        clearAllBtn.style.display = (hasActive && !alwaysPanel) ? '' : 'none';
      }

      if (panelClearBtn) {
        panelClearBtn.style.display = hasActive ? '' : 'none';
      }

      if (mobileObj && mobileObj.syncContext) {
        mobileObj.syncContext();
      }
    }

    function resetOtherFilters(exceptType, exceptKey) {
      if (!fc.resetOthers) return;

      if (exceptType !== 'category') state.category = null;

      var activePrefixDefs = (getTabPrefixes && getTabPrefixes())
        ? normalizePrefixes(getTabPrefixes(), globalLayout)
        : prefixDefs;

      activePrefixDefs.forEach(function(pd) {
        if (exceptType !== 'tag' || exceptKey !== pd.prefix) {
          state.tags[pd.prefix] = null;
        }
      });

      if (exceptType !== 'search') state.search = '';

      if (secondaryEl) {
        secondaryEl.innerHTML = '';
        appendSecondary(tabPool(), secondaryEl);
      }
    }

    function countActive() {
      var n = 0;

      if (state.category) n++;

      Object.keys(state.tags).forEach(function(k) {
        if (state.tags[k]) n++;
      });

      if (state.search) n++;

      return n;
    }

    function updateToggleBadge() {
      if (!toggleBtn) return;

      var n = countActive();
      var badge = toggleBtn.querySelector('.sqb-mobile-toggle-badge');

      if (n > 0) {
        if (!badge) {
          badge = el('span', { class: CLS_MOBILE_TOGGLE_BADGE });
          toggleBtn.appendChild(badge);
        }

        badge.textContent = String(n);
      } else {
        if (badge) badge.remove();
      }
    }

    function tabPool() {
      return state.tab ? applyTabFilter(baseItems, state.tab) : baseItems;
    }

    function resetSec() {
      state.category = null;
      state.tags = {};
      state.search = '';
    }

    function buildPillGroup(vals, displayVals, label, showLabel, getCurrent, onSelect) {
      var wrap = el('div', { class: CLS_FILTER_GROUP + ' ' + CLS_FILTER_GROUP_PILLS });

      if (showLabel && label) {
        var lbl = el('span', { class: CLS_FILTER_LABEL });
        lbl.textContent = label;
        wrap.appendChild(lbl);
      }

      vals.forEach(function(v, vi) {
        var dv = (displayVals && displayVals[vi]) ? displayVals[vi] : v;
        var active = getCurrent() !== null && norm(String(v)) === norm(String(getCurrent()));

        var btn = el('button', {
          class: withUiState(CLS_FILTER_BTN, CLS_FILTER_BTN_ACTIVE, active),
          type: 'button',
        });

        setText(btn, dv);

        btn.addEventListener('click', function() {
          var isCurrent = norm(String(v)) === norm(String(getCurrent() || ''));

          onSelect(isCurrent ? null : v);

          wrap.querySelectorAll('.sqb-filter-btn').forEach(function(b) {
            removeUiClasses(b, CLS_FILTER_BTN_ACTIVE);
          });

          if (!isCurrent) addUiClasses(btn, CLS_FILTER_BTN_ACTIVE);

          emit();
        });

        wrap.appendChild(btn);
      });

      return wrap;
    }

    function buildDropdown(vals, displayVals, label, getCurrent, onSelect) {
      var wrap = el('div', { class: CLS_FILTER_GROUP + ' ' + CLS_FILTER_GROUP_DROPDOWN });

      var sel = el('select', {
        class: CLS_FILTER_SELECT,
        'aria-label': label,
      });

      var o0 = el('option', { value: '' });
      o0.textContent = label + ': ' + i18n.all;
      sel.appendChild(o0);

      vals.forEach(function(v, vi) {
        var dv = (displayVals && displayVals[vi]) ? displayVals[vi] : v;
        var o = el('option', { value: v });
        o.textContent = dv;

        if (getCurrent() && norm(v) === norm(getCurrent())) {
          o.selected = true;
        }

        sel.appendChild(o);
      });

      sel.addEventListener('change', function() {
        onSelect(sel.value || null);
        emit();
      });

      wrap.appendChild(sel);
      return wrap;
    }

    function appendSecondary(pool, container) {
      if (fc.categories !== false) {
        var catsCfg = (fc.categories && typeof fc.categories === 'object') ? fc.categories : {};
        var catsOrder = catsCfg.order || null;
        var catsShowLbl = catsCfg.showLabel !== false;
        var catsLabel = catsCfg.label || 'Cat\u00e9gorie';

        var cats = uniqBy(pool.reduce(function(a, i) {
          return a.concat(i.categories);
        }, []).filter(Boolean), norm).sort(function(a, b) {
          return norm(a).localeCompare(norm(b));
        });

        if (catsOrder) cats = applyCustomOrder(cats, catsOrder);

        if (cats.length > 1) {
          if (fc.defaultCategory && state.category == null) {
            state.category = fc.defaultCategory;
          }

          var grp = buildPillGroup(
            cats,
            null,
            catsLabel,
            catsShowLbl,
            function() { return state.category; },
            function(v) {
              state.category = v;
              resetOtherFilters('category', null);
            }
          );

          addUiClasses(grp, CLS_FILTER_GROUP_CATS);
          container.appendChild(grp);
        }
      }

      var activePrefixDefs = (getTabPrefixes && getTabPrefixes())
        ? normalizePrefixes(getTabPrefixes(), globalLayout)
        : prefixDefs;

      activePrefixDefs.forEach(function(pd) {
        var raw = uniqBy(pool.reduce(function(a, i) {
          return a.concat(getTagValuesByPrefix(i, pd.prefix));
        }, []).filter(Boolean), norm);

        var vals = sortTagValues(raw, pd.prefix, datePrefix);

        if (pd.order) vals = applyCustomOrder(vals, pd.order);

        var fmt = pd.filterFormat || (datePrefix && norm(pd.prefix) === norm(datePrefix) ? 'day' : null);
        var displayVals = fmt ? vals.map(function(v) {
          return formatISOTag(v, fmt) || v;
        }) : vals;

        if (!vals.length) return;

        var defVal = fc.defaultTags && fc.defaultTags[pd.prefix];

        if (defVal === 'first' && vals.length) defVal = vals[0];
        if (defVal === 'last' && vals.length) defVal = vals[vals.length - 1];

        if (defVal && !state.tags[pd.prefix]) {
          state.tags[pd.prefix] = defVal;
        }

        var grp;

        (function(prefix) {
          if (pd.layout === 'dropdown') {
            grp = buildDropdown(
              vals,
              displayVals,
              prefix,
              function() { return state.tags[prefix] || null; },
              function(v) {
                state.tags[prefix] = v;
                resetOtherFilters('tag', prefix);
              }
            );
          } else {
            grp = buildPillGroup(
              vals,
              displayVals,
              prefix,
              pd.showLabel,
              function() { return state.tags[prefix] || null; },
              function(v) {
                state.tags[prefix] = v;
                resetOtherFilters('tag', prefix);
              }
            );
          }
        })(pd.prefix);

        addUiClasses(grp, CLS_FILTER_GROUP_TAG);
        grp.setAttribute('data-prefix', pd.prefix);
        container.appendChild(grp);
      });

      if (fc.search !== false) {
        var sg = el('div', { class: CLS_FILTER_GROUP + ' ' + CLS_FILTER_GROUP_SEARCH });

        var inp = el('input', {
          class: CLS_FILTER_SEARCH,
          type: 'search',
          placeholder: i18n.searchPlaceholder,
          'aria-label': i18n.searchPlaceholder,
        });

        var timer;

        inp.addEventListener('input', function() {
          clearTimeout(timer);

          timer = setTimeout(function() {
            state.search = inp.value.trim();
            emit();
          }, 200);
        });

        sg.appendChild(inp);
        container.appendChild(sg);
      }
    }

    function rebuildSecondary() {
      if (secondaryEl) {
        secondaryEl.innerHTML = '';
        appendSecondary(tabPool(), secondaryEl);
      }
    }

    var tabs = Array.isArray(fc.tabs) ? fc.tabs : [];

    if (tabs.length) {
      var tabGroup = el('div', { class: CLS_FILTER_GROUP + ' ' + CLS_FILTER_GROUP_TABS });
      var defIdx = Number(fc.defaultTab != null ? fc.defaultTab : 0);

      tabs.forEach(function(tab, idx) {
        var active = idx === defIdx;

        var btn = el('button', {
          class: withUiState(CLS_TAB_BTN, CLS_TAB_BTN_ACTIVE, active),
          type: 'button',
        });

        if (tab.labelIcon) {
          var ic = el('span', { class: CLS_ICON });
          ic.textContent = tab.labelIcon;
          btn.appendChild(ic);
        } else {
          setText(btn, tab.label || 'Tab');
        }

        if (active) {
          state.tab = tab.filter || null;
          if (onTabChange) onTabChange(tab);
        }

        btn.addEventListener('click', function() {
          if (btn.classList.contains('sqb-tab-btn--active')) return;

          tabGroup.querySelectorAll('.sqb-tab-btn').forEach(function(b) {
            removeUiClasses(b, CLS_TAB_BTN_ACTIVE);
          });

          addUiClasses(btn, CLS_TAB_BTN_ACTIVE);

          state.tab = tab.filter || null;
          resetSec();

          if (onTabChange) onTabChange(tab);
          if (mobileObj && mobileObj.syncContext) mobileObj.syncContext();

          rebuildSecondary();
          emit();
        });

        tabGroup.appendChild(btn);
      });

      bar.appendChild(tabGroup);
    }

    secondaryEl = el('div', { class: CLS_FILTERS_SECONDARY });
    appendSecondary(tabPool(), secondaryEl);
    bar.appendChild(secondaryEl);

    if (fc.clearAll) {
      clearAllBtn = el('button', {
        class: CLS_CLEAR_ALL,
        type: 'button',
      });

      var _cai = el('span', { class: CLS_ICON });
      _cai.textContent = 'refresh';

      clearAllBtn.appendChild(_cai);
      clearAllBtn.appendChild(document.createTextNode(' ' + (
        typeof fc.clearAll === 'string' ? fc.clearAll : 'R\u00e9initialiser'
      )));

      clearAllBtn.style.display = 'none';

      clearAllBtn.addEventListener('click', function() {
        state.category = null;
        state.tags = {};
        state.search = '';

        secondaryEl.innerHTML = '';
        appendSecondary(tabPool(), secondaryEl);

        emit();
      });

      bar.appendChild(clearAllBtn);
    }

    if (useMobilePanel) {
      toggleBtn = el('button', {
        class: CLS_MOBILE_TOGGLE,
        type: 'button',
      });

      toggleBtn.textContent = i18n.filterToggle;
      toggleBtn.style.display = 'none';

      var tabsGroupEl = bar.querySelector('.sqb-filter-group--tabs');

      if (tabsGroupEl) {
        var tabsRow = el('div', { class: CLS_TABS_ROW });
        bar.replaceChild(tabsRow, tabsGroupEl);
        tabsRow.appendChild(tabsGroupEl);
        tabsRow.appendChild(toggleBtn);
      } else {
        var mobileRow = el('div', { class: CLS_MOBILE_FILTER_ROW });
        mobileRow.appendChild(toggleBtn);
        bar.appendChild(mobileRow);
      }

      mobileObj = buildMobilePanel(appendSecondary, tabPool, i18n, ownerBlock);
      mobileObj.syncContext();

      toggleBtn.addEventListener('click', function() {
        mobileObj.open();
      });

      panelClearBtn = mobileObj.panelClearBtn || null;

      if (panelClearBtn) {
        panelClearBtn.addEventListener('click', function() {
          state.category = null;
          state.tags = {};
          state.search = '';

          if (secondaryEl) {
            secondaryEl.innerHTML = '';
            appendSecondary(tabPool(), secondaryEl);
          }

          emit();
        });
      }

      var isMobileMode = false;

      function checkBreakpoint() {
        var shouldBeMobile = window.innerWidth < mobilePanelBp;

        if (shouldBeMobile === isMobileMode) return;

        isMobileMode = shouldBeMobile;

        toggleUiClasses(wrapper, CLS_FILTERS_MOBILE_MODE, isMobileMode);

        if (toggleBtn) toggleBtn.style.display = isMobileMode ? '' : 'none';

        if (clearAllBtn) {
          clearAllBtn.style.display = isMobileMode
            ? 'none'
            : (countActive() > 0 ? '' : 'none');
        }

        if (mobileObj && mobileObj.syncContext) {
          mobileObj.syncContext();
        }
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

  if (target.dataset.sqbInitialized === 'true') return;
  target.dataset.sqbInitialized = 'true';

    var perf = cfg.performance || {};
    var pag = cfg.pagination || {};
    var disp = cfg.display || {};
    var fc = (cfg.filters && cfg.filters !== false) ? cfg.filters : {};

    var i18n = Object.assign({
      loading: false,
      all: 'Tout',
      noResults: 'Aucun r\u00e9sultat',
      loadMoreLabel: 'Voir plus',
      endLabel: '',
      filterToggle: 'Filtrer',
      filterClose: 'close',
    }, cfg.i18n || {});

    if (pag.loadMoreLabel) i18n.loadMoreLabel = pag.loadMoreLabel;
    if (pag.endLabel !== undefined) i18n.endLabel = pag.endLabel;

    var mode = pag.mode || 'load-more';
    var perPage = mode === 'none' ? Infinity : Number(pag.perPage || 12);
    var dispLayout = disp.layout || 'grid';

    target.classList.add('cb-block');
    target.classList.add('qb-block');
    target.classList.add('sqb-block');
    target.setAttribute('data-sqb-key', cfg.key || 'sqb');

    if (cfg.key && !target.id) target.id = 'sqb-' + cfg.key;
    if (cfg.label) target.setAttribute('data-sqb-label', cfg.label);
    if (cfg.key) {
      target.classList.add('cb--' + cfg.key);
      target.classList.add('qb--' + cfg.key);
      target.classList.add('sqb--' + cfg.key);
    }

    if (cfg.classes) {
      cfg.classes.trim().split(/\s+/).forEach(function(c) {
        if (c) target.classList.add(c);
      });
    }

    if (dispLayout === 'list') target.classList.add('cb-block--list', 'qb-block--list', 'sqb-block--list');
    target.classList.add('cb-block--loading', 'qb-block--loading', 'sqb-block--loading');

injectLoaderStyles();

var initialLoader = buildLoader(i18n.loading);
target.appendChild(initialLoader);

requestAnimationFrame(function() {
  target.classList.add('cb-block--rendering', 'qb-block--rendering', 'sqb-block--rendering');
});

        var rawItems = [];
    var sourceList = Array.isArray(cfg.sources) ? cfg.sources : [];

    var initialMaxPages = perf.maxPages || 1;
    var progressiveMaxPages = perf.progressiveMaxPages || 'all';
    var loadedMaxPages = initialMaxPages;
    var allRemoteLoaded = false;
    var isFetchingMore = false;

    function canFetchMorePages() {
      if (mode === 'none') return false;
      if (allRemoteLoaded) return false;
      if (progressiveMaxPages === 'all') return true;
      return Number(loadedMaxPages || 1) < Number(progressiveMaxPages || 1);
    }

    function nextMaxPagesValue() {
      if (progressiveMaxPages === 'all') {
        return Number(loadedMaxPages || 1) + 1;
      }

      return Math.min(
        Number(loadedMaxPages || 1) + 1,
        Number(progressiveMaxPages || 1)
      );
    }

    function updateRemoteLoadedState(states, requestedPages) {
      states = Array.isArray(states) ? states : [];

      if (!states.length) {
        allRemoteLoaded = true;
        return;
      }

      allRemoteLoaded = states.every(function(state) {
        return !!(state && (state.complete || state.fetchError));
      });

      if (
        progressiveMaxPages !== 'all' &&
        Number(requestedPages || 1) >= Number(progressiveMaxPages || 1)
      ) {
        allRemoteLoaded = true;
      }
    }

    async function loadSources(maxPagesValue) {
      var results = await Promise.all(sourceList.map(function(src) {
        var stripFields = src.stripFields;
        if (stripFields === undefined) stripFields = perf.stripFields;
        if (stripFields === undefined) stripFields = ['body'];

        return fetchCollectionState(
          src.path,
          maxPagesValue,
          perf.sessionCache === true,
          perf.sessionCacheTTL || 300,
          stripFields
        ).then(function(state) {
          return {
            state: state,
            items: (state.items || []).map(function(raw) {
            return mapItem(raw, src.path);
            }),
          };
        });
      }));

      var merged = [];
      var states = [];

      results.forEach(function(r) {
        states.push(r.state || null);
        merged.push.apply(merged, r.items || []);
      });

      updateRemoteLoadedState(states, maxPagesValue);

      merged = uniqBy(merged, function(i) {
        return i.fullUrl || i.id;
      });

      merged = applyPreFilter(merged, cfg.preFilter || null);
      merged = sortItems(merged, cfg.sort);

      return merged;
    }

    async function loadNextRemotePage() {
      if (!canFetchMorePages() || isFetchingMore) return false;

      isFetchingMore = true;
      loadedMaxPages = nextMaxPagesValue();

      try {
        rawItems = await loadSources(loadedMaxPages);
        return true;
      } catch (err) {
        if (cfg.debug) console.warn('[SQB]', cfg.key, err);
        allRemoteLoaded = true;
        return false;
      } finally {
        isFetchingMore = false;
      }
    }

    try {
      rawItems = await loadSources(loadedMaxPages);
    } catch (err) {
      if (cfg.debug) console.warn('[SQB]', cfg.key, err);

      target.querySelector('.sqb-loader, .sqb-loader--text') &&
        target.querySelector('.sqb-loader, .sqb-loader--text').remove();

      setText(target.appendChild(el('p', { class: 'cb-error qb-error sqb-error' })), '\u26A0 Erreur de chargement');
      return;
    }

    if (cfg.debug) console.log('[SQB]', cfg.key, rawItems.length, 'items');

    var loaderEl = target.querySelector('.sqb-loader, .sqb-loader--text');

requestAnimationFrame(function() {
  if (loaderEl) loaderEl.remove();

  target.classList.remove('cb-block--loading', 'qb-block--loading', 'sqb-block--loading');
  target.classList.remove('cb-block--rendering', 'qb-block--rendering', 'sqb-block--rendering');
  target.classList.add('cb-block--ready', 'qb-block--ready', 'sqb-block--ready');
});

    var activeFilters = {
      tab: null,
      category: null,
      tags: {},
      search: '',
    };

    var currentPage = 1;
    var ioInfinite = null;

    if (Array.isArray(fc.tabs) && fc.tabs.length) {
      var di = Number(fc.defaultTab != null ? fc.defaultTab : 0);
      if (fc.tabs[di]) activeFilters.tab = fc.tabs[di].filter || null;
    }

    if (fc.defaultCategory) activeFilters.category = fc.defaultCategory;
    if (fc.defaultTags) Object.assign(activeFilters.tags, fc.defaultTags);

    var root = el('div', { class: 'cb-block__inner qb-block__inner sqb-root' });

    var headingResult = buildHeading(cfg.heading || null);
    if (headingResult.headingEl) root.appendChild(headingResult.headingEl);

    var scrollOnFilter = fc.scrollOnFilter !== false;

    function scrollToGrid() {
      if (!scrollOnFilter) return;
      if (!filterWrapper) return;
      if (!fc.sticky) return;

      requestAnimationFrame(function() {
        var wrapperBottom = filterWrapper.getBoundingClientRect().bottom;
        var gridTop = grid.getBoundingClientRect().top;

        if (gridTop >= wrapperBottom - 8 && gridTop <= wrapperBottom + window.innerHeight * 0.5) {
          return;
        }

        var targetY = window.scrollY + gridTop - wrapperBottom;
        window.scrollTo({ top: targetY, behavior: 'smooth' });
      });
    }

    var currentSort = cfg.sort || null;
    var currentLayout = dispLayout;
    var currentGroups = (disp.groups && disp.groups.length) ? disp.groups : null;
    var currentGroupBy = disp.groupBy || null;
    var currentGroupOrder = disp.groupOrder || 'collection';
    var currentTagPrefixes = null;

    function updateTabClass(tabLabel) {
      Array.from(target.classList).forEach(function(c) {
        if (
          c.indexOf('cb-tab--') === 0 ||
          c.indexOf('qb-tab--') === 0 ||
          c.indexOf('sqb-tab--') === 0
        ) {
          target.classList.remove(c);
        }
      });

      if (tabLabel) {
        var tabSlug = slugify(tabLabel);
        target.classList.add('cb-tab--' + tabSlug);
        target.classList.add('qb-tab--' + tabSlug);
        target.classList.add('sqb-tab--' + tabSlug);
        target.setAttribute('data-sqb-tab', tabSlug);
      } else {
        target.removeAttribute('data-sqb-tab');
      }
    }

    function onTabChange(tab) {
      updateTabClass(tab.labelIcon ? (tab.label || '') : (tab.label || ''));

      if (tab.sort !== undefined) currentSort = tab.sort;
      else currentSort = cfg.sort || null;

      if (tab.layout !== undefined) currentLayout = tab.layout;
      else currentLayout = dispLayout;

      if (tab.groups !== undefined) currentGroups = tab.groups;
      else currentGroups = (disp.groups && disp.groups.length) ? disp.groups : null;

      if (tab.groupBy !== undefined) currentGroupBy = tab.groupBy;
      else currentGroupBy = disp.groupBy || null;

      if (tab.groupOrder !== undefined) currentGroupOrder = tab.groupOrder;
      else currentGroupOrder = disp.groupOrder || 'collection';

      if (tab.tagPrefixes !== undefined) currentTagPrefixes = tab.tagPrefixes;
      else currentTagPrefixes = null;
    }

    var filterWrapper = buildFilterBar(
      rawItems,
      cfg,
      function(f) {
        if (ioInfinite) {
          ioInfinite.disconnect();
          ioInfinite = null;
        }

        activeFilters = f;
        currentPage = 1;
        render(true);
      },
      onTabChange,
      function() {
        return currentTagPrefixes;
      },
      target
    );

    var gridClass = dispLayout === 'list'
      ? 'cb-grid qb-grid sqb-grid cb-grid--list qb-grid--list sqb-grid--list'
      : 'cb-grid qb-grid sqb-grid';

    var grid = el('div', { class: gridClass });

    var counter = el('p', {
      class: 'cb-counter qb-counter sqb-counter',
      'aria-live': 'polite',
    });

    var footer = el('div', { class: 'cb-footer qb-footer sqb-footer' });

    if (filterWrapper) root.appendChild(filterWrapper);

    root.appendChild(grid);

    if (disp.counter === true) root.appendChild(counter);

    root.appendChild(footer);
    target.appendChild(root);

    if (filterWrapper && fc.sticky) {
      var sentinel = el('div', {
        style: 'height:1px;pointer-events:none;visibility:hidden',
      });

      filterWrapper.parentNode.insertBefore(sentinel, filterWrapper);
      setupSticky(sentinel, filterWrapper, fc.stickyTop || '0px');
    }

    if (Array.isArray(fc.tabs) && fc.tabs.length) {
      var initTab = fc.tabs[Number(fc.defaultTab != null ? fc.defaultTab : 0)];

      if (initTab) {
        updateTabClass(initTab.label || '');

        if (initTab.sort !== undefined) currentSort = initTab.sort;
        if (initTab.layout !== undefined) currentLayout = initTab.layout;
        if (initTab.groups !== undefined) currentGroups = initTab.groups;
        if (initTab.groupBy !== undefined) currentGroupBy = initTab.groupBy;
        if (initTab.groupOrder !== undefined) currentGroupOrder = initTab.groupOrder;
        if (initTab.tagPrefixes !== undefined) currentTagPrefixes = initTab.tagPrefixes;
      }
    }

    var hook = window.SQB_HOOKS && window.SQB_HOOKS[cfg.key];

    function render(fromFilter, fromPagination) {
      if (ioInfinite) {
        ioInfinite.disconnect();
        ioInfinite = null;
      }

      grid.className = currentLayout === 'list'
        ? 'cb-grid qb-grid sqb-grid cb-grid--list qb-grid--list sqb-grid--list'
        : 'cb-grid qb-grid sqb-grid';

      target.classList.toggle('cb-block--list', currentLayout === 'list');
      target.classList.toggle('qb-block--list', currentLayout === 'list');
      target.classList.toggle('sqb-block--list', currentLayout === 'list');

      if (fromFilter) scrollToGrid();

      var pool = activeFilters.tab
        ? applyTabFilter(rawItems, activeFilters.tab)
        : rawItems;

      var poolSorted = currentSort ? sortItems(pool, currentSort) : pool;

      var filtered = poolSorted.filter(function(item) {
        return matchesUIFilters(item, activeFilters);
      });

      var total = filtered.length;
      var shown = filtered.slice(0, currentPage * perPage);

            var prevCardCount = fromPagination
        ? grid.querySelectorAll('.sqb-card').length
        : 0;

      var canAppendIncrementally =
        fromPagination &&
        !fromFilter &&
        !currentGroupBy &&
        currentLayout !== 'list';

      if (!canAppendIncrementally) {
        grid.innerHTML = '';
      }

      footer.innerHTML = '';

      if (!shown.length) {
        if (canFetchMorePages() && !isFetchingMore) {
          grid.innerHTML = '';
          grid.appendChild(buildLoader(false));

          if (disp.counter !== false) counter.textContent = '';

          loadNextRemotePage().then(function() {
            render(false, false);
          });

          return;
        }

        setText(grid.appendChild(el('p', { class: 'cb-empty qb-empty sqb-empty' })), i18n.noResults);

        if (disp.counter !== false) counter.textContent = '';

        if (hook) hook(grid, [], cfg);

        return;
      }

      var cfgForRender = (currentGroups || currentGroupBy !== (disp.groupBy || null))
        ? Object.assign({}, cfg, {
            display: Object.assign({}, disp, {
              groups: currentGroups || disp.groups,
              groupBy: currentGroupBy,
              groupOrder: currentGroupOrder,
            }),
          })
        : cfg;

      var activeGroupFilter = null;

      if (currentGroupBy && currentGroupBy.tagPrefix && activeFilters.tags) {
        activeGroupFilter = activeFilters.tags[currentGroupBy.tagPrefix] || null;

        if (activeGroupFilter && currentGroupBy.groupByDay) {
          activeGroupFilter = getISODatePart(activeGroupFilter) || activeGroupFilter;
        }
      }
if (canAppendIncrementally) {
  var newItems = shown.slice(prevCardCount);
  appendPlainItemsProgressive(newItems, cfgForRender, grid, prevCardCount, perf.domBatchSize || 8);
} else {
  SQB_RENDER_IMAGE_INDEX = 0;

  if (!currentGroupBy && currentLayout !== 'list') {
    appendPlainItemsProgressive(shown, cfgForRender, grid, 0, perf.domBatchSize || 8);
  } else {
    renderGrouped(shown, cfgForRender, grid, activeGroupFilter);
  }
}
      if ((cfgForRender.display || disp).fadeIn !== false) {
        var cards = Array.from(grid.querySelectorAll('.sqb-card'));

        cards.forEach(function(c, i) {
          if (i < prevCardCount) return;

          c.style.animationDelay = ((i - prevCardCount) * 0.04) + 's';
          c.classList.add('sqb-card--fade-in');
        });
      }

      if (disp.counter === true) {
        counter.textContent = shown.length + '\u00a0/\u00a0' + total;
      }

      if (hook) {
        hook(grid, shown, cfg, {
          fromPagination: fromPagination,
          prevCount: prevCardCount,
        });
      }

      if (headingResult.ctaBelowEl) {
        var existing = root.querySelector('.sqb-heading__cta-below');
        if (!existing) root.appendChild(headingResult.ctaBelowEl);
      }

      var hasMore = shown.length < total || canFetchMorePages();

      if (!hasMore) {
        if (i18n.endLabel !== false && i18n.endLabel) {
          setText(footer.appendChild(el('p', { class: 'cb-end-label qb-end-label sqb-end-label' })), i18n.endLabel);
        }

        return;
      }

      if (mode === 'load-more') {
        var btn = setText(el('button', {
          class: 'cb-load-more qb-load-more sqb-load-more',
          type: 'button',
        }), i18n.loadMoreLabel);

        btn.addEventListener('click', async function() {
  if (isFetchingMore) return;

  btn.style.display = 'none';
  footer.appendChild(buildLoader(false));

  currentPage++;

  await loadNextRemotePage();

  render(false, true);
});

        footer.appendChild(btn);
      } else if (mode === 'infinite' && 'IntersectionObserver' in window) {
        var infS = el('div', {
          class: 'cb-sentinel qb-sentinel sqb-sentinel',
          'aria-hidden': 'true',
        });

        footer.appendChild(infS);

        ioInfinite = new IntersectionObserver(function(entries) {
          if (!entries[0].isIntersecting) return;

          ioInfinite.disconnect();
          ioInfinite = null;

          if (isFetchingMore) return;

currentPage++;

if (canFetchMorePages()) {
  loadNextRemotePage().then(function() {
    render(false, true);
  });
} else {
  render(false, true);
}
        }, { rootMargin: '400px' });

        ioInfinite.observe(infS);
      }
    }

    render(false);
  }

function scheduleConfig(cfg) {
  if (!cfg || cfg.enabled === false) return;

  var target = document.querySelector(cfg.target || '');
  if (!target) return;

  if (target.dataset.sqbInitialized === 'true') return;
  if (target.dataset.sqbScheduled === 'true') return;

  var perf = cfg.performance || {};
  var lazyInit = perf.lazyInit !== false;

  if (!lazyInit || !('IntersectionObserver' in window)) {
    runConfig(cfg).catch(function(err) {
      if (cfg && cfg.debug) console.warn('[SQB]', cfg.key, err);
    });
    return;
  }

  target.dataset.sqbScheduled = 'true';

  var observer = new IntersectionObserver(function(entries) {
    if (!entries[0].isIntersecting) return;

    observer.disconnect();
    target.dataset.sqbScheduled = 'false';

    runConfig(cfg).catch(function(err) {
      if (cfg && cfg.debug) console.warn('[SQB]', cfg.key, err);
    });
  }, {
    rootMargin: '1200px 0px'
  });

  observer.observe(target);
}
  
  /* ════════════════════════════════════
   * 14. POINT D'ENTRÉE
   * ════════════════════════════════════ */

 function init() {
  var configs = Array.isArray(window.QUERY_BLOCK_CONFIGS)
    ? window.QUERY_BLOCK_CONFIGS
    : (Array.isArray(window.SQB_CONFIGS) ? window.SQB_CONFIGS : []);

  if (!configs.length) return;

  configs = configs
    .filter(function(cfg) {
      if (!cfg || cfg.enabled === false) return false;
      if (!cfg.target) return false;
      return !!document.querySelector(cfg.target);
    })
    .sort(function(a, b) {
      var ta = document.querySelector(a.target || '');
      var tb = document.querySelector(b.target || '');

      var ya = ta ? ta.getBoundingClientRect().top + window.scrollY : Infinity;
      var yb = tb ? tb.getBoundingClientRect().top + window.scrollY : Infinity;

      return ya - yb;
    });

  if (!configs.length) return;

  configs.forEach(scheduleConfig);

  document.addEventListener('turbolinks:load', function() {
    configs.forEach(scheduleConfig);
  });
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }

})();
