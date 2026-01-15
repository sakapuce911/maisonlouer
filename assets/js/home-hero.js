// ==============================
// HOME HERO - LOGIQUE PROPERTYGURU
// Fichier: assets/js/home-hero.js
// ==============================

(function () {
  // --- Elements
  const tabs = Array.from(document.querySelectorAll(".hero-tab"));
  const zoneInput = document.getElementById("home-zone");
  const typeBienSelect = document.getElementById("home-type-bien");
  const budgetInput = document.getElementById("home-budget");
  const chambresSelect = document.getElementById("home-chambres");
  const btnSearch = document.getElementById("home-btn-search");

  // Sécurité : si on n'est pas sur index.html ou si l'HTML a changé
  if (!tabs.length || !btnSearch || !zoneInput) return;

  // --- Etat
  let offre = "vente"; // défaut = Acheter / vente

  // --- Helpers
  function setActiveTab(clickedBtn) {
    tabs.forEach((b) => {
      b.classList.remove("is-active");
      b.setAttribute("aria-selected", "false");
    });

    clickedBtn.classList.add("is-active");
    clickedBtn.setAttribute("aria-selected", "true");
  }

  function normalizeNumber(value) {
    // accepte "1 500 000" => "1500000"
    if (!value) return "";
    return String(value).replace(/\s+/g, "").trim();
  }

  function goToSearch() {
    const zone = (zoneInput.value || "").trim();
    const typeBien = (typeBienSelect?.value || "").trim();
    const budget = normalizeNumber(budgetInput?.value || "");
    const chambres = (chambresSelect?.value || "").trim();

    // Construire les params
    const params = new URLSearchParams();

    if (zone) params.set("zone", zone);
    if (budget) params.set("budget", budget);

    // On passe le type d'offre demandé
    params.set("offre", offre);

    // Ces filtres peuvent être ignorés côté recherche si non implémentés,
    // mais au moins l'accueil est prêt.
    if (typeBien) params.set("type", typeBien);
    if (chambres) params.set("chambres", chambres);

    window.location.href = `recherche.html?${params.toString()}`;
  }

  // --- Tabs click
  tabs.forEach((btn) => {
    const isDisabled = btn.classList.contains("is-disabled") || btn.getAttribute("aria-disabled") === "true";
    if (isDisabled) return;

    btn.addEventListener("click", () => {
      setActiveTab(btn);

      // data-offre = vente / location
      const next = btn.getAttribute("data-offre");
      if (next === "location") offre = "location";
      else offre = "vente"; // Acheter/Vendre => vente
    });
  });

  // --- Search click
  btnSearch.addEventListener("click", goToSearch);

  // --- Enter key on zone input
  zoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      goToSearch();
    }
  });
})();
