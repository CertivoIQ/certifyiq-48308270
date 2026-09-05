import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CertificationUploadPanel } from "@/components/certification-upload-panel-v2";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/upload-certification")({
  head: () => ({
    meta: [
      { title: "Upload Certification & OCR — CertivoIQ" },
      {
        name: "description",
        content: "Upload Tenant Income Certification documents, review every TIC field, and prepare OCR evidence for the controlled CertivoIQ review workflow.",
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
      subtitle="Certification intake only — property, unit, and tenant setup is completed separately during onboarding"
      actions={
        <Button size="sm" variant="outline" asChild>
          <Link to="/files"><FileSearch className="size-4" /> Open review queue</Link>
        </Button>
      }
    >
      <CertificationUploadPanel />
    </AppShell>
  );
}
