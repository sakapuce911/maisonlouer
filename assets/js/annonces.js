/* =========================
   File: assets/js/annonces.js
   Objectif:
   - locations.html => ROA cards + filtre location
   - ventes.html    => ROA cards + filtre vente
   - recherche.html => filtres + ROA cards (mix louer/vendre)
   - autres pages   => rendu classique

   ✅ Mise à jour (2026):
   - Source unique : Supabase (REST API) -> table public.annonces
   - RLS doit autoriser SELECT sur les lignes "Publié = true"
   - Cache sessionStorage pour accélérer

   ⚠️ Note:
   - Tes colonnes Supabase sont : "Titre", "TypeOffre", "Prix", "Publié", etc.
   - On NORMALISE ici pour garder ton code existant (titre, typeOffre, prixAr, ...)
========================= */

/* =========================
   CONFIG SUPABASE (déjà fourni)
========================= */
const SUPABASE_URL = "https://glysaizevxujkiuuwflv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdseXNhaXpldnh1amtpdXV3Zmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDYxOTksImV4cCI6MjA4NDM4MjE5OX0.K29buPf0NxCLw4JSdbxUshHRC9BUMikfakRUPCDVi0w";

/* =========================
   CACHE (accélère beaucoup)
========================= */
const CACHE_KEY = "maisonlouer_supabase_annonces_v1";
const CACHE_TTL_MS = 60 * 1000; // 60 secondes (tu peux mettre 5*60*1000 si tu veux)

/* =========================
   FETCH HELPERS
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

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.ts || !obj.data) return null;
    if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
    return obj.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}

function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // enlève accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =========================
   SUPABASE -> NORMALISATION
   (on retourne le format attendu par TON code)
========================= */
function normalizeAnnonce(row, index) {
  // Tes champs Supabase (d’après ton JSON):
  // Titre, TypeOffre, TypeBien, Ville, Quartier, Prix, Chambres, SDB, Surface,
  // Images, Description, Publié, lat, lng, WhatsApp, ListéParNous, Status, Date d'ajout

  const titre = row["Titre"] ?? "";
  const dateAjout = row["Date d'ajout"] ?? "";
  const syntheticId = `${slugify(titre)}-${index + 1}`;

  // images: tu as "Images: null" pour le moment.
  // Si plus tard tu mets un texte du type "url1|url2|url3", on le transforme en tableau.
  let imagesArr = [];
  if (typeof row["Images"] === "string" && row["Images"].trim()) {
    imagesArr = row["Images"]
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return {
    // ⚠️ Tu n’as pas de colonne id pour l’instant → on génère un id stable “approx”.
    // Si tu ajoutes une colonne "id" plus tard dans Supabase, remplace ici par row["id"].
    id: row["id"] ?? syntheticId,

    titre: titre,
    typeOffre: row["TypeOffre"] ?? "",
    typeBien: row["TypeBien"] ?? "",
    ville: row["Ville"] ?? "",
    quartier: row["Quartier"] ?? "",

    // Ton code attend prixAr (Ar)
    prixAr: row["Prix"] ?? null,

    chambres: row["Chambres"] ?? null,
    sdb: row["SDB"] ?? null,
    surface: row["Surface"] ?? null,

    images: imagesArr.length ? imagesArr : [],

    description: row["Description"] ?? "",

    // ton code filtre par publie côté API RLS déjà,
    // mais on conserve aussi côté JS
    publie: row["Publié"] === true,

    lat: row["lat"] ?? null,
    lng: row["lng"] ?? null,
    whatsapp: row["WhatsApp"] ?? "",

    listeParNous: row["ListéParNous"] === true,
    status: row["Status"] ?? "",
    dateAjout: dateAjout,
  };
}

async function fetchAnnonces() {
  // 1) Cache
  const cached = readCache();
  if (cached) return cached;

  // 2) Supabase REST
  const url = `${SUPABASE_URL}/rest/v1/annonces?select=*`;

  const res = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    },
    8000
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Supabase indisponible (${res.status}) ${txt}`);
  }

  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error("Format Supabase invalide (attendu: tableau)");

  const annonces = rows.map((r, i) => normalizeAnnonce(r, i));

  // (Optionnel) filtre sécurité côté JS aussi
  const publiees = annonces.filter((a) => a.publie === true);

  writeCache(publiees);
  return publiees;
}

/* =========================
   TON CODE EXISTANT (inchangé)
========================= */
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

  const showListeParNous = a.listeParNous === true;

  return `
    <article class="roa-rent-card">
      <a class="roa-rent-media" href="${link}" aria-label="Ouvrir l'annonce">
        <img src="${img}" alt="${a.titre || "Annonce"}">

        <div class="roa-rent-badges">
          ${showListeParNous ? `<span class="roa-pill dark">LISTÉ PAR NOUS</span>` : ``}
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
    container.innerHTML = `<p>Chargement des annonces…</p>`;
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
