/**
 * The catalogue grid's behaviour — components/shop/product-grid.tsx and the
 * sort half of shop-controls.tsx, without TanStack Query or nuqs.
 *
 * WHAT REPLACES WHAT:
 *
 *   useInfiniteQuery + /api/products  ->  fetch of the SAME url the "load more"
 *                                         link already points at, with
 *                                         `section_id` appended. Shopify renders
 *                                         just this section and returns its HTML;
 *                                         the rows are appended and the link is
 *                                         swapped for the next page's.
 *
 *   nuqs URL state                    ->  the URL itself. Sorting submits a form
 *                                         and filtering follows a link, so every
 *                                         view is shareable and the back button
 *                                         works — which is what nuqs was for.
 *
 * EVERYTHING HERE IS AN ENHANCEMENT. With JS off, "load more" is a link to page
 * two and the sort control is a form with a submit button. Nothing below is
 * required for the grid to work.
 */
(function () {
  "use strict";

  function init(root) {
    var scope = root || document;
    var sections = scope.querySelectorAll("[data-sb-collection]");

    for (var i = 0; i < sections.length; i++) bindSection(sections[i]);
  }

  function bindSection(section) {
    if (section.dataset.sbBound === "true") return;
    section.dataset.sbBound = "true";

    bindSort(section);
    bindLoadMore(section);
  }

  /* ---------------------------------------------------------------------
     Sort — submit on change, so the select behaves like a control rather
     than a form that needs a second click.
     --------------------------------------------------------------------- */
  function bindSort(section) {
    var form = section.querySelector("[data-sb-sort]");
    if (!form) return;

    var select = form.querySelector("select[name='sort_by']");
    if (!select) return;

    select.addEventListener("change", function () {
      form.submit();
    });
  }

  /* ---------------------------------------------------------------------
     Load more, then infinite scroll
     --------------------------------------------------------------------- */
  function bindLoadMore(section) {
    var sectionId = section.getAttribute("data-section-id");
    var grid = section.querySelector("[data-sb-collection-grid]");
    if (!grid || !sectionId) return;

    var loading = false;

    function container() {
      return section.querySelector("[data-sb-collection-more]");
    }

    function nextUrl() {
      var link = section.querySelector("[data-sb-collection-more] a[href]");
      return link ? link.getAttribute("href") : null;
    }

    async function loadNext() {
      var href = nextUrl();
      if (!href || loading) return;

      loading = true;
      var box = container();
      if (box) box.setAttribute("data-loading", "true");

      try {
        // The section-rendering URL is the page URL plus `section_id`, so every
        // filter and sort already in the query string travels with it.
        var url = new URL(href, window.location.origin);
        url.searchParams.set("section_id", sectionId);

        var response = await fetch(url.toString());
        if (!response.ok) throw new Error(String(response.status));

        var html = await response.text();
        var parsed = new DOMParser().parseFromString(html, "text/html");

        var incomingGrid = parsed.querySelector("[data-sb-collection-grid]");
        if (incomingGrid) {
          // Appended one node at a time rather than by innerHTML +=, which
          // would re-parse and replace every row already on the page — losing
          // the two-second tick on any quick-add still showing.
          var rows = incomingGrid.children;
          while (rows.length) grid.appendChild(rows[0]);
        }

        // Swap in the next page's link, or drop the control when the incoming
        // page had none — that is how the loop terminates.
        var incomingMore = parsed.querySelector("[data-sb-collection-more]");
        var currentMore = container();
        if (currentMore) {
          if (incomingMore) currentMore.replaceWith(incomingMore);
          else currentMore.remove();
        }
      } catch (error) {
        // Left as a working link: the visitor can still click through to page
        // two, which is the whole reason it is an anchor.
        if (box) box.removeAttribute("data-loading");
      } finally {
        loading = false;
        observe();
      }
    }

    section.addEventListener("click", function (event) {
      var link = event.target.closest
        ? event.target.closest("[data-sb-collection-more] a[href]")
        : null;
      if (!link) return;

      event.preventDefault();
      void loadNext();
    });

    /* Infinite scroll on top of the link. The observer is re-created after each
       page because the element it watches is replaced, and because a page that
       does not fill the viewport must trigger the next one immediately. */
    var observer = null;

    function observe() {
      if (observer) observer.disconnect();

      var box = container();
      if (!box) return;

      observer = new IntersectionObserver(
        function (entries) {
          if (entries[0] && entries[0].isIntersecting) void loadNext();
        },
        { rootMargin: "600px" },
      );

      observer.observe(box);
    }

    observe();
  }

  init();

  // The theme editor replaces section markup wholesale.
  document.addEventListener("shopify:section:load", function (event) {
    init(event.target);
  });
})();
