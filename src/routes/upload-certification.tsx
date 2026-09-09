import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CertificationUploadPanel } from "@/components/certification-upload-panel-v4";
import { Button } from "@/components/ui/button";
import { FileSearch } from "lucide-react";

export const Route = createFileRoute("/upload-certification")({
  head: () => ({
    meta: [
      { title: "Upload Certification & OCR — CertivoIQ" },
      {
        name: "description",
        content: "Upload complete Tenant Income Certification packets, review extracted values in a structured TIC form, and preserve supporting documents with each certification.",
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
      subtitle="Review any certification. A property CSV or saved tenant file is not required."
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
