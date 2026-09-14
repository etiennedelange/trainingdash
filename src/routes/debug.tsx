import { Fragment, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { webhookEventsQuery } from "@/lib/queries";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";

function outcomeColor(outcome: string): string {
  if (outcome === "ok") return "text-emerald-500";
  if (outcome === "forbidden" || outcome === "bad_token" || outcome === "bad_json") return "text-amber-500";
  return "text-red-500";
}

function formatPayload(payload: string | null): string {
  if (!payload) return "";
  try {
    return JSON.stringify(JSON.parse(payload), null, 2);
  } catch {
    return payload;
  }
}

export function Debug() {
  const { data, isPending, isError, error, refetch } = useQuery(webhookEventsQuery);
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="webhook events" />;

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Debug</h1>
      <p className="mt-2 text-sm text-muted">
        Recent Strava webhook deliveries — subscription-validation pings and event payloads, newest first.
      </p>

      {data.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No webhook activity recorded yet.</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-surface)]">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-line text-muted">
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Kind</th>
                <th className="p-3 font-semibold">Object</th>
                <th className="p-3 font-semibold">Aspect</th>
                <th className="p-3 font-semibold">Owner</th>
                <th className="p-3 font-semibold">Outcome</th>
                <th className="p-3 font-semibold">Detail</th>
                <th className="p-3 font-semibold">Payload</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {data.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-b border-line last:border-0">
                    <td className="p-3 whitespace-nowrap text-faint">
                      {new Date(row.received_at).toLocaleString()}
                    </td>
                    <td className="p-3">{row.kind}</td>
                    <td className="p-3">
                      {row.object_type ? `${row.object_type}/${row.object_id}` : "—"}
                    </td>
                    <td className="p-3">{row.aspect_type ?? "—"}</td>
                    <td className="p-3">{row.owner_id ?? "—"}</td>
                    <td className={`p-3 font-bold ${outcomeColor(row.outcome)}`}>{row.outcome}</td>
                    <td className="max-w-[220px] truncate p-3 text-faint" title={row.detail ?? undefined}>
                      {row.detail ?? "—"}
                    </td>
                    <td className="p-3">
                      {row.payload ? (
                        <button
                          type="button"
                          onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                          className="font-sans text-xs font-bold text-accent hover:underline"
                        >
                          {expanded === row.id ? "hide" : "view"}
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                  {expanded === row.id ? (
                    <tr className="border-b border-line last:border-0">
                      <td colSpan={8} className="bg-raised/40 p-3">
                        <div className="mb-1 font-sans text-[11px] font-bold text-muted uppercase">
                          Webhook payload (what Strava actually sent)
                        </div>
                        <pre className="max-h-60 overflow-auto text-[11px] whitespace-pre-wrap text-text">
                          {formatPayload(row.payload)}
                        </pre>
                        {row.activity_raw ? (
                          <>
                            <div className="mt-3 mb-1 font-sans text-[11px] font-bold text-muted uppercase">
                              Fetched activity data ({Math.round(row.activity_raw.length / 1024)} KB from the Strava
                              API call this event triggered)
                            </div>
                            <pre className="max-h-96 overflow-auto text-[11px] whitespace-pre-wrap text-text">
                              {formatPayload(row.activity_raw)}
                            </pre>
                          </>
                        ) : null}
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/debug",
  component: Debug,
});
