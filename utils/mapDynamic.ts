import { parseTextToLandmarks } from './mapTextParser';

type Landmark = {
  id: string;
  name: string;
  type: "LANDMARK" | "SHOP" | "GUILD" | "FAMILIA_HOME" | "SLUM" | "STREET" | "DUNGEON_ENTRANCE" | "SAFE_ZONE" | "STAIRS_UP" | "STAIRS_DOWN" | "POINT";
  coordinates: { x: number; y: number };
  radius: number;
  description: string;
  floor?: number;
  source?: 'static' | 'dynamic';
  lastSeenAt?: number;
  visited?: boolean;
};

export const mergeDynamicLandmarks = (
  existing: Landmark[],
  incoming: Landmark[],
  opts: { maxPerFloor: number }
) => {
  const merged: Landmark[] = [...existing];

  for (const item of incoming) {
    const dup = merged.find(l =>
      l.name === item.name &&
      (l.floor || 0) === (item.floor || 0) &&
      Math.hypot(l.coordinates.x - item.coordinates.x, l.coordinates.y - item.coordinates.y) < 50
    );
    if (dup) {
      dup.lastSeenAt = Math.max(dup.lastSeenAt || 0, item.lastSeenAt || 0);
    } else {
      merged.push({
        ...item,
        id: item.id || `dyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      });
    }
  }

  const byFloor = new Map<number, Landmark[]>();
  merged
    .filter(l => l.source === 'dynamic')
    .forEach(l => {
      const floor = l.floor || 0;
      const list = byFloor.get(floor) || [];
      list.push(l);
      byFloor.set(floor, list);
    });

  for (const [floor, list] of byFloor.entries()) {
    list.sort((a, b) => (b.lastSeenAt || 0) - (a.lastSeenAt || 0));
    const keep = list.slice(0, opts.maxPerFloor);
    const keepIds = new Set(keep.map(i => i.id));
    for (let i = merged.length - 1; i >= 0; i--) {
      const item = merged[i];
      if (item.source === 'dynamic' && (item.floor || 0) === floor && !keepIds.has(item.id)) {
        merged.splice(i, 1);
      }
    }
  }

  return merged;
};

export const applyDynamicLandmarks = ({
  mapData,
  text,
  locationName,
  currentPos,
  floor,
  maxPerFloor = 60
}: {
  mapData: { surfaceLocations?: Landmark[] };
  text: string;
  locationName?: string;
  currentPos: { x: number; y: number };
  floor: number;
  maxPerFloor?: number;
}) => {
  const incoming = parseTextToLandmarks({ text, locationName, currentPos, floor });
  const merged = mergeDynamicLandmarks(mapData.surfaceLocations || [], incoming, { maxPerFloor });
  return { ...mapData, surfaceLocations: merged };
};
