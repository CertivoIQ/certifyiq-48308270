import { type ComponentProps } from "react";
import BaseVoiceoverVideo from "./CertivoIQVoiceoverVideoBase";

type Props = ComponentProps<typeof BaseVoiceoverVideo>;

export default function CertivoIQVoiceoverVideo(props: Props) {
  const trialHref = props.trialHref ?? "/contact-support";
  const showDemoCta = props.accountState !== "subscriber";

  return (
    <div className="min-w-0 max-w-full overflow-x-hidden overflow-y-visible [&_details]:hidden [&_.aspect-video]:min-h-0 [&_.aspect-video]:w-full [&_.aspect-video]:max-w-full [&_.aspect-video]:overflow-hidden [&_.aspect-video>div.relative.grid]:min-w-0 [&_.aspect-video>div.relative.grid]:max-w-full [&_.aspect-video>div.relative.grid>div]:min-w-0 [&_.aspect-video>div.relative.grid>div:nth-child(2)]:order-first [&_.aspect-video>div.relative.grid]:md:grid-cols-[1.1fr_.9fr] [&_.aspect-video>div.relative.grid>div:nth-child(2)]:md:order-first [&_.aspect-video>div.absolute.inset-x-0.bottom-0]:max-w-full [&_.aspect-video>div.absolute.inset-x-0.bottom-0]:overflow-hidden [&_.aspect-video>div.absolute.inset-x-0.bottom-0_.grid.grid-cols-6]:hidden [&_.text-right.text-xs.font-medium.text-slate-400]:hidden [&_p.mt-3.rounded-lg]:hidden">
      <BaseVoiceoverVideo {...props} />
      {showDemoCta && (
        <div className="max-w-full overflow-hidden bg-[#012447] px-5 pb-8 text-white sm:px-8">
          <div className="mx-auto max-w-7xl border-t border-white/10 pt-5">
            <div className="flex flex-col items-center gap-2">
              <a
                href={trialHref}
                className="inline-flex max-w-full items-center justify-center rounded-lg bg-[#FEC229] px-6 py-3 text-center text-sm font-semibold uppercase tracking-[.12em] text-[#012447] shadow-lg transition hover:bg-[#ffd35c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FEC229] focus-visible:ring-offset-2 focus-visible:ring-offset-[#012447]"
              >
                REQUEST A DEMO
              </a>
              <p className="text-[12px] font-semibold uppercase tracking-[.14em] text-[#FEC229]">FEDERAL BASELINE REVIEW</p>
              <p className="text-[11px] uppercase tracking-[.14em] text-white/70">ANNUAL PLATFORM LICENSE</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
