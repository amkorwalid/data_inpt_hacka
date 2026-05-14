"use client";

import { getAllFindings } from "@/lib/spatialContext";
import type { SpatialContext } from "@/types/thakaamed";

interface FindingsListProps {
  spatialContext: SpatialContext | null;
  selectedToothId: string | null;
  onSelectTooth: (toothId: string) => void;
}

const TONE_STYLES = {
  urgent: "border-red-500/30 bg-red-500/10 text-red-100",
  watch: "border-yellow-400/30 bg-yellow-400/10 text-yellow-50",
  healthy: "border-green-500/30 bg-green-500/10 text-green-50",
  restoration: "border-blue-500/30 bg-blue-500/10 text-blue-50",
};

export function FindingsList({
  spatialContext,
  selectedToothId,
  onSelectTooth,
}: FindingsListProps) {
  const findings = spatialContext ? getAllFindings(spatialContext) : [];

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-slate-950/30">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
            Findings
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Prioritised teaching list</h2>
        </div>
        <span className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
          {findings.length} items
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {findings.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
            Upload an image or start the demo to populate the findings list.
          </p>
        ) : (
          findings.map(({ toothId, finding, tooth }) => (
            <button
              key={finding.id}
              type="button"
              onClick={() => onSelectTooth(toothId)}
              className={`w-full rounded-2xl border p-4 text-left transition hover:border-cyan-300 ${
                selectedToothId === toothId
                  ? "border-cyan-400 bg-cyan-400/10"
                  : "border-white/10 bg-slate-950/50"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">Tooth {toothId}</p>
                  <p className="mt-1 text-sm text-slate-300">{finding.label}</p>
                </div>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${TONE_STYLES[finding.tone]}`}
                >
                  {finding.tone}
                </span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{Math.round(finding.probability)}% confidence</span>
                <span>{tooth.findings.length} finding(s) on this tooth</span>
              </div>
            </button>
          ))
        )}
      </div>
    </section>
  );
}
