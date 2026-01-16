// =========================
// File: /api/annonces.js
// Vercel Serverless Function
// Retourne un JSON d'annonces depuis Notion
// =========================

export default async function handler(req, res) {
  // CORS (utile si tu appelles l'API depuis une page statique)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_TOKEN) {
      return res.status(500).json({ error: "NOTION_TOKEN manquant dans Vercel" });
    }
    if (!NOTION_DATABASE_ID) {
      return res.status(500).json({ error: "NOTION_DATABASE_ID manquant dans Vercel" });
    }

    const url = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

    // ✅ Filtre "Publié" si possible, sinon fallback
    const buildBodyWithFilter = () =>
      JSON.stringify({
        filter: { property: "Publié", checkbox: { equals: true } },
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });

    const buildBodyNoFilter = () =>
      JSON.stringify({
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      });

    const notionFetch = async (body) => {
      const notionRes = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${NOTION_TOKEN}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body,
      });

      const data = await notionRes.json();
      return { notionRes, data };
    };

    // 1) Tentative avec filtre "Publié"
    let { notionRes, data } = await notionFetch(buildBodyWithFilter());

    // Si Notion refuse le filtre (propriété absente), retry sans filtre
    if (!notionRes.ok) {
      const msg = (data?.message || "").toLowerCase();
      const isFilterIssue =
        msg.includes("could not find property") ||
        msg.includes("validation") ||
        msg.includes("body failed validation");

      if (isFilterIssue) {
        ({ notionRes, data } = await notionFetch(buildBodyNoFilter()));
      }
    }

    if (!notionRes.ok) {
      return res.status(notionRes.status).json({
        error: "Erreur API Notion",
        detail: data?.message || data,
      });
    }

    // -------------------------
    // Helpers de parsing Notion
    // -------------------------
    const getTitle = (p) => (p?.title || []).map((t) => t.plain_text).join("").trim();
    const getRichText = (p) => (p?.rich_text || []).map((t) => t.plain_text).join("").trim();
    const getSelect = (p) => p?.select?.name || "";
    const getNumber = (p) => (typeof p?.number === "number" ? p.number : null);
    const getCheckbox = (p) => !!p?.checkbox;

    const getFiles = (p) =>
      (p?.files || [])
        .map((f) => f?.external?.url || f?.file?.url)
        .filter(Boolean);

    const normalizeText = (val) => (val || "").toString().trim();

    const normalizeTypeOffre = (val) => {
      const v = normalizeText(val).toLowerCase();
      if (!v) return "";
      // accepte: "Location", "À louer", "Louer", etc.
      if (v.includes("lou") || v.includes("loc")) return "location";
      // accepte: "Vente", "À vendre", "Acheter", etc.
      if (v.includes("ven") || v.includes("ach")) return "vente";
      return v;
    };

    const normalizeTypeBien = (val) => {
      const v = normalizeText(val).toLowerCase();
      if (!v) return "";
      if (v.includes("maison") || v.includes("villa")) return "maison";
      if (v.includes("appart")) return "appartement";
      if (v.includes("terrain")) return "terrain";
      if (v.includes("bureau") || v.includes("local")) return "bureau";
      return v;
    };

    // Convertit les pages Notion -> format simple front
    const annonces = (data.results || []).map((page) => {
      const props = page.properties || {};

      // ✅ IMPORTANT : on lit maintenant TypeOffre / TypeBien (tes vrais noms de colonnes)
      // On garde aussi les anciens noms en fallback (au cas où)
      const rawTypeOffre =
        getSelect(props["TypeOffre"]) ||
        getRichText(props["TypeOffre"]) ||
        getSelect(props["Type d’offre"]) ||
        getSelect(props["Type offre"]) ||
        getRichText(props["Type d’offre"]) ||
        getRichText(props["Type offre"]);

      const rawTypeBien =
        getSelect(props["TypeBien"]) ||
        getRichText(props["TypeBien"]) ||
        getSelect(props["Type de bien"]) ||
        getSelect(props["Type bien"]) ||
        getRichText(props["Type de bien"]) ||
        getRichText(props["Type bien"]);

      const rawVille = getSelect(props["Ville"]) || getRichText(props["Ville"]);
      const rawQuartier = getRichText(props["Quartier"]) || getSelect(props["Quartier"]);

      // ✅ IMPORTANT : utiliser ?? (et pas ||) pour ne pas casser les valeurs 0
      const prixAr = getNumber(props["Prix Ar"]) ?? getNumber(props["Prix"]) ?? null;

      const chambres = getNumber(props["Chambres"]) ?? null;
      const sdb = getNumber(props["SDB"]) ?? getNumber(props["Salle de bain"]) ?? null;
      const surface = getNumber(props["Surface"]) ?? null;

      const publie = props["Publié"] ? getCheckbox(props["Publié"]) : true;

      // ✅ DESCRIPTION : supporte plusieurs noms possibles
      const description =
        getRichText(props["Description"]) ||
        getRichText(props["Détails"]) ||
        getRichText(props["Details"]) ||
        getRichText(props["Infos"]) ||
        "";

      return {
        id: page.id,
        titre: normalizeText(getTitle(props["Titre"])),

        typeOffre: normalizeTypeOffre(rawTypeOffre),
        typeBien: normalizeTypeBien(rawTypeBien),

        ville: normalizeText(rawVille),
        quartier: normalizeText(rawQuartier),

        prixAr,
        chambres,
        sdb,
        surface,

        images: getFiles(props["Images"]),
        description: normalizeText(description),

        publie,
      };
    });

    return res.status(200).json(annonces);
  } catch (e) {
    return res.status(500).json({
      error: "Erreur serveur",
      detail: e?.message || String(e),
    });
  }
}
