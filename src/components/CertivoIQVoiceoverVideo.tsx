import { type ComponentProps } from "react";
import BaseVoiceoverVideo from "./CertivoIQVoiceoverVideoBase";

type Props = ComponentProps<typeof BaseVoiceoverVideo>;

export default function CertivoIQVoiceoverVideo(props: Props) {
  const trialHref = props.trialHref ?? "/trial";
  const showFreeReviewCta = props.accountState !== "subscriber";

  return (
    <div>
      <BaseVoiceoverVideo {...props} />
      {showFreeReviewCta && (
        <div className="bg-slate-950 px-5 pb-8 text-white sm:px-8">
          <div className="mx-auto max-w-7xl border-t border-white/10 pt-5">
            <div className="flex justify-center">
              <a
                href={trialHref}
                className="inline-flex items-center justify-center rounded-lg bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-300/10 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                Review Your 3 FREE Certifications
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
