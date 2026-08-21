import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { IQText } from "@/components/iq-text";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

function PublicWordmark() {
  return (
    <Link to="/welcome" className="flex items-center gap-2.5">
      <img src="/certivoiq-logo.png" alt="CertivoIQ" className="h-9 w-auto rounded-md bg-white px-1.5 py-1 object-contain" />
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
  title?: string | undefined;
  subtitle?: string | undefined;
  actions?: ReactNode | undefined;
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
        {(title || subtitle) && (
          <div className="mb-7">
            {title && <h1 className="font-display text-[28px] leading-tight sm:text-[34px]"><IQText>{title}</IQText></h1>}
            {subtitle && <p className="mt-1.5 text-[13.5px] text-muted-foreground">{subtitle}</p>}
          </div>
        )}
        {children}
      </main>
      <footer className="border-t border-border py-6 text-center">
        <p className="cite text-[12px] text-muted-foreground">CertivoIQ — Find compliance risk before the auditor.</p>
        <nav className="mt-2 flex items-center justify-center gap-4 text-[12px] text-muted-foreground" aria-label="Legal and support links">
          <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
          <Link to="/terms" className="hover:text-foreground">Terms</Link>
          <Link to="/security" className="hover:text-foreground">Security</Link>
          <Link to="/contact-support" className="hover:text-foreground">Support</Link>
        </nav>
      </footer>
    </div>
  );
}
