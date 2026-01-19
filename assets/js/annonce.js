/* =========================
   File: assets/js/annonce.js
   Objectif:
   - annonce.html => afficher UNE annonce via ?id=SLUG
   - Source : Supabase REST (public.annonces)
   - RLS : autoriser SELECT sur les lignes "Publié = true"
========================= */

/* =========================
   CONFIG SUPABASE
========================= */
const SUPABASE_URL = "https://glysaizevxujkiuuwflv.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdseXNhaXpldnh1amtpdXV3Zmx2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg4MDYxOTksImV4cCI6MjA4NDM4MjE5OX0.K29buPf0NxCLw4JSdbxUshHRC9BUMikfakRUPCDVi0w";

/* =========================
   HELPERS
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

function formatPriceAr(prixAr) {
  if (prixAr === null || prixAr === undefined || prixAr === "") return "Prix sur demande";
  const n = Number(prixAr);
  if (Number.isNaN(n)) return "Prix sur demande";
  return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
}

function norm(str) {
  return (str || "").toString().trim().toLowerCase();
}

function getQueryId() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id"); // on garde "id" dans l'URL, mais c'est un SLUG
}

function pickContainer() {
  return (
    document.getElementById("annonce-container") ||
    document.getElementById("annonce-detail") ||
    document.getElementById("annonce") ||
    document.getElementById("main-content") ||
    document.querySelector("main") ||
    document.body
  );
}

/* =========================
   NORMALISATION (comme ton code)
========================= */
function normalizeAnnonce(row) {
  let imagesArr = [];
  if (Array.isArray(row["Images"])) {
    imagesArr = row["Images"].filter(Boolean);
  } else if (typeof row["Images"] === "string" && row["Images"].trim()) {
    imagesArr = row["Images"].split("|").map((s) => s.trim()).filter(Boolean);
  }

  return {
    id: row["id"] ?? null,
    slug: row["slug"] ?? null,

    titre: row["Titre"] ?? "",
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

/* =========================
   FETCH 1 annonce par SLUG
========================= */
async function fetchAnnonceBySlug(slug) {
  const url =
    `${SUPABASE_URL}/rest/v1/annonces` +
    `?select=*` +
    `&slug=eq.${encodeURIComponent(slug)}` +
    `&Publié=eq.true` +
    `&limit=1`;

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
  if (!Array.isArray(rows) || rows.length === 0) return null;

  return normalizeAnnonce(rows[0]);
}

/* =========================
   RENDER
========================= */
function renderNotFound(container, slug) {
  container.innerHTML = `
    <div style="max-width:1100px;margin:40px auto;padding:0 16px;">
      <h2 style="color:#b00020;">Annonce introuvable (ID : ${slug}).</h2>

      <div style="display:flex;gap:16px;flex-wrap:wrap;margin-top:18px;">
        <a class="btn" href="recherche.html">Retour à la recherche</a>
        <a class="btn" href="locations.html">Voir les locations</a>
        <a class="btn" href="ventes.html">Voir les ventes</a>
      </div>
    </div>
  `;
}

function renderAnnonce(container, a) {
  const adresse = [a.quartier, a.ville].filter(Boolean).join(", ") || "Madagascar";
  const prix = formatPriceAr(a.prixAr);

  const img = (a.images && a.images.length) ? a.images[0] : "./assets/images/property-1.jpg";

  const meta = [
    a.chambres ? `${a.chambres} ch.` : null,
    a.sdb ? `${a.sdb} sdb` : null,
    a.surface ? `${a.surface} m²` : null,
  ].filter(Boolean).join(" • ");

  const isLocation = norm(a.typeOffre) === "location";
  const badge = isLocation ? "À louer" : "À vendre";

  // WhatsApp (format simple)
  const wa = (a.whatsapp || "").toString().replace(/\s+/g, "");
  const waLink = wa ? `https://wa.me/${wa}` : null;

  container.innerHTML = `
    <div style="max-width:1100px;margin:30px auto;padding:0 16px;">
      <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:22px;align-items:start;">
        <div>
          <img src="${img}" alt="${a.titre || "Annonce"}" style="width:100%;border-radius:12px;object-fit:cover;max-height:420px;">
        </div>

        <div>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
            <span style="background:#0b1f3a;color:#fff;padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px;">
              ${badge}
            </span>
            ${a.listeParNous ? `<span style="background:#111;color:#fff;padding:6px 10px;border-radius:999px;font-weight:700;font-size:12px;">LISTÉ PAR NOUS</span>` : ``}
          </div>

          <h1 style="margin:12px 0 8px;">${a.titre || "Annonce"}</h1>

          <div style="font-size:22px;font-weight:800;margin:10px 0;">${prix}</div>

          <div style="display:flex;gap:10px;align-items:center;margin:10px 0;color:#333;">
            <span>📍</span>
            <span>${adresse}</span>
          </div>

          ${meta ? `<div style="margin:10px 0;color:#333;">${meta}</div>` : ``}

          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:18px;">
            ${waLink ? `<a class="btn" href="${waLink}" target="_blank" rel="noopener">Contacter sur WhatsApp</a>` : ``}
            <a class="btn" href="recherche.html">Retour à la recherche</a>
          </div>
        </div>
      </div>

      <div style="margin-top:26px;background:#fff;border-radius:12px;padding:16px;box-shadow:0 6px 22px rgba(0,0,0,.06);">
        <h3 style="margin:0 0 10px;">Description</h3>
        <p style="margin:0;line-height:1.6;color:#333;">
          ${a.description ? a.description : "Aucune description pour le moment."}
        </p>
      </div>
    </div>
  `;
}

/* =========================
   INIT
========================= */
async function initAnnonce() {
  const container = pickContainer();
  const slug = getQueryId();

  if (!slug) {
    renderNotFound(container, "aucun-id");
    return;
  }

  try {
    container.innerHTML = `<p style="max-width:1100px;margin:40px auto;padding:0 16px;">Chargement de l’annonce…</p>`;
    const annonce = await fetchAnnonceBySlug(slug);

    if (!annonce) {
      renderNotFound(container, slug);
      return;
    }

    renderAnnonce(container, annonce);
  } catch (e) {
    container.innerHTML = `<p style="color:#b00020;max-width:1100px;margin:40px auto;padding:0 16px;">Erreur : ${e.message}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", initAnnonce);
