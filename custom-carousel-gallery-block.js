(() => {
  "use strict";

  const CFG = window.CustomCarouselGalleryBlockConfig || {};

  function bodyMatches(bodyClassConfiguration) {
    if (!bodyClassConfiguration) return true;
    const list = Array.isArray(bodyClassConfiguration)
      ? bodyClassConfiguration
      : [bodyClassConfiguration];
    return list.every((cls) => document.body.classList.contains(cls));
  }

  function selectOccurrences(blocks, occurrence) {
    if (!Array.isArray(blocks) || !blocks.length) return [];

    if (occurrence === undefined || occurrence === null || occurrence === "all") return blocks;
    if (occurrence === "first") return blocks.slice(0, 1);
    if (occurrence === "last") return blocks.slice(-1);
    if (typeof occurrence === "number") return blocks[occurrence - 1] ? [blocks[occurrence - 1]] : [];
    if (Array.isArray(occurrence)) return occurrence.map((n) => blocks[n - 1]).filter(Boolean);

    return blocks;
  }

  function getStackedBlocks() {
    return Array.from(
      document.querySelectorAll(".sqs-block.gallery-block.sqs-block-gallery")
    ).filter((block) => {
      const gallery = block.querySelector(".sqs-gallery-container.sqs-gallery-block-stacked .sqs-gallery");
      return Boolean(gallery && gallery.querySelector(".image-wrapper"));
    });
  }

  function getStackedItems(block) {
    const gallery = block.querySelector(".sqs-gallery-container.sqs-gallery-block-stacked .sqs-gallery");
    if (!gallery) return null;

    const children = Array.from(gallery.children);
    const items = [];

    for (let i = 0; i < children.length; i += 1) {
      const node = children[i];
      if (!node.classList.contains("image-wrapper")) continue;

      const next = children[i + 1];
      const meta = next && next.classList.contains("meta") ? next : null;

      items.push({ imageWrapper: node, meta });
      if (meta) i += 1;
    }

    return { gallery, items };
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

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createCaption(meta) {
    if (!meta || CFG.carousel?.showCaptions === false) return null;

    const title = meta.querySelector(".meta-title")?.textContent.trim() || "";
    const descLines = normalizeDescriptionLines(
      meta.querySelector(".meta-description")?.innerHTML.trim() || ""
    );

    const caption = document.createElement("div");
    caption.className = "custom-gallery-blocks-caption custom-carousel-gallery-block-caption";

    if (title) {
      const titleEl = document.createElement("div");
      titleEl.className = "custom-gallery-blocks-caption-title";
      titleEl.textContent = title;
      caption.appendChild(titleEl);
    }

    if (descLines.length) {
      const desc = document.createElement("div");
      desc.className = "custom-gallery-blocks-caption-description";

      descLines.forEach((line, index) => {
        const lineEl = document.createElement("span");
        lineEl.className = "custom-gallery-blocks-caption-line";
        lineEl.textContent = line;
        desc.appendChild(lineEl);

        if (index < descLines.length - 1) {
          const sep = document.createElement("span");
          sep.className = "custom-gallery-blocks-caption-separator";
          sep.textContent = ", ";
          desc.appendChild(sep);
        }
      });

      caption.appendChild(desc);
    }

    return caption.childNodes.length ? caption : null;
  }

  function buildFancyboxCaption(meta, prefixes) {
    if (!meta || CFG.fancybox?.showCaptions === false) return "";

    const generic = prefixes?.generic || "custom-gallery-blocks-fancybox";
    const specific = prefixes?.specific || "custom-carousel-gallery-block";

    const title = meta.querySelector(".meta-title")?.textContent.trim() || "";
    const descLines = normalizeDescriptionLines(
      meta.querySelector(".meta-description")?.innerHTML.trim() || ""
    );

    const bits = [];

    if (title) {
      bits.push(
        `<div class="${generic}-header ${specific}-header"><div class="${generic}-title ${specific}-title">${escapeHtml(title)}</div></div>`
      );
    }

    if (descLines.length) {
      bits.push(
        `<div class="${generic}-details ${specific}-details">${descLines.map((line) => `<div class="${generic}-line ${specific}-line">${escapeHtml(line)}</div>`).join("")}</div>`
      );
    }

    if (!bits.length) return "";
    return `<div class="${generic}-caption ${specific}-caption">${bits.join("")}</div>`;
  }

  function applyFancyboxUiClasses(instance, prefixes) {
    const generic = prefixes?.generic || "custom-gallery-blocks-fancybox";
    const specific = prefixes?.specific || "custom-carousel-gallery-block";

    const container = instance?.container || null;
    const dialog = container?.closest("dialog.fancybox__dialog") || null;
    const carousel = container?.querySelector(".fancybox__carousel") || null;

    if (dialog) dialog.classList.add(`${generic}-dialog`, `${specific}-dialog`);
    if (container) container.classList.add(`${generic}-container`, `${specific}-container`);
    if (carousel) carousel.classList.add(`${generic}-carousel`, `${specific}-carousel`);

    if (container) {
      container.querySelectorAll(".fancybox__slide").forEach((slideEl) => {
        slideEl.classList.add(`${generic}-slide`, `${specific}-slide`);
      });
    }
  }

  function bindFancybox(selector, prefixes, options) {
    if (!window.Fancybox) return;

    Fancybox.bind(selector, {
      ...options,
      on: {
        ...(options?.on || {}),
        init: (fb) => {
          queueMicrotask(() => applyFancyboxUiClasses(fb, prefixes));
          if (typeof options?.on?.init === "function") options.on.init(fb);
        },
        ready: (fb) => {
          queueMicrotask(() => applyFancyboxUiClasses(fb, prefixes));
          setTimeout(() => applyFancyboxUiClasses(fb, prefixes), 0);
          setTimeout(() => applyFancyboxUiClasses(fb, prefixes), 60);
          if (typeof options?.on?.ready === "function") options.on.ready(fb);
        },
        reveal: (fb, slide) => {
          queueMicrotask(() => applyFancyboxUiClasses(fb, prefixes));
          if (slide?.el) {
            slide.el.classList.add(
              `${prefixes.generic}-slide`,
              `${prefixes.specific}-slide`
            );
          }
          if (typeof options?.on?.reveal === "function") options.on.reveal(fb, slide);
        },
        createSlide: (fb, slide) => {
          queueMicrotask(() => applyFancyboxUiClasses(fb, prefixes));
          if (slide?.el) {
            slide.el.classList.add(
              `${prefixes.generic}-slide`,
              `${prefixes.specific}-slide`
            );
          }
          if (typeof options?.on?.createSlide === "function") options.on.createSlide(fb, slide);
        }
      }
    });
  }

  function initBlock(block, index) {
    if (block.dataset.customCarouselGalleryBlockReady === "true") return;
    block.dataset.customCarouselGalleryBlockReady = "true";

    if (CFG.customClass) block.classList.add(CFG.customClass);

    const data = getStackedItems(block);
    if (!data || !data.items.length) return;

    const { gallery, items } = data;
    const groupName = `custom-carousel-gallery-block-${index + 1}`;

    block.classList.add("custom-gallery-blocks-mode-carousel");
    if (CFG.carousel?.fullWidth !== false) {
      block.classList.add("custom-gallery-blocks-carousel-full-width");
    }

    gallery.classList.add("custom-gallery-blocks-carousel-gallery");
    gallery.style.setProperty("--custom-gallery-blocks-carousel-gap", `${CFG.carousel?.gap ?? 10}px`);
    gallery.style.setProperty("--custom-gallery-blocks-carousel-row-height", CFG.carousel?.rowHeight || "clamp(220px, 60vh, 864px)");
    gallery.style.setProperty("--custom-gallery-blocks-carousel-caption-gap", CFG.carousel?.captionGap || "0rem");
    gallery.style.setProperty("--custom-gallery-blocks-carousel-mobile-gap", `${CFG.carousel?.mobileGap ?? 10}px`);

    const root = document.createElement("div");
    root.className = "custom-gallery-blocks-carousel";

    const track = document.createElement("div");
    track.className = "custom-gallery-blocks-carousel-track";

    const cards = items.map((item) => {
      const card = document.createElement("div");
      card.className = "custom-gallery-blocks-carousel-item";

      const media = document.createElement("div");
      media.className = "custom-gallery-blocks-carousel-media";

      const img = item.imageWrapper.querySelector("img");
      const src = getImageSrc(img);

      if (img && src) {
        let anchor = item.imageWrapper.querySelector("a.custom-gallery-blocks-lightbox-link");

        if (!anchor) {
          anchor = document.createElement("a");
          anchor.className = "custom-gallery-blocks-lightbox-link";
          img.parentNode.insertBefore(anchor, img);
          anchor.appendChild(img);
        }

        anchor.href = src;

        if (CFG.fancybox?.enabled !== false) {
          anchor.setAttribute("data-fancybox", groupName);
          anchor.setAttribute("data-type", "image");

          const caption = buildFancyboxCaption(item.meta, CFG.fancyboxClassPrefixes);
          if (caption) anchor.setAttribute("data-caption", caption);
        }
      }

      media.appendChild(item.imageWrapper);
      card.appendChild(media);

      const caption = createCaption(item.meta);
      if (caption) card.appendChild(caption);

      return card;
    });

    cards.forEach((card) => track.appendChild(card));
    root.appendChild(track);

    let prevBtn = null;
    let nextBtn = null;

    if (CFG.carousel?.nav?.enabled !== false) {
      const controls = document.createElement("div");
      controls.className = "custom-gallery-blocks-carousel-controls";

      prevBtn = document.createElement("button");
      prevBtn.type = "button";
      prevBtn.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-prev";
      prevBtn.setAttribute("aria-label", CFG.carousel?.nav?.prevLabel || "Précédent");
      prevBtn.textContent = CFG.carousel?.nav?.prevText || "←";

      nextBtn = document.createElement("button");
      nextBtn.type = "button";
      nextBtn.className = "custom-gallery-blocks-carousel-button custom-gallery-blocks-carousel-button-next";
      nextBtn.setAttribute("aria-label", CFG.carousel?.nav?.nextLabel || "Suivant");
      nextBtn.textContent = CFG.carousel?.nav?.nextText || "→";

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
      const active = window.matchMedia(`(max-width: ${(CFG.carousel?.mobileBreakpoint ?? 768) - 0.02}px)`).matches;
      const bandWidth = getBandWidthPx();

      cards.forEach((card) => {
        const img = card.querySelector("img");
        if (!img) return;

        img.classList.remove("is-crop");

        if (!active) return;
        if ((CFG.carousel?.mobileCropMode || "none") !== "conditional-4-5") return;

        const renderedHeight = img.getBoundingClientRect().height || img.offsetHeight;
        const dims = getImageDimensions(img);

        const w = dims?.width || img.naturalWidth || 0;
        const h = dims?.height || img.naturalHeight || 0;

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

    const ro = new ResizeObserver(refresh);
    ro.observe(track);

    const mo = new MutationObserver(refresh);
    mo.observe(block.closest("section") || block, {
      childList: true,
      subtree: true,
      attributes: true
    });

    cards.forEach((card) => {
      const img = card.querySelector("img");
      if (img) {
        if (img.complete) {
          refresh();
        } else {
          img.addEventListener("load", refresh, { once: true });
        }
      }
    });

    window.addEventListener("orientationchange", refresh);
    window.addEventListener("resize", refresh);
    window.addEventListener("load", refresh);

    setTimeout(refresh, 100);
    setTimeout(refresh, 400);
    setTimeout(refresh, 900);

    if (CFG.fancybox?.enabled !== false) {
      bindFancybox(
        `[data-fancybox="${groupName}"]`,
        CFG.fancyboxClassPrefixes || {},
        CFG.fancybox?.options || {}
      );
    }

    refresh();
  }

  function run() {
    if (!bodyMatches(CFG.bodyClassConfiguration)) return;
    const blocks = selectOccurrences(getStackedBlocks(), CFG.occurrence);
    blocks.forEach(initBlock);
  }

  document.addEventListener("DOMContentLoaded", run);
  window.addEventListener("page:loaded", run);
  window.addEventListener("site:refresh", run);
})();
