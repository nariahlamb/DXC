import React, { useEffect, useMemo, useRef, useState } from 'react';
import { WorldMapData, GeoPoint, Confidant, MapRegion, MapBuilding, DungeonGraph, DungeonFloor } from '../../types';

export type MapViewMode = 'WORLD' | 'REGION' | 'BUILDING' | 'DUNGEON';

interface CanvasMapViewProps {
  mapData: WorldMapData;
  viewMode: MapViewMode;
  regionId?: string | null;
  buildingId?: string | null;
  dungeonId?: string | null;
  floor?: number | null;
  currentPos?: GeoPoint;
  confidants?: Confidant[];
  showNPCs?: boolean;
  showLabels?: boolean;
  showFog?: boolean;
  onSelectLocation?: (payload: { name: string; type?: string; description?: string; coordinates: GeoPoint; floor?: number }) => void;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getRegion = (mapData: WorldMapData, regionId?: string | null) => {
  if (regionId) return mapData.regions.find(r => r.id === regionId) || mapData.regions[0];
  return mapData.regions[0];
};

const getBuilding = (mapData: WorldMapData, buildingId?: string | null) => (buildingId ? mapData.buildings[buildingId] : undefined);

const getDungeon = (mapData: WorldMapData, dungeonId?: string | null, region?: MapRegion) => {
  const resolvedId = dungeonId || region?.dungeonId;
  return resolvedId ? mapData.dungeons[resolvedId] : undefined;
};

const getDungeonFloor = (dungeon: DungeonGraph | undefined, floor?: number | null) => {
  if (!dungeon || dungeon.floors.length === 0) return undefined;
  if (typeof floor === 'number') {
    return dungeon.floors.find(f => f.floor === floor) || dungeon.floors[0];
  }
  return dungeon.floors[0];
};

const pointInRect = (point: GeoPoint, rect: { x: number; y: number; width: number; height: number }) => {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
};

const drawBackground = (ctx: CanvasRenderingContext2D, width: number, height: number, tone: string) => {
  ctx.fillStyle = tone;
  ctx.fillRect(0, 0, width, height);
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, step: number, color: string) => {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.4;
  for (let x = 0; x <= width; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
  ctx.restore();
};

const drawHandRect = (ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }, stroke: string, fill: string) => {
  ctx.save();
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  ctx.globalAlpha = 0.35;
  ctx.strokeRect(rect.x + 0.8, rect.y + 0.6, rect.width - 1.2, rect.height - 1.2);
  ctx.restore();
};

const drawWorldLayer = (ctx: CanvasRenderingContext2D, world: WorldMapData['world'], showLabels: boolean) => {
  drawBackground(ctx, world.bounds.width, world.bounds.height, '#0b0f17');
  drawGrid(ctx, world.bounds.width, world.bounds.height, 5000, 'rgba(148,163,184,0.08)');
  world.locations.forEach(loc => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(loc.center.x, loc.center.y, Math.max(90, loc.size.width * 0.02), 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(30,58,138,0.35)';
    ctx.strokeStyle = '#93c5fd';
    ctx.lineWidth = 4;
    ctx.fill();
    ctx.stroke();
    if (showLabels) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 120px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(loc.name, loc.center.x, loc.center.y + 140);
    }
    ctx.restore();
  });
};

const drawRegionLayer = (ctx: CanvasRenderingContext2D, region: MapRegion, showLabels: boolean) => {
  drawBackground(ctx, region.bounds.width, region.bounds.height, '#0f172a');
  drawGrid(ctx, region.bounds.width, region.bounds.height, 1000, 'rgba(148,163,184,0.08)');
  region.landmarks.forEach(landmark => {
    ctx.save();
    ctx.beginPath();
    ctx.arc(landmark.position.x, landmark.position.y, landmark.radius || 400, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(59,130,246,0.15)';
    ctx.strokeStyle = '#60a5fa';
    ctx.lineWidth = 3;
    ctx.fill();
    ctx.stroke();
    if (showLabels) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 56px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(landmark.name, landmark.position.x, landmark.position.y + (landmark.radius || 400) + 60);
    }
    ctx.restore();
  });
};

const drawBuildingLayer = (ctx: CanvasRenderingContext2D, building: MapBuilding, showLabels: boolean) => {
  drawBackground(ctx, building.bounds.width, building.bounds.height, '#f4f1e8');
  drawGrid(ctx, building.bounds.width, building.bounds.height, 2, 'rgba(15,23,42,0.08)');
  building.layout.rooms.forEach(room => {
    drawHandRect(ctx, room.bounds, '#1f2937', 'rgba(255,255,255,0.65)');
    if (showLabels) {
      ctx.save();
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 5px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, room.bounds.x + room.bounds.width / 2, room.bounds.y + room.bounds.height / 2);
      ctx.restore();
    }
  });
  building.layout.furniture.forEach(item => {
    ctx.save();
    ctx.fillStyle = 'rgba(245,158,11,0.7)';
    ctx.strokeStyle = '#92400e';
    ctx.lineWidth = 1;
    const w = (item.size?.width || 1);
    const h = (item.size?.height || 1);
    ctx.fillRect(item.position.x, item.position.y, w, h);
    ctx.strokeRect(item.position.x, item.position.y, w, h);
    if (showLabels) {
      ctx.fillStyle = '#111827';
      ctx.font = '4px "Noto Serif SC", serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(item.name, item.position.x + 0.5, item.position.y + 0.5);
    }
    ctx.restore();
  });
  building.layout.entrances.forEach(ent => {
    ctx.save();
    ctx.fillStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(ent.position.x, ent.position.y, 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

const drawDungeonLayer = (ctx: CanvasRenderingContext2D, floor: DungeonFloor, showLabels: boolean) => {
  drawBackground(ctx, floor.bounds.width, floor.bounds.height, '#050a14');
  drawGrid(ctx, floor.bounds.width, floor.bounds.height, 80, 'rgba(148,163,184,0.05)');
  floor.edges.forEach(edge => {
    ctx.save();
    ctx.strokeStyle = edge.discovered ? '#22d3ee' : 'rgba(148,163,184,0.3)';
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    edge.points.forEach((p, idx) => {
      if (idx === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  });
  floor.rooms.forEach(room => {
    ctx.save();
    ctx.fillStyle = room.discovered ? 'rgba(59,130,246,0.15)' : 'rgba(15,23,42,0.4)';
    ctx.strokeStyle = room.discovered ? '#60a5fa' : '#334155';
    ctx.lineWidth = 3;
    ctx.fillRect(room.x, room.y, room.width, room.height);
    ctx.strokeRect(room.x, room.y, room.width, room.height);
    if (showLabels && room.name) {
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 26px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(room.name, room.x + room.width / 2, room.y + room.height / 2);
    }
    ctx.restore();
  });
};

const drawDungeonFog = (ctx: CanvasRenderingContext2D, floor: DungeonFloor, currentPos?: GeoPoint) => {
  ctx.save();
  ctx.fillStyle = 'rgba(2,6,23,0.85)';
  ctx.fillRect(0, 0, floor.bounds.width, floor.bounds.height);

  const discovered = floor.rooms.filter(r => r.discovered);
  discovered.forEach(room => {
    ctx.fillStyle = 'rgba(2,6,23,0.45)';
    ctx.fillRect(room.x, room.y, room.width, room.height);
  });

  if (currentPos) {
    const currentRoom = floor.rooms.find(room => pointInRect(currentPos, { x: room.x, y: room.y, width: room.width, height: room.height }));
    if (currentRoom) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,1)';
      ctx.fillRect(currentRoom.x, currentRoom.y, currentRoom.width, currentRoom.height);
      ctx.globalCompositeOperation = 'source-over';
    }
  }
  ctx.restore();
};

const drawActors = (ctx: CanvasRenderingContext2D, playerPos: GeoPoint | null, npcPoints: GeoPoint[], showLabels: boolean, npcNames?: string[]) => {
  npcPoints.forEach((pos, idx) => {
    ctx.save();
    ctx.fillStyle = '#ec4899';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (showLabels && npcNames && npcNames[idx]) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(npcNames[idx], pos.x, pos.y - 12);
    }
    ctx.restore();
  });

  if (playerPos) {
    ctx.save();
    ctx.fillStyle = '#22c55e';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(playerPos.x, playerPos.y, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    if (showLabels) {
      ctx.fillStyle = '#f8fafc';
      ctx.font = '12px "Noto Serif SC", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText('玩家', playerPos.x, playerPos.y - 14);
    }
    ctx.restore();
  }
};

export const CanvasMapView: React.FC<CanvasMapViewProps> = ({
  mapData,
  viewMode,
  regionId,
  buildingId,
  dungeonId,
  floor,
  currentPos,
  confidants,
  showNPCs = true,
  showLabels = true,
  showFog = true,
  onSelectLocation
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null);
  const entityRef = useRef<HTMLCanvasElement | null>(null);
  const fogRef = useRef<HTMLCanvasElement | null>(null);
  const actorRef = useRef<HTMLCanvasElement | null>(null);

  const [viewport, setViewport] = useState({ scale: 1, offset: { x: 0, y: 0 } });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  const region = useMemo(() => getRegion(mapData, regionId), [mapData, regionId]);
  const building = useMemo(() => getBuilding(mapData, buildingId), [mapData, buildingId]);
  const dungeon = useMemo(() => getDungeon(mapData, dungeonId, region), [mapData, dungeonId, region]);
  const dungeonFloor = useMemo(() => getDungeonFloor(dungeon, floor), [dungeon, floor]);

  const bounds = useMemo(() => {
    if (viewMode === 'WORLD') return mapData.world.bounds;
    if (viewMode === 'REGION') return region?.bounds;
    if (viewMode === 'BUILDING') return building?.bounds;
    if (viewMode === 'DUNGEON') return dungeonFloor?.bounds;
    return undefined;
  }, [viewMode, mapData.world.bounds, region, building, dungeonFloor]);

  const viewKey = `${viewMode}-${region?.id || ''}-${building?.id || ''}-${dungeon?.id || ''}-${dungeonFloor?.floor || ''}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(entries => {
      entries.forEach(entry => {
        const rect = entry.contentRect;
        setContainerSize({ width: rect.width, height: rect.height });
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    [baseRef.current, entityRef.current, fogRef.current, actorRef.current].forEach(canvas => {
      if (!canvas) return;
      canvas.width = Math.max(1, Math.floor(containerSize.width * dpr));
      canvas.height = Math.max(1, Math.floor(containerSize.height * dpr));
      canvas.style.width = `${containerSize.width}px`;
      canvas.style.height = `${containerSize.height}px`;
    });
  }, [containerSize.width, containerSize.height]);

  useEffect(() => {
    if (!bounds || containerSize.width === 0 || containerSize.height === 0) return;
    const fitScale = Math.min(containerSize.width / bounds.width, containerSize.height / bounds.height) * 0.9;
    const offset = {
      x: (containerSize.width - bounds.width * fitScale) / 2,
      y: (containerSize.height - bounds.height * fitScale) / 2
    };
    setViewport({ scale: fitScale, offset });
  }, [viewKey, bounds, containerSize.width, containerSize.height]);

  const toWorldFromRegion = (point: GeoPoint) => {
    if (!region) return point;
    const worldLoc = mapData.world.locations.find(loc => loc.id === region.worldLocationId);
    if (!worldLoc) return point;
    const topLeft = {
      x: worldLoc.center.x - region.bounds.width / 2,
      y: worldLoc.center.y - region.bounds.height / 2
    };
    return { x: topLeft.x + point.x, y: topLeft.y + point.y };
  };

  const toRegionFromBuilding = (point: GeoPoint) => {
    if (!building) return point;
    const topLeft = {
      x: building.anchor.x - building.bounds.width / 2,
      y: building.anchor.y - building.bounds.height / 2
    };
    return { x: topLeft.x + point.x, y: topLeft.y + point.y };
  };

  const mapActorToView = (point: GeoPoint | undefined): GeoPoint | null => {
    if (!point) return null;
    const actorMode = mapData.current?.mode || 'REGION';
    if (viewMode === actorMode) return point;
    if (viewMode === 'REGION' && actorMode === 'BUILDING') return toRegionFromBuilding(point);
    if (viewMode === 'WORLD' && actorMode === 'REGION') return toWorldFromRegion(point);
    if (viewMode === 'WORLD' && actorMode === 'BUILDING') return toWorldFromRegion(toRegionFromBuilding(point));
    return null;
  };

  const npcPoints = useMemo(() => {
    if (!showNPCs || !confidants) return { points: [], names: [] as string[] };
    const points: GeoPoint[] = [];
    const names: string[] = [];
    confidants.forEach(npc => {
      if (!npc.坐标) return;
      const mapped = mapActorToView(npc.坐标);
      if (mapped) {
        points.push(mapped);
        names.push(npc.姓名 || npc.濮撳悕 || 'NPC');
      }
    });
    return { points, names };
  }, [confidants, showNPCs, viewMode, mapData.current, region, building]);

  useEffect(() => {
    if (!bounds || !baseRef.current || !entityRef.current) return;
    const dpr = window.devicePixelRatio || 1;
    const applyTransform = (ctx: CanvasRenderingContext2D) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.setTransform(viewport.scale * dpr, 0, 0, viewport.scale * dpr, viewport.offset.x * dpr, viewport.offset.y * dpr);
    };

    const baseCtx = baseRef.current.getContext('2d');
    const entityCtx = entityRef.current.getContext('2d');
    if (!baseCtx || !entityCtx) return;

    applyTransform(baseCtx);
    applyTransform(entityCtx);

    if (viewMode === 'WORLD') {
      drawWorldLayer(baseCtx, mapData.world, showLabels);
    } else if (viewMode === 'REGION' && region) {
      drawRegionLayer(baseCtx, region, showLabels);
    } else if (viewMode === 'BUILDING' && building) {
      drawBuildingLayer(baseCtx, building, showLabels);
    } else if (viewMode === 'DUNGEON' && dungeonFloor) {
      drawDungeonLayer(baseCtx, dungeonFloor, showLabels);
    } else {
      drawBackground(baseCtx, bounds.width, bounds.height, '#111827');
    }

    if (viewMode === 'DUNGEON' && dungeonFloor) {
      drawDungeonLayer(entityCtx, dungeonFloor, showLabels);
    }
  }, [bounds, mapData, region, building, dungeonFloor, viewMode, viewport, showLabels]);

  useEffect(() => {
    if (!fogRef.current || !bounds) return;
    const ctx = fogRef.current.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(viewport.scale * dpr, 0, 0, viewport.scale * dpr, viewport.offset.x * dpr, viewport.offset.y * dpr);
    if (viewMode === 'DUNGEON' && dungeonFloor && showFog) {
      drawDungeonFog(ctx, dungeonFloor, currentPos || undefined);
    }
  }, [bounds, dungeonFloor, viewMode, viewport, showFog, currentPos]);

  useEffect(() => {
    if (!actorRef.current || !bounds) return;
    const ctx = actorRef.current.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.setTransform(viewport.scale * dpr, 0, 0, viewport.scale * dpr, viewport.offset.x * dpr, viewport.offset.y * dpr);

    const playerPos = mapActorToView(currentPos || undefined);
    drawActors(ctx, playerPos, npcPoints.points, showLabels, npcPoints.names);
  }, [bounds, viewport, currentPos, npcPoints, viewMode, showLabels, region, building]);

  const handleWheel = (event: React.WheelEvent) => {
    if (!bounds) return;
    event.preventDefault();
    const delta = -event.deltaY * 0.001;
    const nextScale = clamp(viewport.scale * (1 + delta), 0.2, 6);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const cx = event.clientX - rect.left;
    const cy = event.clientY - rect.top;
    const mapX = (cx - viewport.offset.x) / viewport.scale;
    const mapY = (cy - viewport.offset.y) / viewport.scale;
    const nextOffset = {
      x: cx - mapX * nextScale,
      y: cy - mapY * nextScale
    };
    setViewport({ scale: nextScale, offset: nextOffset });
  };

  const dragState = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0
  });

  const handleMouseDown = (event: React.MouseEvent) => {
    dragState.current = {
      active: true,
      startX: event.clientX,
      startY: event.clientY,
      baseX: viewport.offset.x,
      baseY: viewport.offset.y
    };
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!dragState.current.active) return;
    const dx = event.clientX - dragState.current.startX;
    const dy = event.clientY - dragState.current.startY;
    setViewport(prev => ({ ...prev, offset: { x: dragState.current.baseX + dx, y: dragState.current.baseY + dy } }));
  };

  const handleMouseUp = () => {
    dragState.current.active = false;
  };

  const handleClick = (event: React.MouseEvent) => {
    if (!onSelectLocation || !bounds) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = (event.clientX - rect.left - viewport.offset.x) / viewport.scale;
    const y = (event.clientY - rect.top - viewport.offset.y) / viewport.scale;
    const point = { x, y };

    if (viewMode === 'WORLD') {
      const hit = mapData.world.locations.find(loc => {
        const radius = Math.max(90, loc.size.width * 0.02);
        const dx = loc.center.x - point.x;
        const dy = loc.center.y - point.y;
        return Math.hypot(dx, dy) <= radius;
      });
      if (hit) onSelectLocation({ name: hit.name, description: hit.description, coordinates: hit.center });
      return;
    }

    if (viewMode === 'REGION' && region) {
      const hit = region.landmarks.find(lm => {
        const radius = lm.radius || 400;
        const dx = lm.position.x - point.x;
        const dy = lm.position.y - point.y;
        return Math.hypot(dx, dy) <= radius;
      });
      if (hit) onSelectLocation({ name: hit.name, description: hit.description, coordinates: hit.position });
      return;
    }

    if (viewMode === 'BUILDING' && building) {
      const hit = building.layout.rooms.find(room => pointInRect(point, room.bounds));
      if (hit) onSelectLocation({ name: hit.name, type: hit.type, coordinates: point });
      return;
    }

    if (viewMode === 'DUNGEON' && dungeonFloor) {
      const hit = dungeonFloor.rooms.find(room => pointInRect(point, { x: room.x, y: room.y, width: room.width, height: room.height }));
      if (hit) onSelectLocation({ name: hit.name, type: hit.type, description: hit.description, coordinates: { x: hit.x, y: hit.y }, floor: dungeonFloor.floor });
    }
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    dragState.current = {
      active: true,
      startX: touch.clientX,
      startY: touch.clientY,
      baseX: viewport.offset.x,
      baseY: viewport.offset.y
    };
  };

  const handleTouchMove = (event: React.TouchEvent) => {
    if (!dragState.current.active || event.touches.length !== 1) return;
    const touch = event.touches[0];
    const dx = touch.clientX - dragState.current.startX;
    const dy = touch.clientY - dragState.current.startY;
    setViewport(prev => ({ ...prev, offset: { x: dragState.current.baseX + dx, y: dragState.current.baseY + dy } }));
  };

  const handleTouchEnd = () => {
    dragState.current.active = false;
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <canvas ref={baseRef} className="absolute inset-0" />
      <canvas ref={entityRef} className="absolute inset-0" />
      <canvas ref={fogRef} className="absolute inset-0 pointer-events-none" />
      <canvas ref={actorRef} className="absolute inset-0 pointer-events-none" />
    </div>
  );
};
