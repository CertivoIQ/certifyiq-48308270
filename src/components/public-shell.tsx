import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

function PublicWordmark() {
  return (
    <Link to="/welcome" className="flex items-center gap-2.5">
      <span className="brand-gradient grid size-8 place-items-center rounded-[8px] font-mono text-[13px] font-bold text-gold">IQ</span>
      <span className="font-display text-lg leading-none tracking-tight">Certivo<span className="text-gold">IQ</span></span>
    </Link>
  );
}

/**
 * Marketing/public navigation shell. Contains no portfolio (account) navigation:
 * the authenticated application sidebar lives in AppShell and is reserved for
 * signed-in trial/paid users inside the portfolio workspace.
 */
export function PublicShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <PublicWordmark />
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" asChild><Link to="/welcome">Why CertivoIQ</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/pricing">Pricing</Link></Button>
            <Button size="sm" variant="outline" asChild><Link to="/contact-support">Contact</Link></Button>
            <Button size="sm" asChild><Link to="/auth">Sign in</Link></Button>
            <LanguageToggle />
            <ThemeToggle />
            {actions}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 sm:py-10">
        <div className="mb-7">
          <h1 className="font-display text-[28px] leading-tight sm:text-[34px]"><IQText>{title}</IQText></h1>
          {subtitle && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </main>
      <footer className="border-t border-border py-6 text-center">
        <p className="cite text-[12px] text-muted-foreground">CertivoIQ — One Analyst. Every Property. 24/7.</p>
      </footer>
    </div>
  );
}
