import { createFileRoute } from "@tanstack/react-router";
import { IncomeCalculatorAccess } from "@/components/income-calculator-access";

export const Route = createFileRoute("/_authenticated/income-calculator")({
  head: () => ({ meta: [{ title: "Income Calculator — CertivoIQ" }, { name: "robots", content: "noindex, nofollow" }] }),
  component: IncomeCalculatorAccess,
});

