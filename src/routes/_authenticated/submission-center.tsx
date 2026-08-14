import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  LockKeyhole,
  Send,
} from "lucide-react";

import {
  getSubmissionAuthority,
  listCertificationItems,
} from "@/utils/certification-review.functions";

export const Route = createFileRoute("/_authenticated/submission-center")({
  component: SubmissionCenterPage,
});

type SubmissionAuthorityResult = Awaited<
  ReturnType<typeof getSubmissionAuthority>
>;

function SubmissionCenterPage() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listCertificationItems>>
  >([]);
  const [selectedItemId, setSelectedItemId] = useState("");
  const [authority, setAuthority] =
    useState<SubmissionAuthorityResult | null>(null);
  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingAuthority, setLoadingAuthority] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadItems() {
      try {
        setLoadingItems(true);

        const result = await listCertificationItems();

        if (cancelled) return;

        setItems(result);

        const firstCompleted =
          result.find((item) => item.status === "completed") ?? result[0];

        if (firstCompleted) {
          setSelectedItemId(firstCompleted.id);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Certification records could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingItems(false);
        }
      }
    }

    void loadItems();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedItemId) {
      setAuthority(null);
      return;
    }

    let cancelled = false;

    async function loadAuthority() {
      try {
        setLoadingAuthority(true);
        setMessage("");

        const result = await getSubmissionAuthority({
          data: {
            itemId: selectedItemId,
          },
        });

        if (!cancelled) {
          setAuthority(result);
        }
      } catch (error) {
        if (!cancelled) {
          setAuthority(null);
          setMessage(
            error instanceof Error
              ? error.message
              : "Submission authority could not be evaluated.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingAuthority(false);
        }
      }
    }

    void loadAuthority();

    return () => {
      cancelled = true;
    };
  }, [selectedItemId]);

  const canSubmit =
    authority?.submissionAuthority === "ALLOWED" &&
    authority?.submissionStatus === "SUBMISSION_AUTHORIZED";

  function prepareSubmission() {
    if (!authority || !canSubmit) {
      setMessage(
        "Submission is blocked until all certification authority requirements are satisfied.",
      );
      return;
    }

    setMessage(
      `Submission package authorized for certification ${authority.itemId}. The current evidence manifest and human approvals have been validated. External delivery remains a separate controlled step.`,
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Send className="h-4 w-4" />
          Certification Submission Center™
        </div>

        <h1 className="mt-2 text-3xl font-semibold">
          Submit only after validated human approval.
        </h1>

        <p className="mt-2 text-muted-foreground">
          CertivoIQ verifies the current certification record, evidence
          manifest, findings, and persisted human approvals before a submission
          package can be authorized.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-primary" />

          <div>
            <h2 className="font-semibold">Compliance Approval Center™</h2>
            <p className="text-sm text-muted-foreground">
              Submission authority is calculated from persisted review records.
              A local checkbox cannot authorize transmission.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <label htmlFor="certification-item" className="text-sm font-medium">
            Certification
          </label>

          <select
            id="certification-item"
            value={selectedItemId}
            onChange={(event) => setSelectedItemId(event.target.value)}
            disabled={loadingItems}
            className="w-full rounded-md border bg-background px-3 py-2"
          >
            {!items.length && (
              <option value="">
                {loadingItems
                  ? "Loading certifications..."
                  : "No certifications available"}
              </option>
            )}

            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.original_file_name ?? item.id} — {item.status}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-6 rounded-lg border p-4">
          {loadingAuthority ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Evaluating submission authority...
            </div>
          ) : authority ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {canSubmit ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-muted-foreground" />
                )}

                <span className="font-medium">
                  {authority.submissionStatus}
                </span>
              </div>

              {"reason" in authority && authority.reason && (
                <p className="text-sm text-muted-foreground">
                  {authority.reason}
                </p>
              )}

              {"manifestSha256" in authority && authority.manifestSha256 && (
                <p className="break-all text-xs text-muted-foreground">
                  Manifest: {authority.manifestSha256}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Select a certification to evaluate its submission authority.
            </p>
          )}
        </div>

        <button
          disabled={!canSubmit || loadingAuthority}
          onClick={prepareSubmission}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          <CheckCircle2 className="h-4 w-4" />
          Prepare submission package
        </button>

        {message && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
