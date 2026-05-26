/*!
 * Collection Data v0.4
 * Shared Squarespace JSON fetch/cache layer
 * https://github.com/jonas-nicollin/squarespace-components
 *
 * CHANGELOG v0.4
 * — keepFields centralisés ici comme default (plus besoin de les répéter dans les blocs)
 * — fix : l'état en cache n'est plus muté directement (copie défensive avant fetch)
 * — fix : pendingKey inclut maintenant targetPages pour éviter la collision
 *   entre un fetch page=1 et un fetch page=2 sur la même collection
 * — allRemoteLoaded distingue maintenant "erreur réseau" de "fin de collection"
 */
(function () {
  'use strict';

  var VERSION = '0.4';
  var STORE_KEY_PREFIX = 'collection-data::v0.4::';

  var memoryCache = new Map();
  var pendingFetches = new Map();

  /* ════════════════════════════════════
   * DEFAULTS
   * keepFields centralisés ici.
   * Les scripts consommateurs (Query, Related, Locator) n'ont
   * plus besoin de les déclarer — ils héritent automatiquement.
   * ════════════════════════════════════ */
  var DEFAULT_KEEP_FIELDS = [
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
    'updatedOn',
  ];

  var DEFAULTS = {
    maxPages:     10,
    ttl:          900,
    sessionCache: true,
    memoryCache:  true,
    credentials:  'same-origin',
    keepFields:   DEFAULT_KEEP_FIELDS,
    stripFields:  [],
  };

  /* ════════════════════════════════════
   * UTILITAIRES
   * ════════════════════════════════════ */

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

  function normalizeMaxPages(value) {
    return value === 'all' ? Infinity : Number(value || DEFAULTS.maxPages);
  }

  /* ════════════════════════════════════
   * CLÉ DE CACHE
   * Basée uniquement sur path + keepFields + stripFields.
   * maxPages est intentionnellement exclu : tous les consommateurs
   * qui demandent la même collection partagent le même cache,
   * quelle que soit la profondeur de pagination demandée.
   * ════════════════════════════════════ */
  function makeCacheKey(path, options) {
    var keepKey = Array.isArray(options.keepFields) && options.keepFields.length
      ? '::keep=' + options.keepFields.slice().sort().join(',')
      : '';
    var stripKey = Array.isArray(options.stripFields) && options.stripFields.length
      ? '::strip=' + options.stripFields.slice().sort().join(',')
      : '';
    return STORE_KEY_PREFIX + normalizePath(path) + keepKey + stripKey;
  }

  /* ════════════════════════════════════
   * SESSION STORAGE
   * ════════════════════════════════════ */
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
        ts:  now(),
        ttl: Number(ttl || DEFAULTS.ttl),
      })));
    } catch (_) {}
  }

  /* ════════════════════════════════════
   * EXTRACTION ITEMS
   * ════════════════════════════════════ */
  function extractItems(data) {
    if (Array.isArray(data && data.items))                           return data.items;
    if (Array.isArray(data && data.itemList))                        return data.itemList;
    if (Array.isArray(data && data.collection && data.collection.items)) return data.collection.items;
    return [];
  }

  function getNextUrl(data) {
    if (!data || !data.pagination) return null;
    if (data.pagination.nextPageUrl) return ensureJson(data.pagination.nextPageUrl);
    return null;
  }

  function getNextOffset(data) {
    if (!data || !data.pagination) return null;
    if (data.pagination.nextPage && data.pagination.nextPageOffset != null) {
      return data.pagination.nextPageOffset;
    }
    return null;
  }

  /* ════════════════════════════════════
   * NETTOYAGE DES ITEMS
   * ════════════════════════════════════ */
  function keepItemFields(item, fields) {
    if (!item || !Array.isArray(fields) || !fields.length) return item;
    var clone = {};
    fields.forEach(function (field) {
      if (field in item) clone[field] = item[field];
    });
    return clone;
  }

  function stripItemFields(item, fields) {
    if (!item || !Array.isArray(fields) || !fields.length) return item;
    var clone = Object.assign({}, item);
    fields.forEach(function (field) {
      delete clone[field];
    });
    return clone;
  }

  function cleanItems(items, options) {
    var keepFields  = Array.isArray(options.keepFields)  && options.keepFields.length  ? options.keepFields  : null;
    var stripFields = Array.isArray(options.stripFields) && options.stripFields.length ? options.stripFields : [];
    if (!keepFields && !stripFields.length) return items;
    return items.map(function (item) {
      if (keepFields)        item = keepItemFields(item, keepFields);
      if (stripFields.length) item = stripItemFields(item, stripFields);
      return item;
    });
  }

  /* ════════════════════════════════════
   * FETCH COLLECTION
   *
   * FIX v0.4 : on travaille sur une COPIE de state, jamais sur l'original.
   * Cela évite que Related Block (qui étend la pagination) ne mute
   * silencieusement un état partagé que Query Block ou Locator lisent
   * en parallèle dans un état intermédiaire incohérent.
   * ════════════════════════════════════ */
  async function fetchCollection(path, options, cachedState, targetPages) {
    options = Object.assign({}, DEFAULTS, options || {});

    var cleanPath = normalizePath(path);
    var maxPages  = normalizeMaxPages(targetPages);

    /* Copie défensive — on ne mute jamais l'objet reçu en paramètre */
    var state = {
      items:       (cachedState.items || []).slice(),
      pagesLoaded: Number(cachedState.pagesLoaded || 0),
      nextUrl:     cachedState.nextUrl     || null,
      nextOffset:  cachedState.nextOffset  != null ? cachedState.nextOffset : null,
      complete:    !!cachedState.complete,
      fetchError:  false,
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
        /* Erreur réseau — on arrête sans marquer comme complet */
        state.fetchError = true;
        break;
      }

      if (!res.ok) {
        /* Erreur HTTP — idem, on ne marque pas complete */
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

      /*
       * FIX v0.4 allRemoteLoaded :
       * On marque "complete" seulement si Squarespace confirme qu'il n'y a
       * plus de page suivante (pas de nextUrl ET pas de nextOffset).
       * Un batch vide n'est pas suffisant — il peut être dû à une erreur réseau.
       * Dans ce cas fetchError = true ci-dessus, et on sort de la boucle sans
       * marquer complete, ce qui permet de réessayer lors du prochain "Voir plus".
       */
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

  /* ════════════════════════════════════
   * GET — POINT D'ENTRÉE PRINCIPAL
   *
   * FIX v0.4 race condition :
   * pendingKey inclut désormais targetPages. Ainsi un fetch "page=1"
   * et un fetch "page=2" simultanés ne se court-circuitent plus mutuellement.
   * Un fetch page=2 lancé pendant qu'un fetch page=1 est en cours crée
   * sa propre promise et est mis en queue séparément.
   * ════════════════════════════════════ */
  async function get(path, options) {
    options = Object.assign({}, DEFAULTS, options || {});

    var key          = makeCacheKey(path, options);
    var targetPages  = options.maxPages || DEFAULTS.maxPages;
    var wantedPages  = normalizeMaxPages(targetPages);

    /* 1. Lecture mémoire */
    var cachedState = null;
    if (options.memoryCache !== false && memoryCache.has(key)) {
      cachedState = memoryCache.get(key);
    }

    /* 2. Lecture sessionStorage */
    if (!cachedState && options.sessionCache !== false) {
      cachedState = readSession(key);
      if (cachedState && options.memoryCache !== false) {
        memoryCache.set(key, cachedState);
      }
    }

    /* 3. État initial si rien en cache */
    if (!cachedState) {
      cachedState = {
        items:       [],
        pagesLoaded: 0,
        nextUrl:     null,
        nextOffset:  null,
        complete:    false,
      };
    }

    /* 4. Cache suffisant — retour immédiat */
    if (cachedState.complete || Number(cachedState.pagesLoaded || 0) >= wantedPages) {
      return cachedState.items;
    }

    /* 5. Déduplication : même chemin + même profondeur demandée */
    var pendingKey = key + '::pages=' + targetPages;
    if (pendingFetches.has(pendingKey)) {
      return pendingFetches.get(pendingKey);
    }

    /* 6. Fetch */
    var promise = fetchCollection(path, options, cachedState, targetPages)
      .then(function (updatedState) {
        /* Écriture en mémoire */
        if (options.memoryCache !== false) {
          memoryCache.set(key, updatedState);
        }
        /* Écriture session (seulement si le fetch n'a pas eu d'erreur réseau) */
        if (options.sessionCache !== false && !updatedState.fetchError) {
          writeSession(key, updatedState, options.ttl);
        }
        return updatedState.items;
      })
      .finally(function () {
        pendingFetches.delete(pendingKey);
      });

    pendingFetches.set(pendingKey, promise);
    return promise;
  }

  /* ════════════════════════════════════
   * HELPERS PUBLICS
   * ════════════════════════════════════ */
  async function getCurrentPage(options) {
    return get(window.location.pathname, Object.assign({ maxPages: 1 }, options || {}));
  }

  function clear() {
    memoryCache.clear();
    pendingFetches.clear();
    try {
      Object.keys(sessionStorage)
        .filter(function (key) { return key.indexOf(STORE_KEY_PREFIX) === 0; })
        .forEach(function (key) { sessionStorage.removeItem(key); });
    } catch (_) {}
  }

  function stats() {
    var collections = Array.from(memoryCache.entries()).map(function (entry) {
      var state = entry[1] || {};
      return {
        key:        entry[0],
        items:      Array.isArray(state.items) ? state.items.length : 0,
        pagesLoaded: state.pagesLoaded || 0,
        complete:   !!state.complete,
        fetchError: !!state.fetchError,
        hasNext:    !!(state.nextUrl || state.nextOffset != null),
      };
    });
    return {
      version:     VERSION,
      collections: collections,
      pendingKeys: Array.from(pendingFetches.keys()),
      bypass:      shouldBypassCache(),
    };
  }

  /* ════════════════════════════════════
   * EXPORT
   * ════════════════════════════════════ */
  window.CollectionData = {
    version:          VERSION,
    DEFAULT_KEEP_FIELDS: DEFAULT_KEEP_FIELDS,
    get:              get,
    getCurrentPage:   getCurrentPage,
    clear:            clear,
    stats:            stats,
  };

})();
