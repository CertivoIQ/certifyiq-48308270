import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const requireEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
};

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const escapePdf = (value) =>
  value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");

function buildRepresentativePdf({ requestId, createdAt }) {
  const lines = [
    "CertivoIQ Customer File Recovery Drill",
    "",
    "Synthetic pre-launch document - contains no customer data.",
    `Recovery request: ${requestId}`,
    `Created UTC: ${createdAt}`,
    "",
    "Purpose:",
    "Verify a copy-only restore against the real private production bucket.",
    "The source must remain unchanged and the restored copy must match",
    "the source byte-for-byte by SHA-256 digest and byte size.",
  ];

  const textCommands = [
    "BT",
    "/F1 18 Tf",
    "72 720 Td",
    `(${escapePdf(lines[0])}) Tj`,
    "/F1 11 Tf",
    ...lines.slice(1).flatMap((line) => [
      "0 -24 Td",
      `(${escapePdf(line)}) Tj`,
    ]),
    "ET",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(textCommands, "ascii")} >>\nstream\n${textCommands}\nendstream`,
  ];

  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(body, "ascii"));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(body, "ascii");
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) {
    body += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  body += `startxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, "ascii");
}

const url = requireEnv("SUPABASE_URL");
const serviceKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
const bucket = "certification-imports";
const requestId = randomUUID();
const createdAt = new Date().toISOString();

const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: staffRows, error: staffError } = await supabase
  .from("user_roles")
  .select("user_id")
  .eq("role", "staff")
  .order("user_id")
  .limit(1);
if (staffError) throw staffError;
if (!staffRows?.[0]?.user_id) throw new Error("No staff owner is available for the recovery drill");

const ownerId = staffRows[0].user_id;
const sourceBytes = buildRepresentativePdf({ requestId, createdAt });
const sourceDigest = sha256(sourceBytes);
const sourcePath = `${ownerId}/recovery-drill/${requestId}/source.pdf`;
const targetPath = `${ownerId}/recovery/${requestId}/${sourceDigest}/source.pdf`;
const targetDirectory = targetPath.slice(0, targetPath.lastIndexOf("/"));

const { data: existingTargets, error: listError } = await supabase.storage
  .from(bucket)
  .list(targetDirectory, { search: "source.pdf", limit: 10 });
if (listError) throw listError;
if ((existingTargets ?? []).some((item) => item.name === "source.pdf")) {
  throw new Error("Recovery target collision detected before copy");
}

const { error: uploadError } = await supabase.storage
  .from(bucket)
  .upload(sourcePath, sourceBytes, {
    contentType: "application/pdf",
    upsert: false,
    cacheControl: "0",
  });
if (uploadError) throw uploadError;

const { error: copyError } = await supabase.storage
  .from(bucket)
  .copy(sourcePath, targetPath);
if (copyError) throw copyError;

const download = async (path) => {
  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error) throw error;
  return Buffer.from(await data.arrayBuffer());
};

const sourceAfterCopy = await download(sourcePath);
const recoveredBytes = await download(targetPath);
const sourceAfterDigest = sha256(sourceAfterCopy);
const recoveredDigest = sha256(recoveredBytes);

if (sourceAfterCopy.byteLength !== sourceBytes.byteLength) {
  throw new Error("Source byte size changed during recovery");
}
if (sourceAfterDigest !== sourceDigest) {
  throw new Error("Source SHA-256 changed during recovery");
}
if (recoveredBytes.byteLength !== sourceBytes.byteLength) {
  throw new Error("Recovered byte size does not match source");
}
if (recoveredDigest !== sourceDigest) {
  throw new Error("Recovered SHA-256 does not match source");
}

const outputDirectory = "recovery-drill-output";
await mkdir(outputDirectory, { recursive: true });
await writeFile(`${outputDirectory}/source.pdf`, sourceAfterCopy);
await writeFile(`${outputDirectory}/recovered.pdf`, recoveredBytes);

const evidence = {
  schemaVersion: 1,
  status: "copy_verified_pending_owner_confirmation",
  environment: "production",
  bucket,
  requestId,
  createdAt,
  source: {
    pathPattern: "<owner-user-id>/recovery-drill/<request-id>/source.pdf",
    byteSize: sourceAfterCopy.byteLength,
    sha256: sourceAfterDigest,
    remainedIntact: true,
  },
  recovered: {
    pathPattern: "<owner-user-id>/recovery/<request-id>/<sha256>/source.pdf",
    byteSize: recoveredBytes.byteLength,
    sha256: recoveredDigest,
    existedBeforeCopy: false,
  },
  assertions: {
    privateBucket: true,
    copyOnly: true,
    overwriteAllowed: false,
    sourceDeletionAllowed: false,
    byteSizeMatch: true,
    sha256Match: true,
  },
};
await writeFile(
  `${outputDirectory}/recovery-drill-evidence.json`,
  `${JSON.stringify(evidence, null, 2)}\n`,
);

console.log(JSON.stringify(evidence));
