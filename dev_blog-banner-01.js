/**
 * Blog Banner – v4.0.0
 * Squarespace component: injects a cover image or video banner into blog items.
 *
 * Fixes & improvements over v3:
 *  - Body classes (has-banner-image / has-banner-video / has-banner) are only
 *    added when at least one banner was actually inserted.
 *  - Source block (.sqs-block ancestor) is marked with `blog-banner-source`
 *    and hidden outside edit mode via CSS class on body, not inline style.
 *  - Dispatches `blogBannerReady` CustomEvent for coordination with other
 *    scripts (e.g. Metadata block).
 *  - Exposes `window.BlogBanner` API for external scripts.
 *  - FOUC mitigation: body gets `blog-banner-loading` during init; removed
 *    once done. CSS can use this to prevent flash.
 *  - `fetchpriority="high"` on the banner image.
 *  - Idempotent: safe to call initializeBanners() multiple times.
 */

(function () {
  "use strict";

  /* ─────────────────────────────────────────────
     Internal state
  ───────────────────────────────────────────── */

  /** Map of viewItem element → inserted banner element */
  const insertedBanners = new Map();

  /* ─────────────────────────────────────────────
     Public API (window.BlogBanner)
  ───────────────────────────────────────────── */

  window.BlogBanner = {
    /**
     * Returns the banner element inserted for a given .view-item element,
     * or null if none was inserted.
     * @param {Element} viewItem
     * @returns {Element|null}
     */
    getBannerFor(viewItem) {
      return insertedBanners.get(viewItem) || null;
    },

    /**
     * Returns all view-item elements that received a banner.
     * @returns {Element[]}
     */
    getBanneredItems() {
      return Array.from(insertedBanners.keys());
    },

    /** Re-run banner injection (useful after dynamic content loads). */
    refresh() {
      initializeBanners();
    },
  };

  /* ─────────────────────────────────────────────
     Entry point
  ───────────────────────────────────────────── */

  document.addEventListener("DOMContentLoaded", function () {
    // Signal to CSS that we're about to run – suppress potential FOUC
    document.body.classList.add("blog-banner-loading");
    initializeBanners();
    document.body.classList.remove("blog-banner-loading");
  });

  /* ─────────────────────────────────────────────
     Core logic
  ───────────────────────────────────────────── */

  function initializeBanners() {
    const configList = window.blogBannerConfig || [];
    const bodyClasses = Array.from(document.body.classList);

    const activeConfig = configList.find((config) =>
      config.bodyClassConditions.every((cls) => bodyClasses.includes(cls))
    );

    if (!activeConfig) return;

    applyBannerConfig(activeConfig);
  }

  function applyBannerConfig(config) {
    let insertedImageCount = 0;
    let insertedVideoCount = 0;

    document.querySelectorAll(".blog-item-content-wrapper").forEach((contentWrapper) => {
      const viewItem = contentWrapper.closest(".view-item");
      if (!viewItem) return;

      // Skip if already processed for this config run
      if (insertedBanners.has(viewItem)) return;

      const destination = viewItem.querySelector(config.destinationSelector);
      if (!destination) return;

      const bannerBlock = contentWrapper.querySelector(config.bannerSelectors);
      const videoBlock =
        config.allowVideoFallback ? contentWrapper.querySelector(".video-block") : null;

      if (bannerBlock) {
        const banner = insertImageBanner(destination, bannerBlock, config);
        if (banner) {
          insertedBanners.set(viewItem, banner);
          markSourceBlock(bannerBlock);
          insertedImageCount++;
        }
      } else if (videoBlock) {
        const banner = insertVideoBanner(destination, videoBlock, config);
        if (banner) {
          insertedBanners.set(viewItem, banner);
          insertedVideoCount++;
        }
      }
    });

    // Only touch body classes when something was actually inserted
    if (insertedImageCount > 0) {
      document.body.classList.add("has-banner-image", "has-banner");
    }
    if (insertedVideoCount > 0) {
      document.body.classList.add("has-banner-video", "has-banner");
    }

    // Notify other scripts (e.g. Metadata block)
    document.dispatchEvent(
      new CustomEvent("blogBannerReady", {
        detail: {
          insertedImageCount,
          insertedVideoCount,
          insertedBanners, // Map<viewItem, bannerEl>
        },
        bubbles: false,
      })
    );
  }

  /* ─────────────────────────────────────────────
     Banner builders
  ───────────────────────────────────────────── */

  /**
   * Creates and inserts an image banner.
   * @returns {Element|null} The inserted banner div, or null on failure.
   */
  function insertImageBanner(destination, bannerBlock, config) {
    const sourceImg = bannerBlock.querySelector("img");
    if (!sourceImg) return null;

    const source = getBestImageSource(sourceImg);
    if (!source) return null;

    const focal = sourceImg.getAttribute("data-image-focal-point") || "0.5,0.5";
    const [rawX = "0.5", rawY = "0.5"] = focal.split(",");
    const focalX = normalizeFocalPoint(rawX);
    const focalY = normalizeFocalPoint(rawY);

    const banner = document.createElement("div");
    banner.className = `${config.imageBannerClass || "blog-item-cover-image"} is-loading`;
    banner.style.setProperty("--image-focal-point", `${focalX} ${focalY}`);
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");

    const img = document.createElement("img");
    img.src = source;

    const srcset = sourceImg.getAttribute("srcset");
    if (srcset) img.setAttribute("srcset", srcset);

    const sizes = sourceImg.getAttribute("sizes");
    if (sizes) img.setAttribute("sizes", sizes);

    img.setAttribute("alt", sourceImg.getAttribute("alt") || "");
    img.setAttribute("loading", "eager");
    img.setAttribute("fetchpriority", "high");
    img.setAttribute("decoding", "async");
    img.style.objectPosition = `${focalX} ${focalY}`;

    const markLoaded = () => {
      banner.classList.remove("is-loading");
      banner.classList.add("is-loaded");
    };

    if (img.complete) {
      markLoaded();
    } else {
      img.addEventListener("load", markLoaded);
      img.addEventListener("error", markLoaded);
    }

    banner.appendChild(img);

    if (config.displayCaption) {
      const captionData = extractCaptionData(bannerBlock, config);
      if (captionData.hasContent) {
        const captionUI = createCaptionUI(captionData, config);
        banner.appendChild(captionUI.panel);
        banner.appendChild(captionUI.toggle);
      }
    }

    insertBanner(destination, banner, config.insertionMethod);
    return banner;
  }

  /**
   * Creates and inserts a video banner.
   * @returns {Element|null}
   */
  function insertVideoBanner(destination, videoBlock, config) {
    if (!videoBlock) return null;

    const banner = document.createElement("div");
    banner.className = config.videoBannerClass || "blog-item-cover-video";
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");
    banner.appendChild(videoBlock);

    insertBanner(destination, banner, config.insertionMethod);
    return banner;
  }

  /* ─────────────────────────────────────────────
     Source block cleanup
  ───────────────────────────────────────────── */

  /**
   * Walks up from the bannerBlock to its .sqs-block ancestor and marks it
   * with `blog-banner-source`. CSS will hide it outside edit mode.
   * In edit mode (body.sqs-edit-mode-active), Squarespace keeps it visible.
   */
  function markSourceBlock(bannerBlock) {
    let el = bannerBlock;
    while (el && el !== document.body) {
      if (el.classList.contains("sqs-block")) {
        el.classList.add("blog-banner-source");
        // aria-hidden only outside edit mode – handled via CSS :not() selector
        if (!isEditMode()) {
          el.setAttribute("aria-hidden", "true");
        }
        break;
      }
      el = el.parentElement;
    }
  }

  /* ─────────────────────────────────────────────
     DOM helpers
  ───────────────────────────────────────────── */

  function getBestImageSource(img) {
    return (
      img.currentSrc ||
      img.getAttribute("src") ||
      img.getAttribute("data-src") ||
      img.getAttribute("data-image") ||
      ""
    );
  }

  function insertBanner(destination, bannerElement, method) {
    removeExistingBanners(destination);
    if (method === "prepend") {
      destination.insertBefore(bannerElement, destination.firstChild);
    } else {
      destination.appendChild(bannerElement);
    }
  }

  function removeExistingBanners(container) {
    [".blog-item-cover-image", ".blog-item-cover-video"].forEach((selector) => {
      container.querySelectorAll(selector).forEach((el) => el.remove());
    });
  }

  /* ─────────────────────────────────────────────
     Caption
  ───────────────────────────────────────────── */

  function extractCaptionData(bannerBlock, config) {
    const figure =
      bannerBlock.closest("figure") ||
      bannerBlock.querySelector("figure") ||
      bannerBlock;
    const figcaption = figure.querySelector("figcaption");

    if (!figcaption) {
      return { hasContent: false, title: "", subtitle: "", href: "", linkLabel: config.captionLinkLabel || "Learn more" };
    }

    const titleEl = figcaption.querySelector(".image-title p, .image-title");
    const subtitleEl = figcaption.querySelector(".image-subtitle p, .image-subtitle");
    const linkEl = figcaption.querySelector("a");

    const title = titleEl ? titleEl.textContent.trim() : "";
    const subtitle = subtitleEl ? subtitleEl.textContent.trim() : "";
    const href = linkEl ? linkEl.getAttribute("href") || "" : "";

    return {
      hasContent: Boolean(title || subtitle || href),
      title,
      subtitle,
      href,
      linkLabel: (linkEl && linkEl.textContent.trim()) || config.captionLinkLabel || "Learn more",
    };
  }

  function createCaptionUI(captionData, config) {
    const uid = "blog-banner-caption-" + Math.random().toString(36).slice(2, 10);

    const panel = document.createElement("div");
    panel.className = "blog-banner-caption-panel";
    panel.id = uid;
    panel.hidden = true;

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "blog-banner-caption-close";
    closeButton.setAttribute("aria-label", "Fermer la légende");
    closeButton.innerHTML = getCloseIcon();
    panel.appendChild(closeButton);

    if (captionData.title) {
      const title = document.createElement("div");
      title.className = "blog-banner-caption-title";
      title.textContent = captionData.title;
      panel.appendChild(title);
    }

    if (captionData.subtitle) {
      const subtitle = document.createElement("div");
      subtitle.className = "blog-banner-caption-subtitle";
      subtitle.textContent = captionData.subtitle;
      panel.appendChild(subtitle);
    }

    if (captionData.href) {
      const link = document.createElement("a");
      link.className = "blog-banner-caption-link";
      link.href = captionData.href;
      link.textContent = captionData.linkLabel;
      panel.appendChild(link);
    }

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "blog-banner-caption-toggle";
    toggle.setAttribute("aria-label", "Afficher la légende");
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-controls", uid);
    toggle.innerHTML = getInfoIcon();

    toggle.addEventListener("click", function () {
      const isOpen = !panel.hidden;
      panel.hidden = isOpen;
      toggle.setAttribute("aria-expanded", String(!isOpen));
    });

    closeButton.addEventListener("click", function () {
      panel.hidden = true;
      toggle.setAttribute("aria-expanded", "false");
    });

    return { panel, toggle };
  }

  /* ─────────────────────────────────────────────
     Utilities
  ───────────────────────────────────────────── */

  function normalizeFocalPoint(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return "50%";
    return `${Math.max(0, Math.min(1, n)) * 100}%`;
  }

  function isEditMode() {
    return document.body.classList.contains("sqs-edit-mode-active");
  }

  /* ─────────────────────────────────────────────
     Icons
  ───────────────────────────────────────────── */

  function getInfoIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
      <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12" cy="7" r="1.2" fill="currentColor"/>
    </svg>`;
  }

  function getCloseIcon() {
    return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
  }
})();
