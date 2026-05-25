(function () {
  'use strict';

  var VERSION = '0.2';
var STORE_KEY_PREFIX = 'collection-data::v0.2::';

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
    'assetUrl',
    'mediaFocalPoint',
    'categories',
    'tags',
    'excerpt',
    'location',
    'displayIndex',
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

  function normalizePath(path) {
    return String(path || '').trim();
  }

  function ensureJson(url) {
    if (!url) return url;
    if (url.indexOf('format=json') !== -1) return url;
    return url.indexOf('?') !== -1 ? url + '&format=json' : url + '?format=json';
  }

  function makeCacheKey(path, options) {
  var maxPages = options.maxPages === 'all' ? 'all' : Number(options.maxPages || DEFAULTS.maxPages);

  var keepKey = Array.isArray(options.keepFields)
    ? '::keep=' + options.keepFields.join(',')
    : '';

  var stripKey = Array.isArray(options.stripFields)
    ? '::strip=' + options.stripFields.join(',')
    : '';

  return STORE_KEY_PREFIX + normalizePath(path) + '::pages=' + maxPages + keepKey + stripKey;
}

  function readSession(key) {
    if (isPerfTest()) return null;

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

      return parsed.items;
    } catch (_) {
      return null;
    }
  }

  function writeSession(key, items, ttl) {
    if (isPerfTest()) return;

    try {
      sessionStorage.setItem(key, JSON.stringify({
        ts: now(),
        ttl: Number(ttl || DEFAULTS.ttl),
        items: items,
      }));
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
      if (field in item) clone[field] = item[field];
    });

    return clone;
  }

  function stripItemFields(item, fields) {
    if (!item || !Array.isArray(fields) || !fields.length) return item;

    var clone = Object.assign({}, item);

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

  if (!keepFields && !stripFields.length) return items;

  return items.map(function(item) {
    if (keepFields) {
      item = keepItemFields(item, keepFields);
    }

    if (stripFields.length) {
      item = stripItemFields(item, stripFields);
    }

    return item;
  });
}

  async function fetchCollection(path, options) {
    options = Object.assign({}, DEFAULTS, options || {});

    var cleanPath = normalizePath(path);
    var maxPages = options.maxPages === 'all' ? Infinity : Number(options.maxPages || DEFAULTS.maxPages);
    var items = [];
    var url = ensureJson(cleanPath);
    var page = 0;

    while (page < maxPages && url) {
      var res = await fetch(url, {
        credentials: options.credentials || DEFAULTS.credentials,
      });

      if (!res.ok) break;

      var data = await res.json();
      var batch = extractItems(data);

      items.push.apply(items, batch);

      var nextUrl = getNextUrl(data);
      var nextOffset = getNextOffset(data);

      if (nextUrl) {
        url = nextUrl;
      } else if (nextOffset != null) {
        url = ensureJson(cleanPath) + '&offset=' + encodeURIComponent(nextOffset);
      } else {
        url = null;
      }

      page++;
    }

    return cleanItems(items, options);
  }

  async function get(path, options) {
    options = Object.assign({}, DEFAULTS, options || {});

    var key = makeCacheKey(path, options);

    if (options.memoryCache !== false && memoryCache.has(key)) {
      return memoryCache.get(key);
    }

    if (options.sessionCache !== false) {
      var sessionItems = readSession(key);
      if (sessionItems) {
        if (options.memoryCache !== false) memoryCache.set(key, sessionItems);
        return sessionItems;
      }
    }

    if (pendingFetches.has(key)) {
      return pendingFetches.get(key);
    }

    var promise = fetchCollection(path, options)
      .then(function (items) {
        if (options.memoryCache !== false) memoryCache.set(key, items);
        if (options.sessionCache !== false) writeSession(key, items, options.ttl);
        return items;
      })
      .finally(function () {
        pendingFetches.delete(key);
      });

    pendingFetches.set(key, promise);
    return promise;
  }

  async function getCurrentPage(options) {
    return get(window.location.pathname, Object.assign({
      maxPages: 1,
    }, options || {}));
  }

  function clear() {
    memoryCache.clear();
    pendingFetches.clear();

    try {
      Object.keys(sessionStorage)
        .filter(function (key) {
          return key.indexOf(STORE_KEY_PREFIX) === 0;
        })
        .forEach(function (key) {
          sessionStorage.removeItem(key);
        });
    } catch (_) {}
  }

  function stats() {
    return {
      version: VERSION,
      memoryKeys: Array.from(memoryCache.keys()),
      pendingKeys: Array.from(pendingFetches.keys()),
      perfTest: isPerfTest(),
    };
  }

  window.CollectionData = {
    version: VERSION,
    get: get,
    getCurrentPage: getCurrentPage,
    clear: clear,
    stats: stats,
  };

})();
