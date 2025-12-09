/**
 * Automatic Table of Contents
 *
 * Uses global configuration: window.tableOfContentSettings
 * (single object or array of objects).
 *
 * Example config (in Squarespace Code Injection):
 *
 * window.tableOfContentSettings = [
 *   {
 *     requiredBodyClasses: ["collection-XXXX", "view-item"],
 *     selectors: ".blog-anchor-title, .html-block h2",
 *     targetContainerSelector: ".blog-item-wrapper",
 *     insertPosition: "prepend", // "prepend" | "append" | number
 *     sticky: true,
 *     scrollOffset: "200px",     // can be "200px" or var(--header-height)
 *     activeZoneTop: 0.3,        // 0–1, fraction of viewport height
 *     backLink: {
 *       enabled: true,
 *       url: "/exhibitions",
 *       label: "Exhibitions",
 *       icon: "chevron_backward"
 *     }
 *   }
 * ];
 */

(function () {
  if (typeof window === "undefined") return;

  function getMatchingConfig() {
    const raw = window.tableOfContentSettings;
    if (!raw) return null;

    const allConfigs = Array.isArray(raw) ? raw : [raw];

    return allConfigs.find((cfg) =>
      (cfg.requiredBodyClasses || []).every((cls) =>
        document.body.classList.contains(cls)
      )
    );
  }

  function getScrollOffsetPx(value) {
    if (!value) return 0;

    // Support CSS variables: var(--header-height)
    if (value.includes("var(")) {
      const el = document.createElement("div");
      el.style.cssText =
        "position:absolute;visibility:hidden;scroll-margin-top:" + value;
      document.body.appendChild(el);
      const px = parseInt(getComputedStyle(el).scrollMarginTop, 10) || 0;
      el.remove();
      return px;
    }

    return parseInt(value, 10) || 0;
  }

  function defineTOCHeightVariable(toc) {
    const update = () => {
      document.documentElement.style.setProperty(
        "--toc-height",
        toc.offsetHeight + "px"
      );
    };

    // ResizeObserver
    if ("ResizeObserver" in window) {
      const ro = new ResizeObserver(update);
      ro.observe(toc);
    }

    // MutationObserver (content changes)
    if ("MutationObserver" in window) {
      const mo = new MutationObserver(update);
      mo.observe(toc, { childList: true, subtree: true });
    }

    window.addEventListener("resize", update);
    update();
  }

  function initTOC(config) {
    const contentWrapper =
      document.querySelector(".blog-item-content") ||
      document.querySelector(config.contentSelector || ".blog-item-content");

    const targetContainer = document.querySelector(
      config.targetContainerSelector || ".blog-item-top-wrapper"
    );

    if (!contentWrapper || !targetContainer) return;

    const headings = [
      ...contentWrapper.querySelectorAll(
        config.selectors || ".blog-anchor-title, .html-block h3"
      ),
    ];

    if (headings.length === 0 && !config.backLink?.enabled) return;

    // Container
    const tocContainer = document.createElement("nav");
    tocContainer.className = "blog-item-table-of-contents";
    tocContainer.setAttribute("aria-label", "Table of contents");
    if (config.sticky) tocContainer.classList.add("is-sticky");

    const tocInner = document.createElement("div");
    tocInner.className = "table-of-contents-inner";

    const tocList = document.createElement("div");
    tocList.className = "table-of-contents-list";

    const tocLinks = [];

    // Optional back link
    if (config.backLink?.enabled && config.backLink.url) {
      const back = document.createElement("a");
      back.href = config.backLink.url;
      back.className =
        "table-of-contents-back-link table-of-contents-item";
      const icon = config.backLink.icon || "←";
      back.innerHTML =
        '<span class="back-icon">' +
        icon +
        '</span> <span class="back-label">' +
        (config.backLink.label || "Back") +
        "</span>";
      tocList.appendChild(back);
    }

    // Headings → links
    headings.forEach((heading, i) => {
      const text = heading.textContent.trim();
      const id =
        text.replace(/\s+/g, "_").replace(/[^\w-]/g, "") + "_" + i;
      heading.setAttribute("id", id);

      const link = document.createElement("a");
      link.href = "#" + id;
      link.className = "table-of-contents-item";
      link.setAttribute("role", "link");
      link.textContent = text;

      link.addEventListener("click", (e) => {
        e.preventDefault();
        const offset = getScrollOffsetPx(config.scrollOffset);
        const target = document.getElementById(id);
        if (target) {
          const top =
            target.getBoundingClientRect().top +
            window.scrollY -
            offset;
          window.scrollTo({ top, behavior: "smooth" });
        }
      });

      tocList.appendChild(link);
      tocLinks.push({ id, link });
    });

    tocInner.appendChild(tocList);
    tocContainer.appendChild(tocInner);

    // Insert into DOM
    const pos = config.insertPosition;
    if (pos === "prepend") {
      targetContainer.prepend(tocContainer);
    } else if (pos === "append" || pos == null) {
      targetContainer.appendChild(tocContainer);
    } else if (typeof pos === "number") {
      const children = targetContainer.children;
      const idx = Math.max(0, Math.min(pos, children.length));
      targetContainer.insertBefore(tocContainer, children[idx]);
    }

    document.body.classList.add("has-table-of-contents");

    defineTOCHeightVariable(tocContainer);
    observeActiveSection(headings, tocLinks, config.activeZoneTop || 0.3);
  }

  function observeActiveSection(headings, tocLinks, zone) {
    const sections = headings.map((h, i) => {
      const next = headings[i + 1];
      const blocks = [];
      let node = h.parentElement?.nextElementSibling;
      while (node && (!next || node !== next.parentElement)) {
        blocks.push(node);
        node = node.nextElementSibling;
      }
      return { id: h.id, title: h, blocks };
    });

    const links = tocLinks.map((t) => t.link);

    function getSectionTop(section) {
      const rects = [
        section.title.getBoundingClientRect(),
        ...section.blocks
          .map((b) => b?.getBoundingClientRect())
          .filter(Boolean),
      ];
      return Math.min(...rects.map((r) => r.top));
    }

    function updateActive() {
      const threshold = window.innerHeight * zone;
      let active = null;

      for (const s of sections) {
        const top = getSectionTop(s);
        if (top < threshold) active = s;
        else break;
      }

      links.forEach((l) => l.classList.remove("is-active"));

      if (active) {
        const found = document.querySelector(
          '.table-of-contents-item[href="#' + active.id + '"]'
        );
        if (found) found.classList.add("is-active");
      }
    }

    window.addEventListener("scroll", () =>
      requestAnimationFrame(updateActive)
    );
    updateActive();
  }

  function bootstrap() {
    if (!document.body) return;
    if (document.body.classList.contains("sqs-edit-mode-active")) return;

    const matchedConfig = getMatchingConfig();
    if (!matchedConfig) return;

    if (document.querySelector(".blog-item-table-of-contents")) return;

    initTOC(matchedConfig);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
