import { useCallback, useState } from "react";
import { IncomeCalculator } from "@/components/income-calculator";
import { RentIncomeLimits } from "@/components/rent-income-limits";
import { Button } from "@/components/ui/button";
import type { LimitProfileDraft } from "@/lib/rent-income-limit-engine.mjs";

type Mode = "income" | "limits";

/**
 * Two tightly integrated calculator functions under one menu item.
 *
 * Both modes stay mounted; switching modes only changes visibility, so the
 * Household Income calculation state and the unsaved Rent & Income Limits
 * configuration are both preserved.
 */
export function IncomeCalculatorWorkspace({ trial = false, remainingReviews = null }: { trial?: boolean; remainingReviews?: number | null } = {}) {
  const [mode, setMode] = useState<Mode>("income");
  const [limitDraft, setLimitDraft] = useState<{ token: number; draft: LimitProfileDraft } | null>(null);
  const [property, setProperty] = useState<{ stateCode: string; name: string } | null>(null);
  const onPropertyContext = useCallback((next: { stateCode: string; name: string } | null) => setProperty(next), []);

  const tabs = (
    <nav aria-label="Income Calculator functions" className="income-no-print mb-5 flex flex-wrap gap-2 rounded-xl border border-border bg-card p-2">
      {(
        [
          ["income", "Household Income"],
          ["limits", "Rent & Income Limits"],
        ] as const
      ).map(([id, title]) => (
        <Button key={id} size="sm" variant={mode === id ? "default" : "ghost"} aria-pressed={mode === id} onClick={() => setMode(id)}>
          {title}
        </Button>
      ))}
    </nav>
  );

  return (
    <>
      <div hidden={mode !== "income"} aria-hidden={mode !== "income"}>
        <IncomeCalculator trial={trial} remainingReviews={remainingReviews} headerSlot={tabs} limitDraft={limitDraft} onPropertyContext={onPropertyContext} />
      </div>
      <div hidden={mode !== "limits"} aria-hidden={mode !== "limits"}>
        <RentIncomeLimits
          headerSlot={tabs}
          propertyState={property}
          onUseLimits={(draft) => {
            setLimitDraft({ token: Date.now(), draft });
            setMode("income");
          }}
        />
      </div>
    </>
  );
}