(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    fancyboxClassPrefixes: {
      generic: "custom-gallery-blocks-fancybox",
      specific: "custom-gallery-blocks"
    },

    fancyboxDefaults: {
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
    initializedBlocks: new WeakSet()
  };

  function nextUid(prefix = "custom-gallery-blocks") {
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
    return mergeDeep(DEFAULT_CONFIG, window.CustomGalleryBlocksConfig || {});
  }

  function bodyMatches(bodyClassConfiguration) {
    if (!bodyClassConfiguration) return true;

    const requiredClasses = Array.isArray(bodyClassConfiguration)
      ? bodyClassConfiguration
      : [bodyClassConfiguration];

    return requiredClasses.every((cls) => document.body.classList.contains(cls));
  }

  function getAllStackedBlocks() {
    const stackedContainers = Array.from(
      document.querySelectorAll(".sqs-gallery-container.sqs-gallery-block-stacked")
    );

    return stackedContainers
      .map((container) => container.closest(".sqs-block.gallery-block.sqs-block-gallery"))
      .filter(Boolean);
  }

  function getMatchingBlocks(blockConfig) {
    let blocks = getAllStackedBlocks();

    if (blockConfig.blockSelector) {
      blocks = blocks.filter((block) => block.matches(blockConfig.blockSelector));
    }

    if (blockConfig.within) {
      const containers = Array.from(document.querySelectorAll(blockConfig.within));
      blocks = blocks.filter((block) =>
        containers.some((container) => container.contains(block))
      );
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
      return blocks[occurrence - 1] ? [blocks[occurrence - 1]] : [];
    }

    if (Array.isArray(occurrence)) {
      return occurrence.map((n) => blocks[n - 1]).filter(Boolean);
    }

    return blocks;
  }

  function addCustomClass(block, customClass) {
    if (!customClass) return;

    const classes = Array.isArray(customClass) ? customClass : [customClass];
    classes.filter(Boolean).forEach((cls) => block.classList.add(cls));
  }

  function createHeading(block, headingConfig, itemCount) {
    if (!headingConfig || !headingConfig.enabled) return;
    if (block.querySelector(".custom-gallery-blocks-heading")) return;

    const tag = /^h[1-4]$/i.test(headingConfig.level || "")
      ? headingConfig.level.toLowerCase()
      : "h2";

    const usePlural = Boolean(headingConfig.usePlural && itemCount > 1);
    const text = usePlural
      ? (headingConfig.textPlural || headingConfig.text || "")
      : (headingConfig.text || "");

    if (!text) return;

    const heading = document.createElement(tag);
    heading.className = "custom-gallery-blocks-heading";
    heading.textContent = text;
    block.prepend(heading);
  }

  function getStackedGallery(block) {
    return block.querySelector(".sqs-gallery-container.sqs-gallery-block-stacked .sqs-gallery");
  }

  function getStackedItems(block) {
    const gallery = getStackedGallery(block);
    if (!gallery) return null;

    const children = Array.from(gallery.children);
    const items = [];

    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (!node.classList.contains("image-wrapper")) continue;

      const next = children[i + 1];
      const meta = next && next.classList.contains("meta") ? next : null;

      items.push({
        imageWrapper: node,
        meta
      });

      if (meta) i += 1;
    }

    return { gallery, items };
  }

  function getImageElement(item) {
    return item.imageWrapper.querySelector("img");
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

    const [w, h] = raw.split("x").map(Number);
    if (!w || !h) return null;

    return { width: w, height: h, ratio: h / w };
  }

  function getMetaTitle(meta) {
    return meta?.querySelector(".meta-title")?.textContent.trim() || "";
  }

  function getMetaDescriptionHtml(meta) {
    return meta?.querySelector(".meta-description")?.innerHTML.trim() || "";
  }

  function normalizeDescriptionLines(html) {
    if (!html) return [];

    const temp = document.createElement("div");
    temp.innerHTML = html;

    temp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    temp.querySelectorAll("p, div, li").forEach((el) => {
      el.insertAdjacentText("afterend", "\n");
    });

    return (temp.innerText || "")
      .split(/\n+/)
      .map((line) => line.replace(/\u00A0/g, " ").trim())
      .filter(Boolean);
  }

  function createCaption(meta, options = {}) {
    if (!meta || options.showCaptions === false) return null;

    const title = getMetaTitle(meta);
    const descriptionLines = normalizeDescriptionLines(getMetaDescriptionHtml(meta));

    const caption = document.createElement("div");
    caption.className = "custom-gallery-blocks-caption";

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "custom-gallery-blocks-caption-title";
      titleEl.textContent = title;
      caption.appendChild(titleEl);
    }

    if (descriptionLines.length) {
      const descriptionEl = document.createElement("div");
      descriptionEl.className = "custom-gallery-blocks-caption-description";

      descriptionLines.forEach((line, index) => {
        const lineEl = document.createElement("span");
        lineEl.className = "custom-gallery-blocks-caption-line";
        lineEl.textContent = line;
        descriptionEl.appendChild(lineEl);

        if (index < descriptionLines.length - 1) {
          const sep = document.createElement("span");
          sep.className = "custom-gallery-blocks-caption-separator";
          sep.textContent = ", ";
          descriptionEl.appendChild(sep);
        }
      });

      caption.appendChild(descriptionEl);
    }

    return caption.childNodes.length ? caption : null;
  }

  function createFancyboxCaptionHtml(meta, classPrefixes) {
    if (!meta) return "";

    const generic = classPrefixes?.generic || "custom-gallery-blocks-fancybox";
    const specific = classPrefixes?.specific || "custom-gallery-blocks";

    const title = getMetaTitle(meta);
    const descriptionLines = normalizeDescriptionLines(getMetaDescriptionHtml(meta));

    const blocks = [];

    if (title) {
      blocks.push(
        `<div class="${generic}-header ${specific}-header">
          <div class="${generic}-title ${specific}-title">${title}</div>
        </div>`
      );
    }

    if (descriptionLines.length) {
      const linesHtml = descriptionLines
        .map((line) => `<div class="${generic}-line ${specific}-line">${line}</div>`)
        .join("");

      blocks.push(
        `<div class="${generic}-details ${specific}-details">${linesHtml}</div>`
      );
    }

    if (!blocks.length) return "";

    return `<div class="${generic}-caption ${specific}-caption">${blocks.join("")}</div>`;
  }

  function ensureImageLightboxAnchor(item, groupName, fancyboxEnabled, fancyboxCaptionHtml) {
    const img = getImageElement(item);
    const src = getImageSrc(img);
    if (!img || !src) return null;

    let anchor = item.imageWrapper.querySelector("a.custom-gallery-blocks-lightbox-link");

    if (!anchor) {
      anchor = document.createElement("a");
      anchor.className = "custom-gallery-blocks-lightbox-link";
      img.parentNode.insertBefore(anchor, img);
      anchor.appendChild(img);
    }

    anchor.href = src;

    if (fancyboxEnabled) {
      anchor.setAttribute("data-fancybox", groupName);
      anchor.setAttribute("data-type", "image");

      if (fancyboxCaptionHtml) {
        anchor.setAttribute("data-caption", fancyboxCaptionHtml);
      } else {
        anchor.removeAttribute("data-caption");
      }
    } else {
      anchor.removeAttribute("data-fancybox");
      anchor.removeAttribute("data-type");
      anchor.removeAttribute("data-caption");
    }

    return anchor;
  }

  function bindFancybox(selector, globalConfig, blockFancyboxConfig) {
    if (!window.Fancybox) return;

    const prefixes = globalConfig.fancyboxClassPrefixes || {};
    const fancyboxOptions = mergeDeep(
      globalConfig.fancyboxDefaults || {},
      blockFancyboxConfig || {}
    );

    const generic = prefixes.generic || "custom-gallery-blocks-fancybox";
    const specific = prefixes.specific || "custom-gallery-blocks";

    Fancybox.bind(selector, {
      ...fancyboxOptions,
      on: {
        ...(fancyboxOptions.on || {}),
        ready: (fb) => {
          const container = fb?.container;
          if (container) {
            container.classList.add(
              `${generic}-container`,
              `${specific}-container`
            );
          }

          if (typeof fancyboxOptions.on?.ready === "function") {
            fancyboxOptions.on.ready(fb);
          }
        },
        createSlide: (fb, slide) => {
          if (slide?.el) {
            slide.el.classList.add(
              `${generic}-slide`,
              `${specific}-slide`
            );

            const img = slide.el.querySelector("img");
            if (img) {
              img.classList.add(
                `${generic}-image`,
                `${specific}-image`
              );
            }
          }

          if (typeof fancyboxOptions.on?.createSlide === "function") {
            fancyboxOptions.on.createSlide(fb, slide);
          }
        },
        contentReady: (fb, slide) => {
          if (slide?.el) {
            const img = slide.el.querySelector("img");
            if (img) {
              img.classList.add(
                `${generic}-image`,
                `${specific}-image`
              );
            }
          }

          if (typeof fancyboxOptions.on?.contentReady === "function") {
            fancyboxOptions.on.contentReady(fb, slide);
          }
        }
      }
    });
  }

  function safeRelayoutTwice(fn) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fn();
      });
    });
  }

  function prepareBaseBlock(block, blockConfig, config) {
    const data = getStackedItems(block);
    if (!data || !data.items.length) return null;

    const fancyboxEnabled = blockConfig.fancybox?.enabled !== false;
    const showFancyboxCaptions = blockConfig.fancybox?.showCaptions !== false;
    const groupName = nextUid("custom-gallery-blocks-gallery");

    data.items.forEach((item) => {
      const captionHtml = showFancyboxCaptions
        ? createFancyboxCaptionHtml(item.meta, config.fancyboxClassPrefixes)
        : "";

      ensureImageLightboxAnchor(
        item,
        groupName,
        fancyboxEnabled,
        captionHtml
      );
    });

    createHeading(block, blockConfig.heading, data.items.length);

    if (fancyboxEnabled) {
      bindFancybox(
        `[data-fancybox="${groupName}"]`,
        config,
        blockConfig.fancybox?.options || {}
      );
    }

    return {
      gallery: data.gallery,
      items: data.items
    };
  }

  function initGrid(block, blockConfig, config) {
    const prepared = prepareBaseBlock(block, blockConfig, config);
    if (!prepared) return;

    const { gallery, items } = prepared;

    block.classList.add("custom-gallery-blocks-mode-grid");
    gallery.classList.add("custom-gallery-blocks-grid-gallery");

    const wrappers = items.map((item) => {
      const card = document.createElement("div");
      card.className = "custom-gallery-blocks-grid-item";

      card.appendChild(item.imageWrapper);

      if (blockConfig.grid?.showCaptions !== false && item.meta) {
        const caption = createCaption(item.meta, { showCaptions: true });
        if (caption) {
          caption.classList.add("custom-gallery-blocks-grid-caption");
          card.appendChild(caption);
        }
      }

      return card;
    });

    gallery.innerHTML = "";
    wrappers.forEach((card) => gallery.appendChild(card));
  }

  function initMasonry(block, blockConfig, config) {
    const prepared = prepareBaseBlock(block, blockConfig, config);
    if (!prepared) return;

    const { gallery, items } = prepared;

    block.classList.add("custom-gallery-blocks-mode-masonry");
    gallery.classList.add("custom-gallery-blocks-masonry-gallery");

    const masonryConfig = mergeDeep(
      {
        gap: 32,
        mobileBreakpoint: 768,
        mobileColumns: 1,
        desktopColumns: 3,
        showCaptions: true
      },
      blockConfig.masonry || {}
    );

    const masonryItems = items.map((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "custom-gallery-blocks-masonry-item";

      wrapper.appendChild(item.imageWrapper);

      if (masonryConfig.showCaptions !== false && item.meta) {
        const caption = createCaption(item.meta, { showCaptions: true });
        if (caption) {
          caption.classList.add("custom-gallery-blocks-masonry-caption");
          wrapper.appendChild(caption);
        }
      }

      return wrapper;
    });

    gallery.innerHTML = "";
    masonryItems.forEach((item) => gallery.appendChild(item));

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
        const caption = item.querySelector(".custom-gallery-blocks-masonry-caption");
        const dims = getImageDimensions(img);

        let imageHeight = 0;

        if (dims) {
          imageHeight = columnWidth * dims.ratio;
        } else if (img && img.complete && img.naturalWidth) {
          imageHeight = columnWidth * (img.naturalHeight / img.naturalWidth);
        } else {
          imageHeight = img?.getBoundingClientRect().height || 0;
        }

        const captionHeight = caption ? caption.getBoundingClientRect().height : 0;
        const totalHeight = imageHeight + captionHeight;

        const minHeight = Math.min(...heights);
        const columnIndex = heights.indexOf(minHeight);

        const x = columnIndex * (columnWidth + gap);
        const y = heights[columnIndex];

        item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        heights[columnIndex] = y + totalHeight + gap;
      });

      gallery.style.height = `${Math.max(...heights)}px`;
    }

    const resizeObserver = new ResizeObserver(() => safeRelayoutTwice(layout));
    resizeObserver.observe(gallery);

    const mutationTarget = block.closest("section") || block;
    const mutationObserver = new MutationObserver(() => safeRelayoutTwice(layout));
    mutationObserver.observe(mutationTarget, {
      childList: true,
      subtree: true,
      attributes: true
    });

    masonryItems.forEach((item) => {
      const img = item.querySelector("img");
      if (!img) return;

      if (img.complete) return;
      img.addEventListener("load", () => safeRelayoutTwice(layout));
    });

    window.addEventListener("load", () => safeRelayoutTwice(layout));
    window.addEventListener("resize", () => safeRelayoutTwice(layout));

    setTimeout(() => safeRelayoutTwice(layout), 120);
    setTimeout(() => safeRelayoutTwice(layout), 400);
    setTimeout(() => safeRelayoutTwice(layout), 900);
    setTimeout(() => safeRelayoutTwice(layout), 1500);

    safeRelayoutTwice(layout);
  }

  function initCarousel(block, blockConfig, config) {
    const prepared = prepareBaseBlock(block, blockConfig, config);
    if (!prepared) return;

    const { gallery, items } = prepared;

    const carouselConfig = mergeDeep(
      {
        fullWidth: true,
        gap: 10,
        rowHeight: "clamp(220px, 60vh, 864px)",
        captionGap: "0rem",
        mobileBreakpoint: 768,
        mobileGap: 10,
        mobileCropMode: "none",
        showCaptions: true,
        nav: {
          enabled: true,
          prevLabel: "Précédent",
          nextLabel: "Suivant",
          prevText: "←",
          nextText: "→"
        }
      },
      blockConfig.carousel || {}
    );

    block.classList.add("custom-gallery-blocks-mode-carousel");
    if (carouselConfig.fullWidth !== false) {
      block.classList.add("custom-gallery-blocks-carousel-full-width");
    }

    gallery.classList.add("custom-gallery-blocks-carousel-gallery");
    gallery.style.setProperty("--custom-gallery-blocks-carousel-gap", `${carouselConfig.gap}px`);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-row-height", carouselConfig.rowHeight);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-caption-gap", carouselConfig.captionGap);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-mobile-gap", `${carouselConfig.mobileGap}px`);

    const root = document.createElement("div");
    root.className = "custom-gallery-blocks-carousel";

    const track = document.createElement("div");
    track.className = "custom-gallery-blocks-carousel-track";

    const cards = items.map((item) => {
      const card = document.createElement("div");
      card.className = "custom-gallery-blocks-carousel-item";

      const media = document.createElement("div");
      media.className = "custom-gallery-blocks-carousel-media";

      media.appendChild(item.imageWrapper);
      card.appendChild(media);

      if (carouselConfig.showCaptions !== false && item.meta) {
        const caption = createCaption(item.meta, { showCaptions: true });
        if (caption) {
          caption.classList.add("custom-gallery-blocks-carousel-caption");
          card.appendChild(caption);
        }
      }

      return card;
    });

    cards.forEach((card) => track.appendChild(card));
    root.appendChild(track);

    let prevBtn = null;
    let nextBtn = null;

    if (carouselConfig.nav?.enabled !== false) {
      const controls = document.createElement("div");
      controls.className = "custom-gallery-blocks-carousel-controls";

      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-prev";
      prevBtn.setAttribute("aria-label", carouselConfig.nav.prevLabel || "Précédent");
      prevBtn.textContent = carouselConfig.nav.prevText || "←";

      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-next";
      nextBtn.setAttribute("aria-label", carouselConfig.nav.nextLabel || "Suivant");
      nextBtn.textContent = carouselConfig.nav.nextText || "→";

      controls.appendChild(prevBtn);
      controls.appendChild(nextBtn);
      root.appendChild(controls);
    }

    gallery.innerHTML = "";
    gallery.appendChild(root);

    function getGapPx() {
      const styles = window.getComputedStyle(track);
      return parseFloat(styles.columnGap || styles.gap || 0) || 0;
    }

    function getBandWidthPx() {
      const gap = getGapPx();
      return Math.max(0, window.innerWidth - 2 * gap);
    }

    function applyConditionalCrop() {
      const active = window.matchMedia(`(max-width: ${carouselConfig.mobileBreakpoint - 0.02}px)`).matches;
      const bandWidth = getBandWidthPx();

      cards.forEach((card) => {
        const img = card.querySelector("img");
        if (!img) return;

        img.classList.remove("is-crop");

        if (!active) return;
        if (carouselConfig.mobileCropMode !== "conditional-4-5") return;

        const renderedHeight = img.getBoundingClientRect().height || img.offsetHeight;
        const dims = getImageDimensions(img);

        let w = dims?.width || img.naturalWidth || 0;
        let h = dims?.height || img.naturalHeight || 0;

        if (!w || !h || !renderedHeight) return;

        const widthIfContain = renderedHeight * (w / h);
        if (widthIfContain > bandWidth + 0.5) {
          img.classList.add("is-crop");
        }
      });
    }

    function syncCardWidths() {
      const bandWidth = getBandWidthPx();

      cards.forEach((card) => {
        const img = card.querySelector("img");
        if (!img) return;

        const width = img.classList.contains("is-crop")
          ? bandWidth
          : (img.getBoundingClientRect().width || img.offsetWidth || 0);

        if (width > 0) {
          card.style.width = `${width}px`;
        }
      });
    }

    function updateNavState() {
      if (!prevBtn || !nextBtn) return;

      const scrollLeft = track.scrollLeft;
      const clientWidth = track.clientWidth;
      const scrollWidth = track.scrollWidth;

      const atStart = scrollLeft <= 1;
      const atEnd = Math.ceil(scrollLeft + clientWidth) >= scrollWidth - 1;

      prevBtn.toggleAttribute("disabled", atStart);
      nextBtn.toggleAttribute("disabled", atEnd);

      prevBtn.classList.toggle("disabled", atStart);
      nextBtn.classList.toggle("disabled", atEnd);
    }

    function refresh() {
      applyConditionalCrop();
      syncCardWidths();
      updateNavState();
    }

    if (prevBtn && nextBtn) {
      prevBtn.addEventListener("click", () => {
        track.scrollBy({
          left: -Math.max(160, Math.round(track.clientWidth * 0.85)),
          behavior: "smooth"
        });
      });

      nextBtn.addEventListener("click", () => {
        track.scrollBy({
          left: Math.max(160, Math.round(track.clientWidth * 0.85)),
          behavior: "smooth"
        });
      });
    }

    track.addEventListener("scroll", updateNavState, { passive: true });

    const resizeObserver = new ResizeObserver(() => refresh());
    resizeObserver.observe(track);

    const mutationTarget = block.closest("section") || block;
    const mutationObserver = new MutationObserver(() => refresh());
    mutationObserver.observe(mutationTarget, {
      childList: true,
      subtree: true,
      attributes: true
    });

    cards.forEach((card) => {
      const img = card.querySelector("img");
      if (!img) return;

      const onReady = () => refresh();

      if (img.complete) {
        onReady();
      } else {
        img.addEventListener("load", onReady, { once: true });
      }
    });

    window.addEventListener("orientationchange", refresh);
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);

    setTimeout(refresh, 100);
    setTimeout(refresh, 400);
    setTimeout(refresh, 900);

    refresh();
  }

  function initBlock(block, blockConfig, config) {
    if (STATE.initializedBlocks.has(block)) return;

    addCustomClass(block, blockConfig.customClass);

    const mode = blockConfig.mode || "grid";

    if (mode === "grid") initGrid(block, blockConfig, config);
    if (mode === "masonry") initMasonry(block, blockConfig, config);
    if (mode === "carousel") initCarousel(block, blockConfig, config);

    STATE.initializedBlocks.add(block);
    block.dataset.customGalleryBlocksReady = "true";
  }

  function run() {
    const config = getConfig();
    const blocksConfig = Array.isArray(config.blocks) ? config.blocks : [];
    if (!blocksConfig.length) return;

    blocksConfig.forEach((blockConfig) => {
      if (!bodyMatches(blockConfig.bodyClassConfiguration)) return;

      const matches = getMatchingBlocks(blockConfig);
      const selected = selectOccurrences(matches, blockConfig.occurrence);

      selected.forEach((block) => initBlock(block, blockConfig, config));
    });
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("page:loaded", run);
  window.addEventListener("site:refresh", run);
})();
