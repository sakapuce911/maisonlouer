// ===================================
// HOME - NEARBY (Géolocalisation + slider)
// Fichier: assets/js/home-nearby.js
// ✅ Source UNIQUE: /api/annonces (Notion via Vercel)
// ===================================

(async function () {
  const track = document.getElementById("nearbyTrack");
  const statusEl = document.getElementById("nearbyStatus");
  const dotsEl = document.getElementById("nearbyDots");
  const prevBtn = document.getElementById("nearbyPrev");
  const nextBtn = document.getElementById("nearbyNext");
  const viewport = document.getElementById("nearbyViewport");

  if (!track || !statusEl || !dotsEl || !prevBtn || !nextBtn || !viewport) return;

  // =========================
  // Utils
  // =========================
  function setStatus(text, type = "info") {
    const icon =
      type === "ok" ? "location-outline" :
      type === "warn" ? "alert-circle-outline" :
      "location-outline";

    statusEl.innerHTML = `
      <div class="nearby-pill">
        <ion-icon name="${icon}"></ion-icon>
        <span>${text}</span>
      </div>
    `;
  }

  function norm(str) {
    return (str || "").toString().trim().toLowerCase();
  }

  function isPublished(a) {
    // Notion renvoie publie: true/false
    return a && (a.publie === true || a.publie === "true");
  }

  function formatPriceAr(prixAr) {
    if (prixAr === undefined || prixAr === null || prixAr === "") return "Prix sur demande";
    const n = Number(String(prixAr).replace(/\s+/g, ""));
    if (!Number.isFinite(n)) return "Prix sur demande";
    return `${String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(id);
    }
  }

  // ✅ NOTION ONLY
  async function fetchAnnonces() {
    const resApi = await fetchWithTimeout("/api/annonces", { method: "GET" }, 8000);

    if (!resApi.ok) {
      let detail = "";
      try {
        const err = await resApi.json();
        detail = err?.detail ? ` (${err.detail})` : "";
      } catch (_) {}
      throw new Error(`Impossible de charger les annonces depuis Notion (HTTP ${resApi.status})${detail}`);
    }

    const data = await resApi.json();
    if (!Array.isArray(data)) throw new Error("Format API invalide (attendu : tableau)");
    return data;
  }

  function getFirstImage(a) {
    if (a.images && Array.isArray(a.images) && a.images.length) return a.images[0];
    return "./assets/images/property-1.jpg";
  }

  function buildAddress(a) {
    const parts = [];
    if (a.quartier) parts.push(a.quartier);
    if (a.ville) parts.push(a.ville);
    return parts.length ? parts.join(", ") : "Adresse non précisée";
  }

  // =========================
  // Optional geocoding (fallback)
  // - Utilise Nominatim OpenStreetMap (public)
  // - Cache localStorage pour éviter de refaire
  // =========================
  const GEO_CACHE_KEY = "maisonlouer_geo_cache_v1";

  function loadGeoCache() {
    try {
      return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveGeoCache(cache) {
    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch {}
  }

  async function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  async function geocodeAnnonce(a, cache) {
    const key = (a.id !== undefined && a.id !== null)
      ? `id:${a.id}`
      : `txt:${(a.quartier || "")}|${(a.ville || "")}`.toLowerCase();

    if (cache[key] && cache[key].lat && cache[key].lng) {
      return { lat: cache[key].lat, lng: cache[key].lng };
    }

    const q = [a.quartier, a.ville, "Madagascar"].filter(Boolean).join(", ");
    if (!q.trim()) return null;

    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, { headers: { "Accept": "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data || !data.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    cache[key] = { lat, lng, q, t: Date.now() };
    saveGeoCache(cache);

    await sleep(1100);
    return { lat, lng };
  }

  // =========================
  // Slider state
  // =========================
  let cards = [];
  let page = 0;
  let pages = 0;
  let perView = 3;

  function calcPerView() {
    const w = window.innerWidth;
    if (w <= 620) return 1;
    if (w <= 980) return 2;
    return 3;
  }

  function renderDots() {
    dotsEl.innerHTML = "";
    for (let i = 0; i < pages; i++) {
      const b = document.createElement("button");
      b.className = "nearby-dot" + (i === page ? " is-active" : "");
      b.type = "button";
      b.setAttribute("aria-label", `Page ${i + 1}`);
      b.addEventListener("click", () => goTo(i));
      dotsEl.appendChild(b);
    }
  }

  function updateNav() {
    prevBtn.disabled = page <= 0;
    nextBtn.disabled = page >= pages - 1;

    const dots = dotsEl.querySelectorAll(".nearby-dot");
    dots.forEach((d, i) => d.classList.toggle("is-active", i === page));
  }

  function goTo(p) {
    page = Math.max(0, Math.min(p, pages - 1));
    const viewportWidth = viewport.clientWidth;
    const shift = page * viewportWidth;
    track.style.transform = `translateX(${-shift}px)`;
    updateNav();
  }

  function rebuildLayout() {
    perView = calcPerView();
    pages = Math.max(1, Math.ceil(cards.length / perView));
    renderDots();
    goTo(Math.min(page, pages - 1));
  }

  // =========================
  // Card renderer
  // =========================
  function renderCard(a) {
    const img = getFirstImage(a);
    const offre = norm(a.typeOffre);
    const badge = (offre === "location") ? "À louer" : (offre === "vente" ? "À vendre" : "Annonce");
    const badgeClass = (offre === "location") ? "" : " sale";
    const price = formatPriceAr(a.prixAr);
    const addr = buildAddress(a);

    const beds = a.chambres ?? a.nbChambres ?? "";
    const baths = a.sdb ?? a.nbSdb ?? "";
    const surface = a.surface ?? a.surfaceM2 ?? "";

    const bedsTxt = beds !== "" ? `<span><strong>${beds}</strong> ch</span>` : "";
    const bathsTxt = baths !== "" ? `<span><strong>${baths}</strong> sdb</span>` : "";
    const surfaceTxt = surface !== "" ? `<span><strong>${surface}</strong> m²</span>` : "";

    const detailsLink = (a.id !== undefined && a.id !== null)
      ? `annonce.html?id=${encodeURIComponent(a.id)}`
      : "annonce.html";

    return `
      <article class="nearby-card">
        <div class="nearby-card-imgwrap">
          <img src="${img}" alt="${a.titre || "Annonce immobilière"}" loading="lazy">
          <span class="nearby-badge${badgeClass}">${badge}</span>
        </div>

        <div class="nearby-card-body">
          <p class="nearby-price">${price}</p>

          <p class="nearby-location">
            <ion-icon name="location-outline"></ion-icon>
            <span>${addr}</span>
          </p>

          <p class="nearby-meta">
            ${bedsTxt}
            ${bathsTxt}
            ${surfaceTxt}
          </p>

          <div class="nearby-actions">
            <a href="${detailsLink}">
              Voir détails <ion-icon name="arrow-forward-outline"></ion-icon>
            </a>

            <div class="nearby-icons">
              <button class="nearby-icon-btn" type="button" aria-label="Ajouter aux favoris" title="Favori (UI)">
                <ion-icon name="heart-outline"></ion-icon>
              </button>
              <button class="nearby-icon-btn" type="button" aria-label="Partager" title="Partager (UI)">
                <ion-icon name="share-social-outline"></ion-icon>
              </button>
            </div>
          </div>
        </div>
      </article>
    `;
  }

  // =========================
  // Main
  // =========================
  setStatus("Chargement des annonces…", "info");

  let annonces = [];
  try {
    const raw = await fetchAnnonces();
    // ✅ sécurité : seulement publiées
    annonces = raw.filter(isPublished);
  } catch (e) {
    setStatus(`Erreur : ${e.message}`, "warn");
    track.innerHTML = "";
    dotsEl.innerHTML = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  if (!annonces.length) {
    setStatus("Aucune annonce disponible pour le moment.", "warn");
    track.innerHTML = "";
    dotsEl.innerHTML = "";
    prevBtn.disabled = true;
    nextBtn.disabled = true;
    return;
  }

  // 1) Obtenir position utilisateur
  function getUserPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("La géolocalisation n’est pas disponible sur ce navigateur."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(pos),
        (err) => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  let userLat, userLng;

  try {
    setStatus("Veuillez autoriser la localisation pour voir les biens proches.", "info");
    const pos = await getUserPosition();
    userLat = pos.coords.latitude;
    userLng = pos.coords.longitude;
    setStatus("Localisation activée. Tri des annonces par proximité…", "ok");
  } catch (e) {
    // ✅ Si refus : on montre simplement les 9 premières annonces Notion
    setStatus("Localisation refusée. Affichage des annonces recommandées.", "warn");
    cards = annonces.slice(0, 9);
    track.innerHTML = cards.map(renderCard).join("");
    rebuildLayout();
    prevBtn.addEventListener("click", () => goTo(page - 1));
    nextBtn.addEventListener("click", () => goTo(page + 1));
    window.addEventListener("resize", rebuildLayout);
    return;
  }

  // 2) Préparer coords annonces (lat/lng) + fallback geocode si absent
  const cache = loadGeoCache();

  // ✅ limite geocode pour rester safe
  let geocodeBudget = 10;

  const enriched = [];
  for (const a of annonces) {
    let lat = a.lat ?? a.latitude;
    let lng = a.lng ?? a.longitude;

    if ((!lat || !lng) && geocodeBudget > 0) {
      const got = await geocodeAnnonce(a, cache);
      if (got) {
        lat = got.lat;
        lng = got.lng;
      }
      geocodeBudget--;
    }

    if (Number.isFinite(parseFloat(lat)) && Number.isFinite(parseFloat(lng))) {
      const d = haversineKm(userLat, userLng, parseFloat(lat), parseFloat(lng));
      enriched.push({ ...a, _distanceKm: d });
    }
  }

  // Si aucune annonce n'a de coords même après geocode => fallback simple
  if (!enriched.length) {
    setStatus("Proximité indisponible. Affichage des annonces recommandées.", "warn");
    cards = annonces.slice(0, 9);
    track.innerHTML = cards.map(renderCard).join("");
  } else {
    enriched.sort((x, y) => x._distanceKm - y._distanceKm);
    cards = enriched.slice(0, 9);
    setStatus("Voici les biens les plus proches (tri par distance).", "ok");
    track.innerHTML = cards.map(renderCard).join("");
  }

  // 3) Slider actions
  prevBtn.addEventListener("click", () => goTo(page - 1));
  nextBtn.addEventListener("click", () => goTo(page + 1));

  window.addEventListener("resize", () => {
    track.style.transform = "translateX(0px)";
    page = 0;
    rebuildLayout();
  });

  rebuildLayout();

  // Swipe mobile
  let startX = null;
  viewport.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  viewport.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) > 45) {
      if (dx < 0) goTo(page + 1);
      else goTo(page - 1);
    }
    startX = null;
  }, { passive: true });

})();
