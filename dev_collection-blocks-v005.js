(function() {
  'use strict';

  var VERSION = '0.2';
  var STORE_KEY_PREFIX = 'collection-blocks::v0.2::';

  var memoryCache = new Map();
  var pendingFetches = new Map();

  var DEFAULT_FIELDS = [
    'id',
    'title',
    'fullUrl',
    'urlId',
    'assetUrl',
    'mediaFocalPoint',
    'categories',
    'tags',
    'excerpt',
    'location',
    'displayIndex',
    'workflowState',
    'startDate',
    'publishOn',
    'addedOn',
    'updatedOn'
  ];

  var DEFAULTS = {
    maxPages: 10,
    ttl: 900,
    sessionCache: true,
    memoryCache: true,
    credentials: 'same-origin',
    keepFields: DEFAULT_FIELDS,
    stripFields: []
  };

  var SRCSET_WIDTHS = [300, 500, 750, 1000, 1500];

  function now() {
    return Date.now();
  }

  function isPerfTest() {
    try {
      return new URLSearchParams(window.location.search).has('perf-test');
    } catch (_) {
      return false;
    }
  }

  function shouldBypassCache(options) {
    options = options || {};

    return (
      isPerfTest() ||
      options.noCache === true ||
      options.cache === false ||
      options.forceRefresh === true ||
      options.refresh === true ||
      options.bypassCache === true ||
      options.bustCache === true
    );
  }

  function shouldBypassMemory(options) {
    return shouldBypassCache(options) ||
      options.memoryCache === false ||
      options.bypassMemoryCache === true;
  }

  function shouldBypassSession(options) {
    return shouldBypassCache(options) ||
      options.sessionCache === false ||
      options.bypassSessionCache === true;
  }

  function normalizePath(path) {
    return String(path || '').trim();
  }

  function ensureJson(url) {
    if (!url) return url;
    if (url.indexOf('format=json') !== -1) return url;
    return url.indexOf('?') !== -1 ? url + '&format=json' : url + '?format=json';
  }

  function makeCacheKey(path, options) {
    var keepKey = Array.isArray(options.keepFields)
      ? '::keep=' + options.keepFields.join(',')
      : '';

    var stripKey = Array.isArray(options.stripFields)
      ? '::strip=' + options.stripFields.join(',')
      : '';

    return STORE_KEY_PREFIX + normalizePath(path) + keepKey + stripKey;
  }

  function normalizeMaxPages(value) {
    return value === 'all' ? Infinity : Number(value || DEFAULTS.maxPages);
  }

  function serializeError(err) {
    if (!err) return null;

    return {
      message: err.message || String(err),
      status: err.status || null,
      url: err.url || null,
      at: now()
    };
  }

  function cloneValue(value) {
    if (Array.isArray(value)) return value.map(cloneValue);
    if (!value || typeof value !== 'object') return value;
    return Object.assign({}, value);
  }

  function cloneItem(item) {
    if (!item || typeof item !== 'object') return item;

    var clone = {};

    Object.keys(item).forEach(function(key) {
      clone[key] = cloneValue(item[key]);
    });

    return clone;
  }

  function cloneItems(items) {
    return Array.isArray(items) ? items.map(cloneItem) : [];
  }

  function publicState(state) {
    state = state || {};

    return {
      items: cloneItems(state.items),
      pagesLoaded: Number(state.pagesLoaded || 0),
      complete: !!state.complete,
      fetchError: state.fetchError ? Object.assign({}, state.fetchError) : null,
      hasNext: !!(state.nextUrl || state.nextOffset != null),
      nextUrl: state.nextUrl || null,
      nextOffset: state.nextOffset != null ? state.nextOffset : null
    };
  }

  function readSession(key, options) {
    if (shouldBypassSession(options)) return null;

    try {
      var raw = sessionStorage.getItem(key);
      if (!raw) return null;

      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.items)) return null;

      var ttl = Number(parsed.ttl || DEFAULTS.ttl) * 1000;
      if (now() - Number(parsed.ts || 0) > ttl) {
        sessionStorage.removeItem(key);
        return null;
      }

      parsed.fetchError = parsed.fetchError || null;
      parsed.complete = !!parsed.complete;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function writeSession(key, state, ttl, options) {
    if (shouldBypassSession(options)) return;

    try {
      sessionStorage.setItem(key, JSON.stringify(Object.assign({}, state, {
        ts: now(),
        ttl: Number(ttl || DEFAULTS.ttl)
      })));
    } catch (_) {}
  }

  function getNextUrl(data) {
    if (!data || !data.pagination) return null;

    if (data.pagination.nextPageUrl) {
      return ensureJson(data.pagination.nextPageUrl);
    }

    if (data.pagination.nextPage && data.pagination.nextPageOffset != null) {
      return null;
    }

    return null;
  }

  function getNextOffset(data) {
    if (!data || !data.pagination) return null;

    if (data.pagination.nextPage && data.pagination.nextPageOffset != null) {
      return data.pagination.nextPageOffset;
    }

    return null;
  }

  function extractItems(data) {
    if (Array.isArray(data && data.items)) return data.items;
    if (Array.isArray(data && data.itemList)) return data.itemList;
    if (Array.isArray(data && data.collection && data.collection.items)) return data.collection.items;
    return [];
  }

  function keepItemFields(item, fields) {
    if (!item || !Array.isArray(fields) || !fields.length) return item;

    var clone = {};

    fields.forEach(function(field) {
      if (field in item) clone[field] = cloneValue(item[field]);
    });

    return clone;
  }

  function stripItemFields(item, fields) {
    if (!item || !Array.isArray(fields) || !fields.length) return item;

    var clone = cloneItem(item);

    fields.forEach(function(field) {
      if (field in clone) delete clone[field];
    });

    return clone;
  }

  function cleanItems(items, options) {
    options = options || {};

    var keepFields = Array.isArray(options.keepFields)
      ? options.keepFields
      : null;

    var stripFields = Array.isArray(options.stripFields)
      ? options.stripFields
      : [];

    if (!keepFields && !stripFields.length) return cloneItems(items);

    return items.map(function(item) {
      if (keepFields) {
        item = keepItemFields(item, keepFields);
      } else {
        item = cloneItem(item);
      }

      if (stripFields.length) {
        item = stripItemFields(item, stripFields);
      }

      return item;
    });
  }

  async function fetchCollection(path, options, state, targetPages) {
    options = Object.assign({}, DEFAULTS, options || {});

    var cleanPath = normalizePath(path);
    var maxPages = normalizeMaxPages(targetPages);
    var items = state.items || [];
    var page = Number(state.pagesLoaded || 0);
    var url = state.nextUrl || null;

    if (!url && state.nextOffset != null) {
      url = ensureJson(cleanPath) + '&offset=' + encodeURIComponent(state.nextOffset);
    }

    if (!url && page === 0) {
      url = ensureJson(cleanPath);
    }

    state.fetchError = null;

    while (page < maxPages && url && !state.complete) {
      try {
        var res = await fetch(url, {
          credentials: options.credentials || DEFAULTS.credentials
        });

        if (!res.ok) {
          var httpError = new Error('HTTP ' + res.status + ' while fetching collection JSON');
          httpError.status = res.status;
          httpError.url = url;
          throw httpError;
        }

        var data = await res.json();
        var batch = cleanItems(extractItems(data), options);

        items.push.apply(items, batch);

        var nextUrl = getNextUrl(data);
        var nextOffset = getNextOffset(data);

        state.nextUrl = nextUrl || null;
        state.nextOffset = nextOffset != null ? nextOffset : null;
        state.complete = !(state.nextUrl || state.nextOffset != null);

        if (state.nextUrl) {
          url = state.nextUrl;
        } else if (state.nextOffset != null) {
          url = ensureJson(cleanPath) + '&offset=' + encodeURIComponent(state.nextOffset);
        } else {
          url = null;
        }

        page++;
        state.pagesLoaded = page;
        state.items = items;
      } catch (err) {
        state.fetchError = serializeError(err);
        state.complete = false;

        if (!items.length) throw err;
        break;
      }
    }

    return state;
  }

  function createEmptyState() {
    return {
      items: [],
      pagesLoaded: 0,
      nextUrl: null,
      nextOffset: null,
      complete: false,
      fetchError: null
    };
  }

  async function resolveState(path, options) {
    options = Object.assign({}, DEFAULTS, options || {});

    var key = makeCacheKey(path, options);
    var targetPages = options.maxPages || DEFAULTS.maxPages;
    var wantedPages = normalizeMaxPages(targetPages);
    var bypassCache = shouldBypassCache(options);
    var useMemory = !bypassCache && !shouldBypassMemory(options);
    var useSession = !bypassCache && !shouldBypassSession(options);
    var state = null;

    if (useMemory && memoryCache.has(key)) {
      state = memoryCache.get(key);
    }

    if (!state && useSession) {
      state = readSession(key, options);
      if (state && useMemory) {
        memoryCache.set(key, state);
      }
    }

    if (!state || bypassCache) {
      state = createEmptyState();

      if (useMemory) {
        memoryCache.set(key, state);
      }
    }

    if (!state.fetchError && (state.complete || Number(state.pagesLoaded || 0) >= wantedPages)) {
      return state;
    }

    var pendingKey = key + '::to=' + targetPages;

    if (!bypassCache && pendingFetches.has(pendingKey)) {
      return pendingFetches.get(pendingKey);
    }

    var promise = fetchCollection(path, options, state, targetPages)
      .then(function(updatedState) {
        if (useMemory) memoryCache.set(key, updatedState);
        if (useSession) writeSession(key, updatedState, options.ttl, options);
        return updatedState;
      })
      .finally(function() {
        pendingFetches.delete(pendingKey);
      });

    if (!bypassCache) pendingFetches.set(pendingKey, promise);
    return promise;
  }

  async function getState(path, options) {
    var state = await resolveState(path, options);
    return publicState(state);
  }

  async function get(path, options) {
    var state = await getState(path, options);
    return state.items;
  }

  async function getCurrentPage(options) {
    return get(window.location.pathname, Object.assign({
      maxPages: 1
    }, options || {}));
  }

  async function getCurrentPageState(options) {
    return getState(window.location.pathname, Object.assign({
      maxPages: 1
    }, options || {}));
  }

  function clear() {
    memoryCache.clear();
    pendingFetches.clear();

    try {
      Object.keys(sessionStorage)
        .filter(function(key) {
          return key.indexOf(STORE_KEY_PREFIX) === 0;
        })
        .forEach(function(key) {
          sessionStorage.removeItem(key);
        });
    } catch (_) {}
  }

  function stats() {
    var collections = Array.from(memoryCache.entries()).map(function(entry) {
      var state = entry[1] || {};

      return {
        key: entry[0],
        items: Array.isArray(state.items) ? state.items.length : 0,
        pagesLoaded: state.pagesLoaded || 0,
        complete: !!state.complete,
        fetchError: state.fetchError ? Object.assign({}, state.fetchError) : null,
        hasNext: !!(state.nextUrl || state.nextOffset != null)
      };
    });

    return {
      version: VERSION,
      collections: collections,
      memoryKeys: Array.from(memoryCache.keys()),
      pendingKeys: Array.from(pendingFetches.keys()),
      perfTest: isPerfTest()
    };
  }

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

  function slugify(str) {
    return norm(str).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function cleanHTML(str) {
    if (typeof document === 'undefined' || !document.createElement) {
      return String(str || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    var d = document.createElement('div');
    d.innerHTML = String(str || '');
    return (d.textContent || d.innerText || '').replace(/\s+/g, ' ').trim();
  }

  function truncate(str, max) {
    var s = cleanHTML(str);
    var limit = Number(max || 0);

    if (!limit || !s || s.length <= limit) return s;

    var cut = s.slice(0, limit);
    var sp = cut.lastIndexOf(' ');
    return (sp > 0 ? cut.slice(0, sp) : cut).trim() + '\u2026';
  }

  function parseTag(tag) {
    var raw = String(tag || '');
    var idx = raw.indexOf(':');

    if (idx === -1) {
      return {
        prefix: null,
        value: raw.trim()
      };
    }

    return {
      prefix: raw.slice(0, idx).trim(),
      value: raw.slice(idx + 1).trim()
    };
  }

  function getTagValuesByPrefix(item, prefix) {
    var pn = norm(String(prefix || '').replace(/:$/, ''));

    return ((item && item.tags) || []).reduce(function(acc, tag) {
      var parsed = parseTag(tag);

      if (parsed.prefix && norm(parsed.prefix) === pn && parsed.value) {
        acc.push(parsed.value);
      }

      return acc;
    }, []);
  }

  function getSiteTimeZone() {
    try {
      var ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
      return ctx && ctx.websiteTimeZone ? ctx.websiteTimeZone : null;
    } catch (_) {
      return null;
    }
  }

  function getLocale(locale) {
    if (locale) return locale;

    try {
      return document.documentElement.lang || 'fr-CH';
    } catch (_) {
      return 'fr-CH';
    }
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  function parseISO(str) {
    var s = String(str || '').trim();
    if (s.indexOf('/') !== -1) return null;

    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/);
    if (!m) return null;

    var year = parseInt(m[1], 10);
    var month = parseInt(m[2], 10) - 1;
    var day = parseInt(m[3], 10);
    var hour = m[4] != null ? parseInt(m[4], 10) : null;
    var min = m[5] != null ? parseInt(m[5], 10) : null;

    return {
      year: year,
      month: month,
      day: day,
      hour: hour,
      min: min,
      ts: new Date(year, month, day, hour || 0, min || 0).getTime()
    };
  }

  function formatISOTag(str, format, locale) {
    var s = String(str || '').trim();
    var loc = getLocale(locale);
    var tz = getSiteTimeZone();
    var tzOpt = tz ? { timeZone: tz } : {};

    if (s.indexOf('/') !== -1) {
      var parts = s.split('/');
      var d1 = parseISO(parts[0]);
      var d2 = parseISO(parts[1]);

      if (d1 && d2) {
        try {
          var dt1 = new Date(d1.year, d1.month, d1.day);
          var dt2 = new Date(d2.year, d2.month, d2.day);

          if (d1.month === d2.month && d1.year === d2.year) {
            var monthLabel = dt1.toLocaleDateString(loc, { month: 'long' });
            return d1.day + '\u2013' + d2.day + '\u00a0' + monthLabel + '\u00a0' + d1.year;
          }

          return dt1.toLocaleDateString(loc, { day: 'numeric', month: 'long' }) +
            '\u00a0\u2013\u00a0' +
            dt2.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' });
        } catch (_) {
          return s;
        }
      }

      return s;
    }

    var d = parseISO(s);
    if (!d) return s;

    var dt = new Date(d.year, d.month, d.day, d.hour || 0, d.min || 0);

    try {
      if (format && typeof format === 'object') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign({}, tzOpt, format)));
      }

      if (format === 'time') {
        if (d.hour === null) return '';
        return dt.toLocaleTimeString(loc, Object.assign({
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }, tzOpt));
      }

      if (format === 'numeric') {
        return dt.toLocaleDateString(loc, Object.assign({
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }, tzOpt));
      }

      if (format === 'short') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign({
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }, tzOpt)));
      }

      if (format === 'short-time') {
        var shortDay = capitalize(dt.toLocaleDateString(loc, Object.assign({
          weekday: 'short',
          day: 'numeric',
          month: 'short'
        }, tzOpt)));

        if (d.hour !== null) {
          var shortTime = dt.toLocaleTimeString(loc, Object.assign({
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
          }, tzOpt));

          return shortDay + ', ' + shortTime;
        }

        return shortDay;
      }

      if (format === 'day') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign({
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        }, tzOpt)));
      }

      if (format === 'date') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign({
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        }, tzOpt)));
      }

      var dayStr = dt.toLocaleDateString(loc, Object.assign({
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }, tzOpt));

      if (d.hour !== null) {
        var timeStr = dt.toLocaleTimeString(loc, Object.assign({
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }, tzOpt));

        return capitalize(dayStr) + ', ' + timeStr;
      }

      return capitalize(dayStr);
    } catch (_) {
      return s;
    }
  }

  function getISODatePart(str) {
    var m = String(str || '').match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : null;
  }

  function focalPoint(point) {
    if (typeof point === 'string') return point;

    if (point && typeof point.x === 'number' && typeof point.y === 'number') {
      return Math.round(point.x * 100) + '% ' + Math.round(point.y * 100) + '%';
    }

    return '50% 50%';
  }

  function getImageBase(item) {
    if (!item) return '';

    var url = item.assetUrl ||
      item.thumbnailUrl ||
      item.mainImageUrl ||
      (item.asset && item.asset.url) ||
      (item.media && item.media[0] && item.media[0].url) ||
      '';

    return String(url).split('?')[0];
  }

  function buildSrcset(base, widths) {
    var list = Array.isArray(widths) && widths.length ? widths : SRCSET_WIDTHS;
    if (!base) return '';

    return list.map(function(width) {
      return base + '?format=' + width + 'w ' + width + 'w';
    }).join(', ');
  }

  function escapeHTML(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function classNames() {
    var out = [];

    Array.prototype.forEach.call(arguments, function(value) {
      if (!value) return;
      if (Array.isArray(value)) {
        value.forEach(function(item) {
          if (item) out.push(item);
        });
      } else {
        String(value).split(/\s+/).forEach(function(cls) {
          if (cls && out.indexOf(cls) === -1) out.push(cls);
        });
      }
    });

    return out.join(' ');
  }

  function cardClass(role, prefix, extra) {
    var specific = prefix || 'cb-card';
    var common = role ? 'cb-card__' + role : 'cb-card';
    var moduleClass = specific && specific !== 'cb-card'
      ? (role ? specific + '__' + role : specific)
      : '';

    return classNames(common, moduleClass, extra);
  }

  function tagFieldModifier(name, prefix) {
    var slug = slugify(String(name || '').replace(/:$/, ''));
    if (!slug) return '';

    var specific = prefix || '';
    return classNames(
      'cb-card__tag-field--' + slug,
      specific && specific !== 'cb-card' ? specific + '__tag-field--' + slug : ''
    );
  }

  function createEl(tag, attrs) {
    var node = document.createElement(tag);

    if (attrs) {
      Object.keys(attrs).forEach(function(key) {
        var value = attrs[key];
        if (value == null) return;
        if (key === 'class') node.className = value;
        else if (key === 'style') node.style.cssText = value;
        else if (key.indexOf('data-') === 0 || key.indexOf('aria-') === 0 || key === 'role') node.setAttribute(key, value);
        else node[key] = value;
      });
    }

    return node;
  }

  function buildTextElement(text, options) {
    options = options || {};

    var value = options.clean === false ? String(text || '') : cleanHTML(text);
    if (!value && options.allowEmpty !== true) return null;

    var el = createEl(options.tag || 'div', {
      class: classNames(cardClass(options.role || 'title', options.prefix), options.className)
    });

    if (options.attrs) {
      Object.keys(options.attrs).forEach(function(key) {
        if (options.attrs[key] != null) el.setAttribute(key, options.attrs[key]);
      });
    }

    el.textContent = value;
    return el;
  }

  function buildCategories(item, options) {
    options = options || {};

    var cats = Array.isArray(item) ? item : ((item && item.categories) || []);
    cats = cats.map(cleanHTML).filter(Boolean);
    if (!cats.length) return null;

    var prefix = options.prefix || 'cb-card';
    var wrap = createEl(options.tag || 'div', {
      class: classNames(cardClass('categories', prefix), options.className)
    });

    cats.forEach(function(cat) {
      var catEl = createEl(options.itemTag || 'span', {
        class: classNames(cardClass('category', prefix), options.itemClassName)
      });
      catEl.textContent = cat;
      wrap.appendChild(catEl);
    });

    return wrap;
  }

  function buildTagField(item, descriptor, options) {
    descriptor = descriptor || {};
    options = options || {};

    var prefix = options.prefix || descriptor.cardPrefix || 'cb-card';
    var rawValues = Array.isArray(descriptor.values)
      ? descriptor.values
      : getTagValuesByPrefix(item, descriptor.prefix);

    if (descriptor.maxItems) rawValues = rawValues.slice(0, Number(descriptor.maxItems));

    var displayFormat = descriptor.displayFormat;
    var values = rawValues.map(function(value) {
      return displayFormat != null
        ? formatISOTag(value, displayFormat, descriptor.locale)
        : cleanHTML(value);
    }).filter(Boolean);

    if (!values.length) return null;

    var prefixName = String(descriptor.prefix || descriptor.name || '').replace(/:$/, '');
    var modifiers = descriptor.modifier === false ? '' : tagFieldModifier(prefixName, prefix);
    var row = createEl(descriptor.tag || 'div', {
      class: classNames(
        cardClass('tag-field', prefix),
        descriptor.className,
        modifiers
      )
    });

    if (descriptor.dataPrefix !== false && descriptor.prefix) {
      row.setAttribute('data-prefix', descriptor.prefix);
    }

    var joinWith = descriptor.joinWith != null ? descriptor.joinWith : ', ';
    var label = cleanHTML(descriptor.label || '');
    var text = values.join(joinWith);
    var fullText = label && descriptor.separateLabel !== true
      ? label + (descriptor.labelSeparator || ' ') + text
      : text;
    var icon = String(descriptor.icon || descriptor.labelIcon || '').trim();

    if (icon) {
      var iconEl = createEl('span', {
        class: descriptor.iconClassName || cardClass('tag-icon', prefix),
        'aria-hidden': 'true'
      });

      if (String(descriptor.iconType || 'text').toLowerCase() === 'html') iconEl.innerHTML = icon;
      else iconEl.textContent = icon;

      row.appendChild(iconEl);
    }

    if (label && descriptor.separateLabel === true) {
      var labelEl = createEl('span', {
        class: classNames(cardClass('tag-label', prefix), descriptor.labelClassName)
      });
      labelEl.textContent = label + (descriptor.labelSuffix || '');
      row.appendChild(labelEl);
    }

    if (!icon && descriptor.textOnlyWhenNoIcon === true && descriptor.separateLabel !== true) {
      row.textContent = fullText;
      return row;
    }

    var valueClass = classNames(
      cardClass('tag-value', prefix),
      joinWith === '\n' ? cardClass('tag-value--multiline', prefix) : '',
      descriptor.valueClassName
    );
    var valueEl = createEl('span', { class: valueClass });

    if (joinWith === '\n') {
      values.forEach(function(value, index) {
        if (index > 0) valueEl.appendChild(document.createElement('br'));
        valueEl.appendChild(document.createTextNode(value));
      });
    } else {
      valueEl.textContent = fullText;
    }

    row.appendChild(valueEl);
    return row;
  }

  function buildImg(assetUrl, focal, alt, options) {
    options = options || {};

    var base = String(assetUrl || '').split('?')[0];
    if (!base) return null;

    var wrapperClass = options.wrapperClass || 'cb-card__img-wrap';
    var imageClass = options.imageClass || 'cb-card__img';
    var sizes = options.sizes || '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw';
    var fallbackWidth = Number(options.fallbackWidth || 750);
    var priority = options.priority === true;

    var wrap = createEl('div', { class: wrapperClass });
    var img = createEl('img', {
      class: imageClass,
      src: base + '?format=' + fallbackWidth + 'w',
      srcset: buildSrcset(base, options.widths),
      sizes: sizes,
      alt: alt || '',
      loading: priority ? 'eager' : 'lazy',
      decoding: 'async'
    });

    img.fetchPriority = priority ? 'high' : 'low';
    img.style.objectPosition = focalPoint(focal);
    wrap.appendChild(img);
    return wrap;
  }

  function buildImgHTML(assetUrl, focal, alt, options) {
    options = options || {};

    var base = String(assetUrl || '').split('?')[0];
    if (!base) return '';

    var imageClass = options.imageClass || options.className || 'cb-card__img';
    var sizes = options.sizes || '(max-width:640px) 100vw, (max-width:1024px) 50vw, 33vw';
    var fallbackWidth = Number(options.fallbackWidth || 750);
    var priority = options.priority === true;
    var fallback = base + '?format=' + fallbackWidth + 'w';

    return '<img class="' + escapeHTML(imageClass) + '"' +
      ' src="' + escapeHTML(fallback) + '"' +
      ' srcset="' + escapeHTML(buildSrcset(base, options.widths)) + '"' +
      ' sizes="' + escapeHTML(sizes) + '"' +
      ' alt="' + escapeHTML(alt || '') + '"' +
      ' loading="' + (priority ? 'eager' : 'lazy') + '"' +
      ' fetchpriority="' + (priority ? 'high' : 'low') + '"' +
      ' decoding="async"' +
      ' style="object-position:' + escapeHTML(focalPoint(focal)) + '">';
  }

  function buildCategoriesHTML(values, options) {
    options = options || {};

    var cats = (Array.isArray(values) ? values : []).map(cleanHTML).filter(Boolean);
    if (!cats.length) return '';

    var prefix = options.prefix || 'cb-card';
    var wrapClass = classNames(cardClass('categories', prefix), options.className);
    var itemClass = classNames(cardClass('category', prefix), options.itemClassName);

    return '<div class="' + escapeHTML(wrapClass) + '">' + cats.map(function(cat) {
      return '<span class="' + escapeHTML(itemClass) + '">' + escapeHTML(cat) + '</span>';
    }).join('') + '</div>';
  }

  function appendProgressiveDOM(items, container, renderItem, options) {
    options = options || {};

    var index = 0;
    var size = Math.max(1, Number(options.batchSize || 8));
    var startIndex = Number(options.startIndex || 0);

    function appendBatch() {
      var frag = document.createDocumentFragment();
      var end = Math.min(index + size, items.length);

      for (; index < end; index++) {
        var node = renderItem(items[index], startIndex + index, index);
        if (node) frag.appendChild(node);
      }

      container.appendChild(frag);

      if (index < items.length) {
        requestAnimationFrame(appendBatch);
      } else if (typeof options.done === 'function') {
        options.done();
      }
    }

    appendBatch();
  }

  function buildChild(definition, item, options) {
    options = options || {};

    var descriptor = typeof definition === 'string'
      ? { type: definition }
      : (definition || {});

    var type = descriptor.type;
    var prefix = options.prefix || 'cb-card';

    if (type === 'image') {
      return buildImg(getImageBase(item), item.mediaFocalPoint, item.title, {
        wrapperClass: cardClass('img-wrap', prefix, descriptor.className),
        imageClass: cardClass('img', prefix, descriptor.imageClassName),
        sizes: descriptor.sizes || options.imageSizes,
        priority: descriptor.priority || options.priorityImage === true
      });
    }

    if (type === 'title') {
      var title = item && item.title;
      if (!title) return null;
      return buildTextElement(title, {
        prefix: prefix,
        role: 'title',
        tag: descriptor.tag || 'h3',
        className: descriptor.className,
        attrs: descriptor.attrs
      });
    }

    if (type === 'excerpt') {
      var excerpt = item && item.excerpt;
      if (!excerpt) return null;
      return buildTextElement(descriptor.max ? truncate(excerpt, descriptor.max) : excerpt, {
        prefix: prefix,
        role: 'excerpt',
        tag: descriptor.tag || 'p',
        className: descriptor.className
      });
    }

    if (type === 'location') {
      var loc = item && item.location;
      if (!loc) return null;
      return buildTextElement(loc, {
        prefix: prefix,
        role: 'location',
        tag: descriptor.tag || 'p',
        className: descriptor.className
      });
    }

    if (type === 'categories') {
      return buildCategories(item, {
        prefix: prefix,
        className: descriptor.className,
        itemClassName: descriptor.itemClassName
      });
    }

    if (type === 'tagPrefix') {
      return buildTagField(item, descriptor, { prefix: prefix });
    }

    return null;
  }

  function buildCard(item, options) {
    options = options || {};

    var prefix = options.prefix || 'cb-card';
    var href = item && (item.fullUrl || item.url);
    var tag = href && options.link !== false ? 'a' : 'article';
    var card = createEl(tag, { class: cardClass(null, prefix, options.className) });

    if (href && options.link !== false) {
      card.href = href;
      if (options.newTab) {
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
      }
    }

    if (item && item.id) card.setAttribute('data-item-id', item.id);

    var children = Array.isArray(options.children) && options.children.length
      ? options.children
      : ['image', 'title', 'excerpt'];

    children.forEach(function(child) {
      var node = buildChild(child, item, options);
      if (node) card.appendChild(node);
    });

    return card;
  }

  var dataApi = {
    version: VERSION,
    get: get,
    getState: getState,
    getCurrentPage: getCurrentPage,
    getCurrentPageState: getCurrentPageState,
    clear: clear,
    stats: stats
  };

  var utilsApi = {
    norm: norm,
    slugify: slugify,
    cleanHTML: cleanHTML,
    truncate: truncate,
    parseTag: parseTag,
    getTagValuesByPrefix: getTagValuesByPrefix,
    parseISO: parseISO,
    formatISOTag: formatISOTag,
    getISODatePart: getISODatePart,
    focalPoint: focalPoint,
    getImageBase: getImageBase,
    buildSrcset: buildSrcset,
    escapeHTML: escapeHTML,
    classNames: classNames,
    cardClass: cardClass,
    tagFieldModifier: tagFieldModifier,
    createEl: createEl,
    buildTextElement: buildTextElement,
    buildCategories: buildCategories,
    buildTagField: buildTagField,
    buildImg: buildImg,
    buildImgHTML: buildImgHTML,
    buildCategoriesHTML: buildCategoriesHTML,
    buildChild: buildChild,
    buildCard: buildCard,
    appendProgressiveDOM: appendProgressiveDOM
  };

  window.CollectionBlocks = {
    version: VERSION,
    data: dataApi,
    utils: utilsApi,
    get: get,
    getState: getState,
    clear: clear,
    stats: stats,
    norm: norm,
    slugify: slugify,
    cleanHTML: cleanHTML,
    truncate: truncate,
    parseISO: parseISO,
    formatISOTag: formatISOTag,
    getTagValuesByPrefix: getTagValuesByPrefix,
    buildSrcset: buildSrcset,
    escapeHTML: escapeHTML,
    classNames: classNames,
    cardClass: cardClass,
    tagFieldModifier: tagFieldModifier,
    createEl: createEl,
    buildTextElement: buildTextElement,
    buildCategories: buildCategories,
    buildTagField: buildTagField,
    buildImg: buildImg,
    buildImgHTML: buildImgHTML,
    buildCategoriesHTML: buildCategoriesHTML,
    buildChild: buildChild,
    buildCard: buildCard,
    appendProgressiveDOM: appendProgressiveDOM
  };
})();
