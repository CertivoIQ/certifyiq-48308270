import { authorizeOperationsAction, nextFailureState } from "./operations-policy.mjs";

export const DEFAULT_LEASE_SECONDS = 120;
export const MAX_LEASE_SECONDS = 900;

export function validateWorkerRequest({ worker, leaseSeconds = DEFAULT_LEASE_SECONDS }) {
  if (typeof worker !== "string" || !worker.trim()) {
    return { valid: false, reason: "WORKER_REQUIRED" };
  }
  if (!Number.isInteger(leaseSeconds) || leaseSeconds < 30 || leaseSeconds > MAX_LEASE_SECONDS) {
    return { valid: false, reason: "INVALID_LEASE_DURATION" };
  }
  return { valid: true, worker: worker.trim(), leaseSeconds };
}

export function leaseIsOwned(job, worker, now = new Date()) {
  return Boolean(
    job &&
      job.status === "running" &&
      job.leaseOwner === worker &&
      Date.parse(job.leaseExpiresAt) > now.getTime(),
  );
}

export function planJobExecution({ job, worker, approval, now = new Date() }) {
  if (!leaseIsOwned(job, worker, now)) {
    return { execute: false, reason: "VALID_WORKER_LEASE_REQUIRED" };
  }
  const authorization = authorizeOperationsAction({
    riskTier: job.riskTier,
    action: job.action,
    actorId: worker,
    approval,
    sourceEvidence: job.sourceEvidence,
    deterministicValidation: job.deterministicValidation,
    now,
  });
  return authorization.allowed
    ? { execute: true, reason: authorization.reason }
    : { execute: false, reason: authorization.reason };
}

export function planWorkerFailure(job) {
  return nextFailureState({ attempts: job.attempts, maxAttempts: job.maxAttempts });
}

export function healthSummary({ jobs, now = new Date(), staleAfterMs = 300_000 }) {
  const rows = Array.isArray(jobs) ? jobs : [];
  const running = rows.filter((job) => job.status === "running");
  const stale = running.filter((job) => {
    const heartbeat = Date.parse(job.heartbeatAt ?? "");
    return !Number.isFinite(heartbeat) || now.getTime() - heartbeat > staleAfterMs;
  });
  const ready = rows.filter((job) => ["queued", "retry_wait"].includes(job.status));
  return {
    healthyRunning: running.length - stale.length,
    staleRunning: stale.length,
    awaitingApproval: rows.filter((job) => job.status === "awaiting_approval").length,
    quarantined: rows.filter((job) => job.status === "quarantined").length,
    oldestReadyAt: ready.map((job) => job.scheduledAt).sort()[0] ?? null,
    alert: stale.length > 0 || rows.some((job) => job.status === "quarantined"),
  };
}
