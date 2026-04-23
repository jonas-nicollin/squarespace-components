(() => {
  "use strict";

  const CFG = window.CarouselGalleryFancyboxConfig || {};
  const captionsCfg = CFG.captions || {};
  const showCarouselCaptions = captionsCfg.showOnCarousel ?? true;
  const showLightboxCaptions = captionsCfg.showOnLightbox ?? true;
  const navPrevIcon = CFG.nav?.prevIcon || "arrow_back";
  const navNextIcon = CFG.nav?.nextIcon || "arrow_forward";
  const $$ = (root, sel) => Array.from(root.querySelectorAll(sel));

  /* ── Helpers ── */
  function cleanSrc(url) {
    return (url || "").replace(/\?format=\d+w$/i, "");
  }
  function getImgSrc(img) {
    return cleanSrc(
      img?.getAttribute("data-image") ||
      img?.getAttribute("data-src") ||
      img?.getAttribute("src") || ""
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
    clone.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
    clone.querySelectorAll("p").forEach(p => { if (!p.textContent.trim()) p.remove(); });
    return clone.innerHTML.trim();
  }

  /* ── Captions ── */
  function buildCarouselCaptionHTML(title, descHTML) {
    if (!showCarouselCaptions) return "";
    const bits = [];
    if (title) bits.push(`<div class="carousel-gallery-caption-title">${title}</div>`);
    if (descHTML) bits.push(`<div class="carousel-gallery-caption-description">${descHTML}</div>`);
    return bits.length ? `<div class="carousel-gallery-caption">${bits.join("")}</div>` : "";
  }
  function buildLightboxCaptionHTML(title, descHTML) {
    if (!showLightboxCaptions) return "";
    const bits = [];
    if (title) bits.push(`<div class="carousel-gallery-lightbox-title">${title}</div>`);
    if (descHTML) bits.push(`<div class="carousel-gallery-lightbox-description">${descHTML}</div>`);
    return bits.join("");
  }

  /* ── KEY CHANGE: inject aspect-ratio from data-image-dimensions ── */
  function injectAspectRatio(img) {
    const dim = img.getAttribute("data-image-dimensions") || "";
    if (dim.includes("x")) {
      const [w, h] = dim.split("x").map(Number);
      if (w > 0 && h > 0) {
        img.style.aspectRatio = `${w} / ${h}`;
      }
    }
  }

  /* ── Build DOM ── */
  function buildItems(container) {
    if (container.dataset.carouselBuilt === "true") return;
    const gallery = container.querySelector(".sqs-gallery");
    if (!gallery) return;

    const children = Array.from(gallery.children);
    const frag = document.createDocumentFragment();
    let i = 0, index = 0;

    while (i < children.length) {
      const node = children[i];
      if (!node.classList.contains("image-wrapper")) { i++; continue; }

      const next = children[i + 1];
      const metaEl = next?.classList.contains("meta") ? next : null;
      const title = getTitleFromPair(metaEl);
      const descHTML = getDescriptionHTMLFromPair(metaEl);

      const img = node.querySelector("img");
      if (!img) { i++; continue; }

      /* Reset Squarespace inline styles */
      img.removeAttribute("style");
      img.classList.add("carousel-gallery-image");

      /* Inject aspect-ratio BEFORE appending — no layout thrash */
      injectAspectRatio(img);

      const item = document.createElement("article");
      item.className = "carousel-gallery-item";
      item.dataset.index = String(index++);

      const media = document.createElement("div");
      media.className = "carousel-gallery-media";
      const wrap = document.createElement("div");
      wrap.className = "carousel-gallery-image-wrapper";
      wrap.appendChild(img);
      media.appendChild(wrap);
      item.appendChild(media);

      const captionHTML = buildCarouselCaptionHTML(title, descHTML);
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

  /* ── Fancybox ── */
  function collect(container) {
    return $$(container, ".carousel-gallery-item").flatMap(item => {
      const img = item.querySelector(".carousel-gallery-image");
      if (!img) return [];
      const title = getText(item.querySelector(".carousel-gallery-caption-title"));
      const descHTML = item.querySelector(".carousel-gallery-caption-description")?.innerHTML?.trim() || "";
      return [{
        src: getImgSrc(img),
        thumb: getImgSrc(img),
        type: "image",
        caption: buildLightboxCaptionHTML(title, descHTML),
        alt: title || ""
      }];
    });
  }

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
      }
    });
  }

  function bindFancybox(container) {
    if (container._fbBound) return;
    container._fbBound = true;
    container.addEventListener("click", e => {
      const realItem = e.target.closest(".carousel-gallery-item");
      if (!realItem) return;
      e.preventDefault();
      e.stopPropagation();
      openFancybox(collect(container), Number(realItem.dataset.index) || 0);
    }, true);
  }

  /* ── Nav ── */
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
    nav.querySelector(".carousel-gallery-nav-btn--prev")
      .addEventListener("click", () => track.scrollBy({ left: -step(), behavior: "smooth" }));
    nav.querySelector(".carousel-gallery-nav-btn--next")
      .addEventListener("click", () => track.scrollBy({ left: step(), behavior: "smooth" }));
  }

  /* ── Wheel ── */
  function bindWheel(track) {
    if (track._wheelBound) return;
    track._wheelBound = true;
    track.addEventListener("wheel", e => {
      if (Math.abs(e.deltaX) >= Math.abs(e.deltaY)) {
        e.preventDefault();
        track.scrollLeft += e.deltaX;
      }
    }, { passive: false });
  }

  /* ── Init ── */
  function initGallery(container) {
    buildItems(container);
    const track = container.querySelector(".sqs-gallery");
    if (!track) return;
    ensureNav(container, track);
    bindWheel(track);
    bindFancybox(container);
    /* No syncItemWidths — CSS + aspect-ratio handle sizing */
    container.classList.add("is-layout-ready");
  }

  function init() {
    const selectors = CFG.targets?.selectors || [];
    selectors.forEach(sel => {
      document.querySelectorAll(sel).forEach(el => {
        if (!el.dataset.carouselBuilt) initGallery(el);
      });
    });
  }

  document.addEventListener("DOMContentLoaded", init);
  window.addEventListener("load", init);
  window.addEventListener("page:loaded", init);
  window.addEventListener("site:refresh", init);
})();
