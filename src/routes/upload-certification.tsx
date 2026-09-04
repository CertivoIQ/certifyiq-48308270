import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { PortfolioIntakePanel } from "@/components/portfolio-intake-panel";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/upload-certification")({
  head: () => ({
    meta: [
      { title: "Upload Certification & OCR — CertivoIQ" },
      {
        name: "description",
        content: "Upload certification documents, prepare OCR evidence, and map files into the controlled CertivoIQ review workflow.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UploadCertificationPage,
});

function UploadCertificationPage() {
  return (
    <AppShell
      title="Upload Certification & OCR"
      subtitle="Upload certification documents first; extraction and review remain controlled and traceable"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/files"><FileSearch className="size-4" /> Open review queue</Link>
        </Button>
      }
    >
      <PortfolioIntakePanel />
    </AppShell>
  );
}
