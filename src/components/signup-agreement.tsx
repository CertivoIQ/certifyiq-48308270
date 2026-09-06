import { Link } from "@tanstack/react-router";
import { BETA_NOTICE } from "@/lib/beta-terms";

export function SignupAgreement({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm leading-6">
    <p>{BETA_NOTICE}</p>
    <label className="mt-3 flex items-start gap-3">
      <input type="checkbox" required checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 size-4 shrink-0" />
      <span>I agree to the <Link to="/terms" target="_blank" className="text-primary underline">Terms &amp; Agreements</Link>, including the Beta Testing notice and security disclosure.</span>
    </label>
  </div>;
}
