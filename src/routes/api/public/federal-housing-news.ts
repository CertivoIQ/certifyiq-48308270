import { createFileRoute } from "@tanstack/react-router";

type FederalNewsItem = {
  id: string;
  kind: "federal";
  headline: string;
  detail: string | null;
  published_at: string;
  source: string;
  url: string;
};

const RELEVANT_TERMS = [
  "affordable housing",
  "multifamily",
  "low-income housing",
  "lihtc",
  "section 8",
  "housing choice voucher",
  "public housing",
  "hotma",
  "home investment partnerships",
  "community development block grant",
  "continuum of care",
  "fair housing",
  "rural housing",
  "housing finance agency",
];

function textOnly(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function relevant(value: string): boolean {
  const normalized = value.toLowerCase();
  return RELEVANT_TERMS.some((term) => normalized.includes(term));
}

async function federalRegisterUpdates(): Promise<FederalNewsItem[]> {
  const params = new URLSearchParams({
    per_page: "50",
    order: "newest",
    "conditions[agencies][]": "housing-and-urban-development-department",
  });
  const response = await fetch(`https://www.federalregister.gov/api/v1/documents.json?${params}`, {
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Federal Register returned ${response.status}`);

  const body = (await response.json()) as {
    results?: Array<{
      document_number?: string;
      title?: string;
      abstract?: string | null;
      publication_date?: string;
      html_url?: string;
      type?: string;
    }>;
  };

  return (body.results ?? [])
    .filter((item) => item.title && item.html_url)
    .filter((item) => relevant(`${item.title} ${item.abstract ?? ""}`))
    .slice(0, 15)
    .map((item) => ({
      id: `federal-register-${item.document_number ?? item.html_url}`,
      kind: "federal",
      headline: textOnly(item.title!),
      detail: item.type ? `${item.type} · Official Federal Register document` : "Official Federal Register document",
      published_at: item.publication_date
        ? new Date(`${item.publication_date}T12:00:00Z`).toISOString()
        : new Date().toISOString(),
      source: "Federal Register · HUD",
      url: item.html_url!,
    }));
}

async function hudNewsUpdates(): Promise<FederalNewsItem[]> {
  const response = await fetch("https://www.hud.gov/news", {
    headers: {
      Accept: "text/html",
      "User-Agent": "CertivoIQ-Federal-Housing-News/1.0 (+https://certivoiq.com/welcome)",
    },
  });
  if (!response.ok) throw new Error(`HUD News returned ${response.status}`);

  const html = await response.text();
  const anchorPattern = /<a\b[^>]*href=["']([^"']*\/news\/hud-no-[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const items: FederalNewsItem[] = [];

  for (const match of html.matchAll(anchorPattern)) {
    const rawUrl = match[1]!;
    const headline = textOnly(match[2] ?? "");
    if (!headline || !relevant(headline)) continue;
    const url = new URL(rawUrl, "https://www.hud.gov").toString();
    if (seen.has(url)) continue;
    seen.add(url);

    const before = html.slice(Math.max(0, (match.index ?? 0) - 350), match.index);
    const dateMatches = [...textOnly(before).matchAll(/(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),?\s+([A-Z][a-z]+\s+\d{1,2},\s+20\d{2})/g)];
    const published = dateMatches.at(-1)?.[1];
    const timestamp = published ? Date.parse(`${published} 12:00:00 UTC`) : Number.NaN;

    items.push({
      id: `hud-news-${url.split("/").at(-1)}`,
      kind: "federal",
      headline,
      detail: "Official HUD newsroom update",
      published_at: Number.isNaN(timestamp) ? new Date().toISOString() : new Date(timestamp).toISOString(),
      source: "HUD Newsroom",
      url,
    });
    if (items.length >= 15) break;
  }

  return items;
}

export const Route = createFileRoute("/api/public/federal-housing-news")({
  server: {
    handlers: {
      GET: async () => {
        const results = await Promise.allSettled([hudNewsUpdates(), federalRegisterUpdates()]);
        const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
        const unique = [...new Map(items.map((item) => [item.url, item])).values()]
          .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
          .slice(0, 20);

        for (const result of results) {
          if (result.status === "rejected") console.error("Federal housing feed source failed", result.reason);
        }

        return Response.json(
          {
            items: unique,
            fetched_at: new Date().toISOString(),
            sources: ["HUD Newsroom", "Federal Register · HUD"],
            partial: results.some((result) => result.status === "rejected"),
          },
          {
            status: unique.length ? 200 : 503,
            headers: {
              "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
            },
          },
        );
      },
    },
  },
});
