## Automatic TOC

<!-- Automatic TOC – CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/jonas-nicollin/squarespace-components/automatic-toc.css">
<!-- \ Automatic TOC – CSS -->
<!-- Instructions: Place in Header Code Injection. -->

<!-- Automatic TOC – Settings -->
<script>
  window.automaticTocSettings = [
    {
      requiredBodyClasses: ["collection-XXXX", "view-item"],
      selectors: ".blog-anchor-title, .html-block h2",
      targetContainerSelector: ".blog-item-wrapper",
      insertPosition: "prepend",   // "prepend" | "append" | number(index)
      sticky: true,
      scrollOffset: "var(--header-height)", // or "200px"
      activeZoneTop: 0.3,

      backLink: {
        enabled: true,
        url: "/exhibitions",
        label: "Exhibitions",
        icon: "chevron_backward"
      }
    },

    /* --- Example of a second configuration (not active) ---
    {
      requiredBodyClasses: ["collection-YYYY", "view-item"],
      selectors: ".blog-anchor-title, .html-block h3",
      targetContainerSelector: ".blog-item-top-wrapper",
      insertPosition: "append",
      sticky: false,
      scrollOffset: "150px",
      activeZoneTop: 0.25,

      backLink: {
        enabled: false
      }
    }
    ------------------------------------------------------- */
  ];
</script>
<!-- \ Automatic TOC – Settings -->
<!-- Instructions: Add as many configurations as needed. Only one matching the current page will run. -->

<!-- Automatic TOC – Main Script -->
<script src="https://cdn.jsdelivr.net/gh/jonas-nicollin/squarespace-components/automatic-toc.js"></script>
<!-- \ Automatic TOC – Main Script -->
<!-- Instructions: Place in Footer Code Injection. -->
