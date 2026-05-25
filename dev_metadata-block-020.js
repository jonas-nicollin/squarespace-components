(function () {
  'use strict';

  const SETTINGS_LIST = Array.isArray(window.metadataBlocksSettingsList)
    ? window.metadataBlocksSettingsList
    : Array.isArray(window.metadataPluginSettingsList)
      ? window.metadataPluginSettingsList
      : [];

  if (!SETTINGS_LIST.length) return;

  const JSON_FORMAT_SUFFIX = '?format=json';
  let MB_IS_STARTING = false;
  let MB_LAST_RUN_PATH = '';

  /* ════════════════════════════════════
   * UTILITAIRES TEXTE
   * ════════════════════════════════════ */

  function cleanText(str) {
    const txt = document.createElement('textarea');
    txt.innerHTML = String(str || '');
    return txt.value
      .replace(/&nbsp;/gi, ' ')
      .replace(/&#160;/gi, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function trimSlashes(value) {
    return String(value || '').replace(/^\/+|\/+$/g, '');
  }

  function normalizePath(path) {
    return '/' + trimSlashes(path || '');
  }

  function ensureJsonFormat(url) {
    const raw = String(url || '');
    if (!raw) return '';
    if (raw.includes('format=json')) return raw;
    return raw.includes('?') ? raw + '&format=json' : raw + JSON_FORMAT_SUFFIX;
  }

  function getCurrentPath() {
    return normalizePath(window.location.pathname || '/');
  }

  function insertAtPosition(parent, element, position) {
    const safePosition = Number.isFinite(position) ? position : 999;
    const children = parent.children;
    if (!children.length || safePosition > children.length) {
      parent.appendChild(element);
      return;
    }
    if (safePosition <= 1) {
      parent.insertBefore(element, children[0]);
      return;
    }
    parent.insertBefore(element, children[safePosition - 1]);
  }

  function stripPrefixLabel(value) {
    const text = String(value || '').trim();
    const index = text.indexOf(':');
    if (index === -1) return text;
    return text.slice(index + 1).trim();
  }

  function uniq(values) {
    return Array.from(new Set(values));
  }

  function addCustomClasses(element, classes) {
    if (!element || !classes) return;
    String(classes)
      .split(/\s+/)
      .map(cls => cls.trim())
      .filter(Boolean)
      .forEach(cls => element.classList.add(cls));
  }

  function capitalize(s) {
    return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  }

  /* ════════════════════════════════════
   * DATE UTILITIES
   * Alignées avec SQB — même formats, même locale, même TZ
   * ════════════════════════════════════ */

  // Fuseau horaire du site Squarespace (partagé avec SQB)
  const MB_TZ = (function () {
    try {
      const ctx = window.Static && window.Static.SQUARESPACE_CONTEXT;
      return ctx && ctx.websiteTimeZone ? ctx.websiteTimeZone : null;
    } catch (_) {
      return null;
    }
  })();

  /**
   * Parse une date ISO 8601 sans conversion de fuseau horaire.
   * Accepte : 2026-09-19 | 2026-09-19T15:00 | 2026-09-19T15:00:00[Z]
   */
  function parseISO(str) {
    const m = String(str || '').match(
      /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?Z?)?$/
    );
    if (!m) return null;
    const year  = parseInt(m[1], 10);
    const month = parseInt(m[2], 10) - 1;
    const day   = parseInt(m[3], 10);
    const hour  = m[4] != null ? parseInt(m[4], 10) : null;
    const min   = m[5] != null ? parseInt(m[5], 10) : null;
    return {
      year, month, day, hour, min,
      hasTime: hour !== null,
      ts: new Date(year, month, day, hour || 0, min || 0).getTime()
    };
  }

  /**
   * Détecte si une chaîne est une date ISO simple ou un intervalle ISO.
   */
  function isISODate(str) {
    const ISO = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z?)?$/;
    const s   = String(str || '');
    if (ISO.test(s)) return true;
    const parts = s.split('/');
    return parts.length === 2 && ISO.test(parts[0]) && ISO.test(parts[1]);
  }

  /**
   * Formate une valeur de tag ISO en texte lisible.
   * Formats identiques à SQB :
   *   'datetime' | 'date' | 'day' | 'short' | 'numeric' | 'time'
   *   | { ...options Intl }
   *
   * Gère les intervalles : 2026-09-14/2026-09-22 → '14–22 septembre 2026'
   */
  function formatISOTag(str, format, locale) {
    const s   = String(str || '');
    const loc = locale || document.documentElement.lang || 'fr-CH';
    const tzOpt = MB_TZ ? { timeZone: MB_TZ } : {};

    // ── Intervalle ─────────────────────────────────────────────────────────
    if (s.indexOf('/') !== -1) {
      const [raw1, raw2] = s.split('/');
      const d1 = parseISO(raw1);
      const d2 = parseISO(raw2);
      if (d1 && d2) {
        try {
          const dt1 = new Date(d1.year, d1.month, d1.day);
          const dt2 = new Date(d2.year, d2.month, d2.day);
          if (d1.month === d2.month && d1.year === d2.year) {
            const monthName = dt1.toLocaleDateString(loc, { month: 'long' });
            return `${d1.day}\u2013${d2.day}\u00A0${monthName}\u00A0${d1.year}`;
          }
          return (
            dt1.toLocaleDateString(loc, { day: 'numeric', month: 'long' }) +
            '\u00A0\u2013\u00A0' +
            dt2.toLocaleDateString(loc, { day: 'numeric', month: 'long', year: 'numeric' })
          );
        } catch (_) { return s; }
      }
    }

    // ── Date simple ────────────────────────────────────────────────────────
    const d = parseISO(s);
    if (!d) return s;

    const dt = new Date(d.year, d.month, d.day, d.hour || 0, d.min || 0);

    try {
      if (format && typeof format === 'object') {
        return capitalize(dt.toLocaleDateString(loc, format));
      }
      if (format === 'time') {
        if (!d.hasTime) return s;
        return dt.toLocaleTimeString(loc, Object.assign(
          { hour: '2-digit', minute: '2-digit', hour12: false }, tzOpt
        ));
      }
      if (format === 'day') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign(
          { weekday: 'long', day: 'numeric', month: 'long' }, tzOpt
        )));
      }
      if (format === 'short') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign(
          { weekday: 'short', day: 'numeric', month: 'short' }, tzOpt
        )));
      }
      if (format === 'numeric') {
        return dt.toLocaleDateString(loc, Object.assign(
          { day: '2-digit', month: '2-digit', year: 'numeric' }, tzOpt
        ));
      }
      if (format === 'date') {
        return capitalize(dt.toLocaleDateString(loc, Object.assign(
          { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }, tzOpt
        )));
      }
      // 'datetime' (défaut) — jour + heure si disponible
      const dayStr = capitalize(dt.toLocaleDateString(loc, Object.assign(
        { weekday: 'long', day: 'numeric', month: 'long' }, tzOpt
      )));
      if (d.hasTime) {
        const timeStr = dt.toLocaleTimeString(loc, Object.assign(
          { hour: '2-digit', minute: '2-digit', hour12: false }, tzOpt
        ));
        return `${dayStr}, ${timeStr}`;
      }
      return dayStr;
    } catch (_) { return s; }
  }

  /* ════════════════════════════════════
   * FETCH & RÉSOLUTION DES DONNÉES
   * ════════════════════════════════════ */

async function fetchPageJson(settings) {
  const rawUrl = settings.jsonUrl || window.location.pathname;

  /*
   * Si jsonUrl pointe vers une collection, CollectionData peut mutualiser
   * le fetch avec Query / Related / Locator.
   *
   * On retourne un objet { items: [...] } pour garder le reste du script
   * compatible avec resolveCurrentItemData().
   */
  if (
    settings.jsonUrl &&
    window.CollectionData &&
    typeof window.CollectionData.get === 'function'
  ) {
    const items = await window.CollectionData.get(settings.jsonUrl, {
      maxPages: settings.maxPages || settings.performance?.maxPages || 'all',
      ttl: settings.cacheTTL || 900,
      memoryCache: true,
      sessionCache: settings.sessionCache !== false,
      credentials: 'same-origin',
      stripFields: ['body'],
    });

    return { items: Array.isArray(items) ? items : [] };
  }

  /*
   * Fallback original :
   * utile si le script lit directement la page courante,
   * par exemple /programme-2026/mon-post?format=json
   */
  const url = ensureJsonFormat(rawUrl);
  const response = await fetch(url, { credentials: 'same-origin' });

  if (!response.ok) {
    throw new Error('Metadata Blocks: unable to fetch page JSON');
  }

  return response.json();
}
  function resolveCurrentItemData(json) {
    const items = Array.isArray(json?.items) ? json.items : [];
    const currentPath = getCurrentPath();
    if (json?.item) return json.item;
    const byFullUrl = items.find(item => normalizePath(item?.fullUrl) === currentPath);
    if (byFullUrl) return byFullUrl;
    const byUrlId = items.find(item => {
      const urlId = trimSlashes(item?.urlId || '');
      return urlId && currentPath.endsWith('/' + urlId);
    });
    if (byUrlId) return byUrlId;
    return null;
  }

  /* ════════════════════════════════════
   * DOM — MONTAGE DU CONTAINER
   * ════════════════════════════════════ */

  function prepareMetadataBlocksMount(settings) {
    const buildAutomatically = settings.buildAutomatically ?? true;
    const fallbackTarget = document.querySelector('.blog-item-top-wrapper');
    const explicitTarget = settings.moveToDestination
      ? document.querySelector(settings.moveToDestination)
      : null;
    const finalTarget = explicitTarget || fallbackTarget;
    if (!finalTarget) return null;

    let wrapper = finalTarget.querySelector(':scope > .metadata-blocks-wrapper');
    if (!wrapper && buildAutomatically) {
      wrapper = document.createElement('div');
      wrapper.className = 'metadata-blocks-wrapper';
      const container = document.createElement('div');
      container.className = 'metadata-blocks';
      if (settings.customClass) addCustomClasses(container, settings.customClass);
      wrapper.appendChild(container);
      insertAtPosition(
        finalTarget,
        wrapper,
        parseInt(settings.moveToDestinationPosition || '999', 10)
      );
    }

    const container = wrapper?.querySelector('.metadata-blocks');
    if (!container) return null;
    container.innerHTML = '';
    container.className = 'metadata-blocks';
    if (settings.customClass) addCustomClasses(container, settings.customClass);
    return { wrapper, container };
  }

  /* ════════════════════════════════════
   * LOGIQUE DES BLOCS
   * ════════════════════════════════════ */

  function getBlockOrderMap(settings) {
    const orderMap = {};
    (settings.blocksOrder || []).forEach((name, index) => {
      orderMap[name] = index + 1;
    });
    return orderMap;
  }

  function getGoogleMapsUrl(itemData) {
    const location = itemData?.location || {};
    const lat = typeof location.markerLat === 'number'
      ? location.markerLat
      : typeof location.mapLat === 'number' ? location.mapLat : null;
    const lng = typeof location.markerLng === 'number'
      ? location.markerLng
      : typeof location.mapLng === 'number' ? location.mapLng : null;
    if (typeof lat !== 'number' || typeof lng !== 'number') return '';
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function getLocationValues(itemData, block) {
    const source = itemData?.location || {};
    const values = [
      source.addressTitle,
      source.addressLine1,
      source.addressLine2,
      source.addressCountry
    ].map(cleanText).filter(Boolean);
    if (values.length) return values;
    if (block.useGoogleMapsLink && getGoogleMapsUrl(itemData)) {
      return [block.googleMapsLabel || 'Voir sur la carte'];
    }
    return [];
  }

  function getExcerptHtml(itemData, block) {
    if (!block.fetchExcerpt) return '';
    return String(itemData?.excerpt || '').trim();
  }

  function getRawValuesForBlock(block, itemData) {
    if (block.isLocation) return getLocationValues(itemData, block);
    if (block.isExcerpt) return [];
    const sourceKey = block.source || 'tags';
    return Array.isArray(itemData?.[sourceKey]) ? [...itemData[sourceKey]] : [];
  }

  function filterBlockValues(values, block) {
    let filtered = values.map(v => String(v || '').trim()).filter(Boolean);
    if (block.allowedCategories?.length) {
      filtered = filtered.filter(value => block.allowedCategories.includes(value));
    }
    if (block.allowedTags?.length) {
      filtered = filtered.filter(value => block.allowedTags.includes(value));
    }
    if (block.allowedCaracter) {
      filtered = filtered.filter(value => value.includes(block.allowedCaracter));
    }
    if (block.allowedPrefixSuffix) {
      filtered = filtered.filter(value =>
        value.startsWith(block.allowedPrefixSuffix) ||
        value.endsWith(block.allowedPrefixSuffix)
      );
    }
    return filtered;
  }

  function sortBlockValues(values, block) {
    const list = [...values];
    const dir  = block.sortOrder === 'desc' ? -1 : 1;
    if (block.sortOrder === 'asc' || block.sortOrder === 'desc') {
      if (block.formatDates) {
        list.sort((a, b) => {
          const pa = parseISO(a.split('/')[0]);
          const pb = parseISO(b.split('/')[0]);
          if (pa && pb) return (pa.ts - pb.ts) * dir;
          return a.localeCompare(b, undefined, { numeric: true }) * dir;
        });
      } else {
        list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }) * dir);
      }
    } else if (block.sortOrder === 'customOrder' && Array.isArray(block.customOrder)) {
      list.sort((a, b) => {
        const ai = block.customOrder.indexOf(a);
        const bi = block.customOrder.indexOf(b);
        return (ai === -1 ? 9999 : ai) - (bi === -1 ? 9999 : bi);
      });
    }
    return list;
  }

  function normalizeBlockValues(values, block) {
    // 1. Filtrer
    let normalized = filterBlockValues(values, block)
      .map(value => cleanText(value))
      .filter(Boolean);

    // 2. Retirer le préfixe (avant formatage — pour que le tri ISO fonctionne sur la valeur brute)
    if (block.allowedPrefixSuffix) {
      normalized = normalized.map(stripPrefixLabel);
    }

    // 3. Déduplication
    normalized = uniq(normalized);

    // 4. Tri (sur valeurs brutes — timestamps corrects pour les dates ISO)
    normalized = sortBlockValues(normalized, block);

    // 5. Formatage des dates
    if (block.formatDates) {
      normalized = normalized.map(value =>
        isISODate(value)
          ? formatISOTag(value, block.dateFormat || 'datetime', block.dateLocale || null)
          : value
      );
    }

    // 6. Limiter le nombre de valeurs
    if (block.maxValues && block.maxValues > 0) {
      normalized = normalized.slice(0, block.maxValues);
    }

    return normalized;
  }

  /* ════════════════════════════════════
   * DOM — CRÉATION DES ÉLÉMENTS
   * ════════════════════════════════════ */

  function getBlockTitle(block, valueCount) {
    if (block.showTitle === false) return null;
    if (block.title === 'hidden') return null;
    const suffix   = block.titleSuffix || '';
    const singular = block.iconTitle ? block.iconTitle : ((block.title || '') + suffix);
    const plural   = block.iconTitle ? block.iconTitle : ((block.titlePlural || block.title || '') + suffix);
    return valueCount > 1 ? plural : singular;
  }

  function createMetadataValueElement(value, inline, options = {}) {
    const tag = inline ? 'span' : 'div';
    const el  = document.createElement(tag);
    el.className = 'metadata-value';
    if (options.href) {
      const link = document.createElement('a');
      link.href = options.href;
      link.textContent = value;
      if (options.target) link.target = options.target;
      if (options.target === '_blank') link.rel = 'noopener noreferrer';
      el.appendChild(link);
    } else {
      el.textContent = value;
    }
    return el;
  }

  function appendValuesToContent(content, values, block, itemData) {
    const mapsUrl = block.isLocation && block.useGoogleMapsLink
      ? getGoogleMapsUrl(itemData) : '';
    values.forEach((value, index) => {
      const element = createMetadataValueElement(
        value,
        block.displayInline,
        { href: mapsUrl || '', target: block.googleMapsTarget || '' }
      );
      if (block.displayInline && index < values.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'metadata-separator';
        separator.textContent = block.inlineSeparator || ',\u00A0';
        element.appendChild(separator);
      }
      content.appendChild(element);
    });
  }

  function createBlockEndSeparator(separatorText) {
    const separator = document.createElement('span');
    separator.className = 'metadata-block-separator';
    separator.setAttribute('aria-hidden', 'true');
    separator.textContent = separatorText;
    return separator;
  }

  function createGroupSeparatorElement(separatorText, inline) {
    const tag = inline ? 'span' : 'div';
    const sep = document.createElement(tag);
    sep.className = 'metadata-group-separator';
    sep.setAttribute('aria-hidden', 'true');
    sep.textContent = separatorText;
    return sep;
  }

  function createMetadataBlockWrapper(block, orderMap, valueCount) {
    const wrapper = document.createElement('div');
    wrapper.className = `metadata-block metadata-block--${block.name}`;
    if (block.displayInline) wrapper.classList.add('display-inline');
    if (block.iconTitle)     wrapper.classList.add('metadata-icon-title');
    if (block.showTitle === false) wrapper.classList.add('metadata-block--title-hidden');

    const order = block.order ?? orderMap[block.name] ?? 99;
    wrapper.style.order = order;

    const blockTitle = getBlockTitle(block, valueCount);
    if (blockTitle) {
      const title = document.createElement('div');
      title.className = 'metadata-title';
      title.textContent = blockTitle;
      wrapper.appendChild(title);
    }
    return wrapper;
  }

  function appendSeparatorsInsideBlocks(container, settings) {
    if (!settings.blockSeparator) return;
    const blocks = Array.from(container.querySelectorAll(':scope > .metadata-block'));
    if (blocks.length < 2) return;
    blocks.forEach((block, index) => {
      const old = block.querySelector(':scope > .metadata-block-separator');
      if (old) old.remove();
      if (index < blocks.length - 1) {
        block.appendChild(createBlockEndSeparator(settings.blockSeparator));
      }
    });
  }

  function applyStateClasses(container, settings) {
    const blocks = container.querySelectorAll('.metadata-block');
    if (blocks.length === 1) container.classList.add('metadata-blocks--single');
    if (blocks.length > 1)  container.classList.add('metadata-blocks--multiple');
    if (container.querySelector('.metadata-excerpt'))  container.classList.add('metadata-blocks--has-excerpt');
    if (container.querySelector('.display-inline'))    container.classList.add('metadata-blocks--has-inline');
    if (settings.blockSeparator) container.classList.add('metadata-blocks--with-block-separator');
  }

  /* ════════════════════════════════════
   * CONSTRUCTION PRINCIPALE
   * ════════════════════════════════════ */

  function buildMetadataBlocks(settings, itemData, container) {
    const orderMap      = getBlockOrderMap(settings);
    const blockWrappers = {};

    const allBlocks = [
      ...(settings.blocks || []),
      ...((settings.excerpt || []).map(block => ({ ...block, isExcerpt: true }))),
      ...(settings.location ? [{ ...settings.location, isLocation: true }] : [])
    ];

    const pendingGroups = [];

    allBlocks.forEach(block => {
      if (block.group) { pendingGroups.push(block); return; }

      const content = document.createElement('div');
      content.className = 'metadata-elements';
      let valueCount = 0;

      if (block.isExcerpt) {
        const excerptHtml = getExcerptHtml(itemData, block);
        if (!excerptHtml) return;
        content.classList.add('metadata-excerpt');
        content.innerHTML = excerptHtml;
        valueCount = 1;
      } else {
        const rawValues = getRawValuesForBlock(block, itemData);
        const values    = normalizeBlockValues(rawValues, block);
        if (!values.length) {
          if (block.hideIfEmpty === false) {
            const wrapper = createMetadataBlockWrapper(block, orderMap, 0);
            wrapper.classList.add('metadata-block--empty');
            wrapper.appendChild(content);
            container.appendChild(wrapper);
            blockWrappers[block.name] = wrapper;
          }
          return;
        }
        valueCount = values.length;
        appendValuesToContent(content, values, block, itemData);
      }

      const wrapper = createMetadataBlockWrapper(block, orderMap, valueCount);
      wrapper.appendChild(content);
      container.appendChild(wrapper);
      blockWrappers[block.name] = wrapper;
    });

    // ── Blocs groupés — greffés sur un bloc parent existant ───────────────
    pendingGroups.forEach(block => {
      const parentWrapper = blockWrappers[block.group];
      const targetContent = parentWrapper?.querySelector('.metadata-elements');
      if (!targetContent) return;

      const rawValues = getRawValuesForBlock(block, itemData);
      const values    = normalizeBlockValues(rawValues, block);
      if (!values.length) return;

      const mapsUrl       = block.useGoogleMapsLink ? getGoogleMapsUrl(itemData) : '';
      const groupSep      = block.groupSeparator ?? ',\u00A0';
      const isInline      = block.displayInline;

      if (block.groupPosition === 'prepend') {
        // Séparateur entre les valeurs greffées et les valeurs existantes
        const existingFirst = targetContent.querySelector('.metadata-value');
        if (existingFirst && groupSep) {
          targetContent.insertBefore(
            createGroupSeparatorElement(groupSep, isInline),
            existingFirst
          );
        }
        // Valeurs en ordre inverse pour que l'insertBefore préserve l'ordre
        [...values].reverse().forEach(value => {
          const element = createMetadataValueElement(value, isInline, {
            href: mapsUrl || '', target: block.googleMapsTarget || ''
          });
          targetContent.insertBefore(element, targetContent.firstChild);
        });
      } else {
        // append (défaut) — séparateur entre les valeurs existantes et les nouvelles
        const hasExisting = targetContent.querySelector('.metadata-value') !== null;
        if (hasExisting && groupSep) {
          targetContent.appendChild(createGroupSeparatorElement(groupSep, isInline));
        }
        values.forEach((value, index) => {
          const element = createMetadataValueElement(value, isInline, {
            href: mapsUrl || '', target: block.googleMapsTarget || ''
          });
          // Séparateur inline entre les valeurs du groupe greffé elles-mêmes
          if (isInline && index < values.length - 1) {
            const sep = document.createElement('span');
            sep.className = 'metadata-separator';
            sep.textContent = block.inlineSeparator || ',\u00A0';
            element.appendChild(sep);
          }
          targetContent.appendChild(element);
        });
      }

      // Mettre à jour le titre du bloc parent (singulier / pluriel)
      const parentBlockConfig = allBlocks.find(item => item.name === block.group);
      if (parentBlockConfig) {
        const allValues     = Array.from(targetContent.querySelectorAll('.metadata-value'));
        const parentTitle   = parentWrapper.querySelector('.metadata-title');
        const computedTitle = getBlockTitle(parentBlockConfig, allValues.length);
        if (parentTitle && computedTitle) parentTitle.textContent = computedTitle;
      }
    });

    appendSeparatorsInsideBlocks(container, settings);
    applyStateClasses(container, settings);
  }

  /* ════════════════════════════════════
   * RUNNER
   * ════════════════════════════════════ */

  async function runSettings(settings) {
    if (
      settings.bodyClassConfiguration &&
      !document.body.classList.contains(settings.bodyClassConfiguration)
    ) return;

    const pageData = await fetchPageJson(settings);
    if (!pageData) return;

    const currentItem = resolveCurrentItemData(pageData);
    if (!currentItem) return;

    const mount = prepareMetadataBlocksMount(settings);
    if (!mount?.container) return;

    buildMetadataBlocks(settings, currentItem, mount.container);
  }

  async function startAll() {
    const currentPath = getCurrentPath();
    
    if (MB_IS_STARTING) return;

  if (
    MB_LAST_RUN_PATH === currentPath &&
    document.querySelector('.metadata-blocks-wrapper .metadata-block')
  ) {
    return;
  }

  MB_IS_STARTING = true;

  try {
    for (const settings of SETTINGS_LIST) {
      try {
        await runSettings(settings);
      } catch (error) {
        console.warn('[Metadata Blocks]', error);
      }
    }

    MB_LAST_RUN_PATH = currentPath;
  } finally {
    MB_IS_STARTING = false;
  }
}

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAll, { once: true });
  } else {
    startAll();
  }

  document.addEventListener('turbolinks:load', startAll);
})();
