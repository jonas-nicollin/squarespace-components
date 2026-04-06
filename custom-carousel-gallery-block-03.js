<script>
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

  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

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
     HELPERS
  ============================================================ */
  function cleanSrc(url) {
    return (url || "").replace(/\?format=\d+w$/i, "");
  }

  function getImgSrc(img) {
    return cleanSrc(
      img?.getAttribute("data-image") ||
      img?.getAttribute("data-src") ||
      img?.getAttribute("src") ||
      ""
    );
  }

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

    clone.querySelectorAll("[style]").forEach((el) => {
      el.removeAttribute("style");
    });

    clone.querySelectorAll("p").forEach((p) => {
      if (!p.textContent.trim()) p.remove();
    });

    return clone.innerHTML.trim();
  }

  function buildCarouselCaptionHTML(title, descriptionHTML) {
    if (!showCarouselCaptions) return "";

    const bits = [];

    if (title) {
      bits.push(`<h3 class="carousel-gallery-caption-title">${title}</h3>`);
    }

    if (descriptionHTML) {
      bits.push(`<div class="carousel-gallery-caption-description">${descriptionHTML}</div>`);
    }

    if (!bits.length) return "";

    return `<div class="carousel-gallery-caption">${bits.join("")}</div>`;
  }

  function buildLightboxCaptionHTML(title, descriptionHTML) {
    if (!showLightboxCaptions) return "";

    const bits = [];

    if (title) {
      bits.push(`<div class="carousel-gallery-lightbox-title">${title}</div>`);
    }

    if (descriptionHTML) {
      bits.push(`<div class="carousel-gallery-lightbox-description">${descriptionHTML}</div>`);
    }

    return bits.join("");
  }

  /* ============================================================
     BUILD CLEAN STRUCTURE
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

      const imageWrapper = node;
      const next = children[i + 1];
      const metaEl = next && next.classList.contains("meta") ? next : null;

      const title = getTitleFromPair(metaEl);
      const descriptionHTML = getDescriptionHTMLFromPair(metaEl);

      const item = document.createElement("article");
      item.className = "carousel-gallery-item";
      item.dataset.index = String(index++);

      const media = document.createElement("div");
      media.className = "carousel-gallery-media";

      const cleanImageWrap = document.createElement("div");
      cleanImageWrap.className = "carousel-gallery-image-wrapper";

      const img = imageWrapper.querySelector("img");
      if (!img) {
        i++;
        continue;
      }

      img.removeAttribute("style");
      img.classList.add("carousel-gallery-image");

      cleanImageWrap.appendChild(img);
      media.appendChild(cleanImageWrap);
      item.appendChild(media);

      const captionHTML = buildCarouselCaptionHTML(title, descriptionHTML);
      if (captionHTML) {
        const tmp = document.createElement("div");
        tmp.innerHTML = captionHTML;
        item.appendChild(tmp.firstElementChild);
      }

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
  ============================================================ */
  function insertHeading(container) {
    if (!CFG.galleryHeading?.enabled) return;
    if (container.dataset.headingInjected === "true") return;

    const parent = container.parentNode;
    if (!parent) return;

    const tag = (CFG.galleryHeading.tag || "h2").toLowerCase();
    const text = CFG.galleryHeading.text || "";
    if (!text.trim()) return;

    const allowed = new Set(["h1", "h2", "h3", "h4", "h5", "h6"]);
    const safeTag = allowed.has(tag) ? tag : "h2";

    const heading = document.createElement(safeTag);
    heading.className = "carousel-gallery-heading";
    heading.textContent = text;

    parent.insertBefore(heading, container);
    container.dataset.headingInjected = "true";
  }

  /* ============================================================
     FANCYBOX DATA
  ============================================================ */
  function collect(container) {
    const items = [];

    $$(container, ".carousel-gallery-item").forEach((item) => {
      const img = item.querySelector(".carousel-gallery-image");
      if (!img) return;

      const title = getText(item.querySelector(".carousel-gallery-caption-title"));
      const descHTML = item.querySelector(".carousel-gallery-caption-description")?.innerHTML?.trim() || "";

      const caption = buildLightboxCaptionHTML(title, descHTML);

      items.push({
        src: getImgSrc(img),
        thumb: getImgSrc(img),
        type: "image",
        caption: caption || "",
        alt: title || ""
      });
    });

    return items;
  }

  /* ============================================================
     FANCYBOX OPEN
  ============================================================ */
  function openFancybox(items, index) {
    if (!window.Fancybox || !items.length) return;

    const fb = CFG.fancybox || {};

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
          showOnStart: fb.carousel?.thumbs?.showOnStart ?? false
        },

        Toolbar: {
          display: {
            left: fb.carousel?.toolbar?.left || ["counter"],
            middle: fb.carousel?.toolbar?.middle || [],
            right: fb.carousel?.toolbar?.right || ["zoomIn", "thumbs", "close"]
          }
        }
      },

      on: {
        ready: (fbInstance) => {
          const c = fbInstance?.container;
          if (!c) return;

          c.classList.add("custom-fancybox-container", "carousel-gallery-container");

          const dialog = c.closest("dialog");
          if (dialog) {
            dialog.classList.add("custom-fancybox-dialog", "carousel-gallery-dialog");
          }

          const car = c.querySelector(".fancybox__carousel");
          if (car) {
            car.classList.add("custom-fancybox-carousel", "carousel-gallery-fancybox-carousel");
          }

          c.querySelectorAll(".fancybox__slide").forEach((sl) => {
            sl.classList.add("custom-fancybox-slide", "carousel-gallery-fancybox-slide");
            const img = sl.querySelector("img");
            if (img) {
              img.classList.add("custom-fancybox-image", "carousel-gallery-fancybox-image");
            }
          });
        }
      }
    });
  }

  /* ============================================================
     BIND FANCYBOX
  ============================================================ */
  function bindFancybox(container) {
    if (container._fbBound) return;
    container._fbBound = true;

    container.addEventListener("click", (e) => {
      const item = e.target.closest(".carousel-gallery-item, .carousel-gallery-image-wrapper, .carousel-gallery-image");
      if (!item) return;

      const realItem = item.closest(".carousel-gallery-item");
      if (!realItem) return;

      e.preventDefault();
      e.stopPropagation();

      const items = collect(container);
      const index = Number(realItem.dataset.index) || 0;

      openFancybox(items, index);
    }, true);
  }

  /* ============================================================
     NAV
  ============================================================ */
  function ensureNav(container, track) {
    let nav = container.querySelector(".carousel-gallery-nav");
    if (nav) return;

    nav = document.createElement("div");
    nav.className = "carousel-gallery-nav";

    nav.innerHTML = `
      <button type="button" class="carousel-gallery-nav-btn carousel-gallery-nav-btn--prev" aria-label="Previous">
        <span class="material-symbols-ui">${navPrevIcon}</span>
      </button>
      <button type="button" class="carousel-gallery-nav-btn carousel-gallery-nav-btn--next" aria-label="Next">
        <span class="material-symbols-ui">${navNextIcon}</span>
      </button>
    `;

    container.appendChild(nav);

    const prev = nav.querySelector(".carousel-gallery-nav-btn--prev");
    const next = nav.querySelector(".carousel-gallery-nav-btn--next");

    prev.addEventListener("click", () => {
      track.scrollBy({
        left: -Math.max(160, Math.round(track.clientWidth * 0.85)),
        behavior: "smooth"
      });
    });

    next.addEventListener("click", () => {
      track.scrollBy({
        left: Math.max(160, Math.round(track.clientWidth * 0.85)),
        behavior: "smooth"
      });
    });
  }

  /* ============================================================
     INIT
  ============================================================ */
  function initGallery(container) {
    buildItems(container);
    insertHeading(container);

    const track = container.querySelector(".sqs-gallery");
    if (!track) return;

    ensureNav(container, track);
    bindFancybox(container);
  }

  function init() {
    getTargets().forEach(initGallery);
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  window.addEventListener("page:loaded", init);
  window.addEventListener("site:refresh", init);
})();
</script>
