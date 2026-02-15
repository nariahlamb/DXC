import type { BattleMapRow, MapVisuals } from '../types/combat';
import type { GeoPoint, MapMidLocation, WorldMapData, MapArea } from '../types/world';

export type DailyMapViewMode = 'macro' | 'mid';

export interface DailyMapViewState {
  viewMode: DailyMapViewMode;
  activeMid: MapMidLocation | null;
  selectedMacroId: string | null;
  selectedMidId: string | null;
}

export const createEmptyWorldMap = (): WorldMapData => ({
  config: { width: 10000, height: 10000 },
  factions: [],
  territories: [],
  terrain: [],
  routes: [],
  surfaceLocations: [],
  dungeonStructure: [],
  macroLocations: [],
  midLocations: []
});

export const matchLocationName = (needle?: string, candidate?: string): boolean => {
  if (!needle || !candidate) return false;
  const normalize = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/[\s·•_\-()（）[\]【】,，.。:：]/g, '');
  const normalizedNeedle = normalize(needle);
  const normalizedCandidate = normalize(candidate);
  if (!normalizedNeedle || !normalizedCandidate) return false;
  return normalizedNeedle.includes(normalizedCandidate) || normalizedCandidate.includes(normalizedNeedle);
};

const getAreaCenter = (area?: MapArea, fallback?: GeoPoint): GeoPoint | null => {
  if (area?.center) return area.center;
  if (area?.shape === 'RECT' && fallback && Number.isFinite(area.width) && Number.isFinite(area.height)) {
    return { x: fallback.x, y: fallback.y };
  }
  if (area?.shape === 'POLYGON' && Array.isArray(area.points) && area.points.length > 0) {
    const sum = area.points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / area.points.length, y: sum.y / area.points.length };
  }
  return fallback || null;
};

const pointDistance = (a: GeoPoint, b: GeoPoint): number => {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const isRenderableMid = (mid: MapMidLocation): boolean => !!mid.mapStructure;

export const resolveDailyMapViewState = (
  mapData: WorldMapData | undefined,
  location: string | undefined,
  floor: number,
  currentPos?: GeoPoint
): DailyMapViewState => {
  // REMOVED: Floor restriction logic to allow dungeon mid layouts to render.
  // if (floor !== 0) {
  //   return { ... };
  // }

  const macroLocations = mapData?.macroLocations || [];
  const midLocations = mapData?.midLocations || [];

  const renderableMid = midLocations.filter(isRenderableMid);

  const midMatchDirect =
    renderableMid.find(m => matchLocationName(location, m.name)) ||
    midLocations.find(m => matchLocationName(location, m.name)) ||
    null;
  const midMatch = midMatchDirect;
  const macroMatchFromMid = midMatch
    ? macroLocations.find(m => m.id === midMatch.parentId) || null
    : null;

  if (floor === 0 && !midMatch && currentPos) {
    const nearestMid = (renderableMid.length > 0 ? renderableMid : midLocations)
      .map((mid) => {
        const center = getAreaCenter(mid.area, mid.coordinates);
        return center ? { mid, distance: pointDistance(currentPos, center) } : null;
      })
      .filter((row): row is { mid: MapMidLocation; distance: number } => !!row)
      .sort((a, b) => a.distance - b.distance)[0];

    const nearestThreshold = 2800;
    if (nearestMid && nearestMid.distance <= nearestThreshold) {
      const chosenMacro = macroLocations.find(m => m.id === nearestMid.mid.parentId) || null;
      return {
        viewMode: 'mid',
        activeMid: nearestMid.mid,
        selectedMacroId: chosenMacro?.id || null,
        selectedMidId: nearestMid.mid.id
      };
    }
  }

  if (midMatch) {
    return {
      viewMode: 'mid',
      activeMid: midMatch,
      selectedMacroId: macroMatchFromMid?.id || null,
      selectedMidId: midMatch.id
    };
  }

  return {
    viewMode: 'macro',
    activeMid: null,
    selectedMacroId: macroLocations[0]?.id || null,
    selectedMidId: null
  };
};

export const hasBattleMapData = (_mapVisuals?: MapVisuals, battleMap?: BattleMapRow[]): boolean => {
  return Array.isArray(battleMap) && battleMap.length > 0;
};

export const computeBattleMapAnchor = (battleMap?: BattleMapRow[]): GeoPoint | null => {
  if (!Array.isArray(battleMap) || battleMap.length === 0) return null;
  const points = battleMap
    .map(row => row.位置)
    .filter((pos): pos is { x: number; y: number } => !!pos && typeof pos.x === 'number' && typeof pos.y === 'number');
  if (points.length === 0) return null;
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return {
    x: Number((sum.x / points.length).toFixed(2)),
    y: Number((sum.y / points.length).toFixed(2))
  };
};
