# Real explainer video on the CertivoIQ welcome page

Replace the placeholder video block (gradient panel with a play icon) and the six-chapter commentary grid beneath it with a real MP4 player, matching the component you provided, plus a "Start 7 Day Free Trial" overlay button. The watermark gets permanently removed from the file itself.

## What you need to do first

Upload the MP4 in your next message. I can't find any video in the project — `public/` holds only icons, and `src/assets/` only the Merlin images — so nothing can be wired until the file is here. A poster image is optional; if you don't have one I'll grab a clean frame from the video itself.

Please also tell me roughly where the watermark sits (e.g. "bottom-right corner") so I blur the right region.

## What I'll build once the file lands

**1. Clean the watermark out of the file**
Re-encode the upload with ffmpeg's delogo/blur filter over the watermark region only, keeping the original footage, images and voiceover audio untouched everywhere else. I'll pull a still from the processed file to confirm the watermark is gone before wiring it in, and re-encode at a slightly different region if it isn't fully covered.

**2. Store the video**
The processed MP4 (and poster frame) go to CDN-hosted assets rather than into the repo, so the project stays lightweight. The player references the CDN URL. If you'd rather have it as a plain file under `public/assets/`, say so and I'll do that instead.

**3. Replace the welcome-page video section**
In `src/routes/welcome.tsx`:
- Delete the gradient placeholder, its play button, the "Inside CertivoIQ — the 4-minute compliance walkthrough" heading and subtitle, and the six timestamped chapter cards below it.
- Render the video in their place, styled as in your snippet: full-width, 16:9, rounded panel.
- Player controls are visible and audio is on, so the voiceover plays when a visitor presses play. No autoplay (browsers mute autoplaying video, which would silence the narration). The poster frame shows until playback starts.
- Overlay the "Start 7 Day Free Trial" button at the top-right of the frame, linking to `/trial`, using the project's own button styling and design tokens rather than raw `bg-blue-600` so it stays correct in dark mode.

**4. Keep the Spanish switch working**
The button label and the video's accessible label go through the existing translation dictionary, with Spanish copy added, so the EN/ES toggle still applies to this section.

## Technical notes

- Video processing: `ffmpeg -i input.mp4 -vf "delogo=x=..:y=..:w=..:h=.." -c:a copy` — audio stream copied bit-for-bit, so the voiceover is untouched.
- Asset hosting: `lovable-assets create` produces a `.asset.json` pointer imported by the route; no binary is committed.
- Route file touched: `src/routes/welcome.tsx`. Strings added to `src/lib/i18n/en.ts` and `src/lib/i18n/es.ts`.
- `VIDEO_CHAPTERS` in `src/lib/trial-data.ts` and `VIDEO_CHAPTERS_ES` in `src/lib/i18n/marketing-es.ts` become unused once the chapter grid is removed; I'll delete both rather than leave dead data.
- The route's `head()` metadata is unchanged, and no `og:video` tag is added unless you ask.
