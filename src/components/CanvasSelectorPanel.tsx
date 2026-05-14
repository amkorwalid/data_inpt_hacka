"use client";

import { toneToHighlightColor } from "@/lib/canvasOps";
import type { SpatialContext, SpatialFinding } from "@/types/thakaamed";

interface CanvasSelectorPanelProps {
  spatialContext: SpatialContext | null;
  selectedToothId: string | null;
  selectedAreaId: string | null;
  onSelectTooth: (toothId: string) => void;
  onSelectArea: (area: SpatialFinding) => void;
}

export function CanvasSelectorPanel({
  spatialContext,
  selectedToothId,
  selectedAreaId,
  onSelectTooth,
  onSelectArea,
}: CanvasSelectorPanelProps) {
  const teeth = spatialContext
    ? spatialContext.orderedTeeth.map((toothId) => spatialContext.teeth[toothId]).filter(Boolean)
    : [];
  const areas = spatialContext ? [...spatialContext.palateFindings, ...spatialContext.regionFindings] : [];
  const dotClassByColor = {
    red: "bg-red-400",
    yellow: "bg-yellow-300",
    green: "bg-green-400",
    blue: "bg-blue-400",
  } as const;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30">
      <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">Canvas selector</p>
      <h2 className="mt-2 text-lg font-semibold text-white">Tooth + polygon controls</h2>

      <div className="mt-4 space-y-3">
        <details open className="rounded-2xl border border-white/10 bg-slate-950/50">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-100">
            Teeth ({teeth.length})
          </summary>
          <div className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3">
            {teeth.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">
                Upload an image or start demo to load teeth.
              </p>
            ) : (
              teeth.map((tooth) => (
                <button
                  key={tooth.toothId}
                  type="button"
                  onClick={() => onSelectTooth(tooth.toothId)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedToothId === tooth.toothId
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-slate-900 text-slate-200 hover:border-cyan-300"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span>Tooth {tooth.toothId}</span>
                    <span className="text-xs text-slate-400">{tooth.findings.length} finding(s)</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </details>

        <details open className="rounded-2xl border border-white/10 bg-slate-950/50">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold text-slate-100">
            Polygon areas ({areas.length})
          </summary>
          <div className="max-h-72 space-y-2 overflow-y-auto px-3 pb-3">
            {areas.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-700 p-3 text-xs text-slate-400">
                No palate/region polygons available for this image.
              </p>
            ) : (
              areas.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  onClick={() => onSelectArea(area)}
                  className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                    selectedAreaId === area.id
                      ? "border-cyan-400 bg-cyan-400/10 text-cyan-100"
                      : "border-white/10 bg-slate-900 text-slate-200 hover:border-cyan-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span>{area.label}</span>
                    <span
                      className={`mt-0.5 inline-block size-2 rounded-full ${
                        dotClassByColor[toneToHighlightColor(area.tone)]
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{area.probability.toFixed(1)}% confidence</p>
                </button>
              ))
            )}
          </div>
        </details>
      </div>
    </section>
  );
}
