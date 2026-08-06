import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, Wand2, GripVertical, MessageCircle } from "lucide-react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";

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

const TRICKS = [
  { label: "Wand flourish", anim: "animate-merlin-wand", pose: "pointing" as MerlinPose },
  { label: "Hat tip", anim: "animate-merlin-tip", pose: "greeting" as MerlinPose },
  { label: "Poof!", anim: "animate-merlin-poof", pose: "thinking" as MerlinPose },
  { label: "Levitation", anim: "animate-merlin-float", pose: "celebrating" as MerlinPose },
];

const STARTERS = [
  "How do I annualize seasonal income on a TIC?",
  "Does the HOTMA $100,000 asset limit apply to LIHTC?",
  "Full-time student household — is it a §42 violation?",
  "Blended LIHTC + HOME unit: which rent limit governs?",
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

function messageText(parts: { type: string; text?: string }[]) {
  return parts.map((p) => (p.type === "text" ? (p.text ?? "") : "")).join("");
}

/** Merlin's AI compliance chat — grounded in every program rule pack. */
function MerlinChat({ onActivity }: { onActivity: () => void }) {
  const [transport] = useState(() => new DefaultChatTransport({ api: "/api/chat" }));
  const { messages, sendMessage, status, stop, error } = useChat({ transport });
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (status === "ready") inputRef.current?.focus();
  }, [status]);

  const ask = useCallback(
    (text: string) => {
      const value = text.trim();
      if (!value || busy) return;
      onActivity();
      void sendMessage({ text: value });
    },
    [busy, onActivity, sendMessage],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-3 p-3">
          {messages.length === 0 && (
            <div className="space-y-2.5">
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                Stuck on a file? Ask me anything about LIHTC, Section 8, HOME, HOTMA, bonds, RD or fair housing —
                I&apos;ll cite the rule and give you the correction step.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="rounded-full border border-primary/25 bg-accent px-2.5 py-1 text-left text-[11.5px] text-accent-foreground transition-colors hover:border-gold/60"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <Message from={m.role} key={m.id}>
              <MessageContent className="text-[13px] leading-relaxed">

                <MessageResponse>{messageText(m.parts as { type: string; text?: string }[])}</MessageResponse>
              </MessageContent>
            </Message>
          ))}

          {status === "submitted" && <Shimmer className="text-[12.5px]">Consulting the handbook…</Shimmer>}

          {error && (
            <p className="rounded-md border border-reject/40 bg-reject/10 px-2.5 py-2 text-[12px] text-reject">
              Merlin&apos;s crystal ball clouded over. Please try again in a moment.
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="border-t border-border p-2">
        <PromptInput
          onSubmit={(message, event) => {
            event.preventDefault();
            const text = message.text ?? "";
            ask(text);
            event.currentTarget.reset();
          }}
        >
          <PromptInputTextarea
            ref={inputRef}
            placeholder="Ask Merlin a compliance question…"
            className="min-h-[44px] text-[13px]"
            onChange={onActivity}
          />
          <PromptInputFooter className="justify-end">
            <PromptInputSubmit status={status} onStop={stop} />
          </PromptInputFooter>
        </PromptInput>
        <p className="cite mt-1.5 px-1 text-[10px] uppercase tracking-[0.14em]">
          Decision support — a human reviewer still signs final approval
        </p>
      </div>
    </div>
  );
}

/** Floating helper — Merlin follows the user across the app, draggable anywhere. */
export function WizardHelper() {
  const [open, setOpen] = useState(false);
  const [chat, setChat] = useState(false);
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
    if (!open || idle || chat) return;
    const id = setInterval(() => setTrick((t) => t + 1), 2000);
    return () => clearInterval(id);
  }, [open, idle, chat]);

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
          className={`pointer-events-auto flex w-[330px] flex-col rounded-xl border border-primary/25 bg-card shadow-raised ${
            chat ? "h-[420px] max-h-[70vh]" : ""
          }`}
          onClick={wake}
        >
          <div className="flex items-start justify-between gap-2 p-3 pb-2">
            <p className="cite flex items-center gap-1 text-[10px] uppercase tracking-[0.16em]">
              <Sparkles className="size-3" /> {chat ? "Ask Merlin" : "Merlin's tip"}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="flex items-center gap-1 text-[11px] font-medium text-primary underline-offset-2 hover:underline"
                onClick={() => {
                  wake();
                  setChat((c) => !c);
                }}
              >
                {chat ? (
                  <>
                    <Wand2 className="size-3" /> Tips
                  </>
                ) : (
                  <>
                    <MessageCircle className="size-3" /> Chat
                  </>
                )}
              </button>
              <button aria-label="Close Merlin" onClick={() => setOpen(false)}>
                <X className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {chat ? (
            <MerlinChat onActivity={wake} />
          ) : (
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
          )}
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
          aria-label="Ask Merlin the compliance wizard — click and hold to move him"
          title="Click to open · click and hold to move Merlin"
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
            pose={open ? (idle ? "celebrating" : chat ? "thinking" : act.pose) : "greeting"}
            size="sm"
            float={!open || idle}
            className={`pointer-events-none translate-y-0.5 ${open && !idle && !chat ? act.anim : ""}`}
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
