import type {
  FindingTone,
  SpatialFinding,
  SpatialTooth,
  ThakaaMedBoundingBox,
  ThakaaMedCoordinatePair,
} from "@/types/thakaamed";
import type { HighlightColor } from "@/types/script";

export interface CanvasTransform {
  x: number;
  y: number;
  scale: number;
}

export const HIGHLIGHT_COLORS: Record<HighlightColor, string> = {
  red: "#ef4444",
  yellow: "#facc15",
  green: "#22c55e",
  blue: "#3b82f6",
};

export function toneToHighlightColor(tone: FindingTone): HighlightColor {
  switch (tone) {
    case "urgent":
      return "red";
    case "watch":
      return "yellow";
    case "healthy":
      return "green";
    default:
      return "blue";
  }
}

export function getToothPrimaryColor(tooth: SpatialTooth): HighlightColor {
  return toneToHighlightColor(tooth.findings[0]?.tone ?? "healthy");
}

export function polygonToKonvaPoints(polygon: ThakaaMedCoordinatePair[]): number[] {
  return polygon.flatMap(([x, y]) => [x, y]);
}

export function bboxToPolygon(bbox: ThakaaMedBoundingBox): ThakaaMedCoordinatePair[] {
  return [
    [bbox.xmin, bbox.ymin],
    [bbox.xmax, bbox.ymin],
    [bbox.xmax, bbox.ymax],
    [bbox.xmin, bbox.ymax],
  ];
}

export function getBaseTransform(stageWidth: number, imageWidth: number): CanvasTransform {
  const scale = imageWidth === 0 ? 1 : stageWidth / imageWidth;
  return { x: 0, y: 0, scale };
}

export function getZoomTransform(options: {
  bbox: ThakaaMedBoundingBox;
  stageWidth: number;
  stageHeight: number;
  maxZoom?: number;
}): CanvasTransform {
  const { bbox, stageWidth, stageHeight, maxZoom = 2.75 } = options;
  const width = Math.max(120, bbox.xmax - bbox.xmin);
  const height = Math.max(120, bbox.ymax - bbox.ymin);
  const targetScale = Math.min(
    maxZoom,
    stageWidth / (width * 1.8),
    stageHeight / (height * 2.1),
  );
  const centerX = (bbox.xmin + bbox.xmax) / 2;
  const centerY = (bbox.ymin + bbox.ymax) / 2;

  return {
    scale: targetScale,
    x: stageWidth / 2 - centerX * targetScale,
    y: stageHeight / 2 - centerY * targetScale,
  };
}

export function getLabelAnchor(
  finding: SpatialFinding | undefined,
  fallback: ThakaaMedBoundingBox,
): { x: number; y: number } {
  if (!finding?.polygon.length) {
    return { x: fallback.xmin, y: fallback.ymin - 18 };
  }

  const [firstX, firstY] = finding.polygon[0];
  return { x: firstX, y: firstY - 18 };
}
