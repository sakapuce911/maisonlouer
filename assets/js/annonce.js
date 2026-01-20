/* =========================
   File: assets/js/annonce.js
========================= */

(function () {
  const container = document.getElementById("annonce-container");
  if (!container) return;

  const CONTACT_EMAIL = "maisonlouer.mada@outlook.com";
  const DEFAULT_WA = "261385436196";

  function escapeHtml(str) {
    return (str || "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatPriceAr(v) {
    if (!v) return "Prix sur demande";
    const n = Number(v);
    if (Number.isNaN(n)) return "Prix sur demande";
    return `${n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
  }

  async function fetchAnnonces() {
    const res = await fetch("/api/annonces");
    if (!res.ok) throw new Error("API indisponible");
    return await res.json();
  }

  function buildHtml(a) {
    const url = window.location.href;

    return `
      <div class="annonce-head">
        <div>
          <p class="annonce-kicker">MaisonLouer</p>
          <h1 class="annonce-title">${escapeHtml(a.titre)}</h1>
          <p class="annonce-sub">${escapeHtml(a.quartier || "")}, ${escapeHtml(a.ville || "")}</p>
        </div>
      </div>

      <div class="annonce-grid">
        <div class="card">
          <img src="${a.images?.[0] || "./assets/images/property-1.jpg"}" style="width:100%;height:auto">
        </div>

        <aside class="card">
          <div class="side-pad">
            <p class="price">${formatPriceAr(a.prixAr)}</p>

            <div class="cta">
              <a class="cbtn primary" target="_blank"
                 href="https://wa.me/${a.whatsapp || DEFAULT_WA}?text=${encodeURIComponent(url)}">
                WhatsApp
              </a>

              <a class="cbtn dark" href="mailto:${CONTACT_EMAIL}">
                Email
              </a>

              <a class="cbtn ghost" id="shareBtn" href="javascript:void(0)">
                <ion-icon name="share-social-outline"></ion-icon>
                Partager l’annonce
              </a>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function initShare(titre) {
    const btn = document.getElementById("shareBtn");
    if (!btn) return;

    btn.addEventListener("click", async () => {
      const url = window.location.href;

      if (navigator.share) {
        await navigator.share({
          title: titre,
          text: "Annonce immobilière sur MaisonLouer",
          url
        });
      } else {
        await navigator.clipboard.writeText(url);
        alert("Lien copié dans le presse-papier");
      }
    });
  }

  async function init() {
    const id = new URLSearchParams(window.location.search).get("id");
    if (!id) return;

    const annonces = await fetchAnnonces();
    const a = annonces.find(x => x.id === id);
    if (!a) return;

    container.innerHTML = buildHtml(a);
    initShare(a.titre);
  }

  init();
})();
