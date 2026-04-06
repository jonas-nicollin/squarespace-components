(() => {
"use strict";

const CFG = window.CarouselGalleryFancyboxConfig || {};
const captionsCfg = CFG.captions || {};

const showCarouselCaptions = captionsCfg.showOnCarousel ?? true;
const showLightboxCaptions = captionsCfg.showOnLightbox ?? true;

const navPrevIcon = CFG.nav?.prevIcon || "arrow_back";
const navNextIcon = CFG.nav?.nextIcon || "arrow_forward";

const $$ = (r,s) => Array.from(r.querySelectorAll(s));

/* ============================================================
   TARGETS
============================================================ */
function getTargets(){
  const out = [];
  (CFG.targets?.selectors || []).forEach(sel=>{
    document.querySelectorAll(sel).forEach(el=>out.push(el));
  });
  return out;
}

/* ============================================================
   BUILD STRUCTURE
============================================================ */
function buildItems(container){

  if(container.dataset.carouselBuilt === "true") return;

  const gallery = container.querySelector(".sqs-gallery");
  if(!gallery) return;

  const children = Array.from(gallery.children);
  const frag = document.createDocumentFragment();

  let i = 0;
  let index = 0;

  while(i < children.length){

    const node = children[i];

    if(!node.classList.contains("image-wrapper")){
      i++;
      continue;
    }

    const item = document.createElement("article");
    item.className = "carousel-gallery-item";
    item.dataset.index = index++;

    const media = document.createElement("div");
    media.className = "carousel-gallery-media";

    node.removeAttribute("style");
    node.classList.add("carousel-gallery-image-wrapper");

    media.appendChild(node);
    item.appendChild(media);

    const next = children[i+1];

    if(next && next.classList.contains("meta")){
      next.removeAttribute("style");
      next.classList.add("carousel-gallery-meta");

      if(!showCarouselCaptions){
        next.style.display = "none";
      }

      item.appendChild(next);
      i++;
    }

    frag.appendChild(item);
    i++;
  }

  gallery.innerHTML = "";
  gallery.appendChild(frag);

  container.dataset.carouselBuilt = "true";
}

/* ============================================================
   HEADING
============================================================ */
function insertHeading(container){

  if(!CFG.galleryHeading?.enabled) return;

  const parent = container.parentNode;
  if(!parent) return;

  const tag = CFG.galleryHeading.tag || "h2";
  const text = CFG.galleryHeading.text || "";

  const h = document.createElement(tag);
  h.className = "carousel-gallery-heading";
  h.textContent = text;

  parent.insertBefore(h, container);
}

/* ============================================================
   HELPERS
============================================================ */
function getTitle(item){
  const el = item.querySelector(".meta-title");
  return el ? el.textContent.trim() : "";
}

function getDescriptionHTML(item){
  const el = item.querySelector(".meta-description");
  return el ? el.innerHTML : "";
}

function getSrc(img){
  return (
    img.getAttribute("data-image") ||
    img.getAttribute("data-src") ||
    img.getAttribute("src") || ""
  ).replace(/\?format=\d+w$/i,"");
}

/* ============================================================
   FANCYBOX ITEMS
============================================================ */
function collect(container){

  const items = [];

  $$(container, ".carousel-gallery-item").forEach(item=>{

    const img = item.querySelector("img");
    if(!img) return;

    const title = getTitle(item);
    const desc = getDescriptionHTML(item);

    let caption = "";

    if(showLightboxCaptions){
      if(title){
        caption += `<div class="carousel-caption-title">${title}</div>`;
      }
      if(desc){
        caption += `<div class="carousel-caption-desc">${desc}</div>`;
      }
    }

    items.push({
      src: getSrc(img),
      type: "image",
      caption: caption || "",
      alt: title || ""
    });
  });

  return items;
}

/* ============================================================
   OPEN FANCYBOX
============================================================ */
function bindFancybox(container){

  if(container._fbBound) return;
  container._fbBound = true;

  container.addEventListener("click", e => {

    const item = e.target.closest(".carousel-gallery-item");
    if(!item) return;

    const items = collect(container);
    const index = Number(item.dataset.index) || 0;

    Fancybox.show(items, {
      startIndex: index,
      ...CFG.fancybox
    });

  }, true);
}

/* ============================================================
   NAV
============================================================ */
function ensureNav(container, track){

  let nav = container.querySelector(".carousel-gallery-nav");

  if(nav) return;

  nav = document.createElement("div");
  nav.className = "carousel-gallery-nav";

  nav.innerHTML = `
    <button class="carousel-gallery-nav-btn carousel-gallery-nav-btn--prev">
      <span class="material-symbols-ui">${navPrevIcon}</span>
    </button>
    <button class="carousel-gallery-nav-btn carousel-gallery-nav-btn--next">
      <span class="material-symbols-ui">${navNextIcon}</span>
    </button>
  `;

  container.appendChild(nav);

  nav.querySelector(".carousel-gallery-nav-btn--prev")
    .addEventListener("click",()=> {
      track.scrollBy({ left:-track.clientWidth*0.85, behavior:"smooth"});
    });

  nav.querySelector(".carousel-gallery-nav-btn--next")
    .addEventListener("click",()=> {
      track.scrollBy({ left: track.clientWidth*0.85, behavior:"smooth"});
    });
}

/* ============================================================
   INIT
============================================================ */
function initGallery(container){

  buildItems(container);
  insertHeading(container);

  const track = container.querySelector(".sqs-gallery");
  if(!track) return;

  ensureNav(container, track);
  bindFancybox(container);
}

function init(){
  getTargets().forEach(initGallery);
}

document.addEventListener("DOMContentLoaded", init);
window.addEventListener("load", init);
window.addEventListener("page:loaded", init);
window.addEventListener("site:refresh", init);

})();
