import { mkdirSync, writeFileSync } from 'node:fs';
import { PLACES } from '../src/places/index';
import { bbox } from '../src/places/geometry';

mkdirSync('docs/place-previews', { recursive: true });
for (const p of PLACES) {
  const b = bbox(p.outer);
  const pad = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.05;
  const vb = [b.minX - pad, b.minZ - pad, b.maxX - b.minX + 2 * pad, b.maxZ - b.minZ + 2 * pad].join(' ');
  const path = (r: [number, number][]) => 'M' + r.map(([x, z]) => `${x},${z}`).join('L') + 'Z';
  const sw = (b.maxX - b.minX) / 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="800">
<path d="${[p.outer, ...p.holes].map(path).join(' ')}" fill="#e3dfd7" fill-rule="evenodd" stroke="#2b2925" stroke-width="${sw}"/>
<circle cx="0" cy="0" r="${sw * 6}" fill="#d63c2f"/>
<text x="${b.minX}" y="${b.minZ - pad / 3}" font-size="${sw * 14}">${p.name} · ${Math.round(p.areaM2).toLocaleString()} m² · red dot = focus</text>
</svg>`;
  writeFileSync(`docs/place-previews/${p.id}.svg`, svg);
}
console.log('wrote docs/place-previews/*.svg');
