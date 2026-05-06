<script>
/**
 * Blog Banner – v4.3.0
 *
 * Ajout vs v4.2 :
 *  1. Ajoute une classe body si :
 *     - bodyClassConditions correspond
 *     - bannerSelectors trouve au moins un élément dans la page
 *  2. Classe par défaut : has-banner-image
 *     Peut être personnalisée avec config.bannerSourceBodyClass
 *  3. imageLoading configurable :
 *     - défaut : "auto"
 *     - option : "eager"
 */

(function () {
  "use strict";

  const insertedBanners = new Map();

  window.BlogBanner = {
    getBannerFor(viewItem) {
      return insertedBanners.get(viewItem) || null;
    },
    getBanneredItems() {
      return Array.from(insertedBanners.keys());
    },
    refresh() {
      initializeBanners();
    },
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeBanners);
  } else {
    initializeBanners();
  }

  function initializeBanners() {
    const configList = window.blogBannerConfig || [];
    const bodyClasses = document.body.classList;

    configList.forEach((config) => {
      const matches = Array.isArray(config.bodyClassConditions)
        ? config.bodyClassConditions.every((cls) => bodyClasses.contains(cls))
        : true;

      if (!matches) return;

      markBannerSourcePresence(config);
      applyBannerConfig(config);
    });
  }

  function markBannerSourcePresence(config) {
    if (!config.bannerSelectors) return;

    const hasBannerSource = Boolean(document.querySelector(config.bannerSelectors));
    if (!hasBannerSource) return;

    document.body.classList.add(
      config.bannerSourceBodyClass || "has-banner-image"
    );
  }

  function applyBannerConfig(config) {
    let insertedImageCount = 0;
    let insertedVideoCount = 0;

    document.querySelectorAll(".blog-item-content-wrapper").forEach((contentWrapper) => {
      const viewItem = contentWrapper.closest(".view-item");
      if (!viewItem) return;

      if (insertedBanners.has(viewItem)) return;

      const destination = viewItem.querySelector(config.destinationSelector);
      if (!destination) return;

      const bannerBlock = selectBannerBlock(contentWrapper, config);
      const videoBlock = config.allowVideoFallback
        ? contentWrapper.querySelector(".video-block")
        : null;

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

    if (insertedImageCount > 0) {
      document.body.classList.add("has-banner-image", "has-banner");
      addBodyClasses(config.bodyClass);
    }

    if (insertedVideoCount > 0) {
      document.body.classList.add("has-banner-video", "has-banner");
      addBodyClasses(config.bodyClass);
    }

    document.dispatchEvent(
      new CustomEvent("blogBannerReady", {
        detail: { insertedImageCount, insertedVideoCount, insertedBanners },
        bubbles: false,
      })
    );
  }

  function selectBannerBlock(contentWrapper, config) {
    const all = Array.from(contentWrapper.querySelectorAll(config.bannerSelectors));
    if (all.length === 0) return null;

    const pos = config.bannerPosition;

    if (pos === "last") return all[all.length - 1];
    if (typeof pos === "number") return all[pos] || null;

    return all[0];
  }

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

    if (config.imageLoading === "eager") {
      img.setAttribute("loading", "eager");
    } else {
      img.setAttribute("loading", "auto");
    }

    img.setAttribute("decoding", "async");
    img.style.objectPosition = `${focalX} ${focalY}`;

    const markLoaded = () => {
      banner.classList.remove("is-loading");
      banner.classList.add("is-loaded");
    };

    if (img.complete) {
      markLoaded();
    } else {
      img.addEventListener("load", markLoaded, { once: true });
      img.addEventListener("error", markLoaded, { once: true });
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

  function insertVideoBanner(destination, videoBlock, config) {
    if (!videoBlock) return null;

    const banner = document.createElement("div");
    banner.className = config.videoBannerClass || "blog-item-cover-video";
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");
    banner.appendChild(videoBlock);

    insertBanner(destination, banner, config.insertionMethod);
    return banner;
  }

  function markSourceBlock(bannerBlock) {
    let el = bannerBlock;

    while (el && el !== document.body) {
      if (el.classList.contains("sqs-block")) {
        el.classList.add("blog-banner-source");
        if (!isEditMode()) {
          el.setAttribute("aria-hidden", "true");
        }
        break;
      }
      el = el.parentElement;
    }
  }

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

  function addBodyClasses(bodyClass) {
    if (!bodyClass) return;

    const classes = Array.isArray(bodyClass) ? bodyClass : [bodyClass];

    classes.forEach((cls) => {
      if (cls && typeof cls === "string") {
        document.body.classList.add(cls);
      }
    });
  }

  function extractCaptionData(bannerBlock, config) {
    const figure =
      bannerBlock.closest("figure") ||
      bannerBlock.querySelector("figure") ||
      bannerBlock;

    const figcaption = figure.querySelector("figcaption");

    if (!figcaption) {
      return {
        hasContent: false,
        title: "",
        subtitle: "",
        href: "",
        linkLabel: config.captionLinkLabel || "Learn more",
      };
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
      linkLabel:
        (linkEl && linkEl.textContent.trim()) ||
        config.captionLinkLabel ||
        "Learn more",
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

  function normalizeFocalPoint(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return "50%";
    return `${Math.max(0, Math.min(1, n)) * 100}%`;
  }

  function isEditMode() {
    return document.body.classList.contains("sqs-edit-mode-active");
  }

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
</script>
