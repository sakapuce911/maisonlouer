// =========================
// File: /api/annonces.js
// Vercel Serverless Function
// Retourne un JSON d'annonces depuis Supabase
//
// ENV requis dans Vercel :
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY (recommandé) ou SUPABASE_ANON_KEY
//
// ✅ Ajout 2026-01 : renvoie aussi lat/lng (pour Home Nearby)
// =========================

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Méthode non autorisée" });

  try {
    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL) return res.status(500).json({ error: "SUPABASE_URL manquant dans Vercel" });
    if (!SUPABASE_KEY) {
      return res.status(500).json({
        error: "SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY manquant dans Vercel",
      });
    }

    const base = `${SUPABASE_URL}/rest/v1/annonces`;

    // ✅ On filtre sur publie=true
    // ✅ On SELECT tout (incluant lat/lng si les colonnes existent)
    const url = `${base}?select=*&publie=eq.true&order=created_at.desc.nullslast`;

    const sbRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const text = await sbRes.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!sbRes.ok || !Array.isArray(data)) {
      return res.status(sbRes.status || 500).json({
        error: "Erreur API Supabase",
        detail: data,
      });
    }

    // Helpers
    const norm = (v) => (v ?? "").toString().trim();
    const normLower = (v) => norm(v).toLowerCase();

    const normalizeTypeOffre = (val) => {
      const v = normLower(val);
      if (!v) return "";
      if (v.includes("lou") || v.includes("loc")) return "location";
      if (v.includes("ven") || v.includes("ach")) return "vente";
      return v;
    };

    const normalizeTypeBien = (val) => {
      const v = normLower(val);
      if (!v) return "";
      if (v.includes("maison") || v.includes("villa")) return "maison";
      if (v.includes("appart")) return "appartement";
      if (v.includes("terrain")) return "terrain";
      if (v.includes("bureau") || v.includes("local")) return "bureau";
      return v;
    };

    const normalizeWhatsApp = (val) => {
      const raw = norm(val);
      if (!raw) return "";
      let digits = raw.replace(/[^\d]/g, "");
      if (!digits) return "";
      if (digits.startsWith("0")) digits = "261" + digits.slice(1);
      if (!digits.startsWith("261") && digits.length <= 10) digits = "261" + digits;
      return digits;
    };

    const toNumberOrNull = (v) => {
      if (v === null || v === undefined || v === "") return null;
      const n = Number(String(v).replace(/\s+/g, ""));
      return Number.isFinite(n) ? n : null;
    };

    const toBool = (v) => {
      if (typeof v === "boolean") return v;
      const s = normLower(v);
      if (s === "true" || s === "1" || s === "oui") return true;
      if (s === "false" || s === "0" || s === "non") return false;
      return false;
    };

    const toImagesArray = (v) => {
      if (!v) return [];
      if (Array.isArray(v)) return v.filter(Boolean).map(String);
      if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
      return [];
    };

    // ✅ NEW: lat/lng (compat: lat|latitude / lng|longitude)
    const toLatLng = (row) => {
      const lat = row.lat ?? row.latitude ?? row.Lat ?? row.Latitude ?? null;
      const lng = row.lng ?? row.longitude ?? row.Lng ?? row.Longitude ?? row.lon ?? row.Lon ?? null;
      const latN = toNumberOrNull(lat);
      const lngN = toNumberOrNull(lng);
      return { lat: latN, lng: lngN };
    };

    // Mapping + normalisation (garde ton format front)
    const annonces = data.map((row) => {
      const titre = row.titre ?? row.Titre ?? row.title ?? row.Title ?? "";

      const typeOffreRaw =
        row.typeoffre ??
        row.typeOffre ??
        row.TypeOffre ??
        row.type_offre ??
        row["Type d’offre"] ??
        row["Type offre"] ??
        "";

      const typeBienRaw =
        row.typebien ??
        row.typeBien ??
        row.TypeBien ??
        row.type_bien ??
        row["Type de bien"] ??
        row["Type bien"] ??
        "";

      const ville = row.ville ?? row.Ville ?? "";
      const quartier = row.quartier ?? row.Quartier ?? "";

      const prixAr =
        row.prixar ??
        row.prixAr ??
        row.PrixAr ??
        row["Prix Ar"] ??
        row.Prix ??
        row.prix ??
        null;

      const chambres = row.chambres ?? row.Chambres ?? null;
      const sdb = row.sdb ?? row.Sdb ?? row.SDB ?? row["Salle de bain"] ?? null;
      const surface = row.surface ?? row.Surface ?? null;

      const images = row.images ?? row.Images ?? row.photos ?? row.Photos ?? null;
      const description = row.description ?? row.Description ?? row.details ?? row.Détails ?? "";

      const whatsapp = row.whatsapp ?? row.WhatsApp ?? row.telephone ?? row.Téléphone ?? "";

      const publie = row.publie ?? row.Publié ?? row.published ?? row.Published ?? true;

      const { lat, lng } = toLatLng(row);

      return {
        id: row.id ?? row.ID ?? row.Id ?? row.uuid ?? row.UUID ?? "",
        titre: norm(titre),

        typeOffre: normalizeTypeOffre(typeOffreRaw),
        typeBien: normalizeTypeBien(typeBienRaw),

        ville: norm(ville),
        quartier: norm(quartier),

        prixAr: toNumberOrNull(prixAr),
        chambres: toNumberOrNull(chambres),
        sdb: toNumberOrNull(sdb),
        surface: toNumberOrNull(surface),

        images: toImagesArray(images),
        description: norm(description),

        whatsapp: normalizeWhatsApp(whatsapp),

        publie: toBool(publie),

        // ✅ NEW (pour nearby)
        lat,
        lng,
      };
    });

    // sécurité : uniquement publiées
    const publishedOnly = annonces.filter((a) => a.publie === true);

    return res.status(200).json(publishedOnly);
  } catch (e) {
    return res.status(500).json({
      error: "Erreur serveur",
      detail: e?.message || String(e),
    });
  }
}
