import { useState, useEffect, useRef, useMemo, type CSSProperties } from "react";
import { Volume2, VolumeX, Play, RotateCcw } from "lucide-react";
import { VOICEOVER_FILES, getSceneDurations, type VoiceoverLang } from "@/lib/explainer-voiceover";
import { useLanguage, useT } from "@/lib/i18n/provider";

const BASE_SCENES = [0, 1, 2, 3, 4];


const C = {
  bg: "#060B18",
  blue: "#2563EB",
  blueLight: "#60A5FA",
  sky: "#BAE6FD",
  white: "#F8FAFC",
  muted: "#64748B",
  dim: "#94A3B8",
  red: "#F87171",
  green: "#4ADE80",
  gold: "#FBBF24",
  mono: "'JetBrains Mono','Fira Code','Courier New',monospace",
  sans: "-apple-system,'Segoe UI',Roboto,sans-serif",
};

const css = `
@keyframes fadeUp  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
@keyframes scaleIn { from{opacity:0;transform:scale(0.88)}       to{opacity:1;transform:scale(1)}     }
@keyframes barGrow { from{width:0}                               to{width:85%}                        }
@keyframes cardIn  { from{opacity:0;transform:translateY(16px)}  to{opacity:1;transform:translateY(0)} }
@keyframes sceneFade { from{opacity:0} to{opacity:1} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
`;

function a(name: string, delay = "0s", dur = "0.6s"): CSSProperties {
  return { animation: `${name} ${dur} ${delay} both` };
}

function Scene0() {
  return (
    <div style={{ textAlign: "center" }}>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 11,
          letterSpacing: "0.25em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 28,
          ...a("fadeUp", "0.1s"),
        }}
      >
        one uncorrected §42 finding
      </div>
      <div
        style={{
          fontSize: "clamp(52px,9vw,76px)",
          fontWeight: 700,
          color: C.white,
          lineHeight: 1,
          marginBottom: 12,
          fontVariantNumeric: "tabular-nums",
          ...a("scaleIn", "0.3s", "0.7s"),
        }}
      >
        $65,000
      </div>
      <div
        style={{
          fontSize: "clamp(14px,2.2vw,19px)",
          color: C.red,
          fontWeight: 600,
          marginBottom: 32,
          ...a("fadeUp", "0.6s"),
        }}
      >
        in recaptured tax credits — gone.
      </div>
      <div style={{ fontSize: "clamp(11px,1.5vw,14px)", color: C.dim, lineHeight: 1.75, ...a("fadeUp", "1s") }}>
        A single overlooked bonus. An expired third-party verification.
        <br />
        A missed recertification date. One blended-program conflict.
      </div>
    </div>
  );
}

const PROGRAMS = ["LIHTC §42", "Section 8", "HOME", "HOTMA", "Bond"];

function Scene1() {
  return (
    <div style={{ textAlign: "center", maxWidth: 540, margin: "0 auto" }}>
      <div
        style={{
          fontSize: "clamp(16px,2.6vw,22px)",
          color: C.white,
          fontWeight: 600,
          lineHeight: 1.4,
          marginBottom: 14,
          ...a("fadeUp", "0.1s"),
        }}
      >
        Your reviewers are checking every certification by hand.
      </div>
      <div
        style={{
          fontSize: "clamp(11px,1.5vw,14px)",
          color: C.dim,
          lineHeight: 1.75,
          marginBottom: 30,
          ...a("fadeUp", "0.45s"),
        }}
      >
        Five rulebooks. Fifty state agencies. Thousands of files a year.
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {PROGRAMS.map((p, i) => (
          <span
            key={p}
            style={{
              fontFamily: C.mono,
              fontSize: 11,
              letterSpacing: "0.04em",
              color: C.sky,
              border: "1px solid rgba(96,165,250,0.35)",
              background: "rgba(37,99,235,0.12)",
              borderRadius: 999,
              padding: "6px 12px",
              ...a("cardIn", `${0.7 + i * 0.12}s`, "0.5s"),
            }}
          >
            {p}
          </span>
        ))}
      </div>
    </div>
  );
}

const FINDINGS = [
  { rule: "26 CFR 1.42-5(b)", text: "Student status certification missing for unit 204", tone: C.red },
  { rule: "HUD 4350.3 5-6", text: "Asset income imputed at 0.06% — current rate is 0.45%", tone: C.gold },
  { rule: "HOTMA §102", text: "Income determination exceeds 2-year safe harbor window", tone: C.gold },
];

function Scene2() {
  return (
    <div style={{ maxWidth: 620, margin: "0 auto" }}>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 11,
          letterSpacing: "0.22em",
          color: C.blueLight,
          textTransform: "uppercase",
          marginBottom: 10,
          ...a("fadeUp", "0.1s"),
        }}
      >
        CertivoIQ AI review · TIC_2026_0412.pdf
      </div>
      <div
        style={{
          fontSize: "clamp(15px,2.3vw,20px)",
          color: C.white,
          fontWeight: 600,
          marginBottom: 18,
          ...a("fadeUp", "0.3s"),
        }}
      >
        Every line item, checked against the rule that governs it.
      </div>
      <div style={{ height: 4, background: "rgba(255,255,255,0.07)", borderRadius: 999, marginBottom: 22 }}>
        <div
          style={{
            height: "100%",
            borderRadius: 999,
            background: `linear-gradient(90deg,${C.blue},${C.blueLight})`,
            ...a("barGrow", "0.5s", "2.2s"),
          }}
        />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {FINDINGS.map((f, i) => (
          <div
            key={f.rule}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              borderLeft: `2px solid ${f.tone}`,
              borderRadius: 8,
              padding: "10px 14px",
              ...a("cardIn", `${1 + i * 0.45}s`, "0.5s"),
            }}
          >
            <span style={{ fontFamily: C.mono, fontSize: 10, color: f.tone, whiteSpace: "nowrap", paddingTop: 2 }}>
              {f.rule}
            </span>
            <span style={{ fontSize: "clamp(11px,1.4vw,13px)", color: C.dim, lineHeight: 1.5 }}>{f.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "AI finding", body: "Cited to the exact regulation, not a vague warning." },
  { n: "02", title: "Correction steps", body: "The fix, written for the reviewer who has to make it." },
  { n: "03", title: "Human sign-off", body: "Pass or fail is always approved by your reviewer." },
];

function Scene3() {
  return (
    <div style={{ maxWidth: 660, margin: "0 auto", textAlign: "center" }}>
      <div
        style={{
          fontSize: "clamp(15px,2.4vw,21px)",
          color: C.white,
          fontWeight: 600,
          marginBottom: 26,
          ...a("fadeUp", "0.1s"),
        }}
      >
        Findings, corrections, and a human final approval.
      </div>
      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
        {STEPS.map((s, i) => (
          <div
            key={s.n}
            style={{
              textAlign: "left",
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              borderRadius: 10,
              padding: "14px 16px",
              ...a("cardIn", `${0.4 + i * 0.35}s`, "0.5s"),
            }}
          >
            <div style={{ fontFamily: C.mono, fontSize: 10, color: C.blueLight, letterSpacing: "0.18em" }}>{s.n}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: C.white, margin: "8px 0 6px" }}>{s.title}</div>
            <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{s.body}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          marginTop: 22,
          fontFamily: C.mono,
          fontSize: 11,
          letterSpacing: "0.1em",
          color: C.green,
          ...a("fadeUp", "1.6s"),
        }}
      >
        ✓ AUDIT-READY · SIGNED OFF BY REVIEWER
      </div>
    </div>
  );
}

function Scene4() {
  return (
    <div style={{ textAlign: "center", maxWidth: 560, margin: "0 auto" }}>
      <div
        style={{
          fontFamily: C.mono,
          fontSize: 11,
          letterSpacing: "0.25em",
          color: C.muted,
          textTransform: "uppercase",
          marginBottom: 20,
          ...a("fadeUp", "0.1s"),
        }}
      >
        compliance intelligence for all 50 states
      </div>
      <div
        style={{
          fontSize: "clamp(30px,5.4vw,50px)",
          fontWeight: 700,
          color: C.white,
          lineHeight: 1.05,
          marginBottom: 14,
          ...a("scaleIn", "0.3s", "0.7s"),
        }}
      >
        Certivo<span style={{ color: C.gold }}>IQ</span>
      </div>
      <div
        style={{
          fontSize: "clamp(13px,1.9vw,17px)",
          color: C.sky,
          lineHeight: 1.6,
          marginBottom: 30,
          ...a("fadeUp", "0.7s"),
        }}
      >
        Protect your tax credits before the auditor arrives.
      </div>
      <div style={{ display: "flex", justifyContent: "center", ...a("fadeUp", "0.95s") }}>
        <a
          href="/trial"
          style={{
            borderRadius: 8,
            background: C.blue,
            padding: "12px 24px",
            fontSize: 14,
            fontWeight: 600,
            color: C.white,
            textDecoration: "none",
            boxShadow: "0 4px 18px rgba(37,99,235,0.45)",
          }}
        >
          Start 7 Day Free Trial
        </a>
      </div>
      <div style={{ marginTop: 14, fontSize: "clamp(10px,1.3vw,12px)", color: C.muted, ...a("fadeUp", "1.1s", "0.5s") }}>
        No credit card required · Cancel anytime
      </div>
    </div>
  );
}

const SceneMap = [Scene0, Scene1, Scene2, Scene3, Scene4];

export function ExplainerVideo() {
  const t = useT();
  const { lang: uiLang } = useLanguage();
  const [voiceLang, setVoiceLang] = useState<VoiceoverLang>(uiLang === "es" ? "es" : "en");
  const [runId, setRunId] = useState(0);
  const [scene, setScene] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [audioError, setAudioError] = useState(false);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Each language has its own generated voiceover, so scene durations are
  // computed from the real audio length and per-sentence word counts.
  const SCENES = useMemo(() => getSceneDurations(voiceLang).map((duration) => ({ duration })), [voiceLang]);
  const TOTAL = useMemo(() => SCENES.reduce((s, x) => s + x.duration, 0), [SCENES]);


  // Keep voiceover language in sync with UI language when not actively playing.
  useEffect(() => {
    if (!playing) setVoiceLang(uiLang === "es" ? "es" : "en");
  }, [uiLang, playing]);

  // Animation loop. Restarts whenever `runId` changes.
  useEffect(() => {
    setElapsed(0);
    setScene(0);
    setEnded(false);
    startRef.current = performance.now();
    const tick = (now: number) => {
      const ms = now - (startRef.current ?? now);
      setElapsed(Math.min(ms, TOTAL));
      let acc = 0;
      for (let i = 0; i < SCENES.length; i++) {
        if (ms < acc + SCENES[i]!.duration) {
          setScene(i);
          break;
        }
        acc += SCENES[i]!.duration;
      }
      if (ms < TOTAL) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setEnded(true);
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [runId]);

  const handlePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setAudioError(false);
    audio.currentTime = 0;
    setRunId((id) => id + 1);
    setEnded(false);
    setPlaying(true);
    // Start audio after the animation frame has reset so they are in sync.
    requestAnimationFrame(() => {
      audio.play().catch((err) => {
        console.error("Voiceover playback failed", err);
        setAudioError(true);
        setPlaying(false);
      });
    });
  };

  const handlePause = () => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(false);
  };

  const handleAudioEnded = () => {
    setPlaying(false);
    setEnded(true);
  };

  const handleAudioError = () => {
    setAudioError(true);
    setPlaying(false);
  };

  const progress = Math.round((elapsed / TOTAL) * 10000) / 100;
  const Active = SceneMap[scene]!;

  const toggleVoiceLang = () => {
    setVoiceLang((prev) => (prev === "en" ? "es" : "en"));
  };

  return (
    <section
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "16/9",
        overflow: "hidden",
        borderRadius: 12,
        background: C.bg,
        fontFamily: C.sans,
      }}
      aria-label={t("welcome.video.label")}
    >
      <style>{css}</style>

      <audio
        ref={audioRef}
        src={VOICEOVER_FILES[voiceLang].url}
        preload="metadata"
        onEnded={handleAudioEnded}
        onError={handleAudioError}
        style={{ display: "none" }}
        aria-hidden="true"
      />

      {/* Progress bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          height: 3,
          background: "rgba(255,255,255,0.07)",
          zIndex: 10,
        }}
      >
        <div
          style={{ height: "100%", background: C.blue, width: `${progress}%`, transition: "width 0.05s linear" }}
        />
      </div>

      {/* Top-right CTA */}
      <a
        href="/trial"
        style={{
          position: "absolute",
          right: "3%",
          top: "5.5%",
          zIndex: 20,
          borderRadius: 6,
          background: C.blue,
          padding: "8px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: C.white,
          textDecoration: "none",
          boxShadow: "0 2px 10px rgba(37,99,235,0.45)",
        }}
      >
        {t("welcome.video.trialCta")}
      </a>

      {/* Audio controls */}
      <div
        style={{
          position: "absolute",
          left: "3%",
          top: "5.5%",
          zIndex: 20,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={playing ? handlePause : handlePlay}
          aria-label={playing ? t("video.pause") : ended ? t("video.replay") : t("video.play")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(6,11,24,0.72)",
            backdropFilter: "blur(6px)",
            padding: "6px 12px",
            fontSize: 12,
            fontWeight: 600,
            color: C.white,
            cursor: "pointer",
          }}
        >
          {playing ? <Volume2 size={14} /> : ended ? <RotateCcw size={14} /> : <Play size={14} />}
          {playing ? t("video.pause") : ended ? t("video.replay") : t("video.play")}
        </button>
        <button
          type="button"
          onClick={toggleVoiceLang}
          aria-label={t("video.switchLanguage")}
          style={{
            borderRadius: 6,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(6,11,24,0.72)",
            backdropFilter: "blur(6px)",
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: C.sky,
            cursor: "pointer",
            fontFamily: C.mono,
            letterSpacing: "0.04em",
          }}
        >
          {VOICEOVER_FILES[voiceLang].display}
        </button>
      </div>

      {audioError && (
        <div
          style={{
            position: "absolute",
            left: "3%",
            top: "14%",
            zIndex: 20,
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 6,
            background: "rgba(248,113,113,0.15)",
            border: "1px solid rgba(248,113,113,0.35)",
            padding: "6px 10px",
            fontSize: 11,
            color: C.red,
          }}
        >
          <VolumeX size={12} />
          {t("video.audioError")}
        </div>
      )}

      {/* Scene stage */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "10% 8% 6%",
        }}
      >
        <div key={scene} style={{ width: "100%", animation: "sceneFade 0.45s ease forwards" }}>
          <Active />
        </div>
      </div>
    </section>
  );
}

export default ExplainerVideo;
