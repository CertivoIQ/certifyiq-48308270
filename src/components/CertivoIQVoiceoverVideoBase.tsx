import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  ShieldCheck,
  Upload,
  UserCheck,
  Volume2,
  VolumeX,
} from "lucide-react";

type AccountState = "visitor" | "trial" | "subscriber";

type CertivoIQVoiceoverVideoProps = {
  accountState?: AccountState;
  demoDashboardHref?: string;
  trialHref?: string;
  className?: string;
};

type Scene = {
  eyebrow: string;
  title: string;
  body: string;
  narration: string;
  audioSrc: string;
  fallbackSeconds: number;
  Visual: ComponentType;
};

const NARRATION_PLAYBACK_RATE = 1.15;

const scenes: Scene[] = [
  {
    eyebrow: "1 · Upload",
    title: "Start with the certification file",
    body: "A reviewer uploads the household's certification packet into one secure workspace.",
    narration:
      "Every audit-ready decision begins with the file. Upload the household's certification packet into one secure CertivoIQ workspace.",
    audioSrc: "/audio/welcome/scene-01-upload.mp3",
    fallbackSeconds: 9,
    Visual: UploadVisual,
  },
  {
    eyebrow: "2 · Extract",
    title: "Turn documents into traceable evidence",
    body: "Income, assets, signatures, dates, and source pages are extracted and linked back to the original document.",
    narration:
      "CertivoIQ extracts income, assets, signatures, verification dates, and source pages—turning every document into traceable evidence.",
    audioSrc: "/audio/welcome/scene-02-extract.mp3",
    fallbackSeconds: 10,
    Visual: ExtractVisual,
  },
  {
    eyebrow: "3 · Apply rules",
    title: "Activate every applicable rule layer",
    body: "Activated federal controls are evaluated only when their required inputs and source versions are available.",
    narration:
      "The platform applies only activated, versioned federal controls. Inactive, state, local, and project-specific requirements return Unable to Determine or require separate Manual Review.",
    audioSrc: "/audio/welcome/scene-03-rules.mp3",
    fallbackSeconds: 10,
    Visual: RulesVisual,
  },
  {
    eyebrow: "4 · Explain findings",
    title: "See the finding, citation, and correction",
    body: "Each result shows what failed, the authority behind it, and the exact path to correction.",
    narration:
      "Each result shows what passed, what failed, the governing citation, and the exact correction path—so the decision is never a black box.",
    audioSrc: "/audio/welcome/scene-04-findings.mp3",
    fallbackSeconds: 10,
    Visual: FindingsVisual,
  },
  {
    eyebrow: "5 · Agent Approval",
    title: "Keep your compliance team in control",
    body: "CertivoIQ prepares the review; your authorized staff make and record the decision.",
    narration:
      "CertivoIQ prepares the review while your authorized compliance agent retains Agent Approval authority and provides an Agent Signature.",
    audioSrc: "/audio/welcome/scene-05-approval.mp3",
    fallbackSeconds: 9,
    Visual: ApprovalVisual,
  },
  {
    eyebrow: "6 · Portfolio intelligence",
    title: "Turn each review into portfolio readiness",
    body: "Leaders can see open findings, correction progress, upcoming risk, and readiness across every property.",
    narration:
      "Every completed review updates portfolio readiness, giving leaders a clear view of findings, corrections, upcoming risk, and the properties that need attention now.",
    audioSrc: "/audio/welcome/scene-06-portfolio.mp3",
    fallbackSeconds: 11,
    Visual: PortfolioVisual,
  },
];

const transcript = scenes.map((scene) => scene.narration);

export default function CertivoIQVoiceoverVideo({
  accountState = "visitor",
  demoDashboardHref = "/demo-dashboard",
  trialHref = "/trial",
  className = "",
}: CertivoIQVoiceoverVideoProps) {
  const [scene, setScene] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [sceneProgress, setSceneProgress] = useState(0);
  const [audioError, setAudioError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const current = scenes[scene]!;
  const Visual = current.Visual;
  const totalSeconds = useMemo(
    () => scenes.reduce((sum, item) => sum + item.fallbackSeconds, 0),
    [],
  );
  const overallProgress = ((scene + sceneProgress) / scenes.length) * 100;

  useEffect(() => {
    setSceneProgress(0);
    setAudioError(false);
  }, [scene]);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = NARRATION_PLAYBACK_RATE;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    try {
      await audio.play();
      setPlaying(true);
      setAudioError(false);
    } catch {
      setPlaying(false);
      setAudioError(true);
    }
  };

  const restart = async () => {
    const audio = audioRef.current;
    setSceneProgress(0);
    if (scene !== 0) {
      setScene(0);
      setPlaying(true);
      return;
    }
    if (!audio) return;
    audio.currentTime = 0;
    audio.playbackRate = NARRATION_PLAYBACK_RATE;
    try {
      await audio.play();
      setPlaying(true);
      setAudioError(false);
    } catch {
      setAudioError(true);
    }
  };

  const chooseScene = (index: number) => {
    if (index === scene && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.playbackRate = NARRATION_PLAYBACK_RATE;
      setSceneProgress(0);
      if (playing) void audioRef.current.play();
      return;
    }
    setScene(index);
  };

  const handleEnded = () => {
    if (scene === scenes.length - 1) {
      setPlaying(false);
      setSceneProgress(1);
      return;
    }
    setScene((value) => value + 1);
  };

  return (
    <section
      className={`bg-[#012459] px-5 py-8 text-white sm:px-8 ${className}`}
      aria-labelledby="certivo-video-title"
    >
      <style>{`
        @keyframes certivo-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes certivo-scan {
          0% { transform: translateY(-12px); opacity: .2; }
          50% { opacity: 1; }
          100% { transform: translateY(184px); opacity: .2; }
        }
        @keyframes certivo-flow {
          0% { transform: translateX(-18px); opacity: 0; }
          35%, 70% { opacity: 1; }
          100% { transform: translateX(170px); opacity: 0; }
        }
        @keyframes certivo-rise {
          from { transform: scaleY(.15); }
          to { transform: scaleY(1); }
        }
        .certivo-float { animation: certivo-float 3.6s ease-in-out infinite; }
        .certivo-float-delay { animation: certivo-float 3.6s ease-in-out .55s infinite; }
        .certivo-scan { animation: certivo-scan 3s ease-in-out infinite; }
        .certivo-flow { animation: certivo-flow 2.8s ease-in-out infinite; }
        .certivo-rise { transform-origin: bottom; animation: certivo-rise .75s ease-out both; }
        @media (prefers-reduced-motion: reduce) {
          .certivo-float, .certivo-float-delay, .certivo-scan, .certivo-flow, .certivo-rise {
            animation: none !important;
          }
        }
      `}</style>

      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#FEAD05]">
              CertivoIQ in about 60 seconds
            </p>
            <h2
              id="certivo-video-title"
              className="mt-2 text-2xl font-semibold sm:text-3xl"
            >
              Watch a certification become an audit-ready decision
            </h2>
          </div>
          <div className="flex flex-wrap gap-3">
            {(accountState === "visitor" || accountState === "trial") && (
              <a
                href={demoDashboardHref}
                className="rounded-lg border border-[#FEAD05] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#FEAD05]/10"
              >
                Demo Dashboard
              </a>
            )}
            {accountState === "visitor" && (
              <a
                href={trialHref}
                className="rounded-lg bg-[#FEAD05] px-4 py-2.5 text-sm font-semibold text-[#012459] transition hover:bg-[#ffd35c]"
              >
                Try CertivoIQ for Free
              </a>
            )}
          </div>
        </div>

        <div className="relative isolate aspect-video min-h-[430px] overflow-hidden rounded-2xl border border-white/10 bg-[radial-gradient(circle_at_75%_25%,rgba(254,173,5,.18),transparent_34%),linear-gradient(135deg,#012459,#012459)] shadow-2xl">
          <div className="absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.05)_1px,transparent_1px)] [background-size:36px_36px]" />
          <div
            className="absolute inset-y-0 left-0 bg-[#FEAD05]/5 transition-[width] duration-300"
            style={{ width: `${overallProgress}%` }}
            aria-hidden="true"
          />

          <div className="relative grid h-full items-center gap-7 p-7 pb-32 md:grid-cols-[.9fr_1.1fr] md:p-11 md:pb-32">
            <div
              key={`copy-${scene}`}
              className="animate-in fade-in slide-in-from-left-4 duration-500"
            >
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#FEAD05]">
                {current.eyebrow}
              </p>
              <h3 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight sm:text-4xl lg:text-5xl">
                {current.title}
              </h3>
              <p className="mt-5 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
                {current.body}
              </p>
            </div>
            <div
              key={`visual-${scene}`}
              className="animate-in fade-in zoom-in-95 duration-500"
            >
              <Visual />
            </div>
          </div>

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#012459] via-[#012459]/95 to-transparent px-5 pb-5 pt-12">
            <div
              className="mb-4 grid grid-cols-6 gap-2"
              aria-label={`Scene ${scene + 1} of ${scenes.length}`}
            >
              {scenes.map((item, index) => (
                <button
                  key={item.title}
                  type="button"
                  onClick={() => chooseScene(index)}
                  className="group h-1.5 overflow-hidden rounded-full bg-white/15"
                  aria-label={`Go to scene ${index + 1}: ${item.title}`}
                >
                  <span
                    className="block h-full origin-left rounded-full bg-[#FEAD05] transition-transform duration-300"
                    style={{
                      transform:
                        index < scene
                          ? "scaleX(1)"
                          : index === scene
                            ? `scaleX(${Math.max(sceneProgress, 0.03)})`
                            : "scaleX(0)",
                    }}
                  />
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={togglePlayback}
                  className="grid h-11 w-11 place-items-center rounded-full bg-white text-[#012459]"
                  aria-label={playing ? "Pause video" : "Play video"}
                >
                  {playing ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="ml-0.5 h-5 w-5" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={restart}
                  className="grid h-10 w-10 place-items-center rounded-full text-slate-300 hover:bg-white/10"
                  aria-label="Restart video"
                >
                  <RotateCcw className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setMuted((value) => !value)}
                  className="grid h-10 w-10 place-items-center rounded-full text-slate-300 hover:bg-white/10"
                  aria-label={muted ? "Unmute narration" : "Mute narration"}
                >
                  {muted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </button>
              </div>
              <span className="text-right text-xs font-medium text-slate-400">
                Natural female narration · ElevenLabs · 1.15× speed · ~51 sec
              </span>
            </div>
          </div>

          <audio
            ref={audioRef}
            src={current.audioSrc}
            preload="metadata"
            muted={muted}
            autoPlay={playing}
            onLoadedMetadata={(event) => {
              event.currentTarget.playbackRate = NARRATION_PLAYBACK_RATE;
            }}
            onCanPlay={(event) => {
              event.currentTarget.playbackRate = NARRATION_PLAYBACK_RATE;
              if (playing) {
                void event.currentTarget.play().catch(() => {
                  setPlaying(false);
                  setAudioError(true);
                });
              }
            }}
            onEnded={handleEnded}
            onTimeUpdate={(event) => {
              const audio = event.currentTarget;
              if (Number.isFinite(audio.duration) && audio.duration > 0) {
                setSceneProgress(
                  Math.min(audio.currentTime / audio.duration, 1),
                );
              }
            }}
            onError={() => {
              setPlaying(false);
              setAudioError(true);
            }}
          />
        </div>

        {audioError && (
          <p className="mt-3 rounded-lg border border-amber-300/30 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
            The narration track is temporarily unavailable. The complete
            transcript remains available below.
          </p>
        )}

        <details className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-300">
          <summary className="cursor-pointer font-semibold text-white">
            Read video transcript
          </summary>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {transcript.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </details>
      </div>
    </section>
  );
}

function StageCard({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden rounded-2xl border border-white/15 bg-slate-900/85 p-5 shadow-2xl">
      <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
          {label}
        </span>
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2 rounded-full bg-[#FEAD05]" />
          <span className="size-2 rounded-full bg-amber-300" />
          <span className="size-2 rounded-full bg-[#FEAD05]" />
        </span>
      </div>
      {children}
    </div>
  );
}

function UploadVisual() {
  return (
    <StageCard label="Secure certification intake">
      <div className="relative grid min-h-56 place-items-center">
        <div className="certivo-float-delay absolute left-4 top-6 w-36 rotate-[-7deg] rounded-xl border border-white/15 bg-slate-800 p-3 opacity-70">
          <div className="h-2 w-20 rounded bg-white/20" />
          <div className="mt-3 h-2 w-full rounded bg-white/10" />
          <div className="mt-2 h-2 w-4/5 rounded bg-white/10" />
        </div>
        <div className="certivo-float absolute right-5 top-8 w-36 rotate-[7deg] rounded-xl border border-white/15 bg-slate-800 p-3 opacity-70">
          <div className="h-2 w-16 rounded bg-[#FEAD05]/60" />
          <div className="mt-3 h-2 w-full rounded bg-white/10" />
          <div className="mt-2 h-2 w-3/5 rounded bg-white/10" />
        </div>
        <div className="relative z-10 grid size-32 place-items-center rounded-3xl border border-[#FEAD05]/40 bg-[#FEAD05]/10 shadow-[0_0_70px_rgba(254,173,5,.18)]">
          <Upload className="size-14 text-[#FEAD05]" strokeWidth={1.5} />
        </div>
        <div className="absolute inset-x-8 bottom-1 h-2 overflow-hidden rounded-full bg-white/10">
          <span className="block h-full w-4/5 rounded-full bg-gradient-to-r from-[#FEAD05] to-[#012459]" />
        </div>
      </div>
    </StageCard>
  );
}

function ExtractVisual() {
  return (
    <StageCard label="Evidence extraction">
      <div className="grid min-h-56 gap-4 sm:grid-cols-[1.05fr_.95fr]">
        <div className="relative overflow-hidden rounded-xl border border-white/15 bg-white p-4 text-slate-900">
          <div className="h-3 w-28 rounded bg-slate-300" />
          <div className="mt-5 space-y-3">
            {[72, 94, 82, 88, 64].map((width, index) => (
              <div
                key={width}
                className="relative h-2 rounded bg-slate-200"
                style={{ width: `${width}%` }}
              >
                {(index === 1 || index === 3) && (
                  <span className="absolute -inset-1 rounded bg-[#FEAD05]/45" />
                )}
              </div>
            ))}
          </div>
          <span className="certivo-scan absolute inset-x-2 top-3 h-px bg-[#FEAD05] shadow-[0_0_12px_rgba(254,173,5,.9)]" />
        </div>
        <div className="space-y-2.5">
          {[
            ["Annual income", "$38,440"],
            ["Cash assets", "$12,850"],
            ["Verification age", "42 days"],
            ["Confidence", "98.7%"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-lg border border-white/10 bg-white/[0.04] p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </StageCard>
  );
}

function RulesVisual() {
  return (
    <StageCard label="Versioned rule engine">
      <div className="relative min-h-56">
        <div className="absolute inset-y-4 left-0 flex w-36 flex-col justify-around">
          {["SOURCE", "RULE VERSION", "EVIDENCE", "MANUAL REVIEW", "APPROVAL"].map(
            (program) => (
              <span
                key={program}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-300"
              >
                {program}
              </span>
            ),
          )}
        </div>
        <div className="absolute left-40 right-28 top-1/2 h-px bg-gradient-to-r from-[#FEAD05]/10 via-[#FEAD05] to-[#FEAD05]/10">
          <span className="certivo-flow absolute -top-1.5 size-3 rounded-full bg-[#FEAD05] shadow-[0_0_16px_rgba(254,173,5,.9)]" />
        </div>
        <div className="absolute right-0 top-1/2 grid size-24 -translate-y-1/2 place-items-center rounded-2xl border border-[#FEAD05]/30 bg-[#FEAD05]/10 text-center">
          <ShieldCheck className="size-9 text-[#FEAD05]" />
          <span className="text-[10px] font-semibold text-white">
            RULE DECISION
          </span>
        </div>
      </div>
    </StageCard>
  );
}

function FindingsVisual() {
  return (
    <StageCard label="Explainable review">
      <div className="min-h-56 space-y-3">
        <div className="flex items-start gap-3 rounded-xl border border-rose-400/25 bg-rose-400/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-rose-300" />
          <div>
            <p className="font-semibold text-white">Verification is expired</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-400">
              Third-party income verification exceeds the permitted age.
            </p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#FEAD05]">
              Authority
            </p>
            <p className="mt-2 text-sm text-white">Rule version 2026.08</p>
            <p className="mt-1 text-xs text-slate-400">
              Source page and citation attached
            </p>
          </div>
          <div className="rounded-xl border border-amber-300/25 bg-amber-300/10 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-200">
              Correction
            </p>
            <p className="mt-2 text-sm text-white">
              Obtain a current verification
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Recalculate before approval
            </p>
          </div>
        </div>
      </div>
    </StageCard>
  );
}

function ApprovalVisual() {
  return (
    <StageCard label="Decision record">
      <div className="grid min-h-56 place-items-center">
        <div className="w-full max-w-sm rounded-2xl border border-white/15 bg-white/[0.04] p-5">
          <div className="flex items-center gap-4">
            <span className="grid size-12 place-items-center rounded-full bg-blue-500/20">
              <UserCheck className="size-6 text-blue-300" />
            </span>
            <div>
              <p className="font-semibold text-white">
                Compliance specialist review
              </p>
              <p className="mt-1 text-xs text-slate-400">
                All corrections acknowledged
              </p>
            </div>
          </div>
          <div className="mt-5 rounded-xl border border-[#FEAD05]/30 bg-[#FEAD05]/10 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-semibold text-[#FEAD05]">
              <CheckCircle2 className="size-4" /> Agent Signature recorded
            </p>
          </div>
          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            <span>Audit event #CIQ-2048</span>
            <span>Rule version locked</span>
          </div>
        </div>
      </div>
    </StageCard>
  );
}

function PortfolioVisual() {
  const bars = [42, 66, 51, 78, 88, 94];
  return (
    <StageCard label="Portfolio readiness">
      <div className="grid min-h-56 gap-3 sm:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                Readiness trend
              </p>
              <p className="mt-1 text-2xl font-semibold text-white">94%</p>
            </div>
            <BarChart3 className="size-6 text-[#FEAD05]" />
          </div>
          <div className="mt-6 flex h-24 items-end gap-2">
            {bars.map((height, index) => (
              <span
                key={height}
                className="certivo-rise flex-1 rounded-t bg-gradient-to-t from-[#012459] to-[#FEAD05]"
                style={{
                  height: `${height}%`,
                  animationDelay: `${index * 90}ms`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {[
            ["Open findings", "12"],
            ["Corrections due", "4"],
            ["Audit-ready files", "185"],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-xl font-semibold text-white">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </StageCard>
  );
}
