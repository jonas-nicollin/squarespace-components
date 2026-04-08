/* Collection Related Blocks */
(function () {
  'use strict';

  const CONFIGS = Array.isArray(window.COLLECTION_RELATED_BLOCK_CONFIGS)
    ? window.COLLECTION_RELATED_BLOCK_CONFIGS
    : [];

  if (!CONFIGS.length) return;

  const DEFAULT_JSON_FORMAT_SUFFIX = '?format=json';
  const COLLECTION_RELATED_BLOCK_COLLECTION_CACHE = new Map();

  function normalize(str) {
    return String(str || '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019’]/g, "'")
      .replace(/&/g, 'and')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function uniq(arr) {
    return Array.from(new Set(arr));
  }

  function decodeHtmlEntities(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = String(str || '');
    return txt.value;
  }

  function cleanText(str) {
    return decodeHtmlEntities(str)
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/gi, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function truncateText(str, maxLength) {
    const text = cleanText(str);
    if (!text || text.length <= maxLength) return text;

    const sliced = text.slice(0, maxLength);
    const lastSpace = sliced.lastIndexOf(' ');
    return (lastSpace > 0 ? sliced.slice(0, lastSpace) : sliced).trim() + '…';
  }

  function uniqBy(arr, keyFn) {
    const seen = new Set();
    return arr.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function getPrefix(tag) {
    const raw = String(tag || '');
    const idx = raw.indexOf(':');
    if (idx === -1) return null;
    return raw.slice(0, idx).trim();
  }

  function getTagValue(tag) {
    const raw = String(tag || '');
    const idx = raw.indexOf(':');
    if (idx === -1) return raw.trim();
    return raw.slice(idx + 1).trim();
  }

  function slugifyToken(str) {
    return String(str || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildTagObjects(tags) {
    return (Array.isArray(tags) ? tags : [])
      .map(tag => {
        const prefix = getPrefix(tag);
        const value = getTagValue(tag);
        return {
          raw: cleanText(tag),
          prefix: cleanText(prefix),
          prefixNorm: normalize(prefix),
          value: cleanText(value),
          valueNorm: normalize(value),
          rawNorm: normalize(tag)
        };
      })
      .filter(tag => tag.rawNorm);
  }

  function getTagValuesByPrefix(item, prefix) {
    if (!prefix) return [];

    const normalizedPrefix = normalize(String(prefix).replace(/:$/, ''));

    return (Array.isArray(item?.tags) ? item.tags : [])
      .map(tag => {
        const raw = String(tag || '');
        const idx = raw.indexOf(':');
        if (idx === -1) return null;

        const tagPrefix = normalize(raw.slice(0, idx));
        const value = cleanText(raw.slice(idx + 1));

        if (tagPrefix === normalizedPrefix) return value;
        return null;
      })
      .filter(Boolean);
  }

  function getComparableDisplayIndex(item) {
    const value = Number(item?.displayIndex);
    return Number.isFinite(value) ? value : null;
  }

  function getCurrentPathname() {
    return (location.pathname || '').replace(/\/+$/, '') || '/';
  }

  function matchesDevGuard(CFG) {
    const guard = CFG.devGuard || {};
    if (!guard.enabled) return true;
    if (guard.bodyId && document.body.id !== guard.bodyId) return false;
    return true;
  }

  function getInsertTarget(selector) {
    return document.querySelector(selector || '');
  }

  function alreadyInjected(target, cfgKey) {
    return !!target.querySelector(
      ':scope > .collection-related-block[data-related-key="' + cfgKey + '"]'
    );
  }

  function insertInto(target, el, mode) {
    if ((mode || 'append').toLowerCase() === 'prepend') {
      target.insertAdjacentElement('afterbegin', el);
    } else {
      target.insertAdjacentElement('beforeend', el);
    }
  }

  function cacheKey(CFG) {
    return ['collection-related-block-v2', CFG.key, location.pathname].join('::');
  }

  function getCollectionCacheKey(path, maxPages, jsonFormatSuffix) {
    return [
      'collection-related-block-collection-cache',
      path,
      maxPages || 5,
      jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX
    ].join('::');
  }

  function getCollectionCacheOptions(CFG) {
    return {
      useMemoryCache: CFG.performance?.useCollectionMemoryCache !== false,
      useSessionCache: CFG.performance?.useCollectionSessionCache === true
    };
  }

  function getAssetUrl(item) {
    return item.assetUrl || item?.asset?.url || null;
  }

  function getItemTimestamp(item) {
    return Number(
      item?.startDate ||
      item?.publishOn ||
      item?.addedOn ||
      item?.updatedOn ||
      0
    );
  }

  function getItemExcerpt(item) {
    const rawExcerpt = item?.excerpt;
    const rawBody = item?.body;

    const excerptText = cleanText(rawExcerpt || '');
    if (excerptText) return truncateText(excerptText, 180);

    const bodyText = cleanText(rawBody || '');
    if (bodyText) return truncateText(bodyText, 180);

    return '';
  }

  function getItemLocationText(item) {
    if (item?.location?.addressTitle) return cleanText(item.location.addressTitle);
    if (item?.location?.addressLine1) return cleanText(item.location.addressLine1);
    return '';
  }

  function mapItemForRender(item, CFG) {
    const tagPrefixFields = Array.isArray(CFG?.display?.tagPrefixFields)
      ? CFG.display.tagPrefixFields
      : [];

    const tagPrefixValues = tagPrefixFields
      .map(fieldConfig => {
        const prefix = fieldConfig?.prefix || '';
        const values = getTagValuesByPrefix(item, prefix);
        if (!values.length) return null;

        const limitedValues = fieldConfig?.maxItems
          ? values.slice(0, Number(fieldConfig.maxItems))
          : values;

        return {
          prefix: cleanText(prefix),
          prefixSlug: slugifyToken(String(prefix).replace(/:$/, '')),
          values: limitedValues,
          value: limitedValues.join(fieldConfig?.joinWith || ', '),
          label: cleanText(fieldConfig?.label || '')
        };
      })
      .filter(Boolean);

    return {
      title: cleanText(item.title || ''),
      urlId: item.urlId || '',
      fullUrl: item.fullUrl || '',
      assetUrl: getAssetUrl(item),
      mediaFocalPoint: item.mediaFocalPoint || null,
      categories: Array.isArray(item.categories)
        ? item.categories.map(cat => cleanText(cat)).filter(Boolean)
        : [],
      tags: Array.isArray(item.tags)
        ? item.tags.map(tag => cleanText(tag)).filter(Boolean)
        : [],
      excerpt: getItemExcerpt(item),
      locationText: getItemLocationText(item),
      displayIndex: Number(item.displayIndex || 999999),
      timestamp: getItemTimestamp(item),
      tagPrefixValues,
      rawItem: item
    };
  }

  function itemHasCategory(item, categoryName) {
    const wanted = normalize(categoryName);
    return (Array.isArray(item.categories) ? item.categories : [])
      .map(normalize)
      .includes(wanted);
  }

  function itemHasAnyCategory(item, values) {
    const categories = Array.isArray(values) ? values : [];
    if (!categories.length) return false;
    return categories.some(cat => itemHasCategory(item, cat));
  }

  function itemHasTag(item, tagName) {
    const wanted = normalize(tagName);
    return (Array.isArray(item.tags) ? item.tags : [])
      .map(normalize)
      .includes(wanted);
  }

  function itemHasAnyExactTag(item, values) {
    const tags = Array.isArray(values) ? values : [];
    if (!tags.length) return false;
    return tags.some(tag => itemHasTag(item, tag));
  }

  function getTagObjects(item) {
    return buildTagObjects(item.tags || []);
  }

  function getCurrentTagObjectsByPrefixes(currentItem, prefixes) {
    const prefixSet = new Set((Array.isArray(prefixes) ? prefixes : []).map(normalize));
    return getTagObjects(currentItem).filter(tag => prefixSet.has(tag.prefixNorm));
  }

  function itemSharesTagPrefix(candidateItem, currentItem, prefixes) {
    const prefixSet = new Set((Array.isArray(prefixes) ? prefixes : []).map(normalize));
    if (!prefixSet.size) return false;

    const currentTags = getTagObjects(currentItem).filter(tag => prefixSet.has(tag.prefixNorm));
    if (!currentTags.length) return false;

    const currentSet = new Set(currentTags.map(tag => tag.rawNorm));
    return getTagObjects(candidateItem).some(tag => currentSet.has(tag.rawNorm));
  }

  function itemSharesCategory(candidateItem, currentItem) {
    const currentCategories = new Set(
      (currentItem.categories || []).map(normalize).filter(Boolean)
    );
    if (!currentCategories.size) return false;

    return (candidateItem.categories || []).some(cat =>
      currentCategories.has(normalize(cat))
    );
  }

  function itemTitleMatchesCurrentTagValue(candidateItem, currentItem, prefixes) {
    const candidateTitleNorm = normalize(candidateItem.title || '');
    if (!candidateTitleNorm) return false;

    const values = getCurrentTagObjectsByPrefixes(currentItem, prefixes).map(
      tag => tag.valueNorm
    );

    return values.includes(candidateTitleNorm);
  }

  function findNextCollectionItemOfCategory(items, currentItem, rule) {
    const currentIndex = getComparableDisplayIndex(currentItem);
    if (currentIndex === null) return null;

    const wantedCategories = Array.isArray(rule?.values)
      ? rule.values
      : rule?.category
        ? [rule.category]
        : [];

    const currentUrl = String(currentItem?.fullUrl || '').replace(/\/+$/, '') || '/';

    const pool = (Array.isArray(items) ? items : [])
      .filter(item => {
        if (!item) return false;

        const itemIndex = getComparableDisplayIndex(item);
        if (itemIndex === null || itemIndex <= currentIndex) return false;

        const itemUrl = String(item?.fullUrl || '').replace(/\/+$/, '') || '/';
        if (itemUrl === currentUrl) return false;

        if (wantedCategories.length && !itemHasAnyCategory(item, wantedCategories)) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        return getComparableDisplayIndex(a) - getComparableDisplayIndex(b);
      });

    return pool[0] || null;
  }

  function findNextCollectionItemWithTag(items, currentItem, rule) {
    const currentIndex = getComparableDisplayIndex(currentItem);
    if (currentIndex === null) return null;

    const wantedTags = Array.isArray(rule?.values)
      ? rule.values.map(normalize)
      : [];

    const currentUrl = String(currentItem?.fullUrl || '').replace(/\/+$/, '') || '/';

    const pool = (Array.isArray(items) ? items : [])
      .filter(item => {
        if (!item) return false;

        const itemIndex = getComparableDisplayIndex(item);
        if (itemIndex === null || itemIndex <= currentIndex) return false;

        const itemUrl = String(item?.fullUrl || '').replace(/\/+$/, '') || '/';
        if (itemUrl === currentUrl) return false;

        if (wantedTags.length) {
          const itemTags = (Array.isArray(item.tags) ? item.tags : []).map(normalize);
          const hasMatch = wantedTags.some(tag => itemTags.includes(tag));
          if (!hasMatch) return false;
        }

        return true;
      })
      .sort((a, b) => {
        return getComparableDisplayIndex(a) - getComparableDisplayIndex(b);
      });

    return pool[0] || null;
  }

  function ruleMatchesCandidate(rule, candidateItem, currentItem, context) {
    const type = rule?.type;

    if (type === 'sharedCategory') {
      return itemSharesCategory(candidateItem, currentItem);
    }

    if (type === 'sharedTagPrefix') {
      return itemSharesTagPrefix(candidateItem, currentItem, rule.prefixes || []);
    }

    if (type === 'sharedExactTag') {
      return itemHasAnyExactTag(candidateItem, rule.values || []);
    }

    if (type === 'includeCategories') {
      return itemHasAnyCategory(candidateItem, rule.values || []);
    }

    if (type === 'excludeCategories') {
      return !itemHasAnyCategory(candidateItem, rule.values || []);
    }

    if (type === 'includeExactTags') {
      return itemHasAnyExactTag(candidateItem, rule.values || []);
    }

    if (type === 'excludeExactTags') {
      return !itemHasAnyExactTag(candidateItem, rule.values || []);
    }

    if (type === 'titleMatchesCurrentTagValue') {
      return itemTitleMatchesCurrentTagValue(candidateItem, currentItem, rule.prefixes || []);
    }

    if (type === 'nextCollectionItemOfCategory') {
      const nextItem = findNextCollectionItemOfCategory(context?.allItems || [], currentItem, rule);
      if (!nextItem) return false;

      const candidateUrl = String(candidateItem?.fullUrl || '').replace(/\/+$/, '') || '/';
      const nextUrl = String(nextItem?.fullUrl || '').replace(/\/+$/, '') || '/';

      if (candidateUrl && nextUrl && candidateUrl === nextUrl) return true;

      return String(candidateItem?.urlId || '') === String(nextItem?.urlId || '');
    }

    if (type === 'nextCollectionItemWithTag') {
      const nextItem = findNextCollectionItemWithTag(context?.allItems || [], currentItem, rule);
      if (!nextItem) return false;

      const candidateUrl = String(candidateItem?.fullUrl || '').replace(/\/+$/, '') || '/';
      const nextUrl = String(nextItem?.fullUrl || '').replace(/\/+$/, '') || '/';

      if (candidateUrl && nextUrl && candidateUrl === nextUrl) return true;

      return String(candidateItem?.urlId || '') === String(nextItem?.urlId || '');
    }

    return false;
  }

  function evaluateMatchGroups(candidateItem, currentItem, selection, context) {
    const groups = Array.isArray(selection?.match?.groups) ? selection.match.groups : [];
    if (!groups.length) return true;

    return groups.some(group => {
      const rules = Array.isArray(group.rules) ? group.rules : [];
      if (!rules.length) return false;

      const logic = String(group.logic || 'or').toLowerCase();

      if (logic === 'and') {
        return rules.every(rule => ruleMatchesCandidate(rule, candidateItem, currentItem, context));
      }

      return rules.some(rule => ruleMatchesCandidate(rule, candidateItem, currentItem, context));
    });
  }

  function computeCandidateScore(candidateItem, currentItem, selection) {
    const scoreConfig = selection?.score || {};
    if (!scoreConfig.enabled) return 0;

    const rules = Array.isArray(scoreConfig.rules) ? scoreConfig.rules : [];
    let total = 0;

    rules.forEach(rule => {
      const weight = Number(rule.weight || 0);
      if (!weight) return;

      if (rule.type === 'sharedCategory' && itemSharesCategory(candidateItem, currentItem)) {
        const currentCategories = new Set(
          (currentItem.categories || []).map(normalize).filter(Boolean)
        );

        (candidateItem.categories || []).forEach(cat => {
          if (currentCategories.has(normalize(cat))) total += weight;
        });
      }

      if (rule.type === 'sharedTagPrefix') {
        const prefixSet = new Set((Array.isArray(rule.prefixes) ? rule.prefixes : []).map(normalize));
        const currentTags = getTagObjects(currentItem).filter(tag => prefixSet.has(tag.prefixNorm));
        const currentSet = new Set(currentTags.map(tag => tag.rawNorm));

        getTagObjects(candidateItem).forEach(tag => {
          if (currentSet.has(tag.rawNorm)) total += weight;
        });
      }

      if (rule.type === 'sharedExactTag') {
        const values = Array.isArray(rule.values) ? rule.values : [];
        values.forEach(value => {
          if (itemHasTag(candidateItem, value) && itemHasTag(currentItem, value)) {
            total += weight;
          }
        });
      }

      if (rule.type === 'titleMatchesCurrentTagValue') {
        if (itemTitleMatchesCurrentTagValue(candidateItem, currentItem, rule.prefixes || [])) {
          total += weight;
        }
      }
    });

    return total;
  }

  function passesConstraints(candidateItem, currentItem, selection) {
    const constraints = selection?.constraints || {};

    if (constraints.requirePublished) {
      if (candidateItem.workflowState !== 1) return false;
      if (candidateItem.publishOn && Number(candidateItem.publishOn) > Date.now()) return false;
    }

    if (constraints.requireImage) {
      if (!getAssetUrl(candidateItem)) return false;
    }

    if (constraints.excludeCurrentItem) {
      const currentUrl = String(currentItem?.fullUrl || '').replace(/\/+$/, '') || '/';
      const itemUrl = String(candidateItem?.fullUrl || '').replace(/\/+$/, '') || '/';
      const currentTitleNorm = normalize(currentItem?.title || '');
      const itemTitleNorm = normalize(candidateItem?.title || '');

      if (itemUrl === currentUrl) return false;
      if (currentTitleNorm && itemTitleNorm === currentTitleNorm) return false;
    }

    return true;
  }

  function shuffleArray(arr) {
    const clone = arr.slice();
    for (let i = clone.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [clone[i], clone[j]] = [clone[j], clone[i]];
    }
    return clone;
  }

  function sortItemsByRules(items, sortRules) {
    const list = items.slice();
    const rules = Array.isArray(sortRules) ? sortRules : [];

    if (!rules.length) return list;

    const hasRandom = rules.some(rule => rule?.type === 'random');
    if (hasRandom) return shuffleArray(list);

    list.sort((a, b) => {
      for (const rule of rules) {
        const type = rule?.type;
        const direction = String(rule?.direction || 'asc').toLowerCase() === 'desc' ? -1 : 1;

        if (type === 'score') {
          const av = Number(a._score || 0);
          const bv = Number(b._score || 0);
          if (av !== bv) return (av - bv) * direction;
        }

        if (type === 'date') {
          const av = Number(a.timestamp || 0);
          const bv = Number(b.timestamp || 0);
          if (av !== bv) return (av - bv) * direction;
        }

        if (type === 'title') {
          const av = normalize(a.title || '');
          const bv = normalize(b.title || '');
          if (av !== bv) return av.localeCompare(bv) * direction;
        }

        if (type === 'collection') {
          const av = Number(a.displayIndex ?? 999999);
          const bv = Number(b.displayIndex ?? 999999);
          if (av !== bv) return (av - bv) * direction;
        }
      }

      return 0;
    });

    return list;
  }

  function applyFallbackFill(selectedItems, allItems, currentItem, selection, CFG) {
    const fallback = selection?.fallback || {};
    const limit = Number(selection?.limit || selectedItems.length || 0);

    if (!fallback.enabled || !fallback.fillToLimit || !limit) {
      return selectedItems.slice(0, limit || selectedItems.length);
    }

    if (selectedItems.length >= limit) {
      return selectedItems.slice(0, limit);
    }

    const usedUrls = new Set(selectedItems.map(item => String(item.fullUrl || '')));
    const constraints = selection?.constraints || {};

    let pool = allItems
      .filter(item => passesConstraints(item, currentItem, { constraints }))
      .map(item => mapItemForRender(item, CFG))
      .filter(item => {
        const itemUrl = String(item.fullUrl || '');
        if (!itemUrl) return false;
        if (usedUrls.has(itemUrl)) return false;
        return true;
      });

    pool = uniqBy(pool, item => String(item.fullUrl || item.title || ''));
    pool = sortItemsByRules(pool, fallback.sort || [{ type: 'random' }]);

    const result = selectedItems.slice();

    for (const item of pool) {
      if (result.length >= limit) break;
      result.push({
        ...item,
        _score: 0,
        _isFallback: true
      });
    }

    return result.slice(0, limit);
  }

  async function fetchCollectionItemsFromPath(path, maxPages, jsonFormatSuffix, cacheOptions) {
    const suffix = jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX;
    const cacheKey = getCollectionCacheKey(path, maxPages, suffix);
    const options = cacheOptions || {};
    const useMemoryCache = options.useMemoryCache !== false;
    const useSessionCache = options.useSessionCache === true;

    if (useMemoryCache && COLLECTION_RELATED_BLOCK_COLLECTION_CACHE.has(cacheKey)) {
      return COLLECTION_RELATED_BLOCK_COLLECTION_CACHE.get(cacheKey);
    }

    if (useSessionCache) {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            if (useMemoryCache) {
              COLLECTION_RELATED_BLOCK_COLLECTION_CACHE.set(cacheKey, parsed);
            }
            return parsed;
          }
        }
      } catch (e) {}
    }

    let url = path + suffix;
    const items = [];

    function ensureJsonFormat(nextUrl) {
      const raw = String(nextUrl || '');
      if (!raw) return raw;
      if (raw.includes('format=json')) return raw;
      return raw.includes('?') ? raw + '&format=json' : raw + '?format=json';
    }

    for (let page = 0; page < (maxPages || 5); page++) {
      const res = await fetch(url, { credentials: 'same-origin' });
      if (!res.ok) break;

      const data = await res.json();
      const batch = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.itemList)
          ? data.itemList
          : [];

      items.push(...batch);

      const next = data?.pagination?.nextPageUrl || null;
      if (!next) break;

      url = ensureJsonFormat(next);
    }

    if (useMemoryCache) {
      COLLECTION_RELATED_BLOCK_COLLECTION_CACHE.set(cacheKey, items);
    }

    if (useSessionCache) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(items));
      } catch (e) {}
    }

    return items;
  }

  async function fetchCollectionItems(CFG) {
    return fetchCollectionItemsFromPath(
      CFG.sourceCollection.path,
      CFG.performance?.maxPages || 5,
      CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
      getCollectionCacheOptions(CFG)
    );
  }

  async function fetchCurrentItemCollectionItems(CFG) {
    const currentSourcePath = CFG.currentItem?.sourceCollection?.path || CFG.sourceCollection?.path;
    const currentSourceSuffix =
      CFG.currentItem?.sourceCollection?.jsonFormatSuffix ||
      CFG.sourceCollection?.jsonFormatSuffix ||
      DEFAULT_JSON_FORMAT_SUFFIX;

    return fetchCollectionItemsFromPath(
      currentSourcePath,
      CFG.performance?.maxPages || 5,
      currentSourceSuffix,
      getCollectionCacheOptions(CFG)
    );
  }

  function findCurrentItem(items, CFG) {
    const pathname = getCurrentPathname();
    const override = CFG.currentItem?.overrideForDev || null;

    if (
      override &&
      override.enabled &&
      (!override.bodyId || document.body.id === override.bodyId)
    ) {
      return {
        id: override.bodyId || null,
        title: cleanText(override.title || document.title || 'Draft item'),
        fullUrl: override.fullUrl || pathname,
        urlId: (override.fullUrl || pathname).split('/').filter(Boolean).pop() || '',
        memberName: cleanText(override.memberName || ''),
        tags: Array.isArray(override.tags) ? override.tags.map(cleanText) : [],
        categories: Array.isArray(override.categories) ? override.categories.map(cleanText) : [],
        assetUrl: override.assetUrl || null,
        mediaFocalPoint: override.mediaFocalPoint || null,
        displayIndex: Number(override.displayIndex || 999999),
        workflowState: 1,
        publishOn: Date.now()
      };
    }

    if (CFG.currentItem?.matchBy === 'pathname') {
      return items.find(item => {
        const fullUrl = String(item.fullUrl || '').replace(/\/+$/, '') || '/';
        return fullUrl === pathname;
      }) || null;
    }

    return null;
  }

  function getHeadingText(items, CFG) {
    const count = items.length;
    if (count === 1 && CFG.headingSingular) return CFG.headingSingular;
    return CFG.heading || '';
  }

  function buildTagPrefixField(item, fieldConfig) {
    if (!fieldConfig || !fieldConfig.prefix) return null;

    let values = getTagValuesByPrefix(item, fieldConfig.prefix);
    if (!values.length) return null;

    if (fieldConfig.maxItems) {
      values = values.slice(0, Number(fieldConfig.maxItems));
    }

    const el = document.createElement('div');
    el.className = fieldConfig.className || 'collection-related-block__tag-prefix';

    const label = cleanText(fieldConfig.label || '');
    const joinWith = fieldConfig.joinWith || ', ';
    const text = values.join(joinWith);

    el.textContent = label ? (label + ' ' + text) : text;

    return el;
  }

  function buildMetaElement(item) {
    const cats = Array.isArray(item.categories) ? item.categories.filter(Boolean) : [];
    if (!cats.length) return null;

    const meta = document.createElement('div');
    meta.className = 'collection-related-block__meta';

    cats.forEach(cat => {
      const span = document.createElement('span');
      span.className = 'collection-related-block__category';
      span.textContent = cleanText(cat);
      meta.appendChild(span);
    });

    return meta;
  }

  function buildTitleElement(item) {
    const title = document.createElement('div');
    title.className = 'collection-related-block__title';
    title.textContent = cleanText(item.title || '');
    return title;
  }

  function buildExcerptElement(item) {
    if (!item.excerpt) return null;

    const excerpt = document.createElement('div');
    excerpt.className = 'collection-related-block__excerpt';
    excerpt.textContent = cleanText(item.excerpt);
    return excerpt;
  }

  function buildLocationElement(item) {
    if (!item.locationText) return null;

    const location = document.createElement('div');
    location.className = 'collection-related-block__location';
    location.textContent = cleanText(item.locationText);
    return location;
  }

  function buildTagPrefixElements(item, CFG, filterPrefixes) {
    let fields = Array.isArray(CFG.display?.tagPrefixFields)
      ? CFG.display.tagPrefixFields
      : [];

    if (Array.isArray(filterPrefixes) && filterPrefixes.length) {
      const prefixSet = new Set(
        filterPrefixes.map(prefix => normalize(String(prefix).replace(/:$/, '')))
      );

      fields = fields.filter(fieldConfig => {
        const fieldPrefix = normalize(String(fieldConfig?.prefix || '').replace(/:$/, ''));
        return prefixSet.has(fieldPrefix);
      });
    }

    return fields
      .map(fieldConfig => buildTagPrefixField(item, fieldConfig))
      .filter(Boolean);
  }

  function buildImageElement(item, CFG) {
    if (!CFG.display?.showImage || !item.assetUrl) return null;

    const media = document.createElement('div');
    media.className = 'collection-related-block__image';

    const img = document.createElement('img');
    img.src = item.assetUrl;
    img.alt = cleanText(item.title || '');
    img.loading = 'lazy';
    img.decoding = 'async';

    img.style.objectPosition =
      item.mediaFocalPoint &&
      typeof item.mediaFocalPoint.x === 'number' &&
      typeof item.mediaFocalPoint.y === 'number'
        ? Math.round(item.mediaFocalPoint.x * 100) + '% ' +
          Math.round(item.mediaFocalPoint.y * 100) + '%'
        : '50% 50%';

    media.appendChild(img);
    return media;
  }

  function buildContentNodesByType(definition, item, CFG) {
    const descriptor = typeof definition === 'string'
      ? { type: definition }
      : (definition || {});

    const type = descriptor.type;

    if (type === 'image') {
      const imageEl = buildImageElement(item, CFG);
      return imageEl ? [imageEl] : [];
    }

    if (type === 'meta' && CFG.display?.showCategories) {
      const metaEl = buildMetaElement(item);
      return metaEl ? [metaEl] : [];
    }

    if (type === 'title' && CFG.display?.showTitle) {
      return [buildTitleElement(item)];
    }

    if (type === 'excerpt' && CFG.display?.showExcerpt) {
      const excerptEl = buildExcerptElement(item);
      return excerptEl ? [excerptEl] : [];
    }

    if (type === 'location' && CFG.display?.showLocation) {
      const locationEl = buildLocationElement(item);
      return locationEl ? [locationEl] : [];
    }

    if (type === 'tagPrefix') {
      const filterPrefixes = Array.isArray(descriptor.prefixes)
        ? descriptor.prefixes
        : descriptor.prefix
          ? [descriptor.prefix]
          : null;

      return buildTagPrefixElements(item, CFG, filterPrefixes);
    }

    return [];
  }

  function buildGroupedContent(item, CFG) {
    const groups = Array.isArray(CFG.display?.groups) ? CFG.display.groups : [];
    if (!groups.length) return null;

    const fragment = document.createDocumentFragment();
    let hasContent = false;

    groups.forEach(group => {
      const children = Array.isArray(group?.children) ? group.children : [];
      if (!children.length) return;

      const tagName = group?.tag || 'div';
      const wrapper = document.createElement(tagName);

      const classNames = String(group?.className || '')
        .split(/\s+/)
        .map(s => s.trim())
        .filter(Boolean);

      classNames.forEach(cls => wrapper.classList.add(cls));

      children.forEach(child => {
        const nodes = buildContentNodesByType(child, item, CFG);
        nodes.forEach(node => wrapper.appendChild(node));
      });

      if (wrapper.childNodes.length) {
        fragment.appendChild(wrapper);
        hasContent = true;
      }
    });

    return hasContent ? fragment : null;
  }

  function createLoader() {
    const loader = document.createElement('div');
    loader.className = 'collection-related-block__loader';
    loader.setAttribute('aria-hidden', 'true');

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement('span');
      dot.className = 'collection-related-block__loader-dot';
      loader.appendChild(dot);
    }

    return loader;
  }

  function buildHeadingCta(CFG) {
    const cta = CFG.headingCta || {};
    const text = cleanText(cta.text || '');
    const href = String(cta.href || '').trim();

    if (!text || !href) return null;

    const link = document.createElement('a');
    link.className = 'collection-related-block__heading-cta';
    link.href = href;

    if (cta.newTab) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }

    const textEl = document.createElement('span');
    textEl.className = 'collection-related-block__heading-cta-text';
    textEl.textContent = text;
    link.appendChild(textEl);

    const icon = String(cta.icon || '');
    const iconType = String(cta.iconType || 'text').toLowerCase();

    if (icon) {
      const iconEl = document.createElement('span');
      iconEl.className = 'collection-related-block__heading-cta-icon';

      if (iconType === 'html') {
        iconEl.innerHTML = icon;
      } else {
        iconEl.textContent = icon;
      }

      link.appendChild(iconEl);
    }

    return link;
  }

  function buildHeadingElement(items, CFG, forceHeading) {
    const headingText = forceHeading
      ? (CFG.heading || CFG.headingSingular || '')
      : getHeadingText(items, CFG);

    const headingCta = buildHeadingCta(CFG);

    if (!headingText && !headingCta) return null;

    const heading = document.createElement('div');
    heading.className = 'collection-related-block__heading';

    if (headingText) {
      const tag = document.createElement(CFG.headingTag || 'h3');
      tag.className = 'collection-related-block__heading-text';
      tag.textContent = headingText;
      heading.appendChild(tag);
    }

    if (headingCta) {
      heading.appendChild(headingCta);
    }

    return heading;
  }

  function applyStateClasses(section) {
    section.classList.remove(
      'collection-related-block--has-heading',
      'collection-related-block--has-image',
      'collection-related-block--has-title',
      'collection-related-block--has-meta',
      'collection-related-block--has-excerpt',
      'collection-related-block--has-location',
      'collection-related-block--has-tag-prefix',
      'collection-related-block--has-heading-cta',
      'collection-related-block--single-item',
      'collection-related-block--multiple-items',
      'collection-related-block--is-empty'
    );

    if (section.querySelector('.collection-related-block__heading')) {
      section.classList.add('collection-related-block--has-heading');
    }

    if (section.querySelector('.collection-related-block__heading-cta')) {
      section.classList.add('collection-related-block--has-heading-cta');
    }

    if (section.querySelector('.collection-related-block__image')) {
      section.classList.add('collection-related-block--has-image');
    }

    if (section.querySelector('.collection-related-block__title')) {
      section.classList.add('collection-related-block--has-title');
    }

    if (section.querySelector('.collection-related-block__meta')) {
      section.classList.add('collection-related-block--has-meta');
    }

    if (section.querySelector('.collection-related-block__excerpt')) {
      section.classList.add('collection-related-block--has-excerpt');
    }

    if (section.querySelector('.collection-related-block__location')) {
      section.classList.add('collection-related-block--has-location');
    }

    if (section.querySelector('.collection-related-block__tag-prefix')) {
      section.classList.add('collection-related-block--has-tag-prefix');
    }

    const items = section.querySelectorAll('.collection-related-block__item');

    if (items.length === 1) {
      section.classList.add('collection-related-block--single-item');
    }

    if (items.length > 1) {
      section.classList.add('collection-related-block--multiple-items');
    }
  }

  function buildBlockShell(CFG) {
    const section = document.createElement('section');
    section.className = 'collection-related-block collection-related-block--is-loading';
    section.dataset.relatedKey = CFG.key;

    const extraClasses = String(CFG.classes?.block || '')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    extraClasses.forEach(cls => section.classList.add(cls));

    const inner = document.createElement('div');
    inner.className = 'collection-related-block__inner';

    if (!CFG.loading?.hideLoader) {
      inner.appendChild(createLoader());
    }

    section.appendChild(inner);
    applyStateClasses(section);

    return section;
  }

  function buildCard(item, CFG, extraClasses) {
    const card = document.createElement('a');
    card.className = 'collection-related-block__item';
    card.href = item.fullUrl || (CFG.sourceCollection.path + '/' + item.urlId);

    extraClasses.forEach(cls => card.classList.add(cls + '__item'));

    const hasGroups = Array.isArray(CFG.display?.groups) && CFG.display.groups.length > 0;

    if (hasGroups) {
      const groupedContent = buildGroupedContent(item, CFG);
      if (groupedContent) {
        card.appendChild(groupedContent);
      }
      return card;
    }

    if (CFG.display?.showImage && item.assetUrl) {
      const media = buildImageElement(item, CFG);
      if (media) card.appendChild(media);
    }

    const content = document.createElement('div');
    content.className = 'collection-related-block__content';

    const order = Array.isArray(CFG.display?.order)
      ? CFG.display.order
      : ['meta', 'title', 'excerpt', 'location'];

    order.forEach(type => {
      buildContentNodesByType(type, item, CFG).forEach(node => {
        if (node.classList && node.classList.contains('collection-related-block__image')) return;
        content.appendChild(node);
      });
    });

    card.appendChild(content);

    return card;
  }

  function replaceBlockContent(section, items, CFG) {
    const inner = section.querySelector('.collection-related-block__inner');
    if (!inner) return;

    inner.innerHTML = '';

    const heading = buildHeadingElement(items, CFG, false);
    if (heading) {
      inner.appendChild(heading);
    }

    const list = document.createElement('div');
    list.className = 'collection-related-block__list';

    const extraClasses = String(CFG.classes?.block || '')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    items.forEach(item => {
      const card = buildCard(item, CFG, extraClasses);
      list.appendChild(card);
    });

    inner.appendChild(list);
    section.classList.remove('collection-related-block--is-loading');
    applyStateClasses(section);
  }

  function replaceBlockWithEmptyState(section, CFG) {
    const inner = section.querySelector('.collection-related-block__inner');
    if (!inner) return;

    inner.innerHTML = '';

    const heading = buildHeadingElement([], CFG, true);
    if (heading) {
      inner.appendChild(heading);
    }

    const message = cleanText(CFG.emptyState?.message || '');
    if (message) {
      const empty = document.createElement('div');
      empty.className = 'collection-related-block__empty';
      empty.textContent = message;
      inner.appendChild(empty);
    }

    section.classList.remove('collection-related-block--is-loading');
    section.classList.add('collection-related-block--is-empty');

    applyStateClasses(section);
  }

  function buildBlock(items, CFG) {
    const section = document.createElement('section');
    section.className = 'collection-related-block';
    section.dataset.relatedKey = CFG.key;

    const extraClasses = String(CFG.classes?.block || '')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    extraClasses.forEach(cls => section.classList.add(cls));

    const inner = document.createElement('div');
    inner.className = 'collection-related-block__inner';

    const heading = buildHeadingElement(items, CFG, false);
    if (heading) {
      inner.appendChild(heading);
    }

    const list = document.createElement('div');
    list.className = 'collection-related-block__list';

    items.forEach(item => {
      const card = buildCard(item, CFG, extraClasses);
      list.appendChild(card);
    });

    inner.appendChild(list);
    section.appendChild(inner);

    applyStateClasses(section);

    return section;
  }

  function buildPreloadQueue() {
    const queue = [];

    CONFIGS.forEach(CFG => {
      if (!CFG || CFG.enabled === false) return;
      if (!matchesDevGuard(CFG)) return;
      if (!CFG.requiredBodyClasses.every(cls => document.body.classList.contains(cls))) return;
      if (CFG.preload?.enabled !== true) return;

      const maxPages = CFG.preload?.maxPages || CFG.performance?.maxPages || 5;

      const explicitCollections = Array.isArray(CFG.preload?.collections)
        ? CFG.preload.collections
        : [];

      explicitCollections.forEach(collectionConfig => {
        const path = collectionConfig?.path;
        if (!path) return;

        queue.push({
          path,
          maxPages: collectionConfig?.maxPages || maxPages,
          jsonFormatSuffix: collectionConfig?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
          cacheOptions: getCollectionCacheOptions(CFG)
        });
      });

      if (CFG.preload?.includeSourceCollection !== false && CFG.sourceCollection?.path) {
        queue.push({
          path: CFG.sourceCollection.path,
          maxPages,
          jsonFormatSuffix: CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX,
          cacheOptions: getCollectionCacheOptions(CFG)
        });
      }

      if (CFG.preload?.includeCurrentItemSource === true) {
        const currentPath = CFG.currentItem?.sourceCollection?.path;
        const currentSuffix =
          CFG.currentItem?.sourceCollection?.jsonFormatSuffix ||
          DEFAULT_JSON_FORMAT_SUFFIX;

        if (currentPath) {
          queue.push({
            path: currentPath,
            maxPages,
            jsonFormatSuffix: currentSuffix,
            cacheOptions: getCollectionCacheOptions(CFG)
          });
        }
      }
    });

    return uniqBy(
      queue.filter(item => item.path),
      item => [item.path, item.maxPages, item.jsonFormatSuffix].join('::')
    );
  }

  function runPreloadQueue() {
    const queue = buildPreloadQueue();
    if (!queue.length) return;

    const runner = async () => {
      for (const item of queue) {
        try {
          await fetchCollectionItemsFromPath(
            item.path,
            item.maxPages,
            item.jsonFormatSuffix,
            item.cacheOptions
          );
        } catch (e) {}
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(runner, { timeout: 1500 });
    } else {
      setTimeout(runner, 300);
    }
  }

  function createRunner(CFG) {
    CFG = Object.assign(
      {
        enabled: true,
        key: 'related-block',
        devGuard: { enabled: false },
        requiredBodyClasses: [],
        sourceCollection: { path: '' },
        currentItem: {
          matchBy: 'pathname',
          sourceCollection: null
        },
        insertion: { targetSelector: '', mode: 'append' },
        heading: '',
        headingSingular: '',
        headingTag: 'h3',
        headingCta: {
          text: '',
          href: '',
          icon: '',
          iconType: 'text',
          newTab: false
        },
        classes: { block: '' },
        display: {
          maxItems: 4,
          showImage: true,
          showTitle: true,
          showCategories: true,
          showExcerpt: false,
          showLocation: false,
          order: ['meta', 'title', 'excerpt', 'location'],
          tagPrefixFields: [],
          groups: []
        },
        loading: {
          hideLoader: false
        },
        emptyState: {
          message: ''
        },
        preload: {
          enabled: false,
          includeSourceCollection: true,
          includeCurrentItemSource: false,
          collections: [],
          maxPages: null
        },
        selection: {
          constraints: {
            requirePublished: true,
            requireImage: true,
            excludeCurrentItem: false
          },
          match: { groups: [] },
          score: {
            enabled: false,
            rules: [],
            minScore: 0
          },
          sort: [{ type: 'date', direction: 'desc' }],
          limit: 4,
          fallback: {
            enabled: false,
            fillToLimit: false,
            sort: [{ type: 'random' }]
          }
        },
        performance: {
          useSessionStorage: true,
          maxPages: 5,
          useCollectionMemoryCache: true,
          useCollectionSessionCache: false
        }
      },
      CFG || {}
    );

    if (CFG.enabled === false) return null;
    if (!matchesDevGuard(CFG)) return null;
    if (!CFG.requiredBodyClasses.every(cls => document.body.classList.contains(cls))) return null;

    let observer = null;

    async function apply() {
      const target = getInsertTarget(CFG.insertion?.targetSelector);
      if (!target) return false;

      if (alreadyInjected(target, CFG.key)) return true;

      const key = cacheKey(CFG);
      let shell = null;

      if (CFG.performance?.useSessionStorage) {
        try {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length) {
              insertInto(target, buildBlock(parsed, CFG), CFG.insertion?.mode);
              return true;
            }
          }
        } catch (e) {}
      }

      shell = buildBlockShell(CFG);
      insertInto(target, shell, CFG.insertion?.mode);

      let items;
      try {
        items = await fetchCollectionItems(CFG);
      } catch (e) {
        shell.remove();
        return false;
      }

      if (!Array.isArray(items) || !items.length) {
        shell.remove();
        return false;
      }

      let currentItemSourceItems = items;
      const currentItemSourcePath = CFG.currentItem?.sourceCollection?.path || CFG.sourceCollection?.path;
      const resultsSourcePath = CFG.sourceCollection?.path || '';

      if (currentItemSourcePath !== resultsSourcePath) {
        try {
          currentItemSourceItems = await fetchCurrentItemCollectionItems(CFG);
        } catch (e) {
          shell.remove();
          return false;
        }
      }

      if (!Array.isArray(currentItemSourceItems) || !currentItemSourceItems.length) {
        shell.remove();
        return false;
      }

      const currentItem = findCurrentItem(currentItemSourceItems, CFG);
      if (!currentItem) {
        shell.remove();
        return false;
      }

      const candidates = [];

      items.forEach(item => {
        if (!item) return;
        if (!passesConstraints(item, currentItem, CFG.selection)) return;
        if (!evaluateMatchGroups(item, currentItem, CFG.selection, { allItems: items })) return;

        const score = computeCandidateScore(item, currentItem, CFG.selection);
        const minScore = Number(CFG.selection?.score?.minScore || 0);

        if (CFG.selection?.score?.enabled && score < minScore) return;

        candidates.push({
          ...mapItemForRender(item, CFG),
          _score: score
        });
      });

      let finalItems = sortItemsByRules(candidates, CFG.selection?.sort || []);
      finalItems = uniqBy(finalItems, item => String(item.fullUrl || item.title || ''));

      const limit = Number(CFG.selection?.limit || CFG.display?.maxItems || finalItems.length);
      if (limit > 0) {
        finalItems = finalItems.slice(0, limit);
      }

      finalItems = applyFallbackFill(finalItems, items, currentItem, {
        ...CFG.selection,
        limit: limit
      }, CFG);

      if (!finalItems.length) {
        if (CFG.emptyState?.message) {
          replaceBlockWithEmptyState(shell, CFG);
          if (CFG.performance?.useSessionStorage) {
            try {
              sessionStorage.setItem(key, JSON.stringify([]));
            } catch (e) {}
          }
          return true;
        }

        shell.remove();
        if (CFG.performance?.useSessionStorage) {
          try {
            sessionStorage.setItem(key, JSON.stringify([]));
          } catch (e) {}
        }
        return false;
      }

      replaceBlockContent(shell, finalItems, CFG);

      if (CFG.performance?.useSessionStorage) {
        try {
          sessionStorage.setItem(key, JSON.stringify(finalItems));
        } catch (e) {}
      }

      return true;
    }

    async function start() {
      const ok = await apply();
      if (ok) return;

      observer = new MutationObserver(async () => {
        const target = getInsertTarget(CFG.insertion?.targetSelector);
        if (!target) return;

        if (alreadyInjected(target, CFG.key)) {
          if (observer) observer.disconnect();
          return;
        }

        const injected = await apply();
        if (injected && observer) observer.disconnect();
      });

      observer.observe(document.documentElement, {
        childList: true,
        subtree: true
      });
    }

    return { start };
  }

  const runners = CONFIGS.map(createRunner).filter(Boolean);
  if (!runners.length) return;

  async function startSequentially() {
    for (const runner of runners) {
      await runner.start();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      startSequentially();
      runPreloadQueue();
    }, { once: true });
  } else {
    startSequentially();
    runPreloadQueue();
  }

  document.addEventListener('turbolinks:load', function () {
    startSequentially();
    runPreloadQueue();
  });
})();
