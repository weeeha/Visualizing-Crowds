import { mkdirSync, writeFileSync } from 'node:fs';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { RECIPES, type Recipe } from './place-recipes';
import { projector, simplify, type LonLat } from './geo';
import { ringArea } from '../src/places/geometry';
import { validatePlace } from '../src/places/validate';
import type { Place, Ring } from '../src/places/types';

const UA = 'visualizing-crowds/0.1 (https://github.com/weeeha/Visualizing-Crowds)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round2 = ([x, z]: [number, number]): [number, number] => [Math.round(x * 100) / 100, Math.round(z * 100) / 100];

async function fetchPolygons(osmId: string): Promise<LonLat[][][]> {
  const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&polygon_geojson=1&osm_ids=${osmId}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${osmId}: HTTP ${res.status}`);
  const hits = (await res.json()) as { geojson: { type: string; coordinates: unknown } }[];
  await sleep(1100); // Nominatim policy: at most 1 request per second
  if (!hits[0]) throw new Error(`${osmId}: not found`);
  const g = hits[0].geojson;
  if (g.type === 'Polygon') return [g.coordinates as LonLat[][]];
  if (g.type === 'MultiPolygon') return g.coordinates as LonLat[][][];
  throw new Error(`${osmId}: unsupported geometry ${g.type}`);
}

function bboxCenter(polys: LonLat[][][]): [number, number] {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of polys) for (const [lon, lat] of p[0]) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

const polyArea = (p: Polygon) => Math.abs(ringArea(p[0] as Ring));
const largest = (mp: MultiPolygon): Polygon => mp.reduce((a, b) => (polyArea(b) > polyArea(a) ? b : a));

async function extract(r: Recipe): Promise<Place> {
  const outerFeatures: LonLat[][][][] = [];
  for (const id of r.outer) outerFeatures.push(await fetchPolygons(id));
  const [lat, lon] = r.focus === 'centroid' ? bboxCenter(outerFeatures[0]) : r.focus;
  const proj = projector(lat, lon);

  const outerGeoms: Polygon[] = outerFeatures.flatMap((f) =>
    f.map((poly) => (r.keepOwnHoles ? poly : poly.slice(0, 1)).map((ring) => ring.map(proj))),
  );
  if (r.corridor) {
    // The strip runs the full east-west length of the outer features so it bridges the
    // streets that separate the parks; its north-south band comes from the corridor feature.
    const pts = (await fetchPolygons(r.corridor.around)).flatMap((p) => p[0].map(proj));
    const xs = outerGeoms.flatMap((g) => g[0].map((p) => p[0])), zs = pts.map((p) => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = [Math.min(...zs) - r.corridor.padNS, Math.max(...zs) + r.corridor.padNS];
    outerGeoms.push([[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]]);
  }

  const union = polygonClipping.union(outerGeoms[0], ...outerGeoms.slice(1));
  if (union.length > 1) {
    console.warn(`${r.id}: union has ${union.length} parts (m²: ${union.map((p) => Math.round(polyArea(p))).join(', ')}); keeping the largest`);
  }
  let shape: MultiPolygon = [largest(union)];
  if (r.holes.length) {
    const holeGeoms: Polygon[] = [];
    for (const id of r.holes) for (const p of await fetchPolygons(id)) holeGeoms.push([p[0].map(proj)]);
    shape = polygonClipping.difference(shape, ...holeGeoms);
  }

  const [outerRaw, ...holesRaw] = largest(shape);
  const outer = simplify(outerRaw as Ring, r.tolerance).map(round2);
  const holes = holesRaw
    .map((h) => simplify(h as Ring, r.tolerance).map(round2))
    .filter((h) => h.length >= 4 && Math.abs(ringArea(h)) >= 20);
  const areaM2 = Math.abs(ringArea(outer)) - holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  const ids = [...r.outer, ...(r.corridor ? [r.corridor.around] : []), ...r.holes];

  const place: Place = {
    id: r.id,
    name: r.name,
    outer,
    holes,
    focus: [0, 0],
    areaM2: Math.round(areaM2),
    source: `OpenStreetMap ${ids.join(', ')} via Nominatim (ODbL), focus ${lat.toFixed(5)}, ${lon.toFixed(5)}, extracted ${new Date().toISOString().slice(0, 10)}`,
  };
  const errors = validatePlace(place);
  if (errors.length) throw new Error(`${r.id} failed validation:\n  ${errors.join('\n  ')}\nTry a smaller tolerance.`);
  return place;
}

const wanted = process.argv.slice(2);
mkdirSync('src/places/data', { recursive: true });
for (const r of RECIPES.filter((x) => wanted.length === 0 || wanted.includes(x.id))) {
  const place = await extract(r);
  writeFileSync(`src/places/data/${r.id}.json`, JSON.stringify(place) + '\n');
  console.log(`${r.id}: ${place.outer.length} outer pts, ${place.holes.length} holes, ${Math.round(place.areaM2).toLocaleString()} m²`);
}
