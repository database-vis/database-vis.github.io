// Static docs UI: the only JS the shell needs — a responsive sidebar toggle. Anchor scrolling is
// native (real <a href="#slug"> + CSS scroll-padding-top), Prism auto-highlights, and the live
// examples are handled by dvl-example.js. No SPA, no scroll correction.
(function () {
  var toggle = document.querySelector(".sidebar-toggle");
  if (!toggle) return;
  toggle.addEventListener("click", function () {
    var mobile = window.matchMedia("(max-width: 768px)").matches;
    document.body.classList.toggle(mobile ? "nav-open" : "nav-collapsed");
  });
})();
