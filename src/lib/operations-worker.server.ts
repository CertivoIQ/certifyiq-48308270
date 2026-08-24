import { supabaseAdmin } from "@/integrations/supabase/client.server";

type RpcResult<T> = { data: T | null; error: { message: string } | null };
type OperationsRpc = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<RpcResult<unknown>>;
};

const db = supabaseAdmin as unknown as OperationsRpc;

export async function reapStaleOperationsLeases(): Promise<number> {
  const { data, error } = await db.rpc("operations_reap_stale_leases");
  if (error) throw new Error(error.message);
  return Number(data ?? 0);
}

export async function claimOperationsJob(worker: string, leaseSeconds = 120) {
  const { data, error } = await db.rpc("operations_claim_job", {
    _worker: worker,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(error.message);
  return data as Record<string, unknown> | null;
}

export async function heartbeatOperationsJob(jobId: string, worker: string, leaseSeconds = 120) {
  const { data, error } = await db.rpc("operations_heartbeat", {
    _job_id: jobId,
    _worker: worker,
    _lease_seconds: leaseSeconds,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function completeOperationsJob(jobId: string, worker: string, result: Record<string, unknown>) {
  const { data, error } = await db.rpc("operations_complete_job", {
    _job_id: jobId,
    _worker: worker,
    _result: result,
  });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function failOperationsJob(jobId: string, worker: string, errorDetail: Record<string, unknown>) {
  const { data, error } = await db.rpc("operations_fail_job", {
    _job_id: jobId,
    _worker: worker,
    _error: errorDetail,
  });
  if (error) throw new Error(error.message);
  return data;
}
