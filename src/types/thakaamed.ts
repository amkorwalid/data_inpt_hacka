export type ThakaaMedCoordinatePair = [number, number];

export interface ThakaaMedBoundingBox {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  proba?: number;
}

export interface ThakaaMedIcdEntry {
  icd_code?: string;
  icd_desc?: string;
}

export interface ThakaaMedToothFinding {
  name: string;
  slug: string;
  label_slug: string;
  probability: number;
  coordinates?: ThakaaMedCoordinatePair[];
  icd_dict?: ThakaaMedIcdEntry;
}

export interface ThakaaMedTreatmentMethod {
  name: string;
  slug: string;
  label_slug: string;
  probability: number;
  coordinates?: ThakaaMedCoordinatePair[];
}

export interface ThakaaMedRegionFinding {
  name: string;
  slug: string;
  label_slug: string;
  probability: number;
  coordinates: ThakaaMedCoordinatePair[];
}

export interface ThakaaMedToothResult {
  slug: string;
  label_slug: string;
  is_missing: boolean;
  illnesses: ThakaaMedToothFinding[];
  treatment_methods: ThakaaMedTreatmentMethod[];
  coordinates: ThakaaMedBoundingBox;
  list_coordinates: ThakaaMedCoordinatePair[];
  confidence: number;
  cropped_image: string;
}

export interface ThakaaMedResults {
  image_type: string;
  implant_brands: unknown[];
  tooth_results: Record<string, ThakaaMedToothResult>;
  palate_results: ThakaaMedRegionFinding[];
  illness_pool: ThakaaMedRegionFinding[];
  measurement_results: unknown[];
}

export interface ThakaaMedAnalysisResponse {
  id: string;
  is_done: boolean;
  error_status: boolean;
  message: string;
  error_message: string;
  version: string;
  response_time: number;
  original_image: string;
  draw_image: string;
  embeded_link: string;
  embeded_report_link: string;
  results: ThakaaMedResults;
}

export type FindingTone = "urgent" | "watch" | "healthy" | "restoration";
export type SpatialFindingKind = "illness" | "treatment" | "palate" | "region";

export interface SpatialFinding {
  id: string;
  label: string;
  probability: number;
  tone: FindingTone;
  kind: SpatialFindingKind;
  polygon: ThakaaMedCoordinatePair[];
  icdCode?: string;
  icdDescription?: string;
}

export interface SpatialTooth {
  toothId: string;
  isMissing: boolean;
  confidence: number;
  bbox: ThakaaMedBoundingBox;
  polygon: ThakaaMedCoordinatePair[];
  findings: SpatialFinding[];
  croppedImage?: string;
}

export interface SpatialContext {
  analysisId: string;
  imageType: string;
  imageSrc: string;
  annotatedImageSrc: string;
  embedLink: string;
  reportLink: string;
  teeth: Record<string, SpatialTooth>;
  orderedTeeth: string[];
  palateFindings: SpatialFinding[];
  regionFindings: SpatialFinding[];
  summary: {
    teethWithFindings: number;
    totalToothFindings: number;
    palateFindings: number;
    regionFindings: number;
  };
}
