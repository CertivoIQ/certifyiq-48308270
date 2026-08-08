import { Link } from "@tanstack/react-router";
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
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="size-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    );
  }

  if (!isStaff) return <Denied />;

  return (
    <div className="crm-surface min-h-screen pb-16">
      <header className="sticky top-0 z-30 border-b border-gold-line bg-gold-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-3 px-4 py-3 sm:px-7">
          <span className="crm-gradient grid size-9 place-items-center rounded-[9px] font-mono text-[13px] font-bold text-gold-ink">
            IQ
          </span>
          <div className="min-w-0">
            <h1 className="truncate font-display text-[20px] leading-tight text-gold-ink sm:text-[24px]">
              <IQText>CertivoIQ CRM Dashboard</IQText>
            </h1>
            <p className="cite">Internal · staff only</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {email && (
              <span className="hidden rounded-full border border-gold-line bg-background/60 px-3 py-1 font-mono text-[11.5px] text-gold-ink sm:inline">
                {email}
              </span>
            )}
            <Button size="sm" variant="ghost" asChild>
              <Link to="/crm">Pipeline</Link>
            </Button>
            <Button size="sm" variant="ghost" asChild>
              <Link to="/crm-support">Support</Link>
            </Button>
            <Button size="sm" variant="outline" asChild>
              <Link to="/">
                <ArrowLeft className="size-4" /> Product
              </Link>
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-7 sm:py-8">{children}</div>

      <p className="cite mt-4 flex items-center gap-2 px-4 sm:px-7">
        Federal affordable housing updates and new paid subscribers stream in the ticker below, refreshed daily.
      </p>
      <NewsTicker items={newsItems ?? []} />
    </div>
  );
}
