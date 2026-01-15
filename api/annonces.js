const { Client } = require("@notionhq/client");

function getText(prop) {
  if (!prop) return "";
  if (prop.type === "title") return (prop.title || []).map(t => t.plain_text).join("").trim();
  if (prop.type === "rich_text") return (prop.rich_text || []).map(t => t.plain_text).join("").trim();
  return "";
}

function getSelect(prop) {
  if (!prop) return "";
  if (prop.type === "select") return prop.select?.name || "";
  return "";
}

function getNumber(prop) {
  if (!prop) return null;
  if (prop.type === "number") return typeof prop.number === "number" ? prop.number : null;
  return null;
}

function getFiles(prop) {
  if (!prop || prop.type !== "files") return [];
  return (prop.files || [])
    .map(f => (f.type === "external" ? f.external?.url : f.file?.url))
    .filter(Boolean);
}

module.exports = async (req, res) => {
  try {
    const NOTION_TOKEN = process.env.NOTION_TOKEN;
    const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

    if (!NOTION_TOKEN || !NOTION_DATABASE_ID) {
      res.status(500).json({ error: "NOTION_TOKEN / NOTION_DATABASE_ID manquants" });
      return;
    }

    const notion = new Client({ auth: NOTION_TOKEN });

    const resp = await notion.databases.query({
      database_id: NOTION_DATABASE_ID,
      filter: {
        property: "Publié",
        checkbox: { equals: true }
      }
    });

    const annonces = (resp.results || []).map(page => {
      const p = page.properties || {};

      return {
        id: page.id,
        titre: getText(p["Titre"]),
        ville: getSelect(p["Ville"]),
        quartier: getText(p["Quartier"]),
        typeOffre: getSelect(p["TypeOffre"]),
        typeBien: getSelect(p["TypeBien"]),
        prixAr: getNumber(p["PrixAr"]),
        chambres: getNumber(p["Chambres"]),
        sdb: getNumber(p["SDB"]),
        surface: getNumber(p["Surface"]),
        description: getText(p["Description"]),
        images: getFiles(p["Images"])
      };
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(annonces);
  } catch (e) {
    res.status(500).json({ error: "Erreur API Notion", detail: e.message });
  }
};
