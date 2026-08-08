import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, FileSearch, Pause, Play, RotateCcw, ShieldCheck, Volume2 } from "lucide-react";

type AccountState = "visitor" | "trial" | "subscriber";

type CertivoIQVoiceoverVideoProps = {
  accountState?: AccountState;
  demoDashboardHref?: string;
  trialHref?: string;
  className?: string;
};

const scenes = [
  {
    eyebrow: "Affordable housing compliance, clarified",
    title: "Turn every certification into an audit-ready decision",
    body: "CertivoIQ reviews LIHTC, HOME, Section 8, and HOTMA certification files against the rule pack assigned to each property.",
    Icon: ShieldCheck,
    seconds: 12,
  },
  {
    eyebrow: "Evidence, not a black box",
    title: "Pass or fail—with the reason attached",
    body: "Each review identifies the finding, cites the supporting rule, and explains the correction path while your compliance team keeps final approval authority.",
    Icon: FileSearch,
    seconds: 13,
  },
  {
    eyebrow: "Enterprise consistency",
    title: "One standard across every property and reviewer",
    body: "Versioned rule packs and repeatable review logic help reduce reviewer variance across layered programs, portfolios, and state requirements.",
    Icon: CheckCircle2,
    seconds: 13,
  },
  {
    eyebrow: "A faster review queue",
    title: "Move human expertise to the decisions that need it",
    body: "CertivoIQ surfaces missing, expired, and conflicting evidence early so specialists spend less time hunting through files and more time resolving risk.",
    Icon: Volume2,
    seconds: 13,
  },
];

const narration = scenes.map((scene) => `${scene.title}. ${scene.body}`);

export default function CertivoIQVoiceoverVideo({
  accountState = "visitor",
  demoDashboardHref = "/demo-dashboard",
  trialHref = "/trial",
  className = "",
}: CertivoIQVoiceoverVideoProps) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const timer = useRef<number | null>(null);
  const startedAt = useRef(0);
  const elapsed = useRef(0);
  const canUseSpeech = typeof window !== "undefined" && "speechSynthesis" in window;
  const current = scenes[scene]!;
  const Icon = current.Icon;
  const totalSeconds = useMemo(() => scenes.reduce((sum, item) => sum + item.seconds, 0), []);

  const cancelTimer = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  };

  const speak = useCallback((index: number) => {
    if (!canUseSpeech || muted) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(narration[index]);
    utterance.rate = 0.94;
    utterance.pitch = 0.98;
    utterance.volume = 0.95;
    window.speechSynthesis.speak(utterance);
  }, [canUseSpeech, muted]);

  const scheduleAdvance = useCallback((index: number, remainingMs?: number) => {
    cancelTimer();
    startedAt.current = Date.now();
    const duration = remainingMs ?? scenes[index]!.seconds * 1000;
    timer.current = window.setTimeout(() => {
      elapsed.current = 0;
      if (index === scenes.length - 1) {
        setPlaying(false);
        window.speechSynthesis?.cancel();
        return;
      }
      setScene(index + 1);
    }, duration);
  }, []);

  useEffect(() => {
    if (!playing) return;
    speak(scene);
    scheduleAdvance(scene);
    return cancelTimer;
  }, [playing, scene, scheduleAdvance, speak]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const togglePlayback = () => {
    if (playing) {
      elapsed.current += Date.now() - startedAt.current;
      cancelTimer();
      window.speechSynthesis?.pause();
      setPlaying(false);
      return;
    }
    if (scene === scenes.length - 1 && elapsed.current === 0) setScene(0);
    window.speechSynthesis?.resume();
    setPlaying(true);
  };

  const restart = () => {
    cancelTimer();
    window.speechSynthesis?.cancel();
    elapsed.current = 0;
    setScene(0);
    setPlaying(true);
  };

  return (
    <section className={`bg-slate-950 px-5 py-8 text-white sm:px-8 ${className}`} aria-labelledby="certivo-video-title">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-300">CertivoIQ in 60 seconds</p>
            <h2 id="certivo-video-title" className="mt-2 text-2xl font-semibold sm:text-3xl">See compliance intelligence at work</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {(accountState === "visitor" || accountState === "trial") && (
              <a href={demoDashboardHref} className="rounded-lg border border-cyan-300 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-300/10">
                Demo Dashboard
              </a>
            )}
            {accountState === "visitor" && (
              <a href={trialHref} className="rounded-lg bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200">
                Start 7-day trial
              </a>
            )}
          </div>
        </div>

        <div className="relative isolate aspect-video min-h-[380px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_75%_25%,rgba(34,211,238,.20),transparent_34%),linear-gradient(135deg,#0f172a,#020617)] shadow-2xl">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div className="relative grid h-full items-center gap-8 p-7 md:grid-cols-[1.2fr_.8fr] md:p-12">
            <div key={scene} className="animate-in fade-in slide-in-from-left-4 duration-500">
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-cyan-300">{current.eyebrow}</p>
              <h3 className="mt-4 max-w-3xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">{current.title}</h3>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">{current.body}</p>
            </div>
            <div className="hidden place-items-center md:grid" aria-hidden="true">
              <div className="grid h-56 w-56 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 shadow-[0_0_80px_rgba(34,211,238,.18)]">
                <Icon className="h-24 w-24 text-cyan-300" strokeWidth={1.3} />
              </div>
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950 via-slate-950/90 to-transparent px-5 pb-5 pt-12">
            <div className="mb-4 grid grid-cols-4 gap-2" aria-label={`Scene ${scene + 1} of ${scenes.length}`}>
              {scenes.map((_, index) => (
                <button key={index} onClick={() => { setScene(index); elapsed.current = 0; }} className="h-1.5 overflow-hidden rounded-full bg-white/15" aria-label={`Go to scene ${index + 1}`}>
                  <span className={`block h-full rounded-full bg-cyan-300 transition-all ${index <= scene ? "w-full" : "w-0"}`} />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button onClick={togglePlayback} className="grid h-11 w-11 place-items-center rounded-full bg-white text-slate-950" aria-label={playing ? "Pause video" : "Play video"}>
                  {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                </button>
                <button onClick={restart} className="grid h-10 w-10 place-items-center rounded-full text-slate-300 hover:bg-white/10" aria-label="Restart video"><RotateCcw className="h-5 w-5" /></button>
                <button onClick={() => { setMuted((value) => !value); window.speechSynthesis?.cancel(); }} className="grid h-10 w-10 place-items-center rounded-full text-slate-300 hover:bg-white/10" aria-label={muted ? "Unmute narration" : "Mute narration"}><Volume2 className={`h-5 w-5 ${muted ? "opacity-40" : ""}`} /></button>
              </div>
              <span className="text-xs font-medium text-slate-400">Voiceover · {totalSeconds} sec</span>
            </div>
          </div>
        </div>

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-white">Read video transcript</summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5">{narration.map((line) => <li key={line}>{line}</li>)}</ol>
        </details>
        {!canUseSpeech && <p className="mt-3 text-sm text-amber-200">Narration is unavailable in this browser; the complete transcript remains available.</p>}
      </div>
    </section>
  );
}
