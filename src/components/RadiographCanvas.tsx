"use client";

import Konva from "konva";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Group,
  Image as KonvaImage,
  Label,
  Layer,
  Line,
  Stage,
  Tag,
  Text,
} from "react-konva";

import {
  getBaseTransform,
  getToothPrimaryColor,
  getZoomTransform,
  HIGHLIGHT_COLORS,
  polygonToKonvaPoints,
} from "@/lib/canvasOps";
import type { HighlightColor } from "@/types/script";
import type { SpatialContext, ThakaaMedBoundingBox, ThakaaMedCoordinatePair } from "@/types/thakaamed";

interface HighlightOverlay {
  id: string;
  polygon: ThakaaMedCoordinatePair[];
  color: HighlightColor;
  opacity: number;
  label?: string;
}

export interface RadiographCanvasHandle {
  zoomToTooth: (toothId: string) => Promise<void>;
  highlightRegion: (
    toothId: string,
    color?: HighlightColor,
    opacity?: number,
    label?: string,
  ) => Promise<void>;
  highlightPolygon: (
    id: string,
    polygon: ThakaaMedCoordinatePair[],
    color?: HighlightColor,
    opacity?: number,
    label?: string,
  ) => Promise<void>;
  annotate: (toothId: string, label: string) => Promise<void>;
  resetView: () => Promise<void>;
}

interface RadiographCanvasProps {
  imageSrc: string | null;
  spatialContext: SpatialContext | null;
  selectedToothId: string | null;
  selectedAreaPolygon?: ThakaaMedCoordinatePair[] | null;
  onToothSelect: (toothId: string) => void;
}

const LABEL_VERTICAL_OFFSET = 18;

function getPolygonBounds(polygon: ThakaaMedCoordinatePair[]): ThakaaMedBoundingBox {
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  return {
    xmin: Math.min(...xs),
    ymin: Math.min(...ys),
    xmax: Math.max(...xs),
    ymax: Math.max(...ys),
  };
}

export const RadiographCanvas = forwardRef<
  RadiographCanvasHandle,
  RadiographCanvasProps
>(function RadiographCanvas(
  { imageSrc, spatialContext, selectedToothId, selectedAreaPolygon = null, onToothSelect },
  ref,
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const groupRef = useRef<Konva.Group | null>(null);
  const [containerWidth, setContainerWidth] = useState(960);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [imageSize, setImageSize] = useState({ width: 2440, height: 1280 });
  const [activeToothId, setActiveToothId] = useState<string | null>(null);
  const [overlays, setOverlays] = useState<HighlightOverlay[]>([]);
  const transformRef = useRef({ x: 0, y: 0, scale: 1 });

  useEffect(() => {
    if (!imageSrc) {
      setImageElement(null);
      return;
    }

    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      setImageElement(image);
      setImageSize({ width: image.width, height: image.height });
    };
    image.src = imageSrc;
  }, [imageSrc]);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 960;
      setContainerWidth(Math.max(320, width));
    });

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const stageWidth = containerWidth;
  const stageHeight = useMemo(
    () => Math.max(320, (containerWidth * imageSize.height) / imageSize.width),
    [containerWidth, imageSize.height, imageSize.width],
  );
  const baseTransform = useMemo(
    () => getBaseTransform(stageWidth, imageSize.width),
    [imageSize.width, stageWidth],
  );

  const applyTransformImmediately = useCallback((transform: { x: number; y: number; scale: number }) => {
    const node = groupRef.current;
    transformRef.current = transform;
    if (!node) {
      return;
    }

    node.setAttrs({
      x: transform.x,
      y: transform.y,
      scaleX: transform.scale,
      scaleY: transform.scale,
    });
    node.getLayer()?.batchDraw();
  }, []);

  useEffect(() => {
    applyTransformImmediately(baseTransform);
  }, [applyTransformImmediately, baseTransform, imageSrc]);

  const animateTo = useCallback(
    async (transform: { x: number; y: number; scale: number }, durationMs = 650) => {
      const node = groupRef.current;
      const current = transformRef.current;
      if (
        Math.abs(current.x - transform.x) < 0.5 &&
        Math.abs(current.y - transform.y) < 0.5 &&
        Math.abs(current.scale - transform.scale) < 0.005
      ) {
        return;
      }

      if (!node) {
        applyTransformImmediately(transform);
        return;
      }

      await new Promise<void>((resolve) => {
        node.to({
          x: transform.x,
          y: transform.y,
          scaleX: transform.scale,
          scaleY: transform.scale,
          duration: durationMs / 1000,
          easing: Konva.Easings.EaseInOut,
          onFinish: () => {
            transformRef.current = transform;
            resolve();
          },
        });
      });
    },
    [applyTransformImmediately],
  );

  useImperativeHandle(
    ref,
    () => ({
      async zoomToTooth(toothId) {
        const tooth = spatialContext?.teeth[toothId];
        if (!tooth) {
          return;
        }

        setActiveToothId(toothId);
        await animateTo(
          getZoomTransform({
            bbox: tooth.bbox,
            stageWidth,
            stageHeight,
          }),
        );
      },
      async highlightRegion(toothId, color, opacity = 0.35, label) {
        const tooth = spatialContext?.teeth[toothId];
        if (!tooth) {
          return;
        }

        setActiveToothId(toothId);
        setOverlays((current) => {
          const nextColor = color ?? getToothPrimaryColor(tooth);
          const nextId = `tooth:${toothId}`;
          const filtered = current.filter((item) => item.id !== nextId);
          return [
            ...filtered,
            {
              id: nextId,
              polygon: tooth.polygon,
              color: nextColor,
              opacity,
              label,
            },
          ];
        });

        await new Promise((resolve) => window.setTimeout(resolve, 180));
      },
      async highlightPolygon(id, polygon, color = "yellow", opacity = 0.3, label) {
        if (!polygon.length) {
          return;
        }

        const bbox = getPolygonBounds(polygon);
        await animateTo(
          getZoomTransform({
            bbox,
            stageWidth,
            stageHeight,
            maxZoom: 2.2,
          }),
          550,
        );

        setOverlays((current) => {
          const nextId = `area:${id}`;
          const filtered = current.filter((item) => item.id !== nextId);
          return [...filtered, { id: nextId, polygon, color, opacity, label }];
        });
      },
      async annotate(toothId, label) {
        setOverlays((current) =>
          current.map((item) =>
            item.id === `tooth:${toothId}` ? { ...item, label } : item,
          ),
        );
      },
      async resetView() {
        setActiveToothId(null);
        setOverlays([]);
        await animateTo(baseTransform, 500);
      },
    }),
    [animateTo, baseTransform, spatialContext, stageHeight, stageWidth],
  );

  const selectedTooth =
    (selectedToothId && spatialContext?.teeth[selectedToothId]) ||
    (activeToothId && spatialContext?.teeth[activeToothId]) ||
    null;

  return (
    <section className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-2xl shadow-slate-950/30">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 px-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.32em] text-cyan-200">
            Radiograph canvas
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Interactive clinical canvas</h2>
        </div>
        <div className="rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-300">
          {spatialContext?.imageType ?? "Waiting for image"}
        </div>
      </div>

      <div ref={containerRef} className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-950/90">
        {imageElement ? (
          <Stage width={stageWidth} height={stageHeight}>
            <Layer>
              <Group ref={groupRef}>
                <KonvaImage image={imageElement} width={imageSize.width} height={imageSize.height} />

                {selectedTooth && (
                  <Line
                    points={polygonToKonvaPoints(selectedTooth.polygon)}
                    closed
                    stroke="#67e8f9"
                    strokeWidth={5}
                    opacity={0.7}
                    listening={false}
                  />
                )}

                {selectedAreaPolygon && (
                  <Line
                    points={polygonToKonvaPoints(selectedAreaPolygon)}
                    closed
                    stroke="#67e8f9"
                    strokeWidth={5}
                    opacity={0.7}
                    listening={false}
                  />
                )}

                {Object.values(spatialContext?.teeth ?? {}).map((tooth) => (
                  <Line
                    key={tooth.toothId}
                    points={polygonToKonvaPoints(tooth.polygon)}
                    closed
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={2}
                    onClick={() => {
                      setActiveToothId(tooth.toothId);
                      onToothSelect(tooth.toothId);
                    }}
                  />
                ))}

                {overlays.map((overlay) => {
                  const [x, y] = overlay.polygon[0] ?? [0, 0];
                  return (
                    <Group key={overlay.id}>
                      <Line
                        points={polygonToKonvaPoints(overlay.polygon)}
                        closed
                        fill={HIGHLIGHT_COLORS[overlay.color]}
                        opacity={overlay.opacity}
                        stroke={HIGHLIGHT_COLORS[overlay.color]}
                        strokeWidth={4}
                        listening={false}
                      />
                      {overlay.label && (
                        <Label x={x} y={y - LABEL_VERTICAL_OFFSET} listening={false}>
                          <Tag fill="rgba(15, 23, 42, 0.92)" cornerRadius={10} />
                          <Text
                            text={overlay.label}
                            fill="#f8fafc"
                            fontSize={20}
                            padding={10}
                            fontStyle="600"
                          />
                        </Label>
                      )}
                    </Group>
                  );
                })}
              </Group>
            </Layer>
          </Stage>
        ) : (
          <div className="flex min-h-[420px] items-center justify-center p-6 text-center text-sm text-slate-400">
            Upload a radiograph or launch the demo to render the Konva teaching canvas.
          </div>
        )}
      </div>
    </section>
  );
});
