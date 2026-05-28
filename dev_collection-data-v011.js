(function () {
  'use strict';

  var VERSION = '0.4';
  var STORE_KEY_PREFIX = 'collection-data::v0.4::';

  var memoryCache = new Map();
  var pendingFetches = new Map();

  var DEFAULTS = {
    maxPages: 10,
    ttl: 900,
    sessionCache: true,
    memoryCache: true,
    credentials: 'same-origin',

    // Par défaut : ne garder que les champs utiles aux blocs.
    keepFields: [
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
    ],

    // Option complémentaire, utile si keepFields est désactivé ou élargi.
    stripFields: []
  };

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

  window.CollectionData = {
    version: VERSION,
    get: get,
    getState: getState,
    getCurrentPage: getCurrentPage,
    getCurrentPageState: getCurrentPageState,
    clear: clear,
    stats: stats
  };
})();
