(() => {
  "use strict";

  const DEFAULT_CONFIG = {
    classPrefixes: {
      generic: "custom-fancybox",
      specific: "galleryfb"
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
    masonryInstances: new WeakMap(),
    carouselInstances: new WeakMap(),
    blockCounter: 0
  };

  function isObject(value) {
    return value && typeof value === "object" && !Array.isArray(value);
  }

  function deepMerge(target, source) {
    const output = { ...target };

    if (!isObject(target) || !isObject(source)) {
      return source;
    }

    Object.keys(source).forEach((key) => {
      if (Array.isArray(source[key])) {
        output[key] = source[key].slice();
      } else if (isObject(source[key])) {
        output[key] = key in target
          ? deepMerge(target[key], source[key])
          : source[key];
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  function getGlobalConfig() {
    const userConfig = window.SqsGalleryBlocksConfig || {};
    return deepMerge(DEFAULT_CONFIG, userConfig);
  }

  function bodyMatches(requiredBodyClass) {
    if (!requiredBodyClass) return true;
    return document.body.classList.contains(requiredBodyClass);
  }

  function getGalleryBlocksByDesign(design) {
    const allBlocks = Array.from(
      document.querySelectorAll(".sqs-block.gallery-block.sqs-block-gallery")
    );

    if (!design) return allBlocks;

    return allBlocks.filter((block) => {
      const json = block.getAttribute("data-block-json");
      if (!json) return false;

      try {
        const parsed = JSON.parse(json);
        return parsed.design === design;
      } catch (error) {
        return false;
      }
    });
  }

  function resolveOccurrence(blocks, occurrence) {
    if (!Array.isArray(blocks) || !blocks.length) return [];

    if (occurrence === undefined || occurrence === null || occurrence === "all") {
      return blocks;
    }

    if (occurrence === "first") {
      return blocks.slice(0, 1);
    }

    if (typeof occurrence === "number") {
      const index = occurrence - 1;
      return index >= 0 && index < blocks.length ? [blocks[index]] : [];
    }

    return blocks;
  }

  function createHeading(block, headingConfig, itemCount) {
    if (!headingConfig || !headingConfig.enabled) return;

    if (block.querySelector(".sgb-heading")) return;

    const level = /^h[1-4]$/i.test(headingConfig.level || "")
      ? headingConfig.level.toLowerCase()
      : "h2";

    const usePlural = headingConfig.usePlural && itemCount > 1;
    const text = usePlural
      ? (headingConfig.textPlural || headingConfig.text || "")
      : (headingConfig.text || "");

    if (!text) return;

    const heading = document.createElement(level);
    heading.className = "sgb-heading";
    heading.textContent = text;

    block.prepend(heading);
  }

  function addCustomClass(block, customClass) {
    if (!customClass) return;
    block.classList.add(customClass);
  }

  function getBlockIdentifier() {
    STATE.blockCounter += 1;
    return `sgb-gallery-${STATE.blockCounter}`;
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
    const raw = img?.getAttribute("data-image-dimensions");
    if (!raw || !raw.includes("x")) return null;

    const [w, h] = raw.split("x").map(Number);
    if (!w || !h) return null;

    return { width: w, height: h, ratio: h / w };
  }

  function getMetaForImageWrapper(imageWrapper) {
    const next = imageWrapper.nextElementSibling;
    if (next && next.classList.contains("meta")) return next;
    return null;
  }

  function getCaptionHtml(meta) {
    if (!meta) return "";

    const title = meta.querySelector(".meta-title")?.outerHTML || "";
    const description = meta.querySelector(".meta-description")?.outerHTML || "";

    if (!title && !description) {
      return meta.innerHTML.trim();
    }

    return `${title}${description}`.trim();
  }

  function ensureFancyboxClasses(globalCfg, uniqueGroupName) {
    if (!window.Fancybox) return;

    const genericPfx = globalCfg.classPrefixes?.generic || "custom-fancybox";
    const specificPfx = globalCfg.classPrefixes?.specific || "galleryfb";

    if (window.__sgbFancyboxEventsBound) return;
    window.__sgbFancyboxEventsBound = true;

    document.addEventListener("click", () => {
      setTimeout(() => {
        const container = document.querySelector(".fancybox__container");
        if (container) {
          container.classList.add(
            `${genericPfx}-container`,
            `${specificPfx}-container`
          );
        }
      }, 0);
    });

    const originalShow = window.Fancybox.show;
    if (typeof originalShow === "function" && !window.__sgbFancyboxShowWrapped) {
      window.__sgbFancyboxShowWrapped = true;

      window.Fancybox.show = function (...args) {
        const instance = originalShow.apply(this, args);

        setTimeout(() => {
          const container = document.querySelector(".fancybox__container");
          if (container) {
            container.classList.add(
              `${genericPfx}-container`,
              `${specificPfx}-container`
            );
          }
        }, 0);

        return instance;
      };
    }
  }

  function bindFancybox(selector, globalCfg) {
    if (!window.Fancybox) return;

    ensureFancyboxClasses(globalCfg);

    const fbCfg = globalCfg.fancybox || {};

    window.Fancybox.bind(selector, fbCfg);
  }

  function prepareGridBlock(block, blockCfg, globalCfg) {
    const container = block.querySelector(".sqs-gallery-container");
    if (!container) return;

    const slides = Array.from(
      container.querySelectorAll(".slide")
    );

    const uniqueGroup = getBlockIdentifier();

    slides.forEach((slide) => {
      const anchor = slide.querySelector("a.image-slide-anchor");
      const img = anchor?.querySelector("img");
      const src = getImageSrc(img);

      if (!anchor || !src) return;

      anchor.setAttribute("href", src);
      anchor.setAttribute("data-fancybox", uniqueGroup);
      anchor.setAttribute("data-type", "image");
    });

    if (slides.length) {
      slides[slides.length - 1].classList.add("last-slide");
    }

    createHeading(block, blockCfg.heading, slides.length);
    bindFancybox(`[data-fancybox="${uniqueGroup}"]`, globalCfg);
  }

  function buildStackedItems(block) {
    const gallery = block.querySelector(".sqs-gallery-block-stacked .sqs-gallery");
    if (!gallery) return null;

    const children = Array.from(gallery.children);
    const items = [];

    for (let i = 0; i < children.length; i += 1) {
      const el = children[i];
      if (!el.classList.contains("image-wrapper")) continue;

      const meta = getMetaForImageWrapper(el);
      if (meta) {
        i += 1;
      }

      items.push({
        imageWrapper: el,
        meta: meta || null
      });
    }

    return { gallery, items };
  }

  function prepareStackedImagesForFancybox(items, uniqueGroup) {
    items.forEach((item) => {
      const img = item.imageWrapper.querySelector("img");
      const src = getImageSrc(img);
      if (!src || !img) return;

      let anchor = item.imageWrapper.querySelector("a.sgb-lightbox-link");

      if (!anchor) {
        anchor = document.createElement("a");
        anchor.className = "sgb-lightbox-link";

        anchor.setAttribute("href", src);
        anchor.setAttribute("data-fancybox", uniqueGroup);
        anchor.setAttribute("data-type", "image");

        const captionHtml = getCaptionHtml(item.meta);
        if (captionHtml) {
          anchor.setAttribute("data-caption", captionHtml);
        }

        img.parentNode.insertBefore(anchor, img);
        anchor.appendChild(img);
      } else {
        anchor.setAttribute("href", src);
        anchor.setAttribute("data-fancybox", uniqueGroup);
        anchor.setAttribute("data-type", "image");
      }
    });
  }

  function prepareMasonryBlock(block, blockCfg, globalCfg) {
    const stacked = buildStackedItems(block);
    if (!stacked) return;

    const { gallery, items } = stacked;
    const uniqueGroup = getBlockIdentifier();

    gallery.classList.add("sgb-masonry-gallery");
    block.classList.add("sgb-mode-masonry");

    const masonryCfg = deepMerge(
      {
        gap: 32,
        mobileBreakpoint: 768,
        mobileColumns: 1,
        desktopColumns: 3
      },
      blockCfg.masonry || {}
    );

    prepareStackedImagesForFancybox(items, uniqueGroup);

    const wrappers = items.map((item) => {
      const wrapper = document.createElement("div");
      wrapper.className = "sgb-masonry-item";

      wrapper.appendChild(item.imageWrapper);
      if (item.meta) {
        wrapper.appendChild(item.meta);
      }

      return wrapper;
    });

    gallery.innerHTML = "";
    wrappers.forEach((wrapper) => gallery.appendChild(wrapper));

    function layout() {
      const gap = masonryCfg.gap;
      const isMobile = window.innerWidth < masonryCfg.mobileBreakpoint;
      const columns = isMobile ? masonryCfg.mobileColumns : masonryCfg.desktopColumns;

      if (columns <= 1) {
        gallery.style.height = "auto";
        wrappers.forEach((item) => {
          item.style.position = "relative";
          item.style.width = "100%";
          item.style.transform = "none";
        });
        return;
      }

      const galleryWidth = gallery.clientWidth;
      const colWidth = (galleryWidth - gap * (columns - 1)) / columns;
      const heights = Array(columns).fill(0);

      wrappers.forEach((wrapper) => {
        wrapper.style.position = "absolute";
        wrapper.style.width = `${colWidth}px`;

        const img = wrapper.querySelector("img");
        const meta = wrapper.querySelector(".meta");
        const dims = getImageDimensions(img);

        const imgHeight = dims ? colWidth * dims.ratio : (img?.offsetHeight || 0);
        const metaHeight = meta ? meta.offsetHeight : 0;
        const totalHeight = imgHeight + metaHeight;

        const minCol = heights.indexOf(Math.min(...heights));
        const x = minCol * (colWidth + gap);
        const y = heights[minCol];

        wrapper.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        heights[minCol] += totalHeight + gap;
      });

      gallery.style.height = `${Math.max(...heights)}px`;
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(layout);
    });

    ro.observe(gallery);

    window.addEventListener("load", () => requestAnimationFrame(layout));
    window.addEventListener("resize", () => requestAnimationFrame(layout));
    requestAnimationFrame(layout);

    STATE.masonryInstances.set(block, { gallery, wrappers, layout, ro });

    createHeading(block, blockCfg.heading, items.length);
    bindFancybox(`[data-fancybox="${uniqueGroup}"]`, globalCfg);
  }

  function prepareCarouselBlock(block, blockCfg, globalCfg) {
    const stacked = buildStackedItems(block);
    if (!stacked) return;

    const { gallery, items } = stacked;
    const uniqueGroup = getBlockIdentifier();

    block.classList.add("sgb-mode-carousel");
    gallery.classList.add("sgb-carousel-gallery");

    const carouselCfg = deepMerge(
      {
        startIndex: 0,
        showCaptions: true
      },
      blockCfg.carousel || {}
    );

    prepareStackedImagesForFancybox(items, uniqueGroup);

    const viewport = document.createElement("div");
    viewport.className = "sgb-carousel-viewport";

    const track = document.createElement("div");
    track.className = "sgb-carousel-track";

    const slides = items.map((item, index) => {
      const slide = document.createElement("div");
      slide.className = "sgb-carousel-slide";
      slide.setAttribute("data-slide-index", String(index));

      const inner = document.createElement("div");
      inner.className = "sgb-carousel-slide-inner";

      inner.appendChild(item.imageWrapper);

      if (carouselCfg.showCaptions && item.meta) {
        inner.appendChild(item.meta);
      }

      slide.appendChild(inner);
      track.appendChild(slide);

      return slide;
    });

    const prevBtn = document.createElement("button");
    prevBtn.type = "button";
    prevBtn.className = "sgb-carousel-btn sgb-carousel-btn-prev";
    prevBtn.setAttribute("aria-label", "Précédent");
    prevBtn.innerHTML = "‹";

    const nextBtn = document.createElement("button");
    nextBtn.type = "button";
    nextBtn.className = "sgb-carousel-btn sgb-carousel-btn-next";
    nextBtn.setAttribute("aria-label", "Suivant");
    nextBtn.innerHTML = "›";

    const dots = document.createElement("div");
    dots.className = "sgb-carousel-dots";

    const dotButtons = slides.map((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.className = "sgb-carousel-dot";
      dot.setAttribute("aria-label", `Aller à la diapositive ${index + 1}`);
      dot.setAttribute("data-dot-index", String(index));
      dots.appendChild(dot);
      return dot;
    });

    viewport.appendChild(track);

    gallery.innerHTML = "";
    gallery.appendChild(prevBtn);
    gallery.appendChild(viewport);
    gallery.appendChild(nextBtn);
    gallery.appendChild(dots);

    let currentIndex = Math.max(
      0,
      Math.min(carouselCfg.startIndex, slides.length - 1)
    );

    function updateCarousel() {
      track.style.transform = `translate3d(-${currentIndex * 100}%, 0, 0)`;

      slides.forEach((slide, index) => {
        slide.classList.toggle("is-active", index === currentIndex);
      });

      dotButtons.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === currentIndex);
        dot.setAttribute("aria-current", index === currentIndex ? "true" : "false");
      });

      prevBtn.disabled = currentIndex === 0;
      nextBtn.disabled = currentIndex === slides.length - 1;
    }

    prevBtn.addEventListener("click", () => {
      if (currentIndex > 0) {
        currentIndex -= 1;
        updateCarousel();
      }
    });

    nextBtn.addEventListener("click", () => {
      if (currentIndex < slides.length - 1) {
        currentIndex += 1;
        updateCarousel();
      }
    });

    dotButtons.forEach((dot, index) => {
      dot.addEventListener("click", () => {
        currentIndex = index;
        updateCarousel();
      });
    });

    updateCarousel();

    STATE.carouselInstances.set(block, {
      gallery,
      slides,
      updateCarousel
    });

    createHeading(block, blockCfg.heading, items.length);
    bindFancybox(`[data-fancybox="${uniqueGroup}"]`, globalCfg);
  }

  function detectMode(block, blockCfg) {
    if (blockCfg.mode && blockCfg.mode !== "auto") {
      return blockCfg.mode;
    }

    const json = block.getAttribute("data-block-json");
    let design = "";

    if (json) {
      try {
        design = JSON.parse(json).design || "";
      } catch (error) {}
    }

    if (design === "grid") return "grid";
    if (design === "stacked") return "masonry";

    return "";
  }

  function prepareBlock(block, blockCfg, globalCfg) {
    if (block.dataset.sgbReady === "true") return;

    addCustomClass(block, blockCfg.customClass);

    const mode = detectMode(block, blockCfg);

    if (mode === "grid") {
      prepareGridBlock(block, blockCfg, globalCfg);
    } else if (mode === "masonry") {
      prepareMasonryBlock(block, blockCfg, globalCfg);
    } else if (mode === "carousel") {
      prepareCarouselBlock(block, blockCfg, globalCfg);
    }

    block.dataset.sgbReady = "true";
  }

  function run() {
    const globalCfg = getGlobalConfig();
    const blocksCfg = Array.isArray(globalCfg.blocks) ? globalCfg.blocks : [];

    if (!blocksCfg.length) return;

    blocksCfg.forEach((blockCfg) => {
      if (!bodyMatches(blockCfg.bodyClassConfiguration)) return;

      const design = blockCfg.design || null;
      const allMatches = getGalleryBlocksByDesign(design);
      const selectedBlocks = resolveOccurrence(allMatches, blockCfg.occurrence);

      selectedBlocks.forEach((block) => {
        prepareBlock(block, blockCfg, globalCfg);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", run);
  } else {
    run();
  }
})();
