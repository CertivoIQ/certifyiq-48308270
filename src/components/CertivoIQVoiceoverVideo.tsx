import { type ComponentProps } from "react";
import BaseVoiceoverVideo from "./CertivoIQVoiceoverVideoBase";

type Props = ComponentProps<typeof BaseVoiceoverVideo>;

export default function CertivoIQVoiceoverVideo(props: Props) {
  const trialHref = props.trialHref ?? "/trial";
  const showFreeReviewCta = props.accountState !== "subscriber";

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden overflow-y-visible [&_details]:hidden [&_.aspect-video]:min-h-0 [&_.aspect-video]:w-full [&_.aspect-video]:max-w-full [&_.aspect-video]:overflow-hidden [&_.aspect-video>div.relative.grid]:min-w-0 [&_.aspect-video>div.relative.grid]:max-w-full [&_.aspect-video>div.relative.grid>div]:min-w-0 [&_.aspect-video>div.relative.grid>div:nth-child(2)]:order-first [&_.aspect-video>div.relative.grid]:md:grid-cols-[1.1fr_.9fr] [&_.aspect-video>div.relative.grid>div:nth-child(2)]:md:order-first [&_.aspect-video>div.absolute.inset-x-0.bottom-0]:max-w-full [&_.aspect-video>div.absolute.inset-x-0.bottom-0]:overflow-hidden [&_.aspect-video>div.absolute.inset-x-0.bottom-0_.grid.grid-cols-6]:hidden [&_.text-right.text-xs.font-medium.text-slate-400]:hidden [&_p.mt-3.rounded-lg]:hidden">
      <BaseVoiceoverVideo {...props} />
      {showFreeReviewCta && (
        <div className="max-w-full overflow-hidden bg-slate-950 px-5 pb-8 text-white sm:px-8">
          <div className="mx-auto max-w-7xl border-t border-white/10 pt-5">
            <div className="flex justify-center">
              <a
                href={trialHref}
                className="inline-flex max-w-full items-center justify-center rounded-lg bg-cyan-300 px-6 py-3 text-center text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-300/10 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
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
