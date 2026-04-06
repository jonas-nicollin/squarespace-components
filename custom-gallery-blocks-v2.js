(() => {
  "use strict";

  const DEFAULTS = {
    fancyboxClassPrefixes: {
      generic: "custom-gallery-blocks-fancybox",
      specific: "custom-gallery-blocks"
    },

    fancybox: {
      theme: "light",
      hash: true,
      preload: 1,
      dragToClose: true,
      closeButton: false,
      compact: false,
      Carousel: {
        Navigation: true,
        infinite: false,
        Thumbs: {
          type: "modern",
          showOnStart: false
        },
        Toolbar: {
          display: {
            left: ["counter"],
            middle: [],
            right: ["zoomIn", "thumbs", "close"]
          }
        }
      }
    },

    blocks: []
  };

  const STATE = {
    uid: 0,
    masonryInstances: new WeakMap(),
    carouselInstances: new WeakMap()
  };

  function nextUid(prefix = "cgb") {
    STATE.uid += 1;
    return `${prefix}-${STATE.uid}`;
  }

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function mergeDeep(target, source) {
    const output = { ...target };

    if (!isObject(target) || !isObject(source)) {
      return source;
    }

    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (Array.isArray(sourceValue)) {
        output[key] = sourceValue.slice();
      } else if (isObject(sourceValue)) {
        output[key] = isObject(targetValue)
          ? mergeDeep(targetValue, sourceValue)
          : mergeDeep({}, sourceValue);
      } else {
        output[key] = sourceValue;
      }
    });

    return output;
  }

  function getConfig() {
    return mergeDeep(DEFAULTS, window.CustomGalleryBlocksConfig || {});
  }

  function bodyMatches(bodyClassConfiguration) {
    if (!bodyClassConfiguration) return true;

    const classes = Array.isArray(bodyClassConfiguration)
      ? bodyClassConfiguration
      : [bodyClassConfiguration];

    return classes.every((className) => document.body.classList.contains(className));
  }

  function parseBlockJson(block) {
    const raw = block.getAttribute("data-block-json");
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (error) {
      return null;
    }
  }

  function getAllGalleryBlocks() {
    return Array.from(
      document.querySelectorAll(".sqs-block.gallery-block.sqs-block-gallery")
    );
  }

  function getBlocksForConfig(blockConfig) {
    let blocks = getAllGalleryBlocks();

    if (blockConfig.design) {
      blocks = blocks.filter((block) => {
        const json = parseBlockJson(block);
        return json && json.design === blockConfig.design;
      });
    }

    if (blockConfig.blockSelector) {
      blocks = blocks.filter((block) => block.matches(blockConfig.blockSelector));
    }

    if (blockConfig.within) {
      const containers = Array.from(document.querySelectorAll(blockConfig.within));
      blocks = blocks.filter((block) => containers.some((container) => container.contains(block)));
    }

    return blocks;
  }

  function selectOccurrences(blocks, occurrence) {
    if (!Array.isArray(blocks) || !blocks.length) return [];

    if (occurrence === undefined || occurrence === null || occurrence === "all") {
      return blocks;
    }

    if (occurrence === "first") {
      return blocks.slice(0, 1);
    }

    if (occurrence === "last") {
      return blocks.slice(-1);
    }

    if (typeof occurrence === "number") {
      const index = occurrence - 1;
      return blocks[index] ? [blocks[index]] : [];
    }

    if (Array.isArray(occurrence)) {
      return occurrence
        .map((n) => blocks[n - 1])
        .filter(Boolean);
    }

    return blocks;
  }

  function getImageSrc(img) {
    if (!img) return "";
    return (
      img.getAttribute("data-image") ||
      img.getAttribute("data-src") ||
      img.currentSrc ||
      img.src ||
      ""
    );
  }

  function getImageDimensions(img) {
    if (!img) return null;

    const raw = img.getAttribute("data-image-dimensions");
    if (!raw || !raw.includes("x")) return null;

    const [width, height] = raw.split("x").map(Number);
    if (!width || !height) return null;

    return {
      width,
      height,
      ratio: height / width
    };
  }

  function getGridSlides(block) {
    return Array.from(block.querySelectorAll(".sqs-gallery-block-grid .slide"));
  }

  function getStackedGallery(block) {
    return block.querySelector(".sqs-gallery-block-stacked .sqs-gallery");
  }

  function getStackedItems(block) {
    const gallery = getStackedGallery(block);
    if (!gallery) return null;

    const children = Array.from(gallery.children);
    const items = [];

    for (let i = 0; i < children.length; i += 1) {
      const current = children[i];
      if (!current.classList.contains("image-wrapper")) continue;

      const next = children[i + 1];
      const meta = next && next.classList.contains("meta") ? next : null;

      items.push({
        imageWrapper: current,
        meta
      });

      if (meta) {
        i += 1;
      }
    }

    return { gallery, items };
  }

  function getMetaCaptionHtml(meta) {
    if (!meta) return "";

    const title = meta.querySelector(".meta-title")?.outerHTML || "";
    const description = meta.querySelector(".meta-description")?.outerHTML || "";

    return `${title}${description}`.trim() || meta.innerHTML.trim();
  }

  function addBlockCustomClass(block, customClass) {
    if (!customClass) return;

    const classes = Array.isArray(customClass) ? customClass : [customClass];
    classes.filter(Boolean).forEach((className) => block.classList.add(className));
  }

  function createHeading(block, headingConfig, itemCount) {
    if (!headingConfig || !headingConfig.enabled) return;
    if (block.querySelector(".custom-gallery-blocks-heading")) return;

    const tagName = /^h[1-4]$/i.test(headingConfig.level || "")
      ? headingConfig.level.toLowerCase()
      : "h2";

    const usePlural = Boolean(headingConfig.usePlural && itemCount > 1);
    const text = usePlural
      ? (headingConfig.textPlural || headingConfig.text || "")
      : (headingConfig.text || "");

    if (!text) return;

    const heading = document.createElement(tagName);
    heading.className = "custom-gallery-blocks-heading";
    heading.textContent = text;

    block.prepend(heading);
  }

  function ensureStackedLightboxAnchor(item, groupName) {
    const img = item.imageWrapper.querySelector("img");
    const src = getImageSrc(img);
    if (!img || !src) return;

    let anchor = item.imageWrapper.querySelector("a.custom-gallery-blocks-lightbox-link");

    if (!anchor) {
      anchor = document.createElement("a");
      anchor.className = "custom-gallery-blocks-lightbox-link";
      img.parentNode.insertBefore(anchor, img);
      anchor.appendChild(img);
    }

    anchor.href = src;
    anchor.setAttribute("data-fancybox", groupName);
    anchor.setAttribute("data-type", "image");

    const caption = getMetaCaptionHtml(item.meta);
    if (caption) {
      anchor.setAttribute("data-caption", caption);
    } else {
      anchor.removeAttribute("data-caption");
    }
  }

  function ensureGridLightboxAnchor(slide, groupName) {
    const anchor = slide.querySelector("a.image-slide-anchor");
    const img = anchor?.querySelector("img");
    const src = getImageSrc(img);

    if (!anchor || !src) return;

    anchor.href = src;
    anchor.setAttribute("data-fancybox", groupName);
    anchor.setAttribute("data-type", "image");
  }

  function normalizeFancyboxClasses(prefixes) {
    const generic = prefixes?.generic || "custom-gallery-blocks-fancybox";
    const specific = prefixes?.specific || "custom-gallery-blocks";
    return { generic, specific };
  }

  function applyFancyboxContainerClasses(prefixes) {
    const { generic, specific } = normalizeFancyboxClasses(prefixes);

    const container = document.querySelector(".fancybox__container");
    if (!container) return;

    container.classList.add(`${generic}-container`, `${specific}-container`);
  }

  function bindFancybox(selector, config) {
    if (!window.Fancybox) return;

    const prefixes = config.fancyboxClassPrefixes;
    const fancyboxOptions = config.fancybox || {};

    Fancybox.bind(selector, {
      ...fancyboxOptions,
      on: {
        ...(fancyboxOptions.on || {}),
        init: (fancybox) => {
          applyFancyboxContainerClasses(prefixes);

          if (typeof fancyboxOptions.on?.init === "function") {
            fancyboxOptions.on.init(fancybox);
          }
        },
        reveal: (fancybox, slide) => {
          applyFancyboxContainerClasses(prefixes);

          const { generic, specific } = normalizeFancyboxClasses(prefixes);

          slide.el?.classList.add(
            `${generic}-slide`,
            `${specific}-slide`
          );

          const img = slide.el?.querySelector("img");
          if (img) {
            img.classList.add(
              `${generic}-image`,
              `${specific}-image`
            );
          }

          if (typeof fancyboxOptions.on?.reveal === "function") {
            fancyboxOptions.on.reveal(fancybox, slide);
          }
        }
      }
    });
  }

  function initGrid(block, blockConfig, config) {
    const slides = getGridSlides(block);
    if (!slides.length) return;

    const groupName = nextUid("custom-gallery-grid");

    slides.forEach((slide) => ensureGridLightboxAnchor(slide, groupName));
    slides[slides.length - 1]?.classList.add("last-slide");

    createHeading(block, blockConfig.heading, slides.length);
    bindFancybox(`[data-fancybox="${groupName}"]`, config);
  }

  function buildMasonryMarkup(gallery, items) {
    const fragments = items.map((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "custom-gallery-blocks-masonry-item";

      wrapper.appendChild(item.imageWrapper);

      if (item.meta) {
        wrapper.appendChild(item.meta);
      }

      return wrapper;
    });

    gallery.innerHTML = "";
    fragments.forEach((fragment) => gallery.appendChild(fragment));

    return fragments;
  }

  function initMasonry(block, blockConfig, config) {
    const data = getStackedItems(block);
    if (!data) return;

    const { gallery, items } = data;
    if (!items.length) return;

    const masonryConfig = mergeDeep(
      {
        gap: 32,
        mobileBreakpoint: 768,
        mobileColumns: 1,
        desktopColumns: 3
      },
      blockConfig.masonry || {}
    );

    const groupName = nextUid("custom-gallery-masonry");

    items.forEach((item) => ensureStackedLightboxAnchor(item, groupName));

    block.classList.add("custom-gallery-blocks-mode-masonry");
    gallery.classList.add("custom-gallery-blocks-masonry-gallery");

    const masonryItems = buildMasonryMarkup(gallery, items);

    function layout() {
      const width = gallery.clientWidth;
      if (!width || width < 40) return;

      const isMobile = window.innerWidth < masonryConfig.mobileBreakpoint;
      const columns = isMobile ? masonryConfig.mobileColumns : masonryConfig.desktopColumns;
      const gap = masonryConfig.gap;

      if (columns <= 1) {
        gallery.style.height = "auto";

        masonryItems.forEach((item) => {
          item.style.position = "relative";
          item.style.width = "100%";
          item.style.transform = "none";
        });

        return;
      }

      const columnWidth = (width - gap * (columns - 1)) / columns;
      const heights = new Array(columns).fill(0);

      masonryItems.forEach((item) => {
        item.style.position = "absolute";
        item.style.width = `${columnWidth}px`;

        const img = item.querySelector("img");
        const meta = item.querySelector(".meta");
        const dims = getImageDimensions(img);

        let imageHeight = 0;

        if (dims) {
          imageHeight = columnWidth * dims.ratio;
        } else if (img && img.complete && img.naturalWidth) {
          imageHeight = columnWidth * (img.naturalHeight / img.naturalWidth);
        } else {
          imageHeight = img?.offsetHeight || 0;
        }

        const metaHeight = meta ? meta.offsetHeight : 0;
        const totalHeight = imageHeight + metaHeight;

        const minHeight = Math.min(...heights);
        const columnIndex = heights.indexOf(minHeight);

        const x = columnIndex * (columnWidth + gap);
        const y = heights[columnIndex];

        item.style.transform = `translate3d(${x}px, ${y}px, 0)`;

        heights[columnIndex] = y + totalHeight + gap;
      });

      gallery.style.height = `${Math.max(...heights)}px`;
    }

    function safeRelayout() {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          layout();
        });
      });
    }

    const resizeObserver = new ResizeObserver(() => {
      safeRelayout();
    });

    resizeObserver.observe(gallery);

    const mutationTarget = block.closest("section") || block;
    const mutationObserver = new MutationObserver(() => {
      safeRelayout();
    });

    mutationObserver.observe(mutationTarget, {
      childList: true,
      subtree: true,
      attributes: true
    });

    masonryItems.forEach((item) => {
      const img = item.querySelector("img");
      if (!img) return;

      if (!img.complete) {
        img.addEventListener("load", safeRelayout, { once: false });
      }
    });

    window.addEventListener("load", safeRelayout);
    window.addEventListener("resize", safeRelayout);

    setTimeout(safeRelayout, 120);
    setTimeout(safeRelayout, 400);
    setTimeout(safeRelayout, 900);
    setTimeout(safeRelayout, 1500);

    createHeading(block, blockConfig.heading, items.length);
    bindFancybox(`[data-fancybox="${groupName}"]`, config);

    STATE.masonryInstances.set(block, {
      gallery,
      masonryItems,
      layout,
      safeRelayout,
      resizeObserver,
      mutationObserver
    });

    safeRelayout();
  }

  function buildCarouselMarkup(gallery, items, carouselConfig) {
    const root = document.createElement("div");
    root.className = "custom-gallery-blocks-carousel";

    const viewport = document.createElement("div");
    viewport.className = "custom-gallery-blocks-carousel-viewport";

    const track = document.createElement("div");
    track.className = "custom-gallery-blocks-carousel-track";

    items.forEach((item, index) => {
      const slide = document.createElement("div");
      slide.className = "custom-gallery-blocks-carousel-item";
      slide.setAttribute("data-carousel-index", String(index));

      const inner = document.createElement("div");
      inner.className = "custom-gallery-blocks-carousel-item-inner";

      inner.appendChild(item.imageWrapper);

      if (carouselConfig.showCaptions !== false && item.meta) {
        inner.appendChild(item.meta);
      }

      slide.appendChild(inner);
      track.appendChild(slide);
    });

    const controls = document.createElement("div");
    controls.className = "custom-gallery-blocks-carousel-controls";

    const prev = document.createElement("button");
    prev.type = "button";
    prev.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-prev";
    prev.setAttribute("aria-label", "Précédent");
    prev.innerHTML = "←";

    const next = document.createElement("button");
    next.type = "button";
    next.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-next";
    next.setAttribute("aria-label", "Suivant");
    next.innerHTML = "→";

    controls.appendChild(prev);
    controls.appendChild(next);

    viewport.appendChild(track);
    root.appendChild(viewport);
    root.appendChild(controls);

    gallery.innerHTML = "";
    gallery.appendChild(root);

    return { root, viewport, track, controls, prev, next };
  }

  function initCarousel(block, blockConfig, config) {
    const data = getStackedItems(block);
    if (!data) return;

    const { gallery, items } = data;
    if (!items.length) return;

    const carouselConfig = mergeDeep(
      {
        gap: 24,
        mobileBreakpoint: 768,
        mobileItemWidth: "82vw",
        tabletItemWidth: "42vw",
        desktopItemWidth: "28vw",
        desktopMaxItemWidth: "32rem",
        startIndex: 0,
        showCaptions: true,
        scrollBy: 1
      },
      blockConfig.carousel || {}
    );

    const groupName = nextUid("custom-gallery-carousel");
    items.forEach((item) => ensureStackedLightboxAnchor(item, groupName));

    block.classList.add("custom-gallery-blocks-mode-carousel");
    gallery.classList.add("custom-gallery-blocks-carousel-gallery");

    gallery.style.setProperty("--custom-gallery-blocks-carousel-gap", `${carouselConfig.gap}px`);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-mobile-item-width", carouselConfig.mobileItemWidth);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-tablet-item-width", carouselConfig.tabletItemWidth);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-desktop-item-width", carouselConfig.desktopItemWidth);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-desktop-max-item-width", carouselConfig.desktopMaxItemWidth);

    const ui = buildCarouselMarkup(gallery, items, carouselConfig);
    const viewport = ui.viewport;
    const track = ui.track;
    const prev = ui.prev;
    const next = ui.next;

    function getItems() {
      return Array.from(track.querySelectorAll(".custom-gallery-blocks-carousel-item"));
    }

    function getItemWidth() {
      const first = getItems()[0];
      if (!first) return 0;

      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap || 0);
      return first.getBoundingClientRect().width + gap;
    }

    function getMaxIndex() {
      const itemsList = getItems();
      const first = itemsList[0];
      if (!first) return 0;

      const itemWidth = getItemWidth();
      const viewportWidth = viewport.clientWidth;
      const totalWidth = track.scrollWidth;

      if (!itemWidth || !viewportWidth || !totalWidth) return 0;

      return Math.max(0, Math.ceil((totalWidth - viewportWidth) / itemWidth));
    }

    let currentIndex = Math.max(0, Number(carouselConfig.startIndex) || 0);

    function update() {
      const itemWidth = getItemWidth();
      const maxIndex = getMaxIndex();
      currentIndex = Math.max(0, Math.min(currentIndex, maxIndex));

      const offset = currentIndex * itemWidth;
      track.style.transform = `translate3d(-${offset}px, 0, 0)`;

      prev.disabled = currentIndex <= 0;
      next.disabled = currentIndex >= maxIndex;
    }

    prev.addEventListener("click", () => {
      currentIndex -= carouselConfig.scrollBy;
      update();
    });

    next.addEventListener("click", () => {
      currentIndex += carouselConfig.scrollBy;
      update();
    });

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(update);
    });

    resizeObserver.observe(viewport);

    const mutationTarget = block.closest("section") || block;
    const mutationObserver = new MutationObserver(() => {
      requestAnimationFrame(update);
    });

    mutationObserver.observe(mutationTarget, {
      childList: true,
      subtree: true,
      attributes: true
    });

    window.addEventListener("load", update);
    window.addEventListener("resize", update);

    setTimeout(update, 100);
    setTimeout(update, 400);
    setTimeout(update, 900);

    createHeading(block, blockConfig.heading, items.length);
    bindFancybox(`[data-fancybox="${groupName}"]`, config);

    STATE.carouselInstances.set(block, {
      gallery,
      viewport,
      track,
      prev,
      next,
      update,
      resizeObserver,
      mutationObserver
    });

    update();
  }

  function resolveMode(block, blockConfig) {
    if (blockConfig.mode && blockConfig.mode !== "auto") {
      return blockConfig.mode;
    }

    const json = parseBlockJson(block);
    const design = json?.design || "";

    if (design === "grid") return "grid";
    if (design === "stacked") return "masonry";

    return "";
  }

  function initBlock(block, blockConfig, config) {
    if (block.dataset.customGalleryBlocksReady === "true") return;

    addBlockCustomClass(block, blockConfig.customClass);

    const mode = resolveMode(block, blockConfig);

    if (mode === "grid") {
      initGrid(block, blockConfig, config);
    }

    if (mode === "masonry") {
      initMasonry(block, blockConfig, config);
    }

    if (mode === "carousel") {
      initCarousel(block, blockConfig, config);
    }

    block.dataset.customGalleryBlocksReady = "true";
  }

  function run() {
    const config = getConfig();
    const blocksConfig = Array.isArray(config.blocks) ? config.blocks : [];

    if (!blocksConfig.length) return;

    blocksConfig.forEach((blockConfig) => {
      if (!bodyMatches(blockConfig.bodyClassConfiguration)) return;

      const matches = getBlocksForConfig(blockConfig);
      const selected = selectOccurrences(matches, blockConfig.occurrence);

      selected.forEach((block) => {
        initBlock(block, blockConfig, config);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
