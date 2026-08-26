import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import videoPrivacyCss from "../styles/video-privacy.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { Toaster } from "@/components/ui/sonner";
import { WizardHelper } from "@/components/merlin";
import { LanguageProvider, useT } from "@/lib/i18n/provider";

function NotFoundComponent() {
  const t = useT();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("error.notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.notFound.body")}</p>
        <div className="mt-6">
          <Link
            to="/welcome"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const t = useT();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("error.generic.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.generic.body")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("error.tryAgain")}
          </button>
          <a
            href="/welcome"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("error.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}


export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "CertivoIQ — Affordable Housing Compliance Intelligence" },
      {
        name: "description",
        content:
          "Affordable Housing Compliance Intelligence. CertivoIQ reviews LIHTC, Section 8, HOME and HOTMA certifications against supported federal requirements with versioned rules and traceable evidence.",
      },
      { name: "author", content: "CertivoIQ" },
      { property: "og:title", content: "CertivoIQ — Affordable Housing Compliance Intelligence" },
      {
        property: "og:description",
        content: "CertivoIQ provides traceable certification review against supported federal affordable-housing requirements, with Agent Approval and explicit Manual Review limitations.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://certivoiq.com/welcome" },
      { property: "og:site_name", content: "CertivoIQ" },
      { property: "og:image", content: "https://certivoiq.com/certivoiq-social-card.png" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "CertivoIQ — Find compliance risk before the auditor." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://certivoiq.com/certivoiq-social-card.png" },
      { name: "twitter:image:alt", content: "CertivoIQ — Find compliance risk before the auditor." },
      { name: "theme-color", content: "#05265f" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: videoPrivacyCss,
      },
      { rel: "icon", href: "/favicon.ico", sizes: "48x48 32x32 16x16" },
      { rel: "icon", type: "image/png", sizes: "48x48", href: "/favicon.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});


function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "CertivoIQ",
              url: "https://certivoiq.com",
              logo: "https://certivoiq.com/certivoiq-mark.png",
              image: "https://certivoiq.com/certivoiq-social-card.png",
              description: "Affordable Housing Compliance Intelligence for LIHTC, Section 8, HOME and HOTMA programs.",
            }),
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
        <WizardHelper />
        <Toaster />
      </LanguageProvider>
    </QueryClientProvider>
  );
}