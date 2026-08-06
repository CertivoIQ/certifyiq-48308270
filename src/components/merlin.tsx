import { useEffect, useState } from "react";
import { Sparkles, X, Wand2 } from "lucide-react";

import greeting from "@/assets/merlin-greeting.png";
import pointing from "@/assets/merlin-pointing.png";
import celebrating from "@/assets/merlin-celebrating.png";
import thinking from "@/assets/merlin-thinking.png";

export type MerlinPose = "greeting" | "pointing" | "celebrating" | "thinking";

const POSES: Record<MerlinPose, string> = { greeting, pointing, celebrating, thinking };

const SIZES = {
  sm: "h-16",
  md: "h-28",
  lg: "h-44",
  xl: "h-64",
} as const;

/** Merlin, the CertifyIQ Compliance Wizard. */
export function Merlin({
  pose = "greeting",
  size = "md",
  className = "",
  float = false,
}: {
  pose?: MerlinPose;
  size?: keyof typeof SIZES;
  className?: string;
  float?: boolean;
}) {
  return (
    <img
      src={POSES[pose]}
      alt="Merlin the CertifyIQ compliance wizard"
      loading="lazy"
      width={768}
      height={1024}
      className={`w-auto select-none ${SIZES[size]} ${float ? "animate-merlin-float" : ""} ${className}`}
    />
  );
}

/** Merlin says something — a speech bubble beside the wizard. */
export function MerlinSays({
  children,
  pose = "greeting",
  size = "md",
  className = "",
}: {
  children: React.ReactNode;
  pose?: MerlinPose;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-3 ${className}`}>
      <Merlin pose={pose} size={size} float className="shrink-0 drop-shadow-md" />
      <div className="relative min-w-0 flex-1 rounded-xl rounded-bl-none border border-primary/25 bg-accent px-4 py-3">
        <p className="cite mb-1 flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]">
          <Wand2 className="size-3" /> Merlin the Compliance Wizard
        </p>
        <div className="text-[13.5px] leading-relaxed text-accent-foreground">{children}</div>
      </div>
    </div>
  );
}

const TIPS = [
  "Compliance is just paperwork with consequences. Luckily, I read fast.",
  "A missing signature is the most expensive blank space in real estate.",
  "Recertify early. Future-you sends thanks by owl.",
  "Assets under $50,000? HOTMA says self-certification may be your friend.",
  "Student status: four little boxes, endless 8823 findings.",
  "A rule pack is only magic if it's the right state's rule pack.",
  "I've never met an auditor who enjoyed surprises. Neither should you.",
  "Utility allowances expire. So does the goodwill of your state agency.",
  "Every certificate you earn in the Academy is one fewer finding later.",
  "Round income the way the handbook says, not the way the calculator wants.",
];

/** Floating helper — Merlin follows the user across the app. */
export function WizardHelper() {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 print:hidden">
      {open && (
        <div className="pointer-events-auto w-[290px] rounded-xl border border-primary/25 bg-card p-4 shadow-raised">
          <div className="flex items-start justify-between gap-2">
            <p className="cite flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]">
              <Sparkles className="size-3" /> Merlin's tip
            </p>
            <button aria-label="Close Merlin" onClick={() => setOpen(false)}>
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>
          <p className="mt-2 text-[13px] leading-relaxed">{TIPS[tip % TIPS.length]}</p>
          <button
            className="mt-3 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
            onClick={() => setTip((t) => t + 1)}
          >
            Another spell, please
          </button>
        </div>
      )}
      <button
        aria-label="Ask Merlin the compliance wizard"
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto grid size-16 place-items-center rounded-full border border-primary/30 bg-card shadow-raised transition-transform hover:scale-105"
      >
        <Merlin pose={open ? "pointing" : "greeting"} size="sm" float className="translate-y-0.5" />
      </button>
    </div>
  );
}

/** Confetti-ish sparkle burst for wizard/exam celebrations. */
export function MerlinCelebration({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-accent p-6 text-center">
      <div className="pointer-events-none absolute inset-0">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="animate-merlin-float absolute block size-1.5 rounded-full bg-primary/50"
            style={{
              left: `${(i * 37) % 100}%`,
              top: `${(i * 53) % 90}%`,
              animationDelay: `${(i % 6) * 0.25}s`,
            }}
          />
        ))}
      </div>
      <Merlin pose="celebrating" size="lg" float className="mx-auto" />
      <h3 className="mt-2 font-display text-[22px] leading-tight text-accent-foreground">{title}</h3>
      {subtitle && <p className="mt-1.5 text-[13px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}
