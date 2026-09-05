import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CertificationUploadPanel } from "@/components/certification-upload-panel-v3";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/upload-certification")({
  head: () => ({
    meta: [
      { title: "Upload Certification & OCR — CertivoIQ" },
      {
        name: "description",
        content: "Upload complete Tenant Income Certification packets, correct TIC fields, and preserve supporting documents under the tenant file.",
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
