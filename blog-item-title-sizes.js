/**
 * Blog Item Title Sizes
 *
 * Rôle :
 *   Ajoute une classe CSS au titre d’un article de blog (.blog-item-title h1)
 *   en fonction de la longueur du texte.
 *
 * Classes ajoutées :
 *   - small-entry-title       (≤ 20 caractères)
 *   - medium-entry-title      (≤ 40 caractères)
 *   - large-entry-title       (≤ 80 caractères)
 *   - extralarge-entry-title  (> 80 caractères)
 *
 * Usage :
 *   - Cibler ces classes en CSS pour adapter la taille ou le style du titre.
 *
 * Portée :
 *   - Pages d’articles de blog uniquement.
 *   - Ne fait rien si aucun titre n’est trouvé.
 */

(function () {
  const init = () => {
    const h1 = document.querySelector(".blog-item-title h1");
    if (!h1) return;

    const length = h1.textContent.trim().length;

    if (length <= 20) {
      h1.classList.add("small-entry-title");
    } else if (length <= 40) {
      h1.classList.add("medium-entry-title");
    } else if (length <= 80) {
      h1.classList.add("large-entry-title");
    } else {
      h1.classList.add("extralarge-entry-title");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
