import * as THREE from 'three';
import { parseTileKey } from './tileSet';

export interface BuiltTile { obj: THREE.Mesh | THREE.Points; count: number; }
type Entry = BuiltTile | null; // null = tile has nobody in it; remembered so it isn't rebuilt

export class TileManager {
  readonly group = new THREE.Group();
  private tiles = new Map<string, Entry>();

  constructor(private readonly build: (tx: number, tz: number) => BuiltTile | null) {}

  /** Drop tiles no longer wanted, then build missing ones nearest-first until the deadline. */
  sync(wanted: string[], deadline: number): void {
    const want = new Set(wanted);
    for (const [k, t] of this.tiles) {
      if (!want.has(k)) {
        this.drop(t);
        this.tiles.delete(k);
      }
    }
    for (const k of wanted) {
      if (this.tiles.has(k)) continue;
      if (performance.now() >= deadline) break;
      const [tx, tz] = parseTileKey(k);
      const t = this.build(tx, tz);
      this.tiles.set(k, t);
      if (t) this.group.add(t.obj);
    }
  }

  clear(): void {
    for (const t of this.tiles.values()) this.drop(t);
    this.tiles.clear();
  }

  count(): number {
    let n = 0;
    for (const t of this.tiles.values()) if (t) n += t.count;
    return n;
  }

  private drop(t: Entry): void {
    if (!t) return;
    this.group.remove(t.obj);
    t.obj.geometry.dispose();
  }
}
