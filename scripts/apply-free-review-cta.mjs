import fs from "node:fs";

const path = "src/components/CertivoIQVoiceoverVideo.tsx";
const source = fs.readFileSync(path, "utf8");
const marker = `        </div>\n\n        {audioError && (`;
const replacement = `        </div>\n\n        <div className="mt-5 flex justify-center">\n          <a\n            href={trialHref}\n            className="inline-flex items-center justify-center rounded-lg bg-cyan-300 px-6 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-cyan-300/10 transition hover:bg-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"\n          >\n            Review Your 3 FREE Certifications\n          </a>\n        </div>\n\n        {audioError && (`;

if (!source.includes(marker)) {
  throw new Error("Expected video container marker was not found; refusing to modify the file.");
}
if (source.includes("Review Your 3 FREE Certifications")) {
  console.log("CTA already present; nothing to do.");
  process.exit(0);
}
fs.writeFileSync(path, source.replace(marker, replacement));
console.log("Added the 3 FREE certifications CTA below the explainer video.");
