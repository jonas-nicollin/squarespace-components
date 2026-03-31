/* Collection Related Blocks */
(function () {
  'use strict';

  const CONFIGS = Array.isArray(window.COLLECTION_RELATED_BLOCK_CONFIGS)
    ? window.COLLECTION_RELATED_BLOCK_CONFIGS
    : [];

  if (!CONFIGS.length) return;

  const DEFAULT_JSON_FORMAT_SUFFIX = '?format=json';

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

  function mapItemForRender(item) {
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

  function ruleMatchesCandidate(rule, candidateItem, currentItem) {
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

    return false;
  }

  function evaluateMatchGroups(candidateItem, currentItem, selection) {
    const groups = Array.isArray(selection?.match?.groups) ? selection.match.groups : [];
    if (!groups.length) return true;

    return groups.some(group => {
      const rules = Array.isArray(group.rules) ? group.rules : [];
      if (!rules.length) return false;

      const logic = String(group.logic || 'or').toLowerCase();

      if (logic === 'and') {
        return rules.every(rule => ruleMatchesCandidate(rule, candidateItem, currentItem));
      }

      return rules.some(rule => ruleMatchesCandidate(rule, candidateItem, currentItem));
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

  function applyFallbackFill(selectedItems, allItems, currentItem, selection) {
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
      .map(mapItemForRender)
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

  async function fetchCollectionItems(CFG) {
    const suffix = CFG.sourceCollection?.jsonFormatSuffix || DEFAULT_JSON_FORMAT_SUFFIX;
    let url = CFG.sourceCollection.path + suffix;
    const items = [];

    function ensureJsonFormat(nextUrl) {
      const raw = String(nextUrl || '');
      if (!raw) return raw;
      if (raw.includes('format=json')) return raw;
      return raw.includes('?') ? raw + '&format=json' : raw + '?format=json';
    }

    for (let page = 0; page < (CFG.performance?.maxPages || 5); page++) {
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

    return items;
  }

  function findCurrentItem(items, CFG) {
    const pathname = getCurrentPathname();
    const override = CFG.currentItem?.overrideForDev || null;

    if (
      override &&
      override.enabled &&
      override.bodyId &&
      document.body.id === override.bodyId
    ) {
      return {
        id: override.bodyId,
        title: cleanText(override.title || document.title || 'Draft item'),
        fullUrl: override.fullUrl || pathname,
        urlId: (override.fullUrl || pathname).split('/').filter(Boolean).pop() || '',
        memberName: cleanText(override.memberName || ''),
        tags: Array.isArray(override.tags) ? override.tags.map(cleanText) : [],
        categories: Array.isArray(override.categories) ? override.categories.map(cleanText) : [],
        assetUrl: override.assetUrl || null,
        mediaFocalPoint: override.mediaFocalPoint || null,
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

  function buildBlock(items, CFG) {
    const section = document.createElement('section');
    section.className = 'collection-related-block';
    section.dataset.relatedKey = CFG.key;

    const extraClasses = String(CFG.classes?.block || '')
      .split(/\s+/)
      .map(s => s.trim())
      .filter(Boolean);

    extraClasses.forEach(cls => section.classList.add(cls));

    const tag = CFG.headingTag || 'h3';
    const heading = document.createElement(tag);
    heading.className = 'collection-related-block__heading';
    heading.textContent = getHeadingText(items, CFG);
    section.appendChild(heading);

    const list = document.createElement('div');
    list.className = 'collection-related-block__list';

    items.forEach(item => {
      const card = document.createElement('a');
      card.className = 'collection-related-block__item';
      card.href = item.fullUrl || (CFG.sourceCollection.path + '/' + item.urlId);

      extraClasses.forEach(cls => card.classList.add(cls + '__item'));

      if (CFG.display?.showImage && item.assetUrl) {
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
        card.appendChild(media);
      }

      const content = document.createElement('div');
      content.className = 'collection-related-block__content';

      const order = Array.isArray(CFG.display?.order)
        ? CFG.display.order
        : ['meta', 'title', 'excerpt', 'location'];

      order.forEach(type => {
        if (type === 'meta' && CFG.display?.showCategories) {
          const cats = Array.isArray(item.categories) ? item.categories.filter(Boolean) : [];
          if (cats.length) {
            const meta = document.createElement('div');
            meta.className = 'collection-related-block__meta';

            cats.forEach(cat => {
              const span = document.createElement('span');
              span.className = 'collection-related-block__category';
              span.textContent = cleanText(cat);
              meta.appendChild(span);
            });

            content.appendChild(meta);
          }
        }

        if (type === 'title' && CFG.display?.showTitle) {
          const title = document.createElement('div');
          title.className = 'collection-related-block__title';
          title.textContent = cleanText(item.title || '');
          content.appendChild(title);
        }

        if (type === 'excerpt' && CFG.display?.showExcerpt && item.excerpt) {
          const excerpt = document.createElement('div');
          excerpt.className = 'collection-related-block__excerpt';
          excerpt.textContent = cleanText(item.excerpt);
          content.appendChild(excerpt);
        }

        if (type === 'location' && CFG.display?.showLocation && item.locationText) {
          const location = document.createElement('div');
          location.className = 'collection-related-block__location';
          location.textContent = cleanText(item.locationText);
          content.appendChild(location);
        }
      });

      card.appendChild(content);
      list.appendChild(card);
    });

    section.appendChild(list);
    
    applyStateClasses(section);
    
    return section;
  }

function applyStateClasses(section) {
  if (section.querySelector('.collection-related-block__heading')) {
    section.classList.add('collection-related-block--has-heading');
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
}
  
  function createRunner(CFG) {
    CFG = Object.assign(
      {
        enabled: true,
        key: 'related-block',
        devGuard: { enabled: false },
        requiredBodyClasses: [],
        sourceCollection: { path: '' },
        currentItem: { matchBy: 'pathname' },
        insertion: { targetSelector: '', mode: 'append' },
        heading: '',
        headingSingular: '',
        headingTag: 'h3',
        classes: { block: '' },
        display: {
          maxItems: 4,
          showImage: true,
          showTitle: true,
          showCategories: true,
          showExcerpt: false,
          showLocation: false,
          order: ['meta', 'title', 'excerpt', 'location']
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
          maxPages: 5
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

      if (CFG.performance?.useSessionStorage) {
        try {
          const cached = sessionStorage.getItem(key);
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length) {
              insertInto(target, buildBlock(parsed, CFG), CFG.insertion?.mode);
              return true;
            }
            return false;
          }
        } catch (e) {}
      }

      let items;
      try {
        items = await fetchCollectionItems(CFG);
      } catch (e) {
        return false;
      }

      if (!Array.isArray(items) || !items.length) return false;

      const currentItem = findCurrentItem(items, CFG);
      if (!currentItem) return false;

      const candidates = [];

      items.forEach(item => {
        if (!item) return;
        if (!passesConstraints(item, currentItem, CFG.selection)) return;
        if (!evaluateMatchGroups(item, currentItem, CFG.selection)) return;

        const score = computeCandidateScore(item, currentItem, CFG.selection);
        const minScore = Number(CFG.selection?.score?.minScore || 0);

        if (CFG.selection?.score?.enabled && score < minScore) return;

        candidates.push({
          ...mapItemForRender(item),
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
      });

      if (!finalItems.length) {
        if (CFG.performance?.useSessionStorage) {
          try {
            sessionStorage.setItem(key, JSON.stringify([]));
          } catch (e) {}
        }
        return false;
      }

      insertInto(target, buildBlock(finalItems, CFG), CFG.insertion?.mode);

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
    document.addEventListener('DOMContentLoaded', startSequentially, { once: true });
  } else {
    startSequentially();
  }

  document.addEventListener('turbolinks:load', startSequentially);
})();
