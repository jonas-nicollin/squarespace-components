document.addEventListener("DOMContentLoaded", function () {
  const configList = window.blogBannerConfig || [];

  function initializeBanners() {
    const bodyClasses = Array.from(document.body.classList);

    const activeConfig = configList.find(config =>
      config.bodyClassConditions.every(cls => bodyClasses.includes(cls))
    );

    if (!activeConfig) return;

    applyBannerConfig(activeConfig);
  }

  function applyBannerConfig(config) {
    document.querySelectorAll(".blog-item-content-wrapper").forEach(contentWrapper => {
      const viewItem = contentWrapper.closest(".view-item");
      if (!viewItem) return;

      const destination = viewItem.querySelector(config.destinationSelector);
      if (!destination) return;

      const bannerBlock = contentWrapper.querySelector(config.bannerSelectors);
      const videoBlock = config.allowVideoFallback
        ? contentWrapper.querySelector(".video-block")
        : null;

      if (bannerBlock) {
        insertImageBanner(destination, bannerBlock, config);
      } else if (videoBlock) {
        insertVideoBanner(destination, videoBlock, config);
      }
    });
  }

  function insertImageBanner(destination, bannerBlock, config) {
    const sourceImg = bannerBlock.querySelector("img");
    if (!sourceImg) return;

    const focal = sourceImg.getAttribute("data-image-focal-point") || "0.5,0.5";
    const [rawX = "0.5", rawY = "0.5"] = focal.split(",");

    const focalX = normalizeFocalPoint(rawX);
    const focalY = normalizeFocalPoint(rawY);

    const banner = document.createElement("div");
    banner.className = config.imageBannerClass || "blog-item-cover-image";
    banner.style.setProperty("--image-focal-point", `${focalX} ${focalY}`);
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");

    const img = document.createElement("img");
    img.src = sourceImg.currentSrc || sourceImg.getAttribute("src") || "";

    if (sourceImg.getAttribute("srcset")) {
      img.setAttribute("srcset", sourceImg.getAttribute("srcset"));
    }
    if (sourceImg.getAttribute("sizes")) {
      img.setAttribute("sizes", sourceImg.getAttribute("sizes"));
    }

    img.setAttribute("alt", sourceImg.getAttribute("alt") || "");
    img.setAttribute("loading", "eager");
    img.setAttribute("decoding", "async");
    img.style.objectPosition = `${focalX} ${focalY}`;

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

    if (!isEditMode()) {
      bannerBlock.style.display = "none";
    }
  }

  function insertVideoBanner(destination, videoBlock, config) {
    const banner = document.createElement("div");
    banner.className = config.videoBannerClass || "blog-item-cover-video";
    banner.style.setProperty("--banner-aspect-ratio", config.bannerAspectRatio || "16 / 9");

    banner.appendChild(videoBlock);
    insertBanner(destination, banner, config.insertionMethod);
  }

  function extractCaptionData(bannerBlock, config) {
    const figure = bannerBlock.closest("figure") || bannerBlock.querySelector("figure") || bannerBlock;
    const figcaption = figure.querySelector("figcaption");

    if (!figcaption) {
      return {
        hasContent: false,
        title: "",
        subtitle: "",
        href: "",
        linkLabel: config.captionLinkLabel || "Learn more"
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
      linkLabel: (linkEl && linkEl.textContent.trim()) || config.captionLinkLabel || "Learn more"
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
      title.innerHTML = escapeHtml(captionData.title);
      panel.appendChild(title);
    }

    if (captionData.subtitle) {
      const subtitle = document.createElement("div");
      subtitle.className = "blog-banner-caption-subtitle";
      subtitle.innerHTML = escapeHtml(captionData.subtitle);
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

  function insertBanner(destination, bannerElement, method) {
    removeExistingBanners(destination);

    if (method === "prepend") {
      destination.insertBefore(bannerElement, destination.firstChild);
    } else {
      destination.appendChild(bannerElement);
    }
  }

  function removeExistingBanners(container) {
    const existingSelectors = [
      ".blog-item-cover-image",
      ".blog-item-cover-video"
    ];

    existingSelectors.forEach(selector => {
      container.querySelectorAll(selector).forEach(el => el.remove());
    });
  }

  function normalizeFocalPoint(value) {
    const n = parseFloat(value);
    if (Number.isNaN(n)) return "50%";
    const clamped = Math.max(0, Math.min(1, n));
    return `${clamped * 100}%`;
  }

  function isEditMode() {
    return document.body.classList.contains("sqs-edit-mode-active");
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function getInfoIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"></circle>
        <line x1="12" y1="10" x2="12" y2="16" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
        <circle cx="12" cy="7" r="1.2" fill="currentColor"></circle>
      </svg>
    `;
  }

  function getCloseIcon() {
    return `
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
        <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"></line>
      </svg>
    `;
  }

  initializeBanners();
});
