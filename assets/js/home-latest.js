/* =========================
   File: assets/js/home-latest.js
   Objectif:
   - Accueil: afficher les dernières annonces (liens HTML vers annonce.html?id=...)
   - Source: /api/annonces (Supabase via Vercel)
========================= */

(function () {
  const wrap = document.getElementById("latestListings");
  if (!wrap) return;

  function escapeHtml(str) {
    return (str || "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPriceAr(prixAr) {
    if (prixAr === null || prixAr === undefined || prixAr === "") return "Prix sur demande";
    const n = Number(prixAr);
    if (!Number.isFinite(n)) return "Prix sur demande";
    return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
  }

  function norm(str) {
    return (str || "").toString().trim();
  }

  async function fetchWithTimeout(url, timeoutMs = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { method: "GET", signal: controller.signal });
      return res;
    } finally {
      clearTimeout(id);
    }
  }

  async function fetchAnnonces() {
    const res = await fetchWithTimeout("/api/annonces", 12000);
    if (!res.ok) throw new Error(`API indisponible (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Format API invalide (attendu: tableau)");
    return data;
  }

  function buildCard(a) {
    const id = a.id;
    const titre = a.titre || "Annonce";
    const ville = norm(a.ville);
    const quartier = norm(a.quartier);
    const adresse = [quartier, ville].filter(Boolean).join(", ") || "Madagascar";
    const prix = formatPriceAr(a.prixAr);
    const images = Array.isArray(a.images) ? a.images.filter(Boolean) : [];
    const img = images.length ? images[0] : "./assets/images/property-1.jpg";

    const href = `annonce.html?id=${encodeURIComponent(id)}`;

    return `
      <article class="home-latest-card">
        <a class="home-latest-thumb" href="${escapeHtml(href)}" aria-label="Voir l'annonce ${escapeHtml(titre)}">
          <img src="${escapeHtml(img)}" alt="${escapeHtml(titre)}" loading="lazy" decoding="async">
        </a>

        <div class="home-latest-pad">
          <h3 class="home-latest-h3">${escapeHtml(titre)}</h3>

          <p class="home-latest-meta">
            <span>${escapeHtml(adresse)}</span>
            <span>•</span>
            <span>${escapeHtml((a.typeOffre || "").toLowerCase() === "location" ? "À louer" : "À vendre")}</span>
          </p>

          <p class="home-latest-price">${escapeHtml(prix)}</p>

          <a class="home-latest-link" href="${escapeHtml(href)}">
            Voir l’annonce
            <ion-icon name="arrow-forward-outline" aria-hidden="true"></ion-icon>
          </a>
        </div>
      </article>
    `;
  }

  async function init() {
    try {
      const annonces = await fetchAnnonces();
      const list = annonces
        .filter(a => a && a.id)
        .slice(0, 9); // ✅ 9 annonces max sur l’accueil

      if (!list.length) {
        wrap.innerHTML = `<p>Aucune annonce publiée pour le moment.</p>`;
        return;
      }

      wrap.innerHTML = `
        <div class="home-latest-grid">
          ${list.map(buildCard).join("")}
        </div>
      `;
    } catch (e) {
      wrap.innerHTML = `
        <p style="color:#b00020; font-weight:800;">
          Impossible de charger les dernières annonces.<br>
          Détail : ${escapeHtml(e.message)}
        </p>
      `;
    }
  }

  init();
})();
