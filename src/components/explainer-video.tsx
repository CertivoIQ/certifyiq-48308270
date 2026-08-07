import { Link } from "@tanstack/react-router";
import { Panel } from "@/components/ui-kit";
import { useT } from "@/lib/i18n/provider";

/** Set once the processed explainer MP4 is in place. */
export const EXPLAINER_VIDEO_SRC = "/assets/certivo-explainer.mp4";
export const EXPLAINER_POSTER_SRC = "/assets/certivo-explainer-poster.jpg";

/**
 * Welcome-page explainer player. Controls are visible and audio is enabled so
 * the voiceover plays on press — autoplaying video is force-muted by browsers.
 */
export function ExplainerVideo() {
  const t = useT();

  return (
    <Panel bodyClassName="p-0">
      <section className="relative w-full overflow-hidden rounded-lg bg-muted">
        <video
          className="block aspect-video w-full object-cover"
          src={EXPLAINER_VIDEO_SRC}
          poster={EXPLAINER_POSTER_SRC}
          controls
          playsInline
          preload="metadata"
          aria-label={t("welcome.video.label")}
        />

        <Link
          to="/trial"
          className="absolute right-[3%] top-[5.5%] rounded-md bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground shadow-lg transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t("welcome.video.trialCta")}
        </Link>
      </section>
    </Panel>
  );
}
