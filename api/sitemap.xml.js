// =========================
// File: /api/sitemap.xml.js
// Vercel Serverless Function
// Génère un sitemap.xml dynamique avec toutes les annonces publiées (Supabase)
// URL : https://maisonlouer.vercel.app/api/sitemap.xml
//
// ENV requis dans Vercel :
// - SUPABASE_URL
// - SUPABASE_SERVICE_ROLE_KEY (recommandé) ou SUPABASE_ANON_KEY
// =========================

export default async function handler(req, res) {
  try {
    const SITE = "https://maisonlouer.vercel.app";

    const SUPABASE_URL = process.env.SUPABASE_URL;
    const SUPABASE_KEY =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!SUPABASE_URL) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("SUPABASE_URL manquant dans Vercel");
    }
    if (!SUPABASE_KEY) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      return res.end("SUPABASE_SERVICE_ROLE_KEY ou SUPABASE_ANON_KEY manquant dans Vercel");
    }

    // On récupère uniquement ce qu'il faut pour le sitemap
    const base = `${SUPABASE_URL}/rest/v1/annonces`;
    const url = `${base}?select=id,created_at,updated_at,publie&publie=eq.true&order=created_at.desc.nullslast`;

    const sbRes = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const text = await sbRes.text();
    let rows = null;
    try {
      rows = JSON.parse(text);
    } catch {
      rows = null;
    }

    if (!sbRes.ok || !Array.isArray(rows)) {
      res.statusCode = sbRes.status || 500;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      return res.end(
        JSON.stringify({ error: "Erreur API Supabase (sitemap)", detail: rows ?? text })
      );
    }

    const escapeXml = (s) =>
      (s || "")
        .toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&apos;");

    const toIsoDate = (v) => {
      if (!v) return "";
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? "" : d.toISOString();
    };

    // ✅ Pages fixes importantes (à indexer)
    const fixedUrls = [
      { loc: `${SITE}/`, changefreq: "weekly", priority: "1.0" },
      { loc: `${SITE}/recherche.html`, changefreq: "weekly", priority: "0.9" },
      { loc: `${SITE}/locations.html`, changefreq: "daily", priority: "0.9" },
      { loc: `${SITE}/ventes.html`, changefreq: "daily", priority: "0.9" },
      { loc: `${SITE}/contact.html`, changefreq: "monthly", priority: "0.6" },
    ];

    // ✅ URLs annonces (annonce.html?id=uuid)
    const listingUrls = rows
      .map((r) => {
        const id = r?.id ? String(r.id) : "";
        if (!id) return null;

        const lastmod = toIsoDate(r.updated_at || r.created_at);
        return {
          loc: `${SITE}/annonce.html?id=${encodeURIComponent(id)}`,
          lastmod,
          changefreq: "weekly",
          priority: "0.8",
        };
      })
      .filter(Boolean);

    const all = [...fixedUrls, ...listingUrls];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map((u) => {
    const lastmodTag = u.lastmod ? `<lastmod>${escapeXml(u.lastmod)}</lastmod>` : "";
    return `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    ${lastmodTag}
    <changefreq>${escapeXml(u.changefreq)}</changefreq>
    <priority>${escapeXml(u.priority)}</priority>
  </url>`;
  })
  .join("\n")}
</urlset>`;

    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    // Cache léger (Google n'a pas besoin de refresh chaque seconde)
    res.setHeader("Cache-Control", "public, max-age=1800"); // 30 minutes
    return res.end(xml);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    return res.end(
      JSON.stringify({ error: "Erreur serveur sitemap", detail: e?.message || String(e) })
    );
  }
}
