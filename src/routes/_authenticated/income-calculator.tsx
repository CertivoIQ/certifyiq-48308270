import { createFileRoute } from "@tanstack/react-router";
import { IncomeCalculator } from "@/components/income-calculator";

export const Route = createFileRoute("/_authenticated/income-calculator")({
  head: () => ({ meta: [{ title: "Income Calculator — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: IncomeCalculator,
});
