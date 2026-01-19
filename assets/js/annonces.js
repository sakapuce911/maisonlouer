/* =========================
   File: assets/js/annonces.js
   Objectif:
   - locations.html => ROA cards + filtre location
   - ventes.html    => ROA cards + filtre vente
   - recherche.html => filtres + ROA cards (mix louer/vendre)
   - autres pages   => rendu classique

   ✅ Mise à jour (2026):
   - Source unique : Supabase (REST API) -> table public.annonces
   - Cache sessionStorage pour accélérer
   - Identifiant URL = slug (ex: villa-t4-moderne-a-ivandry-1)
   - UUID Supabase (colonne id) = stocké en interne (dbId), pas dans l’URL
========================= */

/* =========================
   CONFIG SUPABASE
   ⚠️ Ne recolle pas ta key ici publiquement.
   (Elle est déjà dans ton projet, on ne la ré-affiche pas.)
========================= */
const SUPABASE_URL = "https://glysaizevxujkiuuwflv.supabase.co";
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ""; // optionnel si tu la mets ailleurs

/* =========================
   CACHE
========================= */
const CACHE_KEY = "maisonlouer_supabase_annonces_v2";
const CACHE_TTL_MS = 60 * 1000; // 60s

/* =========================
   FETCH HELPERS
========================= */
async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
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

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

function slugify(str) {
  return (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

/* =========================
   NORMALISATION (Supabase -> format site)
========================= */
function normalizeAnnonce(row, index) {
  const titre = row["Titre"] ?? "";

  // slug: on accepte plusieurs noms possibles (au cas où)
  const rowSlug =
    row["slug"] ??
    row["Slug"] ??
    row["SLUG"] ??
    null;

  // fallback (si jamais slug pas encore rempli)
  const fallbackSlug = `${slugify(titre)}-${index + 1}`;

  // images
  let imagesArr = [];
  const rawImages = row["Images"];
  if (Array.isArray(rawImages)) {
    imagesArr = rawImages.filter(Boolean);
  } else if (typeof rawImages === "string" && rawImages.trim()) {
    imagesArr = rawImages.split("|").map(s => s.trim()).filter(Boolean);
  }

  return {
    // ✅ identifiant URL
    id: rowSlug || fallbackSlug,

    // ✅ UUID technique (ne pas utiliser dans l’URL)
    dbId: row["slug"] ?? row["id"] ?? syntheticId,

    titre: titre,
    typeOffre: row["TypeOffre"] ?? "",
    typeBien: row["TypeBien"] ?? "",
    ville: row["Ville"] ?? "",
    quartier: row["Quartier"] ?? "",

    prixAr: row["Prix"] ?? null,
    chambres: row["Chambres"] ?? null,
    sdb: row["SDB"] ?? null,
    surface: row["Surface"] ?? null,

    images: imagesArr,

    description: row["Description"] ?? "",

    publie: row["Publié"] === true,

    lat: row["lat"] ?? null,
    lng: row["lng"] ?? null,
    whatsapp: row["WhatsApp"] ?? "",

    listeParNous: row["ListéParNous"] === true,
    status: row["Status"] ?? "",
    dateAjout: row["Date d'ajout"] ?? "",
  };
}

async function fetchAnnonces() {
  const cached = readCache();
  if (cached) return cached;

  if (!SUPABASE_ANON_KEY) {
    throw new Error("Clé Supabase manquante (SUPABASE_ANON_KEY).");
  }

  // ✅ On ne récupère que les lignes publiées côté API (plus rapide)
  // colonne "Publié" => il faut encoder l'accent dans l'URL
  const publishedCol = encodeURIComponent("Publié"); // Publi%C3%A9
  const url = `${SUPABASE_URL}/rest/v1/annonces?select=*&${publishedCol}=eq.true`;

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

  writeCache(annonces);
  return annonces;
}

/* =========================
   UI HELPERS
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

/* -------------------------
   CARTES CLASSIQUES
------------------------- */
function createClassicCard(a) {
  const img = (a.images && a.images.length) ? a.images[0] : "./assets/images/property-1.jpg";
  const isLocation = norm(a.typeOffre) === "location";
  const badgeText = isLocation ? "À louer" : "À vendre";
  const badgeClass = isLocation ? "badge-location" : "badge-vente";

  const adresse = [a.quartier, a.ville].filter(Boolean).join(", ") || "Madagascar";
  const prix = formatPriceAr(a.prixAr);

  const chambres = a.chambres ? `${a.chambres} ch.` : "";
  const sdb = a.sdb ? `${a.sdb} sdb` : "";
  const surface = a.surface ? `${a.surface} m²` : "";
  const details = [chambres, sdb, surface].filter(Boolean).join(" • ");

  // ✅ URL = slug
  const slug = a.id ? encodeURIComponent(a.id) : "";
  const link = slug ? `annonce.html?id=${slug}` : "annonce.html";

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
   CARTE ROA
------------------------- */
function createRoaCard(a, mode) {
  const img = (a.images && a.images.length) ? a.images[0] : "./assets/images/property-1.jpg";
  const adresse = [a.quartier, a.ville].filter(Boolean).join(", ") || "Madagascar";
  const prix = formatPriceAr(a.prixAr);

  const chambres = a.chambres ? `${a.chambres} ch.` : null;
  const sdb = a.sdb ? `${a.sdb} sdb` : null;
  const surface = a.surface ? `${a.surface} m²` : null;

  // ✅ URL = slug
  const slug = a.id ? encodeURIComponent(a.id) : "";
  const link = slug ? `annonce.html?id=${slug}` : "annonce.html";

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
   RENDER
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

  if (page === "locations.html") {
    const locations = annonces.filter(a => norm(a.typeOffre) === "location");
    if (!locations.length) {
      container.innerHTML = `<p>Aucune location disponible pour le moment.</p>`;
      return;
    }
    renderRoaGrid(container, locations, "location");
    return;
  }

  if (page === "ventes.html") {
    const ventes = annonces.filter(a => norm(a.typeOffre) === "vente");
    if (!ventes.length) {
      container.innerHTML = `<p>Aucun bien en vente disponible pour le moment.</p>`;
      return;
    }
    renderRoaGrid(container, ventes, "vente");
    return;
  }

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
        const matchTypeBien = !typeBien ? true : (!a.typeBien ? true : norm(a.typeBien) === typeBien);
        const matchChambres = (chambresMin === null) ? true : (Number(a.chambres || 0) >= chambresMin);

        return matchZone && matchBudget && matchTypeOffre && matchTypeBien && matchChambres;
      });

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
        if (infoEl)JS) infoEl.textContent = "";
        renderRoaGrid(container, annonces, "mix");
      });
    }

    renderRoaGrid(container, annonces, "mix");
    if (qpZone || qpOffre) applyFilters();
    return;
  }

  renderClassicList(container, annonces);
}

document.addEventListener("DOMContentLoaded", initAnnonces);
