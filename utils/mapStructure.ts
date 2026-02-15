import type { MapStructure } from '../types/world';

const isObject = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object';

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const coerceNumber = (value: unknown, fallback: number): number => {
  if (isFiniteNumber(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

const pickFirst = (...values: unknown[]) => values.find(v => v !== undefined && v !== null);

const toRoomList = (input: unknown): any[] => {
  if (Array.isArray(input)) return input;
  if (isObject(input)) {
    const maybeList = (input as any).list;
    if (Array.isArray(maybeList)) return maybeList;
  }
  return [];
};

const toGeoPoints = (input: unknown): { x: number; y: number }[] | undefined => {
  if (!Array.isArray(input)) return undefined;
  const points = input
    .filter(isObject)
    .map((point) => ({
      x: coerceNumber(pickFirst((point as any).x, (point as any).left, (point as any).posX, (point as any).左), NaN),
      y: coerceNumber(pickFirst((point as any).y, (point as any).top, (point as any).posY, (point as any).上), NaN)
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  return points.length >= 3 ? points : undefined;
};

export const parseMapStructure = (
  input?: MapStructure | string | null
): MapStructure | null => {
  if (!input) return null;

  let data: unknown = input;
  if (typeof input === 'string') {
    try {
      data = JSON.parse(input);
    } catch {
      return null;
    }
  }

  if (!isObject(data)) return null;

  const mapNameRaw = pickFirst((data as any).mapName, (data as any).name, (data as any).地图名, (data as any).LocationName);
  const mapName = typeof mapNameRaw === 'string' && mapNameRaw.trim() ? mapNameRaw.trim() : '';
  if (!mapName) return null;

  const lastUpdatedRaw = pickFirst((data as any).LastUpdated, (data as any).lastUpdated, (data as any).更新时间);
  const LastUpdated = typeof lastUpdatedRaw === 'string' && lastUpdatedRaw.trim() ? lastUpdatedRaw.trim() : undefined;

  const mapSizeRaw = pickFirst((data as any).mapSize, (data as any).size, (data as any).地图尺寸);
  if (!isObject(mapSizeRaw)) return null;
  const width = coerceNumber(pickFirst((mapSizeRaw as any).width, (mapSizeRaw as any).w, (mapSizeRaw as any).宽度), 0);
  const height = coerceNumber(pickFirst((mapSizeRaw as any).height, (mapSizeRaw as any).h, (mapSizeRaw as any).高度), 0);
  if (width <= 0 || height <= 0) return null;

  const roomsRaw = toRoomList(pickFirst((data as any).rooms, (data as any).Rooms, (data as any).房间));
  if (roomsRaw.length === 0) return null;

  const rooms = roomsRaw
    .filter(isObject)
    .map((room, index) => {
      const x = coerceNumber(pickFirst(room.x, room.left, room.posX, room.左), 0);
      const y = coerceNumber(pickFirst(room.y, room.top, room.posY, room.上), 0);
      const roomWidth = coerceNumber(pickFirst(room.width, room.w, room.宽度), 0);
      const roomHeight = coerceNumber(pickFirst(room.height, room.h, room.高度), 0);
      if (roomWidth <= 0 || roomHeight <= 0) return null;
      return {
        id: String(pickFirst(room.id, room.roomId, `room_${index + 1}`)),
        name: String(pickFirst(room.name, room.label, room.名称, room.id, `Room ${index + 1}`)),
        type: typeof room.type === 'string' ? room.type : undefined,
        shape: typeof room.shape === 'string' ? room.shape : undefined,
        x,
        y,
        width: roomWidth,
        height: roomHeight,
        points: toGeoPoints(pickFirst(room.points, room.Points, room.点集)),
        path: typeof room.path === 'string' ? room.path : undefined,
        rotation: coerceNumber(pickFirst(room.rotation, room.rotate, room.angle, room.角度), 0),
        description: typeof room.description === 'string' ? room.description : undefined,
        color: typeof room.color === 'string' ? room.color : undefined
      };
    })
    .filter((room): room is NonNullable<typeof room> => !!room);
  if (rooms.length === 0) return null;

  const doorsRaw = toRoomList(pickFirst((data as any).doors, (data as any).Doors, (data as any).门));
  const doors = doorsRaw
    .filter(isObject)
    .map((door) => ({
      x: coerceNumber(pickFirst(door.x, door.posX, door.左), 0),
      y: coerceNumber(pickFirst(door.y, door.posY, door.上), 0),
      type: typeof door.type === 'string' ? door.type : undefined,
      orientation: typeof door.orientation === 'string' ? door.orientation : undefined,
      connects: Array.isArray(door.connects) ? door.connects.map(String) : []
    }));

  const featuresRaw = toRoomList(pickFirst((data as any).features, (data as any).Features, (data as any).地物, (data as any).objects));
  const features = featuresRaw
    .filter(isObject)
    .map((feature) => ({
      x: coerceNumber(pickFirst(feature.x, feature.posX, feature.左), 0),
      y: coerceNumber(pickFirst(feature.y, feature.posY, feature.上), 0),
      type: String(pickFirst(feature.type, feature.kind, feature.类型, 'feature')),
      description: typeof feature.description === 'string' ? feature.description : undefined
    }));

  return {
    mapName,
    LastUpdated,
    mapSize: { width, height },
    rooms,
    doors,
    features
  };
};
