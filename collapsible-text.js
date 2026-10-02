// Collapsible Text Section — script v002
// Charger apres collapsible-text-config-v002.js.

(function () {
  const processed = new WeakSet();

  // Valeurs par défaut (sécurité)
  const defaultCfg = {
    sections: [],
    charLimit: 750,
    minHiddenChars: 200,
    labels: { expand: 'Read more', collapse: 'Read less' }
  };

  // Transforme en tableau si l’utilisateur n’a mis qu’un seul objet
  const configs = Array.isArray(window.CollapsibleTextSection)
    ? window.CollapsibleTextSection
    : [window.CollapsibleTextSection || defaultCfg];

  // Bootstrap sur chargement initial et navigation SPA
  const bootstrap = () => {
    if (!document.body || document.body.classList.contains('sqs-edit-mode-active')) return;
    configs.forEach(cfg => {
      const mergedCfg = Object.assign({}, defaultCfg, cfg);
      mergedCfg.labels = Object.assign({}, defaultCfg.labels, cfg && cfg.labels);
      for (const key of ['charLimit', 'minHiddenChars']) {
        const value = Number(mergedCfg[key]);
        mergedCfg[key] = Number.isFinite(value) && value >= 0 ? value : defaultCfg[key];
      }

      mergedCfg.sections.forEach(sel => {
        document.querySelectorAll(sel).forEach(section => {
          const htmlBlocks = section.querySelectorAll(
            '.html-block .sqs-block-content .sqs-html-content, .html-block .sqs-html-content'
          );
          htmlBlocks.forEach(container => processBlock(container, mergedCfg));
        });
      });
    });
  };

  function processBlock(container, cfg) {
    if (!container || processed.has(container) || container.querySelector('.collapsible-text')) return;

    // Analyse avant toute modification : les textes courts restent intacts.
    const textBlocks = Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6,p'));
    if (!textBlocks.length) return;
    const lengths = textBlocks.map(el => (el.textContent || '').trim().length);
    processed.add(container);

    // Même règle que v001 : conserver le paragraphe qui dépasse charLimit.
    let total = 0, cutoffIndex = -1;
    for (let i = 0; i < textBlocks.length; i++) {
      total += lengths[i];
      if (total > cfg.charLimit) { cutoffIndex = i + 1; break; }
    }

    // Pas de bouton si rien ne suit, ou si le complément est trop court.
    if (cutoffIndex === -1 || cutoffIndex >= textBlocks.length) return;
    const hiddenChars = lengths.slice(cutoffIndex).reduce((sum, length) => sum + length, 0);
    if (hiddenChars === 0 || hiddenChars < cfg.minHiddenChars) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'collapsible-text collapsible-text-collapsed';
    const children = Array.from(container.childNodes);
    children.forEach(n => wrapper.appendChild(n));
    container.appendChild(wrapper);

    // Masque le reste
    for (let i = cutoffIndex; i < textBlocks.length; i++) {
      textBlocks[i].classList.add('collapsible-text-hidden-fragment');
    }

    // Enveloppe pour animation
    const collapsible = document.createElement('div');
    collapsible.className = 'collapsible-text-collapsible';
    while (wrapper.firstChild) collapsible.appendChild(wrapper.firstChild);
    wrapper.appendChild(collapsible);

    // Bouton
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'collapsible-text-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = cfg.labels.expand;
    wrapper.appendChild(toggle);

    // Mesure des hauteurs
    const measureHeights = () => {
      textBlocks.forEach(el => el.classList.remove('collapsible-text-hidden-fragment'));
      collapsible.style.maxHeight = 'none';
      const expandedHeight = collapsible.scrollHeight;
      for (let i = cutoffIndex; i < textBlocks.length; i++) {
        textBlocks[i].classList.add('collapsible-text-hidden-fragment');
      }
      collapsible.style.maxHeight = 'none';
      void collapsible.offsetHeight;
      const collapsedHeight = collapsible.scrollHeight;
      collapsible.style.maxHeight = collapsedHeight + 'px';
      return { expandedHeight, collapsedHeight };
    };

    let heights = measureHeights();

    // Toggle
    toggle.addEventListener('click', () => {
      const isCollapsed = wrapper.classList.contains('collapsible-text-collapsed');
      if (isCollapsed) {
        textBlocks.forEach(el => el.classList.remove('collapsible-text-hidden-fragment'));
        wrapper.classList.replace('collapsible-text-collapsed', 'collapsible-text-expanded');
        toggle.textContent = cfg.labels.collapse;
        toggle.setAttribute('aria-expanded', 'true');
        collapsible.style.maxHeight = heights.expandedHeight + 'px';
      } else {
        for (let i = cutoffIndex; i < textBlocks.length; i++) {
          textBlocks[i].classList.add('collapsible-text-hidden-fragment');
        }
        wrapper.classList.replace('collapsible-text-expanded', 'collapsible-text-collapsed');
        toggle.textContent = cfg.labels.expand;
        toggle.setAttribute('aria-expanded', 'false');
        heights = measureHeights();
      }
    });

    // ResizeObserver pour les changements de layout
    const ro = new ResizeObserver(() => {
      if (wrapper.classList.contains('collapsible-text-collapsed')) {
        heights = measureHeights();
      } else {
        textBlocks.forEach(el => el.classList.remove('collapsible-text-hidden-fragment'));
        collapsible.style.maxHeight = 'none';
        heights.expandedHeight = collapsible.scrollHeight;
        collapsible.style.maxHeight = heights.expandedHeight + 'px';
      }
    });
    ro.observe(collapsible);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
  document.addEventListener('mercury:load', bootstrap);
})();
