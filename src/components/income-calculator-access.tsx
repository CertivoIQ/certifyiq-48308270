import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { IncomeCalculator } from "@/components/income-calculator";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

type Access = { allowed: boolean; mode: "trial" | "paid" | "staff" | "blocked"; remaining: number | null; reason: string };

export function IncomeCalculatorAccess() {
  const { user } = useSession();
  const access = useQuery({
    queryKey: ["income-calculator-access", user?.id],
    enabled: !!user,
    staleTime: 0,
    refetchInterval: 5000,
    refetchOnWindowFocus: "always",
    queryFn: async () => {
      const { data, error } = await supabase.rpc("income_calculator_access" as never);
      if (error) throw new Error("Could not verify calculator access. Please try again.");
      return data as unknown as Access;
    },
  });
  if (access.isError) return <AppShell title="Income Calculator"><p role="alert">Could not verify calculator access.</p><Button onClick={() => void access.refetch()}>Try again</Button></AppShell>;
  if (!access.data) return <AppShell title="Income Calculator"><p role="status">Checking your calculator access…</p></AppShell>;
  if (!access.data.allowed) return <AppShell title="Income Calculator"><div className="rounded-xl border border-border bg-card p-6"><p>{access.data.reason}</p><Link to="/pricing" className="mt-4 inline-block text-primary underline">View subscription options</Link></div></AppShell>;
  return <IncomeCalculator key={`${user?.id}:${access.data.mode}`} trial={access.data.mode === "trial"} remainingReviews={access.data.remaining} />;
}
