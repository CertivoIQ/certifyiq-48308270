import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { IQText } from "@/components/iq-text";
import { NewsTicker } from "@/components/crm/news-ticker";
import type { NewsItem } from "@/lib/crm";

function Denied() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="max-w-md rounded-xl border border-border bg-card p-7 text-center">
        <ShieldAlert className="mx-auto size-9 text-flag" />
        <h1 className="mt-3 font-display text-[21px]">Staff access only</h1>
        <p className="mt-2 text-[13.5px] text-muted-foreground">
          The CertivoIQ CRM Dashboard is restricted to verified @certivoiq.com accounts.
        </p>
        <Button className="mt-5" asChild>
          <Link to="/dashboard">Back to CertivoIQ</Link>
        </Button>
      </div>
    </div>
  );
}

export function CrmShell({
  children,
  email,
  isStaff,
  loading,
  newsItems,
}: {
  children: React.ReactNode;
  email?: string | null;
  isStaff?: boolean;
  loading?: boolean;
  newsItems?: NewsItem[];
}) {
  const federalNews = useQuery({
    queryKey: ["crm", "official-federal-housing-news"],
    enabled: isStaff === true,
    staleTime: 15 * 60 * 1000,
    refetchInterval: 15 * 60 * 1000,
    retry: 2,
    queryFn: async (): Promise<{
      items: NewsItem[];
      fetched_at: string;
      partial: boolean;
    }> => {
      const response = await fetch("/api/public/federal-housing-news", {
        headers: { Accept: "application/json" },
      });
      if (!response.ok) throw new Error("Official housing news is temporarily unavailable");
      return response.json();
    },
  });

  const subscriberItems = (newsItems ?? []).filter((item) => item.kind === "subscriber");
  const tickerItems = [...(federalNews.data?.items ?? []), ...subscriberItems]
    .sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))
    .slice(0, 24);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  if (!isStaff) return <Denied />;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),linear-gradient(to_bottom,#f7fcf9,#eef8f2)] pb-16 dark:bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.12),transparent_32%),linear-gradient(to_bottom,#07150f,#0b1f16)]">
      <header className="sticky top-0 z-30 border-b border-emerald-900/10 bg-white/90 shadow-sm dark:border-emerald-300/10 dark:bg-[#0b1f16]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-7">
          <span className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-800 font-mono text-[13px] font-bold text-white shadow-lg shadow-emerald-900/20">
            IQ
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-sans text-[20px] font-semibold tracking-tight leading-tight text-emerald-950 dark:text-emerald-50 sm:text-[24px]">
              <IQText>CertivoIQ CRM Dashboard</IQText>
            </h1>
            <p className="cite">Internal · staff only</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {email && (
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-mono text-[11.5px] text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-100 sm:inline">
                {email}
              </span>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link to="/crm">Pipeline</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/crm-documents">Documents</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/crm-support">Support</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/welcome">
                <ArrowLeft className="size-4" /> Product
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-7 sm:py-8">{children}</div>

      <p className="cite mt-4 flex items-center gap-2 px-4 sm:px-7">
        Official HUD Newsroom and Federal Register updates appear below with dates and direct source
        links; the feed refreshes every 15 minutes.
      </p>
      <NewsTicker
        items={tickerItems}
        fetchedAt={federalNews.data?.fetched_at ?? null}
        partial={federalNews.data?.partial ?? false}
      />
    </div>
  );
}
