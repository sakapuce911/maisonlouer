/* =========================
   File: assets/js/annonces.js
   Objectif:
   - locations.html => ROA cards + filtre location
   - ventes.html    => ROA cards + filtre vente
   - recherche.html => filtres + ROA cards (mix louer/vendre)
   - autres pages   => rendu classique

   ✅ Mise à jour:
   - Essaie d'abord /api/annonces (Notion via Vercel)
   - Fallback automatique vers ./assets/data/annonces.json si /api échoue (local / sans Vercel)
   ========================= */

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

async function fetchAnnonces() {
  // 1) ✅ Source principale : API Vercel (Notion)
  try {
    const resApi = await fetchWithTimeout("/api/annonces", { method: "GET" }, 8000);
    if (resApi.ok) {
      const data = await resApi.json();
      if (Array.isArray(data)) return data;
      throw new Error("Format API invalide (attendu: tableau)");
    }
    // si /api/annonces répond mais en erreur
    throw new Error(`API Notion indisponible (${resApi.status})`);
  } catch (e) {
    // 2) ✅ Fallback : JSON local (utile en dev local / live server)
    const res = await fetch("./assets/data/annonces.json");
    if (!res.ok) throw new Error("Impossible de charger annonces.json (fallback)");
    return await res.json();
  }
}

function formatPriceAr(prixAr) {
  if (prixAr === null || prixAr === undefined || prixAr === "") return "Prix sur demande";
  const n = Number(prixAr);
  if (Number.isNaN(n)) return "Prix sur demande";
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
}

function getPageName() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

/* -------------------------
   CARTES CLASSIQUES (fallback)
   ------------------------- */
function createClassicCard(a) {
  const img = (a.images && a.images.length) ? a.images[0] : "./assets/images/property-1.jpg";
  const isLocation = norm(a.typeOffre) === "location";
  const badgeText = isLocation ? "À louer" : "À vendre";
  const badgeClass = isLocation ? "badge-location" : "badge-vente";

  const ville = a.ville ? a.ville : "";
  const quartier = a.quartier ? a.quartier : "";
  const adresse = [quartier, ville].filter(Boolean).join(", ") || "Madagascar";

  const prix = formatPriceAr(a.prixAr);
  const chambres = a.chambres ? `${a.chambres} ch.` : "";
  const sdb = a.sdb ? `${a.sdb} sdb` : "";
  const surface = a.surface ? `${a.surface} m²` : "";
  const details = [chambres, sdb, surface].filter(Boolean).join(" • ");

  const id = (a.id !== undefined && a.id !== null) ? encodeURIComponent(a.id) : "";
  const link = id ? `annonce.html?id=${id}` : "annonce.html";

  return `
    <li>
      <div class="property-card">
        <figure class="card-banner">
          <a href="${link}">
            <img src="${img}" alt="${a.titre || "Annonce immobilière"}" class="w-100">
          </a>
          <div class="card-badge ${badgeClass}">${badgeText}</div>
        </figure>

        <div class="card-content">
          <p class="card-subtitle">${adresse}</p>
          <h3 class="h3 card-title">
            <a href="${link}">${a.titre || "Annonce"}</a>
          </h3>

          <div class="card-price">
            <strong>${prix}</strong>
          </div>

          ${details ? `<p class="card-text">${details}</p>` : ""}

          <a class="btn" href="${link}">Voir l'annonce</a>
        </div>
      </div>
    </li>
  `;
}

/* -------------------------
   CARTE ROA (bloc)
   - mode = "location" | "vente" | "mix"
   ------------------------- */
function createRoaCard(a, mode) {
  const img = (a.images && a.images.length) ? a.images[0] : "./assets/images/property-1.jpg";

  const ville = a.ville ? a.ville : "";
  const quartier = a.quartier ? a.quartier : "";
  const adresse = [quartier, ville].filter(Boolean).join(", ") || "Madagascar";

  const prix = formatPriceAr(a.prixAr);

  const chambres = a.chambres ? `${a.chambres} ch.` : null;
  const sdb = a.sdb ? `${a.sdb} sdb` : null;
  const surface = a.surface ? `${a.surface} m²` : null;

  const id = (a.id !== undefined && a.id !== null) ? encodeURIComponent(a.id) : "";
  const link = id ? `annonce.html?id=${id}` : "annonce.html";

  const offre = norm(a.typeOffre);
  const badgeB =
    mode === "mix"
      ? (offre === "location" ? "À LOUER" : "EN VENTE")
      : (mode === "vente" ? "EN VENTE" : "À LOUER");

  return `
    <article class="roa-rent-card">
      <a class="roa-rent-media" href="${link}" aria-label="Ouvrir l'annonce">
        <img src="${img}" alt="${a.titre || "Annonce"}">

        <div class="roa-rent-badges">
          <span class="roa-pill dark">LISTÉ PAR NOUS</span>
          <span class="roa-pill green">${badgeB}</span>
        </div>

        <span class="roa-rent-nav left" aria-hidden="true">‹</span>
        <span class="roa-rent-nav right" aria-hidden="true">›</span>
      </a>

      <div class="roa-rent-body">
        <div class="roa-rent-price">${prix}</div>

        <div class="roa-rent-row">
          <ion-icon name="location-outline"></ion-icon>
          <span>${adresse}</span>
        </div>

        <div class="roa-rent-meta">
          ${chambres ? `<span><strong>${chambres}</strong></span>` : ""}
          ${sdb ? `<span><strong>${sdb}</strong></span>` : ""}
          ${surface ? `<span><strong>${surface}</strong></span>` : ""}
        </div>

        <div class="roa-rent-actions">
          <a class="roa-icon-btn" href="${link}" aria-label="Favori">
            <ion-icon name="heart-outline"></ion-icon>
          </a>
          <a class="roa-icon-btn" href="${link}" aria-label="Partager">
            <ion-icon name="share-social-outline"></ion-icon>
          </a>
          <a class="roa-btn-link" href="${link}">Voir l’annonce</a>
        </div>
      </div>
    </article>
  `;
}

/* -------------------------
   RENDER HELPERS
   ------------------------- */
function renderClassicList(container, annonces) {
  const items = annonces.map(createClassicCard).join("");
  container.innerHTML = `<ul class="property-list">${items}</ul>`;
}

function renderRoaGrid(container, annonces, mode) {
  const cards = annonces.map(a => createRoaCard(a, mode)).join("");
  container.innerHTML = `<div class="roa-rent-grid">${cards}</div>`;
}

/* -------------------------
   INIT
   ------------------------- */
async function initAnnonces() {
  const page = getPageName();
  const container = document.getElementById("listings-container");
  if (!container) return;

  let annonces = [];
  try {
    annonces = await fetchAnnonces();
  } catch (e) {
    container.innerHTML = `<p style="color:#b00020;">Erreur : ${e.message}</p>`;
    return;
  }

  // locations.html => filtre location + ROA
  if (page === "locations.html") {
    const locations = annonces.filter(a => norm(a.typeOffre) === "location");
    if (!locations.length) {
      container.innerHTML = `<p>Aucune location disponible pour le moment.</p>`;
      return;
    }
    renderRoaGrid(container, locations, "location");
    return;
  }

  // ventes.html => filtre vente + ROA
  if (page === "ventes.html") {
    const ventes = annonces.filter(a => norm(a.typeOffre) === "vente");
    if (!ventes.length) {
      container.innerHTML = `<p>Aucun bien en vente disponible pour le moment.</p>`;
      return;
    }
    renderRoaGrid(container, ventes, "vente");
    return;
  }

  // recherche.html => filtres + ROA (mix)
  if (page === "recherche.html") {
    const zoneEl = document.getElementById("zone");
    const budgetEl = document.getElementById("budget");
    const typeBienEl = document.getElementById("type-bien");
    const typeOffreEl = document.getElementById("type-offre");
    const chambresMinEl = document.getElementById("chambres-min");
    const triPrixEl = document.getElementById("tri-prix");

    const btnRechercher = document.getElementById("btn-rechercher");
    const btnReset = document.getElementById("btn-reset");
    const infoEl = document.getElementById("resultats-info");

    // Pré-remplissage via querystring (?zone=...&offre=location|vente)
    const params = new URLSearchParams(window.location.search);
    const qpZone = params.get("zone");
    const qpOffre = params.get("offre");

    if (qpZone && zoneEl) zoneEl.value = qpZone;
    if (qpOffre && typeOffreEl) typeOffreEl.value = qpOffre;

    function applyFilters() {
      const zone = norm(zoneEl ? zoneEl.value : "");
      const budget = budgetEl && budgetEl.value ? Number(budgetEl.value) : null;
      const typeBien = norm(typeBienEl ? typeBienEl.value : "");
      const typeOffre = norm(typeOffreEl ? typeOffreEl.value : "");
      const chambresMin = chambresMinEl && chambresMinEl.value ? Number(chambresMinEl.value) : null;
      const triPrix = triPrixEl ? triPrixEl.value : "";

      let filtered = annonces.filter(a => {
        const matchZone =
          !zone ||
          norm(a.ville).includes(zone) ||
          norm(a.quartier).includes(zone);

        const matchBudget = (budget === null) ? true : (Number(a.prixAr || 0) <= budget);

        const matchTypeOffre = !typeOffre ? true : (norm(a.typeOffre) === typeOffre);

        // typeBien peut ne pas exister => si absent, on ignore le filtre
        const matchTypeBien = !typeBien ? true : (!a.typeBien ? true : norm(a.typeBien) === typeBien);

        const matchChambres = (chambresMin === null) ? true : (Number(a.chambres || 0) >= chambresMin);

        return matchZone && matchBudget && matchTypeOffre && matchTypeBien && matchChambres;
      });

      // Tri prix
      if (triPrix === "prix-asc") {
        filtered.sort((x, y) => Number(x.prixAr || 0) - Number(y.prixAr || 0));
      } else if (triPrix === "prix-desc") {
        filtered.sort((x, y) => Number(y.prixAr || 0) - Number(x.prixAr || 0));
      }

      if (infoEl) infoEl.textContent = `${filtered.length} résultat(s)`;

      if (!filtered.length) {
        container.innerHTML = `<p>Aucun bien ne correspond à votre recherche.</p>`;
        return;
      }

      // ✅ Affichage “bloc” ROA (mix louer/vendre)
      renderRoaGrid(container, filtered, "mix");
    }

    if (btnRechercher) btnRechercher.addEventListener("click", applyFilters);

    if (btnReset) {
      btnReset.addEventListener("click", () => {
        if (zoneEl) zoneEl.value = "";
        if (budgetEl) budgetEl.value = "";
        if (typeBienEl) typeBienEl.value = "";
        if (typeOffreEl) typeOffreEl.value = "";
        if (chambresMinEl) chambresMinEl.value = "";
        if (triPrixEl) triPrixEl.value = "";
        if (infoEl) infoEl.textContent = "";

        // ✅ affichage par défaut = tout, en ROA “mix”
        renderRoaGrid(container, annonces, "mix");
      });
    }

    // rendu initial = tout, en ROA “mix”
    renderRoaGrid(container, annonces, "mix");

    // si query params => applique directement
    if (qpZone || qpOffre) applyFilters();

    return;
  }

  // autres pages => classique
  renderClassicList(container, annonces);
}

document.addEventListener("DOMContentLoaded", initAnnonces);
