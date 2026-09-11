import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { TrainingCenter } from "@/components/training-center";
import { useIsStaff, useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/training")({
  head: () => ({
    meta: [
      { title: "Training — CertivoIQ" },
      { name: "description", content: "Step-by-step CertivoIQ customer training for multifamily workflows." },
    ],
  }),
  component: TrainingPage,
});

function TrainingPage() {
  const { isStaff } = useIsStaff();
  const { user, ready } = useSession();

  return (
    <AppShell title="Training" subtitle="Learn CertivoIQ, one customer workflow at a time">
      <TrainingCenter
        key={ready ? user?.id ?? "visitor" : "loading"}
        accountId={user?.id ?? null}
        isStaff={isStaff}
        scope="customer"
      />
    </AppShell>
  );
}
