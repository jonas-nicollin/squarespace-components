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

  function shouldBypassCache() {
    try {
      var params = new URLSearchParams(window.location.search);
      return params.has('perf-test') || params.has('preview');
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
  /* On trie les champs pour que l'ordre de déclaration n'impacte pas la clé.
     Deux appels avec les mêmes champs dans des ordres différents partagent
     ainsi le même cache. */
  var keepKey = Array.isArray(options.keepFields) && options.keepFields.length
    ? '::keep=' + options.keepFields.slice().sort().join(',')
    : '';

  var stripKey = Array.isArray(options.stripFields) && options.stripFields.length
    ? '::strip=' + options.stripFields.slice().sort().join(',')
    : '';

  return STORE_KEY_PREFIX + normalizePath(path) + keepKey + stripKey;
}

function normalizeMaxPages(value) {
  return value === 'all' ? Infinity : Number(value || DEFAULTS.maxPages);
}

  function readSession(key) {
  if (shouldBypassCache()) return null;

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

    return parsed;
  } catch (_) {
    return null;
  }
}

  function writeSession(key, state, ttl) {
  if (shouldBypassCache()) return;

  try {
    sessionStorage.setItem(key, JSON.stringify(Object.assign({}, state, {
      ts: now(),
      ttl: Number(ttl || DEFAULTS.ttl),
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

  async function fetchCollection(path, options, cachedState, targetPages) {
  options = Object.assign({}, DEFAULTS, options || {});

  var cleanPath = normalizePath(path);
  var maxPages  = normalizeMaxPages(targetPages);

  /* Copie défensive : on ne mute jamais l'objet reçu en paramètre.
     Si plusieurs blocs partagent le même état en mémoire (même clé de cache),
     un fetch progressif de Related n'altère pas ce que Query ou Locator lisent
     en parallèle dans un état intermédiaire incohérent. */
  var state = {
    items:      (cachedState.items || []).slice(),
    pagesLoaded: Number(cachedState.pagesLoaded || 0),
    nextUrl:    cachedState.nextUrl    || null,
    nextOffset: cachedState.nextOffset != null ? cachedState.nextOffset : null,
    complete:   !!cachedState.complete,
    fetchError: false,
  };

  var url = state.nextUrl;
  if (!url && state.nextOffset != null) {
    url = ensureJson(cleanPath) + '&offset=' + encodeURIComponent(state.nextOffset);
  }
  if (!url && state.pagesLoaded === 0) {
    url = ensureJson(cleanPath);
  }

  while (state.pagesLoaded < maxPages && url && !state.complete) {
    var res;
    try {
      res = await fetch(url, { credentials: options.credentials || DEFAULTS.credentials });
    } catch (_) {
      /* Erreur réseau — on s'arrête sans marquer complete.
         Le prochain "Voir plus" pourra réessayer. */
      state.fetchError = true;
      break;
    }

    if (!res.ok) {
      state.fetchError = true;
      break;
    }

    var data;
    try {
      data = await res.json();
    } catch (_) {
      state.fetchError = true;
      break;
    }

    var batch = cleanItems(extractItems(data), options);
    state.items.push.apply(state.items, batch);

    var nextUrl    = getNextUrl(data);
    var nextOffset = getNextOffset(data);

    state.nextUrl    = nextUrl    || null;
    state.nextOffset = nextOffset != null ? nextOffset : null;

    /* On marque complete seulement si Squarespace confirme l'absence de page
       suivante — pas sur un batch vide qui pourrait être une erreur réseau. */
    if (!state.nextUrl && state.nextOffset == null) {
      state.complete = true;
    }

    if (state.nextUrl) {
      url = state.nextUrl;
    } else if (state.nextOffset != null) {
      url = ensureJson(cleanPath) + '&offset=' + encodeURIComponent(state.nextOffset);
    } else {
      url = null;
    }

    state.pagesLoaded++;
  }

  return state;
}

  async function get(path, options) {
  options = Object.assign({}, DEFAULTS, options || {});

  var key = makeCacheKey(path, options);
  var targetPages = options.maxPages || DEFAULTS.maxPages;
  var wantedPages = normalizeMaxPages(targetPages);

  var state = null;

  if (options.memoryCache !== false && memoryCache.has(key)) {
    state = memoryCache.get(key);
  }

  if (!state && options.sessionCache !== false) {
    state = readSession(key);
    if (state && options.memoryCache !== false) {
      memoryCache.set(key, state);
    }
  }

  if (!state) {
    state = {
      items: [],
      pagesLoaded: 0,
      nextUrl: null,
      nextOffset: null,
      complete: false,
    };

    if (options.memoryCache !== false) {
      memoryCache.set(key, state);
    }
  }

  if (state.complete || Number(state.pagesLoaded || 0) >= wantedPages) {
    return state.items;
  }

  var pendingKey = key + '::to=' + targetPages;

  if (pendingFetches.has(pendingKey)) {
    return pendingFetches.get(pendingKey);
  }

  var promise = fetchCollection(path, options, state, targetPages)
    .then(function(updatedState) {
      if (options.memoryCache !== false) {
        memoryCache.set(key, updatedState);
      }
      /* N'écrire en session que si le fetch s'est terminé proprement —
         évite de persister un état partiel dû à une erreur réseau. */
      if (options.sessionCache !== false && !updatedState.fetchError) {
        writeSession(key, updatedState, options.ttl);
      }
      return updatedState.items;
    })
    .finally(function() {
      pendingFetches.delete(pendingKey);
    });

  pendingFetches.set(pendingKey, promise);
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
  var collections = Array.from(memoryCache.entries()).map(function(entry) {
    var state = entry[1] || {};

    return {
      key:         entry[0],
      items:       Array.isArray(state.items) ? state.items.length : 0,
      pagesLoaded: state.pagesLoaded || 0,
      complete:    !!state.complete,
      fetchError:  !!state.fetchError,
      hasNext:     !!(state.nextUrl || state.nextOffset != null),
    };
  });

  return {
    version: VERSION,
    collections: collections,
    memoryKeys: Array.from(memoryCache.keys()),
    pendingKeys: Array.from(pendingFetches.keys()),
    bypass: shouldBypassCache(),
  };
}

  window.CollectionData = {
    version:           VERSION,
    DEFAULT_KEEP_FIELDS: DEFAULTS.keepFields,
    get:               get,
    getCurrentPage:    getCurrentPage,
    clear:             clear,
    stats:             stats,
  };

})();
