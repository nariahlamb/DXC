type LandmarkInput = {
  text: string;
  locationName?: string;
  currentPos: { x: number; y: number };
  floor: number;
};

type DynamicLandmark = {
  id: string;
  name: string;
  type: 'LANDMARK' | 'SHOP' | 'GUILD' | 'FAMILIA_HOME' | 'SLUM' | 'STREET' | 'DUNGEON_ENTRANCE' | 'SAFE_ZONE' | 'STAIRS_UP' | 'STAIRS_DOWN' | 'POINT';
  coordinates: { x: number; y: number };
  radius: number;
  description: string;
  floor: number;
  source: 'dynamic';
  lastSeenAt: number;
};

export const parseTextToLandmarks = ({
  text,
  locationName,
  currentPos,
  floor
}: LandmarkInput): DynamicLandmark[] => {
  const results: DynamicLandmark[] = [];
  const now = Date.now();
  const inFountain = text.includes('喷泉广场') || (locationName ? locationName.includes('喷泉') : false);
  if (inFountain) {
    results.push({
      id: `dyn-fountain-${now}`,
      name: '喷泉',
      type: 'LANDMARK',
      coordinates: { x: currentPos.x, y: currentPos.y },
      radius: 120,
      description: '由文本解析生成的喷泉地标。',
      floor,
      source: 'dynamic',
      lastSeenAt: now
    });
  }
  if (text.includes('商店')) {
    results.push({
      id: `dyn-shop-${now}`,
      name: '商店',
      type: 'SHOP',
      coordinates: { x: currentPos.x, y: currentPos.y - 200 },
      radius: 90,
      description: '由文本解析生成的商店地标。',
      floor,
      source: 'dynamic',
      lastSeenAt: now
    });
  }
  return results;
};
