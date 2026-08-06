import { BellRing, Landmark, CreditCard } from "lucide-react";
import type { NewsItem } from "@/lib/crm";

export function NewsTicker({ items }: { items: NewsItem[] }) {
  if (!items.length) return null;
  const row = [...items, ...items];

  return (
    <div className="crm-ticker fixed inset-x-0 bottom-0 z-40 border-t border-gold/40 bg-gold-surface/95 backdrop-blur">
      <div className="flex items-center gap-3 px-3 py-2">
        <span className="flex shrink-0 items-center gap-1.5 rounded-md bg-gold px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-gold-ink">
          <BellRing className="size-3.5" /> Live
        </span>
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <div className="ticker-track flex w-max items-center gap-8">
            {row.map((n, i) => (
              <span key={`${n.id}-${i}`} className="flex items-center gap-2 whitespace-nowrap text-[12.5px]">
                {n.kind === "subscriber" ? (
                  <CreditCard className="size-3.5 shrink-0 text-seal" />
                ) : (
                  <Landmark className="size-3.5 shrink-0 text-gold-ink/70" />
                )}
                <span className="cite uppercase tracking-[0.12em]">
                  {n.kind === "subscriber" ? "New paid subscriber" : (n.source ?? "Federal update")}
                </span>
                <span className="font-medium">{n.headline}</span>
                {n.detail && <span className="text-muted-foreground">— {n.detail}</span>}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
