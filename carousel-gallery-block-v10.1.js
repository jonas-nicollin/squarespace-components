(() => {
  "use strict";

  /* ============================================================
     CONFIG
  ============================================================ */
  const CFG = window.CarouselGalleryFancyboxConfig || {};
  const captionsCfg = CFG.captions || {};
  const showCarouselCaptions = captionsCfg.showOnCarousel ?? true;
  const showLightboxCaptions = captionsCfg.showOnLightbox ?? true;
  const navPrevIcon = CFG.nav?.prevIcon || "arrow_back";
  const navNextIcon = CFG.nav?.nextIcon || "arrow_forward";
  const customClass = CFG.customClass || "";

  /* SQS available format widths */
  const SQS_FORMATS = [100, 300, 500, 750, 1000, 1500, 2500];

  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  /* ============================================================
     GUARD: mode édition Squarespace
  ============================================================ */
  function isEditMode() {
    return (
      document.body.classList.contains("sqs-edit-mode-active") ||
      document.body.classList.contains("sqs-is-editing")
    );
  }

  /* ============================================================
     TARGETS
  ============================================================ */
  function getTargets() {
    const out = [];
    (CFG.targets?.selectors || []).forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => out.push(el));
    });
    return out;
  }

  /* ============================================================
     HELPERS — IMAGE SOURCE
  ============================================================ */
  function getBaseUrl(img) {
    const raw =
      img?.getAttribute("data-image") ||
      img?.getAttribute("data-src") ||
      img?.getAttribute("src") ||
      "";
    /* Strip any existing ?format= param */
    return raw.replace(/\?format=\d+w$/i, "");
  }

  function buildSrcset(baseUrl) {
    return SQS_FORMATS.map((w) => `${baseUrl}?format=${w}w ${w}w`).join(", ");
  }

  /**
   * Choose the best carousel src: smallest SQS format >= renderedWidth.
   * Falls back to 1500w for unknown widths.
   */
  function chooseCarouselSrc(baseUrl, renderedWidth) {
    const target = Math.ceil((renderedWidth || 0) * (window.devicePixelRatio || 1));
    const fmt = SQS_FORMATS.find((w) => w >= target) || 1500;
    return `${baseUrl}?format=${fmt}w`;
  }

  /** Always use highest quality for lightbox */
  function getLightboxSrc(baseUrl) {
    return `${baseUrl}?format=2500w`;
  }

  /* ============================================================
     HELPERS — FOCAL POINT
  ============================================================ */
  function getFocalPoint(img) {
    const fp =
      img?.getAttribute("data-image-focal-point") ||
      img?.dataset?.imageFocalPoint ||
      "";
    if (fp.includes(",")) {
      const [x, y] = fp.split(",").map(Number);
      if (!isNaN(x) && !isNaN(y)) {
        return `${Math.round(x * 100)}% ${Math.round(y * 100)}%`;
      }
    }
    return "50% 50%";
  }

  /* ============================================================
     HELPERS — ASPECT RATIO
  ============================================================ */
  function injectAspectRatio(img) {
    const dim = img.getAttribute("data-image-dimensions") || "";
    if (dim.includes("x")) {
      const [w, h] = dim.split("x").map(Number);
      if (w > 0 && h > 0) {
        img.style.aspectRatio = `${w} / ${h}`;
      }
    }
  }

  /* ============================================================
     HELPERS — TEXT / CAPTION
  ============================================================ */
  function getText(el) {
    return el ? (el.textContent || "").trim() : "";
  }

  function isFileNameLike(str) {
    return !!str && /\.[a-z0-9]{2,6}$/i.test(str.trim());
  }

  function getTitleFromPair(metaEl) {
    const title = getText(metaEl?.querySelector(".meta-title"));
    return isFileNameLike(title) ? "" : title;
  }

  function getDescriptionHTMLFromPair(metaEl) {
    const desc = metaEl?.querySelector(".meta-description");
    if (!desc) return "";
    const clone = desc.cloneNode(true);
    clone.querySelectorAll("[style]").forEach((el) => el.removeAttribute("style"));
    clone.querySelectorAll("p").forEach((p) => {
      if (!p.textContent.trim()) p.remove();
    });
    return clone.innerHTML.trim();
  }

  function buildCarouselCaptionHTML(title, descriptionHTML) {
    if (!showCarouselCaptions) return "";
    const bits = [];
    if (title)
      bits.push(`<div class="carousel-gallery-caption-title">${title}</div>`);
    if (descriptionHTML)
      bits.push(
        `<div class="carousel-gallery-caption-description">${descriptionHTML}</div>`
      );
    if (!bits.length) return "";
    return `<div class="carousel-gallery-caption">${bits.join("")}</div>`;
  }

  function buildLightboxCaptionHTML(title, descriptionHTML) {
    if (!showLightboxCaptions) return "";
    const bits = [];
    if (title)
      bits.push(`<div class="carousel-gallery-lightbox-title">${title}</div>`);
    if (descriptionHTML)
      bits.push(
        `<div class="carousel-gallery-lightbox-description">${descriptionHTML}</div>`
      );
    return bits.join("");
  }

  /* ============================================================
     BUILD CLEAN STRUCTURE
     Caption data stored on dataset regardless of showOnCarousel,
     so lightbox can always retrieve it.
  ============================================================ */
  function buildItems(container) {
    if (container.dataset.carouselBuilt === "true") return;
    const gallery = container.querySelector(".sqs-gallery");
    if (!gallery) return;

    const children = Array.from(gallery.children);
    const frag = document.createDocumentFragment();
    let i = 0;
    let index = 0;

    while (i < children.length) {
      const node = children[i];
      if (!node.classList.contains("image-wrapper")) {
        i++;
        continue;
      }

      const next = children[i + 1];
      const metaEl = next?.classList.contains("meta") ? next : null;
      const title = getTitleFromPair(metaEl);
      const descHTML = getDescriptionHTMLFromPair(metaEl);

      const img = node.querySelector("img");
      if (!img) {
        i++;
        continue;
      }

      /* Reset Squarespace inline styles */
      img.removeAttribute("style");
      img.classList.add("carousel-gallery-image");

      /* Apply responsive loading */
      const baseUrl = getBaseUrl(img);
      img.setAttribute("src", `${baseUrl}?format=1500w`);
      img.setAttribute("srcset", buildSrcset(baseUrl));
      img.setAttribute("sizes", "(max-width: 767px) 100vw, 80vw");
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");

      /* Focal point */
      img.style.objectPosition = getFocalPoint(img);

      /* Aspect ratio for stable layout (no JS width calc needed) */
      injectAspectRatio(img);

      /* Store base URL and caption data on dataset for later use */
      img.dataset.baseUrl = baseUrl;

      const item = document.createElement("article");
      item.className = "carousel-gallery-item";
      item.dataset.index = String(index++);

      /* Store caption data on the item so Fancybox collect() can
         retrieve it even when showOnCarousel is false */
      item.dataset.captionTitle = title;
      item.dataset.captionDesc = descHTML;

      const media = document.createElement("div");
      media.className = "carousel-gallery-media";

      const wrap = document.createElement("div");
      wrap.className = "carousel-gallery-image-wrapper";
      wrap.appendChild(img);
      media.appendChild(wrap);
      item.appendChild(media);

      /* Carousel caption (only if showOnCarousel) */
      const captionHTML = buildCarouselCaptionHTML(title, descHTML);
      if (captionHTML) {
        const tmp = document.createElement("div");
        tmp.innerHTML = captionHTML;
        item.appendChild(tmp.firstElementChild);
      }

      /* Skeleton: removed once image loads */
      media.classList.add("is-loading");
      img.addEventListener(
        "load",
        () => {
          media.classList.remove("is-loading");
          media.classList.add("is-loaded");
          /* Upgrade src to best match for rendered size */
          const rendered = img.getBoundingClientRect().width || img.offsetWidth || 0;
          if (rendered > 0) {
            const best = chooseCarouselSrc(baseUrl, rendered);
            if (img.src !== best) img.src = best;
          }
        },
        { once: true }
      );

      frag.appendChild(item);
      if (metaEl) i++;
      i++;
    }

    gallery.innerHTML = "";
    gallery.appendChild(frag);
    container.dataset.carouselBuilt = "true";
  }

  /* ============================================================
     HEADING
     Inserted before .sqs-block-content (parent of our container)
  ============================================================ */
  function insertHeading(container) {
    if (!CFG.galleryHeading?.enabled) return;
    if (container.dataset.headingInjected === "true") return;

    const text = (CFG.galleryHeading.text || "").trim();
    if (!text) return;

    const tag = (CFG.galleryHeading.tag || "h2").toLowerCase();
    const allowed = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
    const safeTag = allowed.has(tag) ? tag : "h2";

    /* Walk up to find .sqs-block-content and insert before it */
    let insertTarget = container;
    let parent = container.parentNode;
    while (parent && !parent.classList.contains("sqs-block")) {
      insertTarget = parent;
      parent = parent.parentNode;
    }
    /* insertTarget is now .sqs-block-content; parent is .sqs-block-gallery */
    if (!parent) return;

    const heading = document.createElement(safeTag);
    heading.className = "carousel-gallery-heading";
    heading.textContent = text;
    parent.insertBefore(heading, insertTarget);
    container.dataset.headingInjected = "true";
  }

  /* ============================================================
     FANCYBOX DATA
     Reads from dataset so captions are available regardless of
     whether they're shown in the carousel.
  ============================================================ */
  function collect(container) {
    return $$(container, ".carousel-gallery-item").flatMap((item) => {
      const img = item.querySelector(".carousel-gallery-image");
      if (!img) return [];

      const title = item.dataset.captionTitle || "";
      const descHTML = item.dataset.captionDesc || "";
      const caption = buildLightboxCaptionHTML(title, descHTML);
      const baseUrl = img.dataset.baseUrl || getBaseUrl(img);

      return [
        {
          src: getLightboxSrc(baseUrl),
          thumb: `${baseUrl}?format=300w`,
          type: "image",
          caption: caption || "",
          alt: title || "",
          _baseUrl: baseUrl,
        },
      ];
    });
  }

  /* ============================================================
     FANCYBOX CAPTION WIDTH
     Constrains caption to rendered image width on each slide change.
  ============================================================ */
  function constrainCaption(fbInstance) {
    if (!fbInstance) return;
    const container = fbInstance.container;
    if (!container) return;

    const slide = container.querySelector(".fancybox__slide.is-selected, .fancybox__slide[aria-hidden='false']")
      || container.querySelector(".fancybox__slide");
    if (!slide) return;

    const img = slide.querySelector("img");
    if (!img) return;

    const imgWidth = img.getBoundingClientRect().width || img.offsetWidth;
    if (!imgWidth) return;

    const caption = container.querySelector(".fancybox__caption");
    if (caption) {
      caption.style.maxWidth = `${imgWidth}px`;
      caption.style.width = `${imgWidth}px`;
    }
  }

  /* ============================================================
     FANCYBOX OPEN
  ============================================================ */
  function openFancybox(items, index) {
    if (!window.Fancybox || !items.length) return;
    const fb = CFG.fancybox || {};

    const extraClasses = [
      "carousel-gallery-block",
      customClass,
    ].filter(Boolean).join(" ");

    Fancybox.show(items, {
      startIndex: index,
      theme: fb.theme ?? "light",
      Hash: fb.hash ?? true,
      preload: fb.preload ?? 1,
      dragToClose: fb.dragToClose ?? true,
      closeButton: fb.closeButton ?? false,
      Carousel: {
        Navigation: true,
        infinite: fb.carousel?.infinite ?? false,
        Thumbs: {
          type: fb.carousel?.thumbs?.type || "modern",
          showOnStart: fb.carousel?.thumbs?.showOnStart ?? false,
        },
        Toolbar: {
          display: {
            left: fb.carousel?.toolbar?.left || ["counter"],
            middle: fb.carousel?.toolbar?.middle || [],
            right: fb.carousel?.toolbar?.right || ["zoomIn", "thumbs", "close"],
          },
        },
      },
      on: {
        ready: (fbInstance) => {
          const c = fbInstance?.container;
          if (!c) return;
          c.classList.add("carousel-gallery-block", customClass);
          const dialog = c.closest("dialog");
          if (dialog) dialog.classList.add("carousel-gallery-block-dialog", customClass);
          /* Initial caption constraint */
          setTimeout(() => constrainCaption(fbInstance), 80);
        },
        "Carousel.change": (fbInstance) => {
          setTimeout(() => constrainCaption(fbInstance), 80);
        },
        reveal: (fbInstance) => {
          setTimeout(() => constrainCaption(fbInstance), 80);
        },
      },
    });
  }

  /* ============================================================
     BIND FANCYBOX
  ============================================================ */
  function bindFancybox(container) {
    if (container._fbBound) return;
    container._fbBound = true;
    container.addEventListener(
      "click",
      (e) => {
        const realItem = e.target.closest(".carousel-gallery-item");
        if (!realItem) return;
        e.preventDefault();
        e.stopPropagation();
        openFancybox(collect(container), Number(realItem.dataset.index) || 0);
      },
      true
    );
  }

  /* ============================================================
     NAV
  ============================================================ */
  function ensureNav(container, track) {
    if (container.querySelector(".carousel-gallery-nav")) return;
    const nav = document.createElement("div");
    nav.className = "carousel-gallery-nav";
    nav.innerHTML = `
      <button type="button" class="carousel-gallery-nav-btn carousel-gallery-nav-btn--prev" aria-label="Précédent">
        <span class="material-symbols-ui">${navPrevIcon}</span>
      </button>
      <button type="button" class="carousel-gallery-nav-btn carousel-gallery-nav-btn--next" aria-label="Suivant">
        <span class="material-symbols-ui">${navNextIcon}</span>
      </button>`;
    container.appendChild(nav);

    const step = () => Math.max(200, Math.round(track.clientWidth * 0.85));
    nav
      .querySelector(".carousel-gallery-nav-btn--prev")
      .addEventListener("click", () =>
        track.scrollBy({ left: -step(), behavior: "smooth" })
      );
    nav
      .querySelector(".carousel-gallery-nav-btn--next")
      .addEventListener("click", () =>
        track.scrollBy({ left: step(), behavior: "smooth" })
      );
  }

  /* ============================================================
     WHEEL
  ============================================================ */
  function bindWheel(track) {
    if (track._wheelBound) return;
    track._wheelBound = true;
    track.addEventListener(
      "wheel",
      (e) => {
        if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
          e.preventDefault();
          track.scrollLeft += e.deltaX;
        }
      },
      { passive: false }
    );
  }

  /* ============================================================
     INIT
  ============================================================ */
  function initGallery(container) {
    buildItems(container);
    insertHeading(container);

    const track = container.querySelector(".sqs-gallery");
    if (!track) return;

    container.classList.add("carousel-gallery-block");
    if (customClass) container.classList.add(customClass);

    ensureNav(container, track);
    bindWheel(track);
    bindFancybox(container);
    container.classList.add("is-layout-ready");
  }

  function init() {
    /* Respect Squarespace edit mode */
    if (isEditMode()) return;

    const selectors = CFG.targets?.selectors || [];
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        if (!el.dataset.carouselBuilt) initGallery(el);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  window.addEventListener("page:loaded", init);
  window.addEventListener("site:refresh", init);
})();
