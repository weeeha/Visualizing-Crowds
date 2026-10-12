export const PLACE_IDS = ['open-field', 'times-square', 'national-mall', 'michigan-stadium', 'manhattan'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** Closed ring of [x, z] meters; first point equals last point. */
export type Ring = [number, number][];

export interface Place {
  id: PlaceId;
  name: string;
  outer: Ring;
  holes: Ring[];
  /** Always [0, 0]: coordinates are relative to the focus. */
  focus: [number, number];
  areaM2: number;
  source: string;
}
