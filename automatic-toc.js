/**
 * Automatic TOC — v001 (local candidate, 2026-10-13)
 * Configure window.tableOfContentSettings before loading this file.
 * One TOC per page; the first matching configuration wins.
 * Existing Squarespace defaults and CSS classes are retained.
 * Generic options: contentSelector, selectors, targetContainerSelector,
 * observeChanges (default true), anchorKeyAttribute (optional), ariaLabel.
 * API: window.AutomaticTOC.refresh() / destroy(). No dependencies.
 */
(function () {
  "use strict";
  if (typeof window === "undefined") return;
  if (window.AutomaticTOC) {
    window.AutomaticTOC.refresh();
    return;
  }

  const TOC = ".blog-item-table-of-contents";
  let instance = null;
  let frame = 0;
  let stopped = false;
  let lifecycleObserver;
  let bodyObserver;

  function matchingConfig() {
    if (!document.body || document.body.classList.contains("sqs-edit-mode-active")) return null;
    const raw = window.tableOfContentSettings;
    return (Array.isArray(raw) ? raw : [raw]).find(cfg =>
      cfg && cfg.enabled !== false &&
      (cfg.requiredBodyClasses || []).every(cls => document.body.classList.contains(cls))
    ) || null;
  }

  function query(root, selector, all) {
    try {
      return all ? Array.from(root.querySelectorAll(selector)) : root.querySelector(selector);
    } catch (error) {
      console.warn("[Automatic TOC] Invalid selector:", selector);
      return all ? [] : null;
    }
  }

  function schedule() {
    if (stopped || frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      refresh();
    });
  }

  function refresh() {
    if (stopped || !document.body) return;
    const config = matchingConfig();
    const content = config && query(document, config.contentSelector || ".blog-item-content");
    const target = config && query(document, config.targetContainerSelector || ".blog-item-top-wrapper");
    if (instance && (instance.config !== config || instance.content !== content ||
        instance.target !== target || !instance.nav.isConnected)) {
      instance.destroy();
      instance = null;
    }
    if (!config || !content || !target) return;
    // Never take over a TOC produced by another script version.
    if (!instance && document.querySelector(TOC)) return;
    if (!instance) instance = createTOC(config, content, target);
    instance.sync();
  }

  function createTOC(config, content, target) {
    const nav = document.createElement("nav");
    nav.className = "blog-item-table-of-contents";
    nav.setAttribute("aria-label", config.ariaLabel || "Table of contents");
    nav.classList.toggle("is-sticky", !!config.sticky);
    nav.hidden = true;
    const inner = document.createElement("div");
    inner.className = "table-of-contents-inner";
    const list = document.createElement("div");
    list.className = "table-of-contents-list";
    inner.appendChild(list);
    nav.appendChild(inner);

    let back = null;
    if (config.backLink?.enabled && config.backLink.url) {
      back = document.createElement("a");
      back.className = "table-of-contents-back-link table-of-contents-item";
      back.href = config.backLink.url;
      const icon = document.createElement("span");
      icon.className = "back-icon";
      icon.setAttribute("aria-hidden", "true");
      icon.textContent = config.backLink.icon || "←";
      const label = document.createElement("span");
      label.className = "back-label";
      label.textContent = config.backLink.label || "Back";
      back.append(icon, " ", label);
      list.appendChild(back);
    }

    const pos = config.insertPosition;
    if (pos === "prepend") target.prepend(nav);
    else if (typeof pos === "number" && Number.isFinite(pos)) {
      const index = Math.max(0, Math.min(Math.trunc(pos), target.children.length));
      target.insertBefore(nav, target.children[index] || null);
    } else target.appendChild(nav);

    const previousHeight = document.documentElement.style.getPropertyValue("--toc-height");
    const previousPriority = document.documentElement.style.getPropertyPriority("--toc-height");
    const hadBodyClass = document.body.classList.contains("has-table-of-contents");
    const rememberedIds = new Map();
    let records = [];
    let contentObserver;
    let resizeObserver;
    let activeFrame = 0;
    let destroyed = false;
    let hashHandled = false;
    let lastHeight = "";

    function updateHeight() {
      const height = (nav.hidden ? 0 : nav.offsetHeight) + "px";
      if (height === lastHeight) return;
      lastHeight = height;
      document.documentElement.style.setProperty("--toc-height", height);
    }

    function isVisible(heading) {
      return heading.getClientRects().length > 0 &&
        getComputedStyle(heading).visibility !== "hidden" &&
        !heading.closest('[hidden], [aria-hidden="true"]');
    }

    function updateActive() {
      if (destroyed) return;
      const value = Number(config.activeZoneTop ?? 0.3);
      const zone = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0.3;
      const threshold = window.innerHeight * zone;
      let active = null;
      records.forEach(record => {
        if (isVisible(record.heading) && record.heading.getBoundingClientRect().top <= threshold) active = record;
      });
      records.forEach(record => {
        const selected = record === active;
        if (record.link.classList.contains("is-active") !== selected) record.link.classList.toggle("is-active", selected);
        if (selected) {
          if (record.link.getAttribute("aria-current") !== "location") record.link.setAttribute("aria-current", "location");
        } else if (record.link.hasAttribute("aria-current")) record.link.removeAttribute("aria-current");
      });
      updateHeight();
    }

    function scheduleActive() {
      if (destroyed || activeFrame) return;
      activeFrame = requestAnimationFrame(() => { activeFrame = 0; updateActive(); });
    }

    function offsetPx() {
      const value = config.scrollOffset;
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      if (!value) return 0;
      const probe = document.createElement("span");
      probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;width:0;height:0;";
      // Unitless numeric strings remain compatible with the old script.
      const cssValue = /^-?\d+(\.\d+)?$/.test(String(value).trim()) ? value + "px" : value;
      probe.style.scrollMarginTop = cssValue;
      nav.appendChild(probe);
      const px = parseFloat(getComputedStyle(probe).scrollMarginTop) || 0;
      probe.remove();
      return px;
    }

    function scrollToHeading(heading, behavior) {
      if (!heading.isConnected) return;
      window.scrollTo({
        top: Math.max(0, heading.getBoundingClientRect().top + window.scrollY - offsetPx()),
        behavior
      });
    }

    function onClick(event) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target.closest("a");
      const record = records.find(item => item.link === link);
      if (!record) return;
      event.preventDefault();
      scrollToHeading(record.heading, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth");
    }

    function identity(heading, text, counts) {
      const attribute = config.anchorKeyAttribute;
      const explicit = attribute && heading.getAttribute(attribute);
      let owner = heading.parentElement;
      while (owner && owner !== content && !owner.id) owner = owner.parentElement;
      // Stable enclosing IDs also survive replacement of a generated heading.
      // With no such ID, use its text. An optional explicit key resolves ambiguity.
      const base = JSON.stringify(explicit ? ["key", explicit] :
        owner && owner !== content && owner.id ? ["owner", owner.id, heading.tagName] :
          ["text", heading.tagName, text]);
      const occurrence = counts.get(base) || 0;
      counts.set(base, occurrence + 1);
      return base + ":" + occurrence;
    }

    function ensureId(heading, text, index, key) {
      if (heading.id) {
        rememberedIds.set(key, heading.id);
        return heading.id;
      }
      // Keep the historical shape (About_0 etc.) on the initial scan.
      const base = rememberedIds.get(key) ||
        (text.replace(/\s+/g, "_").replace(/[^\w-]/g, "") || "toc-heading") + "_" + index;
      let id = base;
      let suffix = 2;
      while (document.getElementById(id)) id = base + "-" + suffix++;
      heading.id = id;
      rememberedIds.set(key, id);
      return id;
    }

    function sync() {
      if (destroyed) return;
      const candidates = query(content, config.selectors || ".blog-anchor-title, .html-block h3", true)
        .filter(h => !h.closest(TOC) && h.textContent.trim());
      const counts = new Map();
      const oldByHeading = new Map(records.map(record => [record.heading, record]));
      // querySelectorAll supplies document order and deduplicates overlapping selectors.
      const next = candidates.map((heading, index) => {
        const text = heading.textContent.trim();
        const key = identity(heading, text, counts);
        const id = ensureId(heading, text, index, key);
        const old = oldByHeading.get(heading);
        const link = old?.link || document.createElement("a");
        if (!old) link.className = "table-of-contents-item";
        const href = "#" + encodeURIComponent(id);
        if (link.getAttribute("href") !== href) link.setAttribute("href", href);
        if (link.textContent !== text) link.textContent = text;
        return { heading, link, id };
      });
      const keep = new Set(next.map(record => record.link));
      records.forEach(record => { if (!keep.has(record.link)) record.link.remove(); });
      let cursor = back ? back.nextSibling : list.firstChild;
      next.forEach(({ link }) => {
        if (link !== cursor) list.insertBefore(link, cursor);
        cursor = link.nextSibling;
      });
      records = next;
      const hidden = !back && !records.length;
      if (nav.hidden !== hidden) nav.hidden = hidden;
      if (!hadBodyClass) document.body.classList.toggle("has-table-of-contents", !hidden);
      updateActive();
      if (!hashHandled && location.hash) {
        let hash;
        try { hash = decodeURIComponent(location.hash.slice(1)); } catch (_) { hash = ""; }
        const match = records.find(record => record.id === hash);
        if (match) {
          hashHandled = true;
          scrollToHeading(match.heading, "instant");
          scheduleActive();
        }
      }
    }

    function outsideTOC(node) {
      const element = node.nodeType === 1 ? node : node.parentElement;
      return element && !element.closest(TOC);
    }

    if (config.observeChanges !== false && "MutationObserver" in window) {
      contentObserver = new MutationObserver(mutations => {
        if (mutations.some(mutation => outsideTOC(mutation.target))) schedule();
      });
      contentObserver.observe(content, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["id", "class", "hidden", "aria-hidden"].concat(config.anchorKeyAttribute ? [config.anchorKeyAttribute] : [])
      });
    }
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(scheduleActive);
      resizeObserver.observe(content);
      resizeObserver.observe(nav);
    }
    list.addEventListener("click", onClick);
    window.addEventListener("scroll", scheduleActive, { passive: true });
    window.addEventListener("resize", schedule);
    // Image loads and collapsible content can change positions without scrolling.
    content.addEventListener("load", scheduleActive, true);
    content.addEventListener("transitionend", scheduleActive);
    document.fonts?.ready.then(scheduleActive);

    return {
      config, content, target, nav, sync,
      destroy() {
        destroyed = true;
        contentObserver?.disconnect();
        resizeObserver?.disconnect();
        cancelAnimationFrame(activeFrame);
        list.removeEventListener("click", onClick);
        window.removeEventListener("scroll", scheduleActive);
        window.removeEventListener("resize", schedule);
        content.removeEventListener("load", scheduleActive, true);
        content.removeEventListener("transitionend", scheduleActive);
        nav.remove();
        if (!hadBodyClass) document.body.classList.remove("has-table-of-contents");
        if (previousHeight) document.documentElement.style.setProperty("--toc-height", previousHeight, previousPriority);
        else document.documentElement.style.removeProperty("--toc-height");
        // Heading IDs intentionally remain: existing URLs must keep working.
      }
    };
  }

  function start() {
    if (stopped || !document.body) return;
    refresh();
    if ("MutationObserver" in window && !lifecycleObserver) {
      // This lightweight guard only checks connectivity. Heading scans stay scoped.
      lifecycleObserver = new MutationObserver(() => {
        if (!instance || !instance.content.isConnected || !instance.target.isConnected || !instance.nav.isConnected) schedule();
      });
      lifecycleObserver.observe(document.body, { childList: true, subtree: true });
      bodyObserver = new MutationObserver(schedule);
      bodyObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    }
  }

  window.AutomaticTOC = {
    version: "v001",
    refresh,
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      lifecycleObserver?.disconnect();
      bodyObserver?.disconnect();
      instance?.destroy();
      instance = null;
      document.removeEventListener("DOMContentLoaded", start);
      document.removeEventListener("mercury:load", schedule);
      window.removeEventListener("pageshow", schedule);
      delete window.AutomaticTOC;
    }
  };
  document.addEventListener("mercury:load", schedule);
  window.addEventListener("pageshow", schedule);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
