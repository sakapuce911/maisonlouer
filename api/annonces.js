// =========================
// File: /api/annonces.js
// Vercel Serverless Function
// Retourne un JSON d'annonces depuis Supabase
//
// ✅ Remplace Notion par Supabase
// ✅ Garde le même format que ton front attend
//
// ENV requis dans Vercel (Project Settings > Environment Variables) :
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY   (recommandé)
//   (ou tu peux mettre SUPABASE_ANON_KEY si tu utilises RLS côté Supabase)
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
    if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY manquant" });

    // Table Supabase attendue : "annonces"
    // On filtre pub/publie/publié = true (selon tes colonnes)
    // 👉 Si tu utilises une seule colonne, garde uniquement celle-là côté DB
    const base = `${SUPABASE_URL}/rest/v1/annonces`;

    // On tente plusieurs schémas possibles, pour être robuste selon tes noms de colonnes
    const tryUrls = [
      `${base}?select=*&publie=eq.true&order=created_at.desc.nullslast`,
      `${base}?select=*&Publié=eq.true&order=created_at.desc.nullslast`,
      `${base}?select=*&publie=eq.true&order=id.desc`,
      `${base}?select=*&Publié=eq.true&order=id.desc`,
      `${base}?select=*&order=created_at.desc.nullslast`,
      `${base}?select=*&order=id.desc`,
    ];

    const sbFetch = async (url) => {
      const sbRes = await fetch(url, {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
        },
      });
      const text = await sbRes.text();
      let data = null;
      try { data = JSON.parse(text); } catch { data = text; }
      return { sbRes, data };
    };

    let sbRes, data;
    for (const url of tryUrls) {
      const r = await sbFetch(url);
      sbRes = r.sbRes;
      data = r.data;

      // On accepte seulement un tableau
      if (sbRes.ok && Array.isArray(data)) break;
    }

    if (!sbRes.ok || !Array.isArray(data)) {
      return res.status(sbRes?.status || 500).json({
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
      const n = Number(v);
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
      if (typeof v === "string") {
        return v.split(",").map((s) => s.trim()).filter(Boolean);
      }
      return [];
    };

    // Normalisation : accepte plusieurs conventions de colonnes (FR/EN/snake_case)
    const annonces = data.map((row) => {
      const titre = row.titre ?? row.Titre ?? row.title ?? row.Title ?? "";
      const typeOffreRaw = row.typeOffre ?? row.TypeOffre ?? row.type_offre ?? row["Type d’offre"] ?? row["Type offre"] ?? "";
      const typeBienRaw = row.typeBien ?? row.TypeBien ?? row.type_bien ?? row["Type de bien"] ?? row["Type bien"] ?? "";

      const ville = row.ville ?? row.Ville ?? "";
      const quartier = row.quartier ?? row.Quartier ?? "";

      const prixAr = row.prixAr ?? row.PrixAr ?? row["Prix Ar"] ?? row.Prix ?? row.prix ?? null;
      const chambres = row.chambres ?? row.Chambres ?? null;
      const sdb = row.sdb ?? row.Sdb ?? row.SDB ?? row["Salle de bain"] ?? null;
      const surface = row.surface ?? row.Surface ?? null;

      const images = row.images ?? row.Images ?? row.photos ?? row.Photos ?? null;
      const description = row.description ?? row.Description ?? row.details ?? row.Détails ?? "";

      const whatsapp = row.whatsapp ?? row.WhatsApp ?? row.telephone ?? row.Téléphone ?? "";

      const publie = row.publie ?? row.Publié ?? row.published ?? row.Published ?? true;

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
      };
    });

    // On renvoie uniquement les publiées (sécurité supplémentaire)
    const publishedOnly = annonces.filter((a) => a.publie === true);

    return res.status(200).json(publishedOnly);
  } catch (e) {
    return res.status(500).json({
      error: "Erreur serveur",
      detail: e?.message || String(e),
    });
  }
}
