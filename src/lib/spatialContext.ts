import {
  type SpatialContext,
  type SpatialFinding,
  type ThakaaMedAnalysisResponse,
  type ThakaaMedBoundingBox,
  type ThakaaMedCoordinatePair,
  type ThakaaMedRegionFinding,
  type ThakaaMedToothFinding,
  type ThakaaMedTreatmentMethod,
} from "@/types/thakaamed";
import { bboxToPolygon } from "@/lib/canvasOps";

function classifyFindingTone(label: string): SpatialFinding["tone"] {
  const normalized = label.toLowerCase();

  if (
    ["caries", "lesion", "infection", "pulp", "abscess", "impacted"].some((term) =>
      normalized.includes(term),
    )
  ) {
    return "urgent";
  }

  if (normalized.includes("bone loss") || normalized.includes("watch")) {
    return "watch";
  }

  if (
    ["filling", "implant", "post", "crown", "root-canal", "restoration"].some((term) =>
      normalized.includes(term),
    )
  ) {
    return "restoration";
  }

  return "healthy";
}

function ensurePolygon(
  polygon: ThakaaMedCoordinatePair[] | undefined,
  fallbackBbox: ThakaaMedBoundingBox,
): ThakaaMedCoordinatePair[] {
  return polygon && polygon.length > 2 ? polygon : bboxToPolygon(fallbackBbox);
}

function normalizeToothFinding(
  toothId: string,
  finding: ThakaaMedToothFinding | ThakaaMedTreatmentMethod,
  kind: SpatialFinding["kind"],
  fallbackBbox: ThakaaMedBoundingBox,
): SpatialFinding {
  return {
    id: `${toothId}:${kind}:${finding.slug}`,
    label: finding.name,
    probability: finding.probability,
    tone: classifyFindingTone(finding.name),
    kind,
    polygon: ensurePolygon(finding.coordinates, fallbackBbox),
    icdCode: "icd_dict" in finding ? finding.icd_dict?.icd_code : undefined,
    icdDescription: "icd_dict" in finding ? finding.icd_dict?.icd_desc : undefined,
  };
}

function normalizeRegionFinding(
  prefix: string,
  finding: ThakaaMedRegionFinding,
  kind: SpatialFinding["kind"],
): SpatialFinding {
  return {
    id: `${prefix}:${finding.slug}`,
    label: finding.name,
    probability: finding.probability,
    tone: classifyFindingTone(finding.name),
    kind,
    polygon: finding.coordinates,
  };
}

export function buildSpatialContext(
  analysis: ThakaaMedAnalysisResponse,
): SpatialContext {
  const entries = Object.entries(analysis.results.tooth_results)
    .map(([toothId, tooth]) => {
      const findings = [
        ...tooth.illnesses.map((finding) =>
          normalizeToothFinding(toothId, finding, "illness", tooth.coordinates),
        ),
        ...tooth.treatment_methods.map((finding) =>
          normalizeToothFinding(toothId, finding, "treatment", tooth.coordinates),
        ),
      ].sort((left, right) => right.probability - left.probability);

      return [
        toothId,
        {
          toothId,
          isMissing: tooth.is_missing,
          confidence: tooth.confidence,
          bbox: tooth.coordinates,
          polygon: ensurePolygon(tooth.list_coordinates, tooth.coordinates),
          findings,
          croppedImage: tooth.cropped_image,
        },
      ] as const;
    })
    .sort((left, right) => Number(left[0]) - Number(right[0]));

  const teeth = Object.fromEntries(entries);
  const orderedTeeth = entries.map(([toothId]) => toothId);
  const palateFindings = analysis.results.palate_results.map((finding) =>
    normalizeRegionFinding("palate", finding, "palate"),
  );
  const regionFindings = analysis.results.illness_pool.map((finding) =>
    normalizeRegionFinding("region", finding, "region"),
  );

  const totalToothFindings = entries.reduce(
    (sum, [, tooth]) => sum + tooth.findings.length,
    0,
  );

  return {
    analysisId: analysis.id,
    imageType: analysis.results.image_type,
    imageSrc: analysis.original_image,
    annotatedImageSrc: analysis.draw_image,
    embedLink: analysis.embeded_link,
    reportLink: analysis.embeded_report_link,
    teeth,
    orderedTeeth,
    palateFindings,
    regionFindings,
    summary: {
      teethWithFindings: entries.filter(([, tooth]) => tooth.findings.length > 0).length,
      totalToothFindings,
      palateFindings: palateFindings.length,
      regionFindings: regionFindings.length,
    },
  };
}

export function getNarratableTeeth(spatialContext: SpatialContext, limit = 6) {
  return Object.values(spatialContext.teeth)
    .filter((tooth) => !tooth.isMissing && tooth.findings.length > 0)
    .sort((left, right) => {
      if (right.findings.length !== left.findings.length) {
        return right.findings.length - left.findings.length;
      }

      return right.confidence - left.confidence;
    })
    .slice(0, limit);
}

export function getAllFindings(spatialContext: SpatialContext) {
  return Object.values(spatialContext.teeth)
    .flatMap((tooth) =>
      tooth.findings.map((finding) => ({
        toothId: tooth.toothId,
        tooth,
        finding,
      })),
    )
    .sort((left, right) => right.finding.probability - left.finding.probability);
}
