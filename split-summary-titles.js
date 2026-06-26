
(function () {
  // =========================
  // 1) Conditions globales
  // =========================
  if (document.body.classList.contains('sqs-edit-mode-active')) return;

  const TARGET_SECTION_ID = 'exhibitions-grid-program';
  const PROCESSED_CLASS = 'summary-title-split-applied';

  // Classes génériques
  const CLS_PART = 'summary-title-part';
  const CLS_BEFORE = 'summary-title-part--before';
  const CLS_AFTER  = 'summary-title-part--after';

  // =========================
  // 2) Split helper
  // =========================
  function splitSummaryTitle(item) {
    if (!item || item.nodeType !== 1) return;
    if (item.classList.contains(PROCESSED_CLASS)) return;

    // scope: seulement dans la section ciblée
    if (!item.closest('#' + TARGET_SECTION_ID)) return;

    const link = item.querySelector('.summary-title-link');
    if (!link) return;

    // si déjà split (sécurité)
    if (link.querySelector('.' + CLS_BEFORE) || link.querySelector('.' + CLS_AFTER)) {
      item.classList.add(PROCESSED_CLASS);
      return;
    }

    const text = link.textContent.trim();
    const idx = text.indexOf(':');
    if (idx === -1) return;

    const before = text.slice(0, idx).trim();
    const after = text.slice(idx + 1).trim(); // supprime ":" puis trim (donc supprime aussi l’espace)
    if (!before || !after) return;

    link.innerHTML = `
      <span class="${CLS_PART} ${CLS_BEFORE}">${before}</span>
      <span class="${CLS_PART} ${CLS_AFTER}">${after}</span>
    `;

    item.classList.add(PROCESSED_CLASS);
  }

  function processSection(root) {
    const section = (root && root.nodeType === 1)
      ? root.closest ? root.closest('#' + TARGET_SECTION_ID) : null
      : null;

    const target = section || document.getElementById(TARGET_SECTION_ID);
    if (!target) return;

    target.querySelectorAll('.summary-item').forEach(splitSummaryTitle);
  }

  // =========================
  // 3) Initial run
  // =========================
  document.addEventListener('DOMContentLoaded', function () {
    processSection(document.getElementById(TARGET_SECTION_ID));
  });

  // =========================
  // 4) MutationObserver (fiabilité maximale en lazy-load)
  // =========================
  function initObserver() {
    const section = document.getElementById(TARGET_SECTION_ID);
    if (!section) return;

    const obs = new MutationObserver((mutations) => {
      for (const m of mutations) {
        // nouveaux noeuds ajoutés
        m.addedNodes && m.addedNodes.forEach((node) => {
          if (!node || node.nodeType !== 1) return;

          // si c’est un summary-item ou contient des summary-items
          if (node.matches && node.matches('.summary-item')) {
            splitSummaryTitle(node);
          } else if (node.querySelectorAll) {
            node.querySelectorAll('.summary-item').forEach(splitSummaryTitle);
          }
        });
      }
    });

    obs.observe(section, { childList: true, subtree: true });

    // petit run au cas où
    processSection(section);
  }

  // lancer l’observer dès que possible
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initObserver);
  } else {
    initObserver();
  }

  // =========================
  // 5) Hooks Lazy Summaries (en bonus / redondance)
  // =========================
  window.customLazySummaries = window.customLazySummaries || {};
  const prevGeneral = window.customLazySummaries.general || {};

  function wrapHook(name, fn) {
    const prev = prevGeneral[name];
    return function () {
      // exécute d’abord le hook existant
      let result;
      if (typeof prev === 'function') {
        result = prev.apply(this, arguments);
      }
      // puis notre logique
      try { fn.apply(this, arguments); } catch (e) {}
      return result;
    };
  }

  window.customLazySummaries.general = Object.assign({}, prevGeneral, {
    renderItemDataFunction: wrapHook('renderItemDataFunction', function (item, jsonData) {
      splitSummaryTitle(item);
    }),
    afterRenderItemFunction: wrapHook('afterRenderItemFunction', function (item, jsonData) {
      splitSummaryTitle(item);
    }),
    portionItemsAddedFunction: wrapHook('portionItemsAddedFunction', function (sum_block, jsonData) {
      processSection(sum_block);
    }),
    allItemsAddedFunction: wrapHook('allItemsAddedFunction', function (sum_block, jsonData) {
      processSection(sum_block);
    }),
    refreshFunction: wrapHook('refreshFunction', function (sum_block, jsonData) {
      processSection(sum_block);
    })
  });

})();

