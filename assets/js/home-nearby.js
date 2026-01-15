// ===================================
// HOME - NEARBY (Géolocalisation + slider)
// Fichier: assets/js/home-nearby.js
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
    const icon = type === "ok" ? "location-outline" : type === "warn" ? "alert-circle-outline" : "location-outline";
    statusEl.innerHTML = `
      <div class="nearby-pill">
        <ion-icon name="${icon}"></ion-icon>
        <span>${text}</span>
      </div>
    `;
  }

  function formatPriceAr(prixAr) {
    if (prixAr === undefined || prixAr === null || prixAr === "") return "Prix sur demande";
    const s = String(prixAr).replace(/\s+/g, "");
    if (!/^\d+$/.test(s)) return "Prix sur demande";
    return `${s.replace(/\B(?=(\d{3})+(?!\d))/g, " ")} Ar`;
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

  async function fetchAnnonces() {
    const res = await fetch("./assets/data/annonces.json");
    if (!res.ok) throw new Error("Impossible de charger annonces.json");
    return await res.json();
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
  const GEO_CACHE_KEY = "immo_geo_cache_v1";

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
    // Utilise a.id si possible, sinon une clé basée sur ville/quartier
    const key = (a.id !== undefined && a.id !== null)
      ? `id:${a.id}`
      : `txt:${(a.quartier || "")}|${(a.ville || "")}`.toLowerCase();

    if (cache[key] && cache[key].lat && cache[key].lng) {
      return { lat: cache[key].lat, lng: cache[key].lng };
    }

    const q = [a.quartier, a.ville, "Madagascar"].filter(Boolean).join(", ");
    if (!q.trim()) return null;

    // Nominatim policy: rester raisonnable -> 1 req/sec + cache
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
    const res = await fetch(url, {
      headers: {
        // User-Agent n'est pas possible en browser, mais on reste raisonnable (cache + low volume)
        "Accept": "application/json"
      }
    });

    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.length) return null;

    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

    cache[key] = { lat, lng, q, t: Date.now() };
    saveGeoCache(cache);

    // Pause pour éviter d'enchaîner
    await sleep(1100);

    return { lat, lng };
  }

  // =========================
  // Slider state
  // =========================
  let cards = [];
  let page = 0;
  let pages = 0;
  let perView = 3; // recalculé selon largeur

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
    const gap = 18;
    // Translate basé sur largeur viewport
    const viewportWidth = viewport.clientWidth;
    const shift = page * (viewportWidth + 0); // page par "écran"
    track.style.transform = `translateX(${-shift}px)`;
    updateNav();
  }

  function rebuildLayout() {
    perView = calcPerView();
    pages = Math.max(1, Math.ceil(cards.length / perView));

    // On fixe une largeur "page" = viewport; on répartit les cards dedans par CSS flex-basis
    // Ici, on se contente de recalculer pages/dots et re-go.
    renderDots();
    goTo(Math.min(page, pages - 1));
  }

  // =========================
  // Card renderer
  // =========================
  function renderCard(a) {
    const img = getFirstImage(a);
    const badge = (a.typeOffre === "location") ? "À louer" : "À vendre";
    const badgeClass = (a.typeOffre === "location") ? "" : " sale";
    const price = formatPriceAr(a.prixAr);
    const addr = buildAddress(a);

    const beds = a.chambres ?? a.nbChambres ?? "";
    const baths = a.sdb ?? a.nbSdb ?? "";
    const surface = a.surface ?? a.surfaceM2 ?? "";

    const bedsTxt = beds !== "" ? `<span><strong>${beds}</strong> ch</span>` : "";
    const bathsTxt = baths !== "" ? `<span><strong>${baths}</strong> sdb</span>` : "";
    const surfaceTxt = surface !== "" ? `<span><strong>${surface}</strong> m²</span>` : "";

    const detailsLink = (a.id !== undefined && a.id !== null) ? `annonce.html?id=${encodeURIComponent(a.id)}` : "annonce.html";

    return `
      <article class="nearby-card">
        <div class="nearby-card-imgwrap">
          <img src="${img}" alt="${a.titre || "Annonce immobilière"}">
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
  setStatus("Localisation en attente…", "info");

  const annonces = await fetchAnnonces();

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
    setStatus("Localisation refusée. Affichage des annonces recommandées à la place.", "warn");
    // Fallback sans géoloc : on montre juste les 9 premières
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

  // On limite le geocode pour rester safe (sinon trop de requêtes)
  // -> On géocode max 10 annonces par chargement si besoin
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

  // Si aucune annonce n'a de coords même après fallback
  if (!enriched.length) {
    setStatus("Impossible de calculer la proximité : ajoutez lat/lng dans annonces.json (recommandé).", "warn");
    cards = annonces.slice(0, 9);
    track.innerHTML = cards.map(renderCard).join("");
  } else {
    enriched.sort((x, y) => x._distanceKm - y._distanceKm);

    // on prend les 9 plus proches
    cards = enriched.slice(0, 9);

    setStatus(`Voici les biens les plus proches (tri par distance).`, "ok");
    track.innerHTML = cards.map(renderCard).join("");
  }

  // 3) Slider actions
  function snapToPage(p) {
    // On reconstruit un "page width = viewport width" : on doit ajouter une "spacer" technique
    // Simple approche : on duplique une structure en pages par JS
    // Mais ici on gère translation en pixels sur viewport (par écran).
    goTo(p);
  }

  prevBtn.addEventListener("click", () => snapToPage(page - 1));
  nextBtn.addEventListener("click", () => snapToPage(page + 1));
  window.addEventListener("resize", () => {
    // reset transform pour éviter décalage après resize
    track.style.transform = "translateX(0px)";
    page = 0;
    rebuildLayout();
  });

  // Pagination basée sur viewport (pages = écrans)
  rebuildLayout();

  // Swipe mobile (simple)
  let startX = null;
  viewport.addEventListener("touchstart", (e) => { startX = e.touches[0].clientX; }, { passive: true });
  viewport.addEventListener("touchend", (e) => {
    if (startX === null) return;
    const endX = e.changedTouches[0].clientX;
    const dx = endX - startX;
    if (Math.abs(dx) > 45) {
      if (dx < 0) snapToPage(page + 1);
      else snapToPage(page - 1);
    }
    startX = null;
  }, { passive: true });

})();
