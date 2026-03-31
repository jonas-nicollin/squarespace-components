(function () {
  'use strict';

  const SETTINGS_LIST = Array.isArray(window.metadataBlocksSettingsList)
    ? window.metadataBlocksSettingsList
    : [];

  if (!SETTINGS_LIST.length) return;

  const JSON_FORMAT_SUFFIX = '?format=json';

  function normalize(str) {
    return String(str || '')
      .replace(/\u00A0/g, ' ')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2019’]/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

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

  async function fetchPageJson(settings) {
    const url = ensureJsonFormat(settings.jsonUrl || window.location.pathname);
    const response = await fetch(url, { credentials: 'same-origin' });
    if (!response.ok) {
      throw new Error('Metadata Blocks: unable to fetch page JSON');
    }
    const json = await response.json();
    return typeof settings.dataResolver === 'function'
      ? settings.dataResolver({ settings, json })
      : json;
  }

  function resolveCurrentItemData(json, settings) {
    const items = Array.isArray(json?.items) ? json.items : [];
    const currentPath = getCurrentPath();

    if (typeof settings.itemResolver === 'function') {
      return settings.itemResolver({ settings, json, items, currentPath }) || null;
    }

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
      wrapper.className = 'sqs-block metadata-blocks-wrapper';

      const blockContent = document.createElement('div');
      blockContent.className = 'sqs-block-content';

      const container = document.createElement('div');
      container.className = 'metadata-blocks';

      blockContent.appendChild(container);
      wrapper.appendChild(blockContent);

      insertAtPosition(
        finalTarget,
        wrapper,
        parseInt(settings.moveToDestinationPosition || '999', 10)
      );
    }

    const container = wrapper?.querySelector('.metadata-blocks');
    if (!container) return null;

    container.innerHTML = '';

    return { wrapper, container };
  }

  function getBlockOrderMap(settings) {
    const orderMap = {};
    (settings.blocksOrder || []).forEach((name, index) => {
      orderMap[name] = index + 1;
    });
    return orderMap;
  }

  function getLocationValues(itemData, pageData, block) {
    if (typeof block.valueResolver === 'function') {
      return block.valueResolver(itemData, pageData, block) || [];
    }

    const source = itemData?.location || {};
    const values = [
      source.addressTitle,
      source.addressLine1,
      source.addressLine2,
      source.addressCountry
    ]
      .map(cleanText)
      .filter(Boolean);

    return values;
  }

  function getExcerptHtml(itemData, pageData, block) {
    if (typeof block.excerptResolver === 'function') {
      return String(block.excerptResolver(itemData, pageData, block) || '').trim();
    }

    if (!block.fetchExcerpt) return '';

    return String(itemData?.excerpt || '').trim();
  }

  function getRawValuesForBlock(block, itemData, pageData) {
    if (block.isLocation) {
      return getLocationValues(itemData, pageData, block);
    }

    if (block.isExcerpt) {
      return [];
    }

    if (typeof block.valueResolver === 'function') {
      return block.valueResolver(itemData, pageData, block) || [];
    }

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
      filtered = filtered.filter(value => {
        return value.startsWith(block.allowedPrefixSuffix) || value.endsWith(block.allowedPrefixSuffix);
      });
    }

    return filtered;
  }

  function sortBlockValues(values, block) {
    const list = [...values];

    if (block.sortOrder === 'asc') {
      list.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    } else if (block.sortOrder === 'desc') {
      list.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } else if (block.sortOrder === 'customOrder' && Array.isArray(block.customOrder)) {
      list.sort((a, b) => {
        const ai = block.customOrder.indexOf(a);
        const bi = block.customOrder.indexOf(b);
        const safeA = ai === -1 ? 9999 : ai;
        const safeB = bi === -1 ? 9999 : bi;
        return safeA - safeB;
      });
    }

    return list;
  }

  function normalizeBlockValues(values, block) {
    let normalized = filterBlockValues(values, block)
      .map(value => cleanText(value))
      .filter(Boolean);

    if (block.allowedPrefixSuffix) {
      normalized = normalized.map(stripPrefixLabel);
    }

    normalized = uniq(normalized);
    normalized = sortBlockValues(normalized, block);

    return normalized;
  }

  function createMetadataValueElement(value, inline) {
    const tag = inline ? 'span' : 'div';
    const el = document.createElement(tag);
    el.className = 'metadata-value';
    el.textContent = value;
    return el;
  }

  function appendValuesToContent(content, values, block) {
    values.forEach((value, index) => {
      const element = createMetadataValueElement(value, block.displayInline);

      if (block.displayInline && index < values.length - 1) {
        const separator = document.createElement('span');
        separator.className = 'metadata-separator';
        separator.textContent = block.inlineSeparator || ',\u00A0';
        element.appendChild(separator);
      }

      content.appendChild(element);
    });
  }

  function createMetadataBlockWrapper(block, orderMap) {
    const wrapper = document.createElement('div');
    wrapper.className = `metadata-block metadata-block--${block.name}`;

    if (block.displayInline) wrapper.classList.add('display-inline');
    if (block.iconTitle) wrapper.classList.add('metadata-icon-title');

    const order = orderMap[block.name] || block.order || 99;
    wrapper.style.order = order;

    if (block.title !== 'hidden') {
      const title = document.createElement('div');
      title.className = 'metadata-title';
      title.textContent = block.iconTitle || block.title || '';
      wrapper.appendChild(title);
    }

    return wrapper;
  }

  function applyStateClasses(container) {
    const blocks = container.querySelectorAll('.metadata-block');

    if (blocks.length === 1) {
      container.classList.add('metadata-blocks--single');
    }

    if (blocks.length > 1) {
      container.classList.add('metadata-blocks--multiple');
    }

    if (container.querySelector('.metadata-excerpt')) {
      container.classList.add('metadata-blocks--has-excerpt');
    }

    if (container.querySelector('.display-inline')) {
      container.classList.add('metadata-blocks--has-inline');
    }
  }

  function buildMetadataBlocks(settings, pageData, itemData, container) {
    const orderMap = getBlockOrderMap(settings);
    const blockWrappers = {};

    const allBlocks = [
      ...(settings.blocks || []),
      ...((settings.excerpt || []).map(block => ({ ...block, isExcerpt: true }))),
      ...(settings.location ? [{ ...settings.location, isLocation: true }] : [])
    ];

    const pendingGroups = [];

    allBlocks.forEach(block => {
      if (block.group) {
        pendingGroups.push(block);
        return;
      }

      const wrapper = createMetadataBlockWrapper(block, orderMap);
      const content = document.createElement('div');
      content.className = 'metadata-elements';

      if (block.isExcerpt) {
        const excerptHtml = getExcerptHtml(itemData, pageData, block);
        if (!excerptHtml) return;

        content.classList.add('metadata-excerpt');
        content.innerHTML = excerptHtml;
      } else {
        const rawValues = getRawValuesForBlock(block, itemData, pageData);
        const values = normalizeBlockValues(rawValues, block);
        if (!values.length) return;

        appendValuesToContent(content, values, block);
      }

      wrapper.appendChild(content);
      container.appendChild(wrapper);
      blockWrappers[block.name] = wrapper;
    });

    pendingGroups.forEach(block => {
      const parentWrapper = blockWrappers[block.group];
      const targetContent = parentWrapper?.querySelector('.metadata-elements');
      if (!targetContent) return;

      const rawValues = getRawValuesForBlock(block, itemData, pageData);
      const values = normalizeBlockValues(rawValues, block);
      if (!values.length) return;

      values.forEach(value => {
        const element = createMetadataValueElement(value, block.displayInline);

        if (block.groupPosition === 'prepend') {
          targetContent.insertBefore(element, targetContent.firstChild);
        } else {
          targetContent.appendChild(element);
        }
      });
    });

    applyStateClasses(container);
  }

  async function runSettings(settings) {
    if (
      settings.bodyClassConfiguration &&
      !document.body.classList.contains(settings.bodyClassConfiguration)
    ) {
      return;
    }

    const pageData = await fetchPageJson(settings);
    if (!pageData) return;

    const currentItem = resolveCurrentItemData(pageData, settings);
    if (!currentItem) return;

    const mount = prepareMetadataBlocksMount(settings);
    if (!mount?.container) return;

    buildMetadataBlocks(settings, pageData, currentItem, mount.container);
  }

  async function startAll() {
    for (const settings of SETTINGS_LIST) {
      try {
        await runSettings(settings);
      } catch (error) {
        console.warn('[Metadata Blocks]', error);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAll, { once: true });
  } else {
    startAll();
  }

  document.addEventListener('turbolinks:load', startAll);
})();
