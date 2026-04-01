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
    banner.style.setProperty(
      "--banner-aspect-ratio",
      config.bannerAspectRatio || "16 / 9"
    );

    const img = document.createElement("img");

    /* On conserve au maximum les attributs utiles de l'image d'origine */
    img.src = sourceImg.currentSrc || sourceImg.getAttribute("src") || "";
    if (sourceImg.getAttribute("srcset")) {
      img.setAttribute("srcset", sourceImg.getAttribute("srcset"));
    }
    if (sourceImg.getAttribute("sizes")) {
      img.setAttribute("sizes", sourceImg.getAttribute("sizes"));
    }
    if (sourceImg.getAttribute("alt")) {
      img.setAttribute("alt", sourceImg.getAttribute("alt"));
    } else {
      img.setAttribute("alt", "");
    }

    img.setAttribute("loading", "eager");
    img.setAttribute("decoding", "async");
    img.style.objectPosition = `${focalX} ${focalY}`;

    banner.appendChild(img);

    insertBanner(destination, banner, config.insertionMethod);

    if (!isEditMode()) {
      bannerBlock.style.display = "none";
    }
  }

  function insertVideoBanner(destination, videoBlock, config) {
    const banner = document.createElement("div");
    banner.className = config.videoBannerClass || "blog-item-cover-video";
    banner.style.setProperty(
      "--banner-aspect-ratio",
      config.bannerAspectRatio || "16 / 9"
    );

    banner.appendChild(videoBlock);
    insertBanner(destination, banner, config.insertionMethod);
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

    /* Clamp 0 → 1 puis conversion en % */
    const clamped = Math.max(0, Math.min(1, n));
    return `${clamped * 100}%`;
  }

  function isEditMode() {
    return document.body.classList.contains("sqs-edit-mode-active");
  }

  initializeBanners();
});
