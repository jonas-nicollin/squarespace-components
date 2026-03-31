<script>
document.addEventListener('DOMContentLoaded', () => {
  if (!document.body.classList.contains('view-item')) return;

  const allSettings = window.metadataBlocksSettingsList || [];
  if (!allSettings.length) return;

  allSettings.forEach(settings => {
    if (
      settings.bodyClassConfiguration &&
      !document.body.classList.contains(settings.bodyClassConfiguration)
    ) {
      return;
    }

    const pageData = getSquarespacePageData(settings);
    if (!pageData) return;

    const currentItem = resolveCurrentItemData(pageData, settings);
    if (!currentItem) return;

    const mountData = prepareMetadataBlocksMount(settings);
    if (!mountData?.container) return;

    buildMetadataBlocks({
      settings,
      pageData,
      itemData: currentItem,
      container: mountData.container
    });
  });
});

function getSquarespacePageData(settings = {}) {
  if (typeof settings.dataResolver === 'function') {
    try {
      return settings.dataResolver();
    } catch (error) {
      console.warn('[Metadata Blocks] dataResolver error:', error);
    }
  }

  const candidates = [
    window.Static?.SQUARESPACE_CONTEXT,
    window.SQUARESPACE_CONTEXT,
    window.Y?.Squarespace?.Context,
    window.__SQUARESPACE_CONTEXT__
  ];

  return candidates.find(Boolean) || null;
}

function resolveCurrentItemData(pageData, settings = {}) {
  if (!pageData) return null;

  if (typeof settings.itemResolver === 'function') {
    try {
      return settings.itemResolver(pageData);
    } catch (error) {
      console.warn('[Metadata Blocks] itemResolver error:', error);
    }
  }

  if (pageData.item) return pageData.item;

  const items = Array.isArray(pageData.items) ? pageData.items : [];
  if (!items.length) return null;

  const currentPath = normalizePath(window.location.pathname);

  const directMatch = items.find(item => {
    return normalizePath(item.fullUrl) === currentPath;
  });
  if (directMatch) return directMatch;

  const urlIdMatch = items.find(item => {
    if (!item.urlId) return false;
    return currentPath.endsWith('/' + trimSlashes(item.urlId));
  });
  if (urlIdMatch) return urlIdMatch;

  const titleSlugMatch = items.find(item => {
    if (!item.title) return false;
    return currentPath.includes(slugify(item.title));
  });
  if (titleSlugMatch) return titleSlugMatch;

  return null;
}

function prepareMetadataBlocksMount(settings) {
  const buildAutomatically = settings.buildAutomatically ?? true;
  const blogContent = document.querySelector('.blog-item-content');
  const existingBlocks = blogContent?.querySelector('.metadata-blocks');
  const fallbackTarget = document.querySelector('.blog-item-top-wrapper');

  let finalTarget = settings.moveToDestination
    ? document.querySelector(settings.moveToDestination)
    : existingBlocks || fallbackTarget;

  if (!finalTarget) return null;

  let blocksWrapper = finalTarget.closest('.metadata-blocks-wrapper');

  if (!blocksWrapper && buildAutomatically) {
    blocksWrapper = document.createElement('div');
    blocksWrapper.className = 'sqs-block metadata-blocks-wrapper';

    const selectorClass = (settings.moveToDestination || '.blog-item-top-wrapper')
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .replace(/^-+|-+$/g, '');

    if (selectorClass) {
      blocksWrapper.classList.add(`metadata-blocks-${selectorClass}`);
    }

    const blockContent = document.createElement('div');
    blockContent.className = 'sqs-block-content';

    const blocksContainer = document.createElement('div');
    blocksContainer.className = 'metadata-blocks';

    blockContent.appendChild(blocksContainer);
    blocksWrapper.appendChild(blockContent);

    insertAtPosition(
      finalTarget,
      blocksWrapper,
      parseInt(settings.moveToDestinationPosition || '999', 10)
    );
  }

  const container = blocksWrapper?.querySelector('.metadata-blocks');
  if (!container) return null;

  container.innerHTML = '';

  return { target: finalTarget, wrapper: blocksWrapper, container };
}

function buildMetadataBlocks({ settings, pageData, itemData, container }) {
  const blockWrappers = {};
  const blockOrderMap = {};

  (settings.blocksOrder || []).forEach((name, index) => {
    blockOrderMap[name] = index + 1;
  });

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

    const values = getBlockValuesFromItem(block, itemData, pageData);
    const hasContent = block.isExcerpt
      ? Boolean(values?.length || getExcerptHtml(itemData, block))
      : Boolean(values?.length);

    if (!hasContent) return;

    const wrapper = createMetadataBlockWrapper(block, blockOrderMap);
    const content = document.createElement('div');
    content.className = 'metadata-elements';

    if (block.isExcerpt && block.fetchExcerpt) {
      const excerptHtml = getExcerptHtml(itemData, block);
      if (!excerptHtml) return;
      content.classList.add('metadata-excerpt');
      content.innerHTML = excerptHtml;
    } else {
      const normalizedValues = normalizeAndSortValues(values, block);
      appendValuesToContent(content, normalizedValues, block);
    }

    wrapper.appendChild(content);
    container.appendChild(wrapper);
    blockWrappers[block.name] = wrapper;
  });

  pendingGroups.forEach(block => {
    const parentWrapper = blockWrappers[block.group];
    const targetContent = parentWrapper?.querySelector('.metadata-elements');
    if (!targetContent) return;

    const values = getBlockValuesFromItem(block, itemData, pageData);
    if (!values.length) return;

    const normalizedValues = normalizeAndSortValues(values, block);

    normalizedValues.forEach(value => {
      const element = createMetadataValueElement(value, block.displayInline);

      if (block.groupPosition === 'prepend') {
        targetContent.insertBefore(element, targetContent.firstChild);
      } else {
        targetContent.appendChild(element);
      }
    });
  });
}

function createMetadataBlockWrapper(block, blockOrderMap) {
  const wrapper = document.createElement('div');
  wrapper.className = `metadata-block metadata-block--${block.name}`;

  if (block.displayInline) wrapper.classList.add('display-inline');
  if (block.iconTitle) wrapper.classList.add('metadata-icon-title');

  const order = blockOrderMap[block.name] || block.order || 99;
  wrapper.style.order = order;

  if (block.title !== 'hidden') {
    const title = document.createElement('div');
    title.className = 'metadata-title';
    title.textContent = block.iconTitle || block.title || '';
    wrapper.appendChild(title);
  }

  return wrapper;
}

function getBlockValuesFromItem(block, itemData, pageData) {
  if (block.isLocation) {
    return getLocationValues(itemData, pageData, block);
  }

  if (block.isExcerpt) {
    return [];
  }

  const sourceKey = block.source || 'tags';
  let values = [];

  if (typeof block.valueResolver === 'function') {
    try {
      values = block.valueResolver(itemData, pageData, block) || [];
    } catch (error) {
      console.warn('[Metadata Blocks] valueResolver error:', error);
    }
  } else {
    values = Array.isArray(itemData?.[sourceKey]) ? [...itemData[sourceKey]] : [];
  }

  if (!values.length) return [];

  if (block.allowedCategories?.length) {
    values = values.filter(value => block.allowedCategories.includes(String(value).trim()));
  }

  if (block.allowedTags?.length) {
    values = values.filter(value => block.allowedTags.includes(String(value).trim()));
  }

  if (block.allowedCaracter) {
    values = values.filter(value => String(value).includes(block.allowedCaracter));
  }

  if (block.allowedPrefixSuffix) {
    values = values.filter(value => {
      const text = String(value).trim();
      return (
        text.startsWith(block.allowedPrefixSuffix) ||
        text.endsWith(block.allowedPrefixSuffix)
      );
    });
  }

  return values;
}

function getLocationValues(itemData, pageData, block) {
  const itemLocation = itemData?.location || {};
  const collectionLocation = pageData?.collection?.location || {};

  const source = Object.keys(itemLocation).length ? itemLocation : collectionLocation;

  const values = [
    source.addressTitle,
    source.addressLine1,
    source.addressLine2,
    source.addressCountry
  ].filter(Boolean);

  return values;
}

function getExcerptHtml(itemData, block) {
  if (!block.fetchExcerpt) return '';

  const excerpt = itemData?.excerpt;
  if (!excerpt) return '';

  return String(excerpt).trim();
}

function normalizeAndSortValues(values, block) {
  let normalized = values
    .map(value => String(value).trim())
    .filter(Boolean);

  if (block.allowedPrefixSuffix) {
    normalized = normalized.map(value => stripPrefixLabel(value));
  }

  normalized = [...new Set(normalized)];

  if (block.sortOrder === 'asc') {
    normalized.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  } else if (block.sortOrder === 'desc') {
    normalized.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
  } else if (block.sortOrder === 'customOrder' && Array.isArray(block.customOrder)) {
    normalized.sort((a, b) => {
      const indexA = block.customOrder.indexOf(a);
      const indexB = block.customOrder.indexOf(b);
      const safeA = indexA === -1 ? 9999 : indexA;
      const safeB = indexB === -1 ? 9999 : indexB;
      return safeA - safeB;
    });
  }

  return normalized;
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

function createMetadataValueElement(value, inline = false) {
  const tag = inline ? 'span' : 'div';
  const el = document.createElement(tag);
  el.className = 'metadata-value';
  el.textContent = value;
  return el;
}

function stripPrefixLabel(value) {
  const index = value.indexOf(':');
  if (index === -1) return value.trim();
  return value.slice(index + 1).trim();
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

function normalizePath(path) {
  if (!path) return '';
  return '/' + trimSlashes(String(path));
}

function trimSlashes(value) {
  return String(value).replace(/^\/+|\/+$/g, '');
}

function slugify(value) {
  return trimSlashes(
    String(value)
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s/-]/g, '')
      .replace(/\s+/g, '-')
  );
}
</script>
