// =========================
// File: /api/annonces.js
// Vercel Serverless Function
// Retourne un JSON d'annonces depuis Notion
// =========================

export default async function handler(req, res) {
  // Autoriser CORS (utile si tu appelles l'API depuis une page statique)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_TOKEN) {
      return res.status(500).json({ error: "NOTION_TOKEN manquant dans Vercel" });
    }
    if (!NOTION_DATABASE_ID) {
      return res.status(500).json({ error: "NOTION_DATABASE_ID manquant dans Vercel" });
    }

    // ✅ URL correcte Notion API (c'est ça qui corrige ton "Invalid request URL")
    const url = `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}/query`;

    const notionRes = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Si tu ajoutes plus tard une propriété "Publié" (checkbox), tu pourras filtrer ici
        // filter: { property: "Publié", checkbox: { equals: true } }
      }),
    });

    const data = await notionRes.json();

    if (!notionRes.ok) {
      return res.status(notionRes.status).json({
        error: "Erreur API Notion",
        detail: data?.message || data,
      });
    }

    // Convertit les lignes Notion -> format simple
    const annonces = (data.results || []).map((page) => {
      const props = page.properties || {};

      const getTitle = (p) =>
        (p?.title || []).map((t) => t.plain_text).join("").trim();

      const getRichText = (p) =>
        (p?.rich_text || []).map((t) => t.plain_text).join("").trim();

      const getSelect = (p) => p?.select?.name || "";
      const getMulti = (p) => (p?.multi_select || []).map((x) => x.name);

      const getNumber = (p) => (typeof p?.number === "number" ? p.number : null);
      const getCheckbox = (p) => !!p?.checkbox;

      const getFiles = (p) =>
        (p?.files || [])
          .map((f) => f?.external?.url || f?.file?.url)
          .filter(Boolean);

      return {
        id: page.id,
        titre: getTitle(props["Titre"]),
        typeOffre: getSelect(props["Type d’offre"]) || getSelect(props["Type offre"]),
        typeBien: getSelect(props["Type de bien"]) || getSelect(props["Type bien"]),
        ville: getSelect(props["Ville"]) || getRichText(props["Ville"]),
        quartier: getRichText(props["Quartier"]),
        prixAr: getNumber(props["Prix Ar"]) || getNumber(props["Prix"]),
        chambres: getNumber(props["Chambres"]),
        sdb: getNumber(props["SDB"]) || getNumber(props["Salle de bain"]),
        surface: getNumber(props["Surface"]),
        images: getFiles(props["Images"]),
        publie: props["Publié"] ? getCheckbox(props["Publié"]) : true,
      };
    });

    // ✅ Même si tu n'as aucune annonce => ça doit retourner []
    return res.status(200).json(annonces);
  } catch (e) {
    return res.status(500).json({
      error: "Erreur serveur",
      detail: e?.message || String(e),
    });
  }
}
