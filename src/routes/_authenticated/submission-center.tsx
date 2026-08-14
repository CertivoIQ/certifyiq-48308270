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

import {
  createHfaSubmissionDraft,
  listHfaDestinationOptions,
} from "@/utils/hfa-submission.functions";

export const Route = createFileRoute("/_authenticated/submission-center")({
  component: SubmissionCenterPage,
});

type SubmissionAuthorityResult = Awaited<
  ReturnType<typeof getSubmissionAuthority>
>;

type HfaDestination = Awaited<
  ReturnType<typeof listHfaDestinationOptions>
>[number];

function SubmissionCenterPage() {
  const [items, setItems] = useState<
    Awaited<ReturnType<typeof listCertificationItems>>
  >([]);

  const [destinations, setDestinations] = useState<HfaDestination[]>([]);

  const [selectedItemId, setSelectedItemId] = useState("");
  const [agencyId, setAgencyId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [propertyName, setPropertyName] = useState("");
  const [program, setProgram] = useState("");
  const [reportingPeriod, setReportingPeriod] = useState("");

  const [authority, setAuthority] =
    useState<SubmissionAuthorityResult | null>(null);

  const [loadingItems, setLoadingItems] = useState(true);
  const [loadingDestinations, setLoadingDestinations] = useState(true);
  const [loadingAuthority, setLoadingAuthority] = useState(false);
  const [preparingDraft, setPreparingDraft] = useState(false);

  const [message, setMessage] = useState("");
  const [draftId, setDraftId] = useState("");

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
    let cancelled = false;

    async function loadDestinations() {
      try {
        setLoadingDestinations(true);

        const result = await listHfaDestinationOptions();

        if (cancelled) return;

        setDestinations(result);

        if (result.length) {
          setAgencyId(result[0].id);
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "HFA destinations could not be loaded.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingDestinations(false);
        }
      }
    }

    void loadDestinations();

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
        setDraftId("");

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

  const metadataComplete =
    Boolean(agencyId.trim()) &&
    Boolean(propertyId.trim()) &&
    Boolean(program.trim()) &&
    Boolean(reportingPeriod.trim());

  async function prepareSubmission() {
    if (!authority || !canSubmit) {
      setMessage(
        "Submission is blocked until all certification authority requirements are satisfied.",
      );
      return;
    }

    if (!metadataComplete) {
      setMessage(
        "Destination HFA, property ID, program, and reporting period are required.",
      );
      return;
    }

    try {
      setPreparingDraft(true);
      setMessage("");
      setDraftId("");

      const result = await createHfaSubmissionDraft({
        data: {
          certificationId: selectedItemId,
          agencyId,
          propertyId: propertyId.trim(),
          propertyName: propertyName.trim() || undefined,
          program: program.trim(),
          reportingPeriod: reportingPeriod.trim(),
        },
      });

      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setDraftId(result.submissionId);

      setMessage(
        result.existing
          ? `Existing submission draft ${result.submissionId} is already bound to the current evidence manifest.`
          : `Submission draft ${result.submissionId} created and bound to the current evidence manifest. External delivery has not occurred.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "The submission draft could not be prepared.",
      );
    } finally {
      setPreparingDraft(false);
    }
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 p-6 md:p-10">
      <header className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Send className="h-4 w-4" />
          Certification Submission Center™
        </div>

        <h1 className="mt-2 text-3xl font-semibold">
          Prepare an authorized submission package.
        </h1>

        <p className="mt-2 text-muted-foreground">
          CertivoIQ validates the current certification, evidence manifest,
          findings, and persisted human approvals before creating an HFA
          submission draft.
        </p>
      </header>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-3">
          <LockKeyhole className="h-5 w-5 text-primary" />

          <div>
            <h2 className="font-semibold">Compliance Approval Center™</h2>

            <p className="text-sm text-muted-foreground">
              A submission draft can only be prepared after persisted approval
              authority is validated. Preparing a draft does not transmit it.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <label
              htmlFor="certification-item"
              className="text-sm font-medium"
            >
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

          <div className="space-y-2 md:col-span-2">
            <label htmlFor="agency" className="text-sm font-medium">
              Destination HFA
            </label>

            <select
              id="agency"
              value={agencyId}
              onChange={(event) => setAgencyId(event.target.value)}
              disabled={loadingDestinations}
              className="w-full rounded-md border bg-background px-3 py-2"
            >
              {!destinations.length && (
                <option value="">
                  {loadingDestinations
                    ? "Loading HFA destinations..."
                    : "No HFA destinations available"}
                </option>
              )}

              {destinations.map((agency) => (
                <option key={agency.id} value={agency.id}>
                  {agency.state_code} — {agency.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label htmlFor="property-id" className="text-sm font-medium">
              Property ID
            </label>

            <input
              id="property-id"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              placeholder="Property identifier"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="property-name" className="text-sm font-medium">
              Property Name
            </label>

            <input
              id="property-name"
              value={propertyName}
              onChange={(event) => setPropertyName(event.target.value)}
              placeholder="Optional property name"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="program" className="text-sm font-medium">
              Program
            </label>

            <input
              id="program"
              value={program}
              onChange={(event) => setProgram(event.target.value)}
              placeholder="e.g. LIHTC"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="reporting-period"
              className="text-sm font-medium"
            >
              Reporting Period
            </label>

            <input
              id="reporting-period"
              value={reportingPeriod}
              onChange={(event) => setReportingPeriod(event.target.value)}
              placeholder="e.g. 2026 Annual"
              className="w-full rounded-md border bg-background px-3 py-2"
            />
          </div>
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

              {"manifestSha256" in authority &&
                authority.manifestSha256 && (
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
          disabled={
            !canSubmit ||
            !metadataComplete ||
            loadingAuthority ||
            preparingDraft
          }
          onClick={() => void prepareSubmission()}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50"
        >
          {preparingDraft ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}

          Prepare submission package
        </button>

        {draftId && (
          <p className="mt-4 break-all text-xs text-muted-foreground">
            Draft ID: {draftId}
          </p>
        )}

        {message && (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
      </section>
    </main>
  );
}
