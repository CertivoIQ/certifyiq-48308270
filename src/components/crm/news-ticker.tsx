import { BellRing, Landmark, CreditCard, ExternalLink } from "lucide-react";
import type { NewsItem } from "@/lib/crm";

export function NewsTicker({
  items,
  fetchedAt,
  partial,
}: {
  items: NewsItem[];
  fetchedAt?: string | null;
  partial?: boolean;
}) {
  if (!items.length) return null;
  const row = [...items, ...items];
  // Keep the crawl near a broadcast-news reading pace as the feed grows.
  const tickerDurationSeconds = Math.max(64, items.length * 8);
  const updatedLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : null;

  return (
    <div className="crm-ticker fixed inset-x-0 bottom-0 z-40 border-t border-emerald-700/30 bg-emerald-950/95 text-white shadow-[0_-8px_30px_rgba(6,78,59,0.18)] backdrop-blur">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-400 px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-emerald-950">
          <BellRing className="size-3.5" /> Federal
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div
            className="ticker-track flex w-max items-center gap-8"
            style={{ animationDuration: `${tickerDurationSeconds}s` }}
          >
            {row.map((n, i) => {
              const body = (
                <>
                  {n.kind === "subscriber" ? (
                    <CreditCard className="size-3.5 shrink-0 text-emerald-300" />
                  ) : (
                    <Landmark className="size-3.5 shrink-0 text-emerald-300" />
                  )}
                  <span className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-emerald-200">
                    {n.kind === "subscriber" ? "New paid subscriber" : (n.source ?? "Federal update")}
                  </span>
                  <span className="font-medium">{n.headline}</span>
                  {n.published_at && (
                    <time className="text-emerald-200/75">
                      {new Date(n.published_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </time>
                  )}
                  {n.url && <ExternalLink className="size-3.5 shrink-0 text-emerald-300" />}
                </>
              );
              return n.url ? (
                <a
                  key={`${n.id}-${i}`}
                  href={n.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-2 whitespace-nowrap text-[12.5px] hover:text-emerald-200 hover:underline"
                  title="Open official source"
                >
                  {body}
                </a>
              ) : (
                <span key={`${n.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">
                  {body}
                </span>
              );
            })}
          </div>
        </div>
        <span className="hidden shrink-0 text-[10px] text-emerald-200/75 lg:inline">
          {partial ? "One source delayed" : updatedLabel ? `Updated ${updatedLabel}` : "Official sources"}
        </span>
      </div>
    </div>
  );
}
