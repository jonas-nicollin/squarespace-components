/* Requires Fancybox in the header:
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.29/dist/fancybox/fancybox.css" />
<script src="https://cdn.jsdelivr.net/npm/@fancyapps/ui@5.0.29/dist/fancybox/fancybox.umd.js"></script>

*/
document.addEventListener("DOMContentLoaded", () => {
  const galleries = document.querySelectorAll(".sqs-gallery-block-stacked .sqs-gallery");
  if (!galleries.length) return;

  galleries.forEach((gallery, galleryIndex) => {
    const galleryId = `gallery-${galleryIndex}`;
    const children = Array.from(gallery.children);
    const masonryItems = [];

    for (let i = 0; i < children.length; i++) {
      const el = children[i];
      if (el.classList.contains("image-wrapper")) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("masonry-item");

        const img = el.querySelector("img");
        const fullSrc = img?.dataset?.image || img?.src;

        const next = children[i + 1];
        let caption = "";
        if (next && next.classList.contains("meta")) {
          caption = next.innerHTML.trim();
        }

        const link = document.createElement("a");
        link.href = fullSrc;
        link.setAttribute("data-fancybox", galleryId);
        if (caption) link.setAttribute("data-caption", caption);
        link.appendChild(img);

        el.innerHTML = "";
        el.appendChild(link);

        wrapper.appendChild(el);
        if (next && next.classList.contains("meta")) {
          wrapper.appendChild(next);
          i++;
        }

        masonryItems.push(wrapper);
      }
    }

    gallery.innerHTML = "";
    masonryItems.forEach((item) => gallery.appendChild(item));

    const gap = 32;

    function layoutMasonry() {
      const containerWidth = gallery.clientWidth;
      const isMobile = window.innerWidth < 768;
      const columns = isMobile ? 1 : 3;
      const colWidth = (containerWidth - gap * (columns - 1)) / columns;

      const colHeights = Array(columns).fill(0);
      masonryItems.forEach((item) => {
        item.style.width = `${colWidth}px`;
        item.style.position = "absolute";

        const img = item.querySelector("img");
        const meta = item.querySelector(".meta");

        let imgHeight = 0;
        if (img && img.dataset.imageDimensions) {
          const [w, h] = img.dataset.imageDimensions.split("x").map(Number);
          const ratio = h / w;
          imgHeight = colWidth * ratio;
        }

        const metaHeight = meta ? meta.offsetHeight : 0;
        const totalHeight = imgHeight + metaHeight;

        const minCol = colHeights.indexOf(Math.min(...colHeights));
        const x = (colWidth + gap) * minCol;
        const y = colHeights[minCol];

        item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
        colHeights[minCol] += totalHeight + gap;
      });

      const containerHeight = Math.max(...colHeights);
      gallery.style.height = `${containerHeight}px`;
    }

    const ro = new ResizeObserver(() => {
      requestAnimationFrame(layoutMasonry);
    });
    ro.observe(gallery);

    // Bind Fancybox pour chaque galerie individuellement
    Fancybox.bind(`[data-fancybox="${galleryId}"]`, {
      Hash: false,                // Désactiver le lien dans l’URL
      compact: false,
      theme: "light",
      backdropClick: false,
      contentClick: false,
      zoom: false,
      zoomOpacity: false,
      Images: {
        Panzoom: {
          maxScale: 1,
          click: false,
          wheel: false,
          panMode: "none",
          touch: false,
          zoom: false,
          pinchToZoom: true
        }
      },
      Toolbar: {
        absolute: "auto",
        display: {
          left: ["infobar"],
          middle: [],
          right: ["thumbs", "close"]
        }
      },
      Thumbs: {
        type: "classic",
        showOnStart: false
      },
      Carousel: {
        Navigation: true
      },
      Slideshow: false,
      Fullscreen: false
    });
  });
});
