/* =========================
   File: assets/js/annonce.js
   Objectif:
   - annonce.html => détails d’un bien via /api/annonces
   - URL attendue : annonce.html?id=<uuid>
========================= */

(function () {
  const container = document.getElementById("annonce-container");
  if (!container) return;

  // Email global MaisonLouer
  const CONTACT_EMAIL = "maisonlouer.mada@outlook.com";

  // WhatsApp par défaut si l’annonce n’en a pas
  const DEFAULT_WA = "261385436196";

  function norm(str) {
    return (str || "").toString().trim().toLowerCase();
  }

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
    if (Number.isNaN(n)) return "Prix sur demande";
    return `${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // ✅ Source unique : /api/annonces (Supabase)
  async function fetchAnnoncesFromApiOnly() {
    const res = await fetchWithTimeout("/api/annonces", { method: "GET" }, 12000);
    if (!res.ok) throw new Error(`API indisponible (${res.status})`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Format API invalide (attendu: tableau)");
    return data;
  }

  function buildWhatsAppLink(waDigits, titre, pageUrl) {
    const phone = (waDigits || "").toString().replace(/[^\d]/g, "") || DEFAULT_WA;
    const msg = `Bonjour, je suis intéressé(e) par cette annonce : ${titre}\nLien : ${pageUrl}`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  }

  function buildMailLink(titre, pageUrl) {
    const subject = `Demande d'information - ${titre}`;
    const body = `Bonjour,\n\nJe suis intéressé(e) par l'annonce : ${titre}\nLien : ${pageUrl}\n\nMerci.`;
    return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function buildHtml(a) {
    const titre = a.titre || "Annonce";
    const offre = norm(a.typeOffre);
    const bien = norm(a.typeBien);

    const badgeOffre =
      offre === "location" ? "À LOUER" :
      offre === "vente" ? "EN VENTE" :
      "ANNONCE";

    const pillOffreClass =
      offre === "location" ? "green" :
      offre === "vente" ? "blue" :
      "gray";

    const badgeBien = bien ? bien.toUpperCase() : "BIEN";

    const prix = formatPriceAr(a.prixAr);

    const ville = a.ville || "";
    const quartier = a.quartier || "";
    const adresse = [quartier, ville].filter(Boolean).join(", ") || "Madagascar";

    const chambres = (a.chambres !== null && a.chambres !== undefined) ? Number(a.chambres) : null;
    const sdb = (a.sdb !== null && a.sdb !== undefined) ? Number(a.sdb) : null;
    const surface = (a.surface !== null && a.surface !== undefined) ? Number(a.surface) : null;

    const description = a.description ? a.description : "Aucune description pour le moment.";

    const images = Array.isArray(a.images) ? a.images.filter(Boolean) : [];
    const mainImg = images.length ? images[0] : "./assets/images/property-1.jpg";

    const pageUrl = window.location.href;
    const waLink = buildWhatsAppLink(a.whatsapp, titre, pageUrl);
    const mailLink = buildMailLink(titre, pageUrl);

    return `
      <div class="annonce-head">
        <div>
          <p class="annonce-kicker">MaisonLouer</p>
          <h1 class="annonce-title">${escapeHtml(titre)}</h1>
          <p class="annonce-sub"><span>${escapeHtml(adresse)}</span></p>
        </div>

        <div class="annonce-badges">
          <span class="pill ${pillOffreClass}">
            <ion-icon name="pricetag-outline"></ion-icon>
            ${escapeHtml(badgeOffre)}
          </span>
          <span class="pill gray">
            <ion-icon name="home-outline"></ion-icon>
            ${escapeHtml(badgeBien)}
          </span>
        </div>
      </div>

      <div class="annonce-grid">
        <div style="display:grid; gap:18px;">
          <div class="card">
            <div class="gallery-main">
              <img id="galleryMainImg" src="${escapeHtml(mainImg)}" alt="${escapeHtml(titre)}">
              <div class="gallery-nav" aria-hidden="false">
                <button class="gbtn" id="gPrev" type="button" aria-label="Photo précédente">
                  <ion-icon name="chevron-back-outline"></ion-icon>
                </button>
                <button class="gbtn" id="gNext" type="button" aria-label="Photo suivante">
                  <ion-icon name="chevron-forward-outline"></ion-icon>
                </button>
              </div>
            </div>

            <div class="gallery-thumbs" id="galleryThumbs">
              ${
                images.length
                  ? images.slice(0, 12).map((src, idx) => `
                      <div class="thumb ${idx === 0 ? "is-active" : ""}" data-idx="${idx}" role="button" tabindex="0" aria-label="Voir la photo ${idx + 1}">
                        <img src="${escapeHtml(src)}" alt="${escapeHtml(titre)} - photo ${idx + 1}">
                      </div>
                    `).join("")
                  : `
                      <div class="thumb is-active" data-idx="0" role="button" tabindex="0" aria-label="Voir la photo 1">
                        <img src="${escapeHtml(mainImg)}" alt="${escapeHtml(titre)} - photo 1">
                      </div>
                    `
              }
            </div>
          </div>

          <div class="card">
            <div class="content-pad">
              <h3 class="h3t">Description du bien</h3>
              <p class="desc">${escapeHtml(description)}</p>
            </div>
          </div>
        </div>

        <aside class="card">
          <div class="side-pad">
            <p class="price">${escapeHtml(prix)}</p>

            <div class="meta-row">
              <ion-icon name="location-outline"></ion-icon>
              <span>${escapeHtml(adresse)}</span>
            </div>

            <div class="meta-grid">
              <div class="kpi"><strong>${chambres !== null ? chambres : "-"}</strong><span>Chambres</span></div>
              <div class="kpi"><strong>${sdb !== null ? sdb : "-"}</strong><span>SDB</span></div>
              <div class="kpi"><strong>${surface !== null ? surface : "-"}</strong><span>m²</span></div>
            </div>

            <!-- ✅ CTA + Partage -->
            <div class="cta">
              <a class="cbtn primary" href="${escapeHtml(waLink)}" target="_blank" rel="noopener">
                <ion-icon name="logo-whatsapp"></ion-icon>
                Contacter sur WhatsApp
              </a>

              <a class="cbtn dark" href="${escapeHtml(mailLink)}">
                <ion-icon name="mail-outline"></ion-icon>
                Envoyer un email
              </a>

              <a class="cbtn ghost" id="btn-share" href="#" aria-label="Partager l’annonce">
                <ion-icon name="share-social-outline"></ion-icon>
                Partager l’annonce
              </a>
            </div>

            <p style="margin:14px 0 0; color:#6b7280; font-size:13px; line-height:1.6;">
              Astuce : indiquez votre budget, la zone et si vous cherchez plutôt à louer ou acheter.
            </p>
          </div>
        </aside>
      </div>
    `;
  }

  function initGallery(images) {
    const imgEl = document.getElementById("galleryMainImg");
    const thumbs = document.getElementById("galleryThumbs");
    const prev = document.getElementById("gPrev");
    const next = document.getElementById("gNext");
    if (!imgEl || !prev || !next || !thumbs) return;

    const list = (Array.isArray(images) && images.length) ? images.filter(Boolean) : [imgEl.src];
    let idx = 0;

    const setActive = (i) => {
      idx = (i + list.length) % list.length;
      imgEl.src = list[idx];

      const all = thumbs.querySelectorAll(".thumb");
      all.forEach(t => t.classList.remove("is-active"));

      const current = thumbs.querySelector(`.thumb[data-idx="${idx}"]`);
      if (current) current.classList.add("is-active");
    };

    prev.addEventListener("click", () => setActive(idx - 1));
    next.addEventListener("click", () => setActive(idx + 1));

    thumbs.addEventListener("click", (e) => {
      const t = e.target.closest(".thumb");
      if (!t) return;
      const i = Number(t.getAttribute("data-idx"));
      if (!Number.isNaN(i)) setActive(i);
    });

    thumbs.addEventListener("keydown", (e) => {
      const t = e.target.closest(".thumb");
      if (!t) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const i = Number(t.getAttribute("data-idx"));
        if (!Number.isNaN(i)) setActive(i);
      }
    });

    if (list.length <= 1) {
      prev.style.display = "none";
      next.style.display = "none";
    }
  }

  function initShare(titre) {
    const btn = document.getElementById("btn-share");
    if (!btn) return;

    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      const url = window.location.href;

      try {
        if (navigator.share) {
          await navigator.share({
            title: titre || "Annonce MaisonLouer",
            text: "Annonce immobilière sur MaisonLouer",
            url
          });
        } else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          alert("Lien copié dans le presse-papier ✅");
        } else {
          prompt("Copiez le lien :", url);
        }
      } catch (err) {
        // si user annule, pas besoin d’erreur
      }
    });
  }

  async function init() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      container.innerHTML = `<p style="color:#b00020; font-weight:800;">Erreur : aucune annonce sélectionnée. (ID manquant)</p>`;
      return;
    }

    let annonces = [];
    try {
      annonces = await fetchAnnoncesFromApiOnly();
    } catch (e) {
      container.innerHTML = `
        <p style="color:#b00020; font-weight:800;">
          Impossible de charger l’annonce (API Supabase).<br>
          Détail : ${escapeHtml(e.message)}
        </p>
      `;
      return;
    }

    const a = annonces.find(x => String(x.id) === String(id));
    if (!a) {
      container.innerHTML = `<p style="color:#b00020; font-weight:800;">Annonce introuvable (ID : ${escapeHtml(id)}).</p>`;
      return;
    }

    // SEO dynamique
    document.title = `${a.titre || "Annonce"} - MaisonLouer`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc) {
      const snippet = (a.description || "").replace(/\s+/g, " ").trim();
      metaDesc.setAttribute("content", snippet ? snippet.slice(0, 160) : "Détails de l’annonce sur MaisonLouer.");
    }

    container.innerHTML = buildHtml(a);
    initGallery(a.images);
    initShare(a.titre || "Annonce MaisonLouer");
  }

  init();
})();
