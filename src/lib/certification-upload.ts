import { supabase } from "@/integrations/supabase/client";

export const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 6 * 1024 * 1024;
export const RESUMABLE_UPLOAD_CHUNK_BYTES = 6 * 1024 * 1024;

const RETRY_DELAYS_MS = [0, 1_000, 3_000, 5_000, 10_000] as const;
const TUS_VERSION = "1.0.0";

export type CertificationUploadProgress = (
  uploadedBytes: number,
  totalBytes: number,
) => void;

export type CertificationUploadResult = {
  transport: "standard" | "tus";
  durationMs: number;
};

function encodeMetadata(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function resumableEndpoint(): string {
  const storageUrl = String(
    (supabase as unknown as { storageUrl?: string }).storageUrl ?? "",
  );
  if (!storageUrl)
    throw new Error("Secure storage is not configured for resumable uploads.");
  const endpoint = new URL(`${storageUrl.replace(/\/$/, "")}/upload/resumable`);
  if (
    endpoint.hostname.endsWith(".supabase.co") &&
    !endpoint.hostname.endsWith(".storage.supabase.co")
  ) {
    endpoint.hostname = endpoint.hostname.replace(
      /\.supabase\.co$/,
      ".storage.supabase.co",
    );
  }
  return endpoint.toString();
}

async function authenticatedHeaders(): Promise<Record<string, string>> {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session?.access_token)
    throw new Error(
      "Please sign in before uploading a certification document.",
    );
  return {
    authorization: `Bearer ${data.session.access_token}`,
    "tus-resumable": TUS_VERSION,
  };
}

function shouldRetry(response: Response): boolean {
  return (
    response.status === 408 ||
    response.status === 425 ||
    response.status === 429 ||
    response.status >= 500
  );
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit,
): Promise<Response> {
  let lastError: unknown;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    try {
      const response = await fetch(input, init);
      if (!shouldRetry(response)) return response;
      lastError = new Error(
        `Temporary upload service error (${response.status}).`,
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("The upload could not be resumed.");
}

async function readServerOffset(
  uploadUrl: string,
  headers: Record<string, string>,
): Promise<number> {
  const response = await fetchWithRetry(uploadUrl, { method: "HEAD", headers });
  if (!response.ok)
    throw new Error(
      `The resumable upload could not be checked (${response.status}).`,
    );
  const offset = Number(response.headers.get("upload-offset"));
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("The upload service returned an invalid offset.");
  return offset;
}

async function uploadWithTus(
  bucket: string,
  path: string,
  file: File,
  onProgress?: CertificationUploadProgress,
) {
  const headers = await authenticatedHeaders();
  const createResponse = await fetchWithRetry(resumableEndpoint(), {
    method: "POST",
    headers: {
      ...headers,
      "upload-length": String(file.size),
      "upload-metadata": [
        `bucketName ${encodeMetadata(bucket)}`,
        `objectName ${encodeMetadata(path)}`,
        `contentType ${encodeMetadata(file.type || "application/octet-stream")}`,
        `cacheControl ${encodeMetadata("3600")}`,
      ].join(","),
      "x-upsert": "false",
    },
  });
  if (!createResponse.ok)
    throw new Error(
      `The secure upload could not be started (${createResponse.status}).`,
    );
  const location = createResponse.headers.get("location");
  if (!location)
    throw new Error(
      "The upload service did not return a resumable upload location.",
    );
  const uploadUrl = new URL(location, resumableEndpoint()).toString();

  let offset = 0;
  onProgress?.(offset, file.size);
  while (offset < file.size) {
    const end = Math.min(file.size, offset + RESUMABLE_UPLOAD_CHUNK_BYTES);
    try {
      const response = await fetchWithRetry(uploadUrl, {
        method: "PATCH",
        headers: {
          ...headers,
          "content-type": "application/offset+octet-stream",
          "upload-offset": String(offset),
        },
        body: file.slice(offset, end),
      });
      if (!response.ok)
        throw new Error(
          `The secure upload stopped unexpectedly (${response.status}).`,
        );
      const nextOffset = Number(response.headers.get("upload-offset"));
      offset =
        Number.isSafeInteger(nextOffset) && nextOffset > offset
          ? nextOffset
          : end;
    } catch (error) {
      const serverOffset = await readServerOffset(uploadUrl, headers);
      if (serverOffset <= offset) throw error;
      offset = serverOffset;
    }
    onProgress?.(Math.min(offset, file.size), file.size);
  }
}

/**
 * Upload small documents with the normal Storage API and large documents with
 * Supabase's 6 MiB TUS protocol. Large uploads go directly to the storage host,
 * expose byte progress, and resume after transient network failures.
 */
export async function uploadCertificationFile(
  bucket: string,
  path: string,
  file: File,
  onProgress?: CertificationUploadProgress,
): Promise<CertificationUploadResult> {
  const startedAt = performance.now();
  if (file.size <= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    onProgress?.(0, file.size);
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: false });
    if (error) throw error;
    onProgress?.(file.size, file.size);
    return { transport: "standard", durationMs: performance.now() - startedAt };
  }

  await uploadWithTus(bucket, path, file, onProgress);
  return { transport: "tus", durationMs: performance.now() - startedAt };
}

