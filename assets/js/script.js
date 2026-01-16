'use strict';

/* =========================================================
   Fichier : assets/js/script.js
   Objectif :
   - Menu mobile en hamburger (off-canvas) + overlay
   - Liens toujours cliquables
   - Aucun impact sur le desktop
   ========================================================= */

/**
 * Helpers
 */
function addActive(elem) {
  if (!elem) return;
  elem.classList.add("active");
}

function removeActive(elem) {
  if (!elem) return;
  elem.classList.remove("active");
}

function toggleActive(elem) {
  if (!elem) return;
  elem.classList.toggle("active");
}

/**
 * NAVBAR (mobile)
 */
const navbar = document.querySelector("[data-navbar]");
const overlay = document.querySelector("[data-overlay]");
const navCloseBtn = document.querySelector("[data-nav-close-btn]");
const navOpenBtn = document.querySelector("[data-nav-open-btn]");
const navbarLinks = document.querySelectorAll("[data-nav-link]");

function openNav() {
  addActive(navbar);
  addActive(overlay);
}

function closeNav() {
  removeActive(navbar);
  removeActive(overlay);
}

// Sécurise si une page n'a pas de navbar
if (navbar && overlay && navOpenBtn && navCloseBtn) {
  // Ouvrir
  navOpenBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    openNav();
  });

  // Fermer (bouton X)
  navCloseBtn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopPropagation();
    closeNav();
  });

  // Fermer (clic overlay)
  overlay.addEventListener("click", function () {
    closeNav();
  });

  // Fermer quand on clique un lien du menu
  for (let i = 0; i < navbarLinks.length; i++) {
    navbarLinks[i].addEventListener("click", function () {
      closeNav();
    });
  }

  // Fermer avec Echap
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeNav();
  });
}

/**
 * HEADER active state (scroll)
 * (inchangé, desktop OK)
 */
const header = document.querySelector("[data-header]");

if (header) {
  window.addEventListener("scroll", function () {
    window.scrollY >= 400 ? header.classList.add("active")
      : header.classList.remove("active");
  });
}
