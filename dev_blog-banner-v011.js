(function () {
  "use strict";

  if (window.__blogBannerLoaded) {
    console.warn("[BlogBanner] Script chargé deux fois — second run ignoré.");
    return;
  }
  window.__blogBannerLoaded = true;

  function dbg() {
    if (window.blogBannerDebug) {
      console.warn.apply(console, ["[BlogBanner]"].concat(Array.prototype.slice.call(arguments)));
    }
  }

  const insertedBanners = new Map();
    const BANNER_WIDTHS = [750, 1000, 1500, 2500];
  let didPreloadFirstBanner = false;

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

    dbg("initializeBanners — body classes:", Array.from(bodyClasses).join(" "));

    configList.forEach(function (config, i) {
      const matches = config.bodyClassConditions.every(function (cls) {
        return bodyClasses.contains(cls);
      });

      dbg("config[" + i + "] match:", matches, config.bodyClassConditions);

      if (matches) applyBannerConfig(config);
    });
  }

  function applyBannerConfig(config) {
    resetManagedBodyClasses(config);

    let insertedImageCount = 0;
    let insertedVideoCount = 0;

    const wrappers = document.querySelectorAll(".blog-item-content-wrapper");
    dbg("applyBannerConfig — wrappers:", wrappers.length);

    wrappers.forEach(function (contentWrapper, i) {
      const viewItem = contentWrapper.closest(".view-item");

      if (!viewItem) {
        dbg("wrapper[" + i + "] — pas de .view-item, ignoré");
        return;
      }

      if (insertedBanners.has(viewItem)) {
        dbg("wrapper[" + i + "] — déjà traité, ignoré");
        return;
      }

      const destination = viewItem.querySelector(config.destinationSelector);

      if (!destination) {
        dbg("wrapper[" + i + "] — destination introuvable, ignoré");
        return;
      }

      const bannerBlock = selectBannerBlock(contentWrapper, config);
      const videoBlock = config.allowVideoFallback
        ? contentWrapper.querySelector(".video-block")
        : null;

      dbg("wrapper[" + i + "] — bannerBlock:", bannerBlock, "| videoBlock:", videoBlock);

      if (bannerBlock) {
        const banner = insertImageBanner(destination, bannerBlock, config);
        dbg("wrapper[" + i + "] — insertImageBanner →", banner ? "OK" : "null");

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

    dbg("insertedImageCount:", insertedImageCount, "| insertedVideoCount:", insertedVideoCount);

    if (insertedImageCount > 0) {
      document.body.classList.add("has-blog-banner-image", "has-banner");
      addBodyClasses(config.bodyClass);
    }

    if (insertedVideoCount > 0) {
      document.body.classList.add("has-blog-banner-video", "has-banner");
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
    const parts = focal.split(",");
    const focalX = normalizeFocalPoint(parts[0] !== undefined ? parts[0] : "0.5");
    const focalY = normalizeFocalPoint(parts[1] !== undefined ? parts[1] : "0.5");

    const banner = document.createElement("div");
    banner.className = (config.imageBannerClass || "blog-item-cover-image") + " is-loading";
    banner.style.setProperty("--image-focal-point", focalX + " " + focalY);
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");

        const img = document.createElement("img");
    const bannerSrc = stripImageFormat(source) + "?format=" + (config.bannerFallbackWidth || 1500) + "w";
    const bannerSrcset = buildBannerSrcset(source);
    const bannerSizes = config.bannerSizes || "100vw";

    preloadBannerImage(bannerSrc, bannerSrcset, bannerSizes);

    img.src = bannerSrc;
    img.setAttribute("srcset", bannerSrcset);
    img.setAttribute("sizes", bannerSizes);
    img.setAttribute("alt", sourceImg.getAttribute("alt") || "");
    img.setAttribute("loading", "eager");
    img.setAttribute("decoding", "async");
    img.setAttribute("fetchpriority", "high");
    img.fetchPriority = "high";
    img.style.objectPosition = focalX + " " + focalY;

    const markLoaded = function () {
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
      img.getAttribute("data-src") ||
      img.getAttribute("data-image") ||
      img.getAttribute("src") ||
      img.currentSrc ||
      ""
    );
  }

  function stripImageFormat(url) {
    return String(url || "").replace(/\?format=\d+w.*$/, "");
  }

  function buildBannerSrcset(url) {
    const base = stripImageFormat(url);

    return BANNER_WIDTHS.map(function (w) {
      return base + "?format=" + w + "w " + w + "w";
    }).join(", ");
  }

  function preloadBannerImage(src, srcset, sizes) {
    if (didPreloadFirstBanner || !src) return;
    didPreloadFirstBanner = true;

    const link = document.createElement("link");
    link.rel = "preload";
    link.as = "image";
    link.href = src;

    if (srcset) link.setAttribute("imagesrcset", srcset);
    if (sizes) link.setAttribute("imagesizes", sizes);

    document.head.appendChild(link);
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
    [".blog-item-cover-image", ".blog-item-cover-video"].forEach(function (selector) {
      container.querySelectorAll(selector).forEach(function (el) {
        el.remove();
      });
    });
  }

  function resetManagedBodyClasses(config) {
    document.body.classList.remove(
      "has-blog-banner-image",
      "has-blog-banner-video",
      "has-banner"
    );

    if (!config || !config.bodyClass) return;

    const classes = Array.isArray(config.bodyClass)
      ? config.bodyClass
      : [config.bodyClass];

    classes.forEach(function (cls) {
      if (cls && typeof cls === "string") {
        document.body.classList.remove(cls);
      }
    });
  }

  function addBodyClasses(bodyClass) {
    if (!bodyClass) return;

    const classes = Array.isArray(bodyClass) ? bodyClass : [bodyClass];

    classes.forEach(function (cls) {
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
    closeButton.appendChild(makeMaterialIcon(config.captionCloseIcon || "close"));
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
    toggle.appendChild(makeMaterialIcon(config.captionToggleIcon || "info"));

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

  function makeMaterialIcon(name) {
    const span = document.createElement("span");
    span.className = "icon";
    span.setAttribute("aria-hidden", "true");
    span.textContent = name;
    return span;
  }

  function normalizeFocalPoint(value) {
    const n = parseFloat(value);

    if (Number.isNaN(n)) return "50%";

    return (Math.max(0, Math.min(1, n)) * 100) + "%";
  }

  function isEditMode() {
    return document.body.classList.contains("sqs-edit-mode-active");
  }

})();
