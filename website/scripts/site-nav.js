/**
 * Shared navigation — EquitAI marketing site
 * Homepage: smooth scroll to named sections. Subpages: same-origin index.html#section.
 */
(function () {
  var TOOL_URL_PRODUCTION = "https://equitai.eu.com/";
  var MARKETING_URL_PRODUCTION = "https://equitai.eu.com/";
  var TOOL_URL_LOCAL = "http://localhost:3000/";

  function toolUrl() {
    return isLocalHost() ? TOOL_URL_LOCAL : TOOL_URL_PRODUCTION;
  }
  var ANCHORS = ["who-its-for", "process", "pricing", "contact"];
  var NAV_ITEMS = [
    { label: "Who it's for", id: "who-its-for" },
    { label: "The Process", id: "process" },
    { label: "Pricing", id: "pricing" },
    { label: "Contact", id: "contact" },
  ];

  function isLocalHost() {
    var host = window.location.hostname;
    return (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "[::1]" ||
      host.endsWith(".local")
    );
  }

  function pageDirectory() {
    var path = window.location.pathname || "/";
    if (path.endsWith("/")) return path;
    var slash = path.lastIndexOf("/");
    return slash >= 0 ? path.slice(0, slash + 1) : "/";
  }

  function indexPageUrl() {
    return window.location.origin + pageDirectory() + "index.html";
  }

  function currentPageUrl() {
    return (
      window.location.origin +
      window.location.pathname +
      window.location.search
    );
  }

  function isHomePage() {
    if (document.body.dataset.page === "home") return true;
    if (document.body.dataset.page === "subpage") return false;
    var file = window.location.pathname.split("/").pop() || "";
    return file === "" || file === "index.html";
  }

  function homeHref() {
    return isHomePage() ? currentPageUrl() : indexPageUrl();
  }

  function sectionHref(id) {
    if (isHomePage() && document.getElementById(id)) {
      return currentPageUrl() + "#" + id;
    }
    return indexPageUrl() + "#" + id;
  }

  function brandMarkup() {
    var wordmark =
      '<span class="site-brand__wordmark">Equit<span class="site-brand__ai">AI</span></span>';
    if (document.body.dataset.brand === "coaches") {
      return wordmark + '<span class="site-brand__suffix">for Coaches</span>';
    }
    return wordmark;
  }

  function closeMobile(menu, btn) {
    if (menu) menu.classList.remove("is-open");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function scrollToSection(id, behavior) {
    var target = document.getElementById(id);
    if (!target) return false;
    target.scrollIntoView({ behavior: behavior || "smooth", block: "start" });
    if (isHomePage()) {
      history.replaceState(null, "", "#" + id);
    }
    return true;
  }

  function goToSection(id) {
    if (isHomePage() && document.getElementById(id)) {
      scrollToSection(id, "smooth");
      return;
    }
    window.location.assign(indexPageUrl() + "#" + id);
  }

  function wireToolLinks() {
    var url = toolUrl();
    var openNewTab = !isLocalHost();
    document.querySelectorAll("[data-tool-link]").forEach(function (link) {
      link.setAttribute("href", url);
      if (openNewTab) {
        link.setAttribute("target", "_blank");
        link.setAttribute("rel", "noopener noreferrer");
      } else {
        link.removeAttribute("target");
        link.removeAttribute("rel");
      }
    });
  }

  function neutralizeCanonicalOnLocalhost() {
    if (!isLocalHost()) return;
    document.querySelectorAll('link[rel="canonical"]').forEach(function (link) {
      link.remove();
    });
  }

  function renderNav() {
    var mount = document.getElementById("site-header");
    if (!mount) return;

    var navLinks = NAV_ITEMS.map(function (item) {
      return (
        '<li><a href="' +
        sectionHref(item.id) +
        '" data-nav-anchor="' +
        item.id +
        '">' +
        item.label +
        "</a></li>"
      );
    }).join("");

    var mobileLinks = NAV_ITEMS.map(function (item) {
      return (
        '<a href="' +
        sectionHref(item.id) +
        '" data-nav-anchor="' +
        item.id +
        '">' +
        item.label +
        "</a>"
      );
    }).join("");

    mount.innerHTML =
      '<nav class="site-header" aria-label="Primary">' +
      '<div class="site-header__inner">' +
      '<a class="site-brand" href="' +
      homeHref() +
      '">' +
      brandMarkup() +
      "</a>" +
      '<ul class="site-nav">' +
      navLinks +
      "</ul>" +
      '<div class="site-nav__actions">' +
      '<a class="site-nav__cta site-nav__cta--desktop" href="' +
      toolUrl() +
      '"' +
      (isLocalHost() ? "" : ' target="_blank" rel="noopener noreferrer"') +
      '>Start Free</a>' +
      '<button type="button" class="site-header__menu-btn" aria-label="Open menu" aria-expanded="false" aria-controls="site-mobile-menu">' +
      "<span></span><span></span><span></span>" +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="site-mobile-menu" id="site-mobile-menu">' +
      mobileLinks +
      '<a class="site-nav__cta" href="' +
      toolUrl() +
      '"' +
      (isLocalHost() ? "" : ' target="_blank" rel="noopener noreferrer"') +
      '>Start Free</a>' +
      "</div>" +
      "</nav>";

    var menuBtn = mount.querySelector(".site-header__menu-btn");
    var mobileMenu = mount.querySelector("#site-mobile-menu");

    if (menuBtn && mobileMenu) {
      menuBtn.addEventListener("click", function () {
        var open = mobileMenu.classList.toggle("is-open");
        menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      });

      mobileMenu.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", function () {
          closeMobile(mobileMenu, menuBtn);
        });
      });
    }

    mount.querySelectorAll("[data-nav-anchor]").forEach(function (link) {
      link.addEventListener("click", function (event) {
        event.preventDefault();
        var id = link.getAttribute("data-nav-anchor");
        if (!id) return;
        closeMobile(mobileMenu, menuBtn);
        goToSection(id);
      });
    });

    var brandLink = mount.querySelector(".site-brand");
    if (brandLink && isHomePage()) {
      brandLink.addEventListener("click", function (event) {
        event.preventDefault();
        window.scrollTo({ top: 0, behavior: "smooth" });
        history.replaceState(null, "", currentPageUrl());
      });
    }
  }

  function scrollToHashOnLoad() {
    var hash = window.location.hash.replace("#", "");
    if (!hash || ANCHORS.indexOf(hash) === -1) return;
    if (!isHomePage()) return;

    var target = document.getElementById(hash);
    if (!target) return;

    window.requestAnimationFrame(function () {
      scrollToSection(hash, "auto");
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    neutralizeCanonicalOnLocalhost();
    renderNav();
    wireToolLinks();
    scrollToHashOnLoad();
  });
})();
