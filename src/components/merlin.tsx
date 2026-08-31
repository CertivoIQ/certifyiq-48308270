import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, Wand2, GripVertical } from "lucide-react";
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

/** Merlin, the CertivoIQ Compliance Wizard. */
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
      alt="Merlin the CertivoIQ compliance wizard"
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

const TRICKS = [
  { label: "Wand flourish", anim: "animate-merlin-wand", pose: "pointing" as MerlinPose },
  { label: "Hat tip", anim: "animate-merlin-tip", pose: "greeting" as MerlinPose },
  { label: "Poof!", anim: "animate-merlin-poof", pose: "thinking" as MerlinPose },
  { label: "Levitation", anim: "animate-merlin-float", pose: "celebrating" as MerlinPose },
];


const IDLE_MS = 12000;

function Sparks() {
  return (
    <span className="pointer-events-none absolute inset-0">
      {Array.from({ length: 6 }).map((_, i) => (
        <span
          key={i}
          className="animate-merlin-spark absolute left-1/2 top-1/2 block size-1.5 rounded-full bg-gold"
          style={
            {
              "--sx": `${((i % 3) - 1) * 20}px`,
              "--sy": `${-18 - (i % 4) * 7}px`,
              animationDelay: `${i * 0.22}s`,
            } as React.CSSProperties
          }
        />
      ))}
    </span>
  );
}

/** Floating helper — Merlin follows the user across the app, draggable anywhere. */
export function WizardHelper() {
  const [open, setOpen] = useState(false);
  const [tip, setTip] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [trick, setTrick] = useState(0);
  const [idle, setIdle] = useState(false);
  const lastActive = useRef(Date.now());

  // Free positioning — offset from the default bottom-right anchor.
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);

  useEffect(() => setMounted(true), []);

  const wake = useCallback(() => {
    lastActive.current = Date.now();
    setIdle(false);
  }, []);

  // Idle detection while the helper is open.
  useEffect(() => {
    if (!open) {
      setIdle(false);
      return;
    }
    lastActive.current = Date.now();
    const id = setInterval(() => {
      setIdle(Date.now() - lastActive.current > IDLE_MS);
    }, 1000);
    return () => clearInterval(id);
  }, [open]);

  // Rotate the magic tricks while open and engaged.
  useEffect(() => {
    if (!open || idle) return;
    const id = setInterval(() => setTrick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [open, idle]);

  // Click-and-hold dragging.
  const onPointerDown = (e: React.PointerEvent) => {
    const box = shell.current?.getBoundingClientRect();
    if (!box) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, moved: false };
    setDragging(true);
    wake();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const box = shell.current?.getBoundingClientRect();
    if (!d || !box) return;
    d.moved = true;
    const x = Math.min(Math.max(e.clientX - d.dx, 8), window.innerWidth - box.width - 8);
    const y = Math.min(Math.max(e.clientY - d.dy, 8), window.innerHeight - box.height - 8);
    setPos({ x, y });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const moved = drag.current?.moved ?? false;
    drag.current = null;
    setDragging(false);
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    if (!moved) setOpen((o) => (o ? (wake(), o) : true));
  };

  // Keep Merlin on screen when the window resizes.
  useEffect(() => {
    if (!pos) return;
    const onResize = () => {
      const box = shell.current?.getBoundingClientRect();
      if (!box) return;
      setPos((p) =>
        p
          ? {
              x: Math.min(p.x, Math.max(8, window.innerWidth - box.width - 8)),
              y: Math.min(p.y, Math.max(8, window.innerHeight - box.height - 8)),
            }
          : p,
      );
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos]);

  if (!mounted) return null;

  const act = TRICKS[trick % TRICKS.length]!;
  const anchored = pos === null;

  return (
    <div
      ref={shell}
      style={anchored ? undefined : { left: pos.x, top: pos.y }}
      className={`pointer-events-none fixed z-50 flex flex-col items-end gap-2 print:hidden ${
        anchored ? "bottom-4 right-4" : ""
      }`}
      onPointerMove={open && !dragging ? wake : undefined}
      onKeyDown={open ? wake : undefined}
    >
      {open && (
        <div
          className="pointer-events-auto flex w-[330px] flex-col rounded-xl border border-primary/25 bg-card shadow-raised"
          onClick={wake}
        >
          <div className="flex items-start justify-between gap-2 p-3 pb-2">
            <p className="cite flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]">
              <Sparkles className="size-3" /> Merlin&apos;s tip
            </p>
            <button aria-label="Close Merlin" onClick={() => setOpen(false)}>
              <X className="size-3.5 text-muted-foreground" />
            </button>
          </div>

          <div className="px-3 pb-3">
            <p className="text-[13px] leading-relaxed">{TIPS[tip % TIPS.length]}</p>
            {idle ? (
              <p className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-gold">
                <Wand2 className="size-3.5" /> Still here! Tap the X when you&apos;re done with me.
              </p>
            ) : (
              <p className="cite mt-3 text-[10.5px] uppercase tracking-[0.16em]">{act.label}</p>
            )}
            <button
              className="mt-2 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
              onClick={() => {
                wake();
                setTip((t) => t + 1);
              }}
            >
              Another spell, please
            </button>
          </div>
        </div>
      )}

      <div className="pointer-events-auto flex items-center gap-1">
        {open && (
          <span
            aria-hidden
            className="grid size-6 cursor-grab place-items-center rounded-md border border-border bg-card text-muted-foreground"
            title="Drag Merlin"
          >
            <GripVertical className="size-3.5" />
          </span>
        )}
        <button
          aria-label="Open Merlin compliance tips — click and hold to move him"
          title="Click to open tips · click and hold to move Merlin"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`relative grid size-16 touch-none place-items-center rounded-full border bg-card shadow-raised transition-transform hover:scale-105 ${
            dragging ? "cursor-grabbing scale-105" : "cursor-grab"
          } ${idle && !dragging ? "animate-merlin-fly border-gold/60" : "border-primary/30"}`}
        >
          {open && <Sparks />}
          <Merlin
            pose={open ? (idle ? "celebrating" : act.pose) : "greeting"}
            size="sm"
            float={!open || idle}
            className={`pointer-events-none translate-y-0.5 ${open && !idle ? act.anim : ""}`}
          />
          {open && !idle && (
            <span className="pointer-events-none absolute inset-0 grid place-items-center">
              <span className="animate-merlin-orb block size-1.5 rounded-full bg-gold shadow-[0_0_8px_2px_var(--gold)]" />
            </span>
          )}
        </button>
      </div>
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
