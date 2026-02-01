import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Eye, EyeOff, Layers } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant } from '../../types';
import { CanvasMapView, MapViewMode } from '../map/CanvasMapView';

interface MobileMapViewProps {
  worldMap: WorldMapData;
  currentPos: GeoPoint;
  playerName: string;
  confidants: Confidant[];
  floor: number;
  location?: string;
}

export const MobileMapView: React.FC<MobileMapViewProps> = ({
  worldMap,
  currentPos,
  confidants,
  floor,
  location
}) => {
  const mapData = worldMap;
  const currentMode = mapData?.current?.mode || 'REGION';
  const [viewMode, setViewMode] = useState<MapViewMode>(currentMode);
  const [showNPCs, setShowNPCs] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showFog, setShowFog] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number>(floor || mapData?.current?.floor || 0);

  const region = useMemo(() => {
    if (!mapData) return undefined;
    const id = mapData.current?.regionId;
    return id ? mapData.regions.find(r => r.id === id) || mapData.regions[0] : mapData.regions[0];
  }, [mapData]);

  const dungeon = useMemo(() => {
    if (!mapData || !region) return undefined;
    const id = mapData.current?.dungeonId || region.dungeonId;
    return id ? mapData.dungeons[id] : undefined;
  }, [mapData, region]);

  const floors = useMemo(() => (dungeon?.floors || []).map(f => f.floor), [dungeon]);

  useEffect(() => {
    const nextMode = mapData.current?.mode || 'REGION';
    setViewMode(nextMode);
    setSelectedFloor(mapData.current?.floor || floor || dungeon?.floors?.[0]?.floor || 0);
  }, [mapData, floor, dungeon]);

  const buildingId = mapData.current?.buildingId || null;
  const dungeonId = mapData.current?.dungeonId || region?.dungeonId || null;
  const worldAllowed = currentMode === 'WORLD' || currentMode === 'REGION';

  return (
    <div className="w-full h-full relative bg-[#050a14] overflow-hidden flex flex-col">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-black/80 border border-blue-600 rounded-full overflow-hidden flex text-[10px] font-bold">
        {worldAllowed && (
          <button
            onClick={() => setViewMode('WORLD')}
            className={`px-3 py-1.5 ${viewMode === 'WORLD' ? 'bg-blue-600 text-white' : 'text-zinc-300'}`}
          >
            世界
          </button>
        )}
        <button
          onClick={() => setViewMode('REGION')}
          className={`px-3 py-1.5 ${viewMode === 'REGION' ? 'bg-blue-600 text-white' : 'text-zinc-300'}`}
        >
          区域
        </button>
        {buildingId && (
          <button
            onClick={() => setViewMode('BUILDING')}
            className={`px-3 py-1.5 ${viewMode === 'BUILDING' ? 'bg-blue-600 text-white' : 'text-zinc-300'}`}
          >
            建筑
          </button>
        )}
        {dungeonId && (
          <button
            onClick={() => setViewMode('DUNGEON')}
            className={`px-3 py-1.5 ${viewMode === 'DUNGEON' ? 'bg-blue-600 text-white' : 'text-zinc-300'}`}
          >
            地下城
          </button>
        )}
      </div>

      {viewMode === 'DUNGEON' && floors.length > 0 && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-20">
          <div className="relative">
            <button className="bg-black/80 text-white border border-blue-500 px-4 py-2 rounded flex items-center gap-2 shadow-lg">
              <span className="font-bold font-mono">地下 {selectedFloor} 层</span>
              <ChevronDown size={12} className="text-blue-300" />
            </button>
            <div className="absolute top-full left-0 mt-1 w-40 bg-black border border-zinc-700 max-h-52 overflow-y-auto shadow-xl">
              {floors.map(f => (
                <button
                  key={f}
                  onClick={() => setSelectedFloor(f)}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 font-mono ${f === selectedFloor ? 'text-green-400' : 'text-zinc-300'}`}
                >
                  地下 {f} 层
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <CanvasMapView
        mapData={mapData}
        viewMode={viewMode}
        regionId={region?.id || null}
        buildingId={viewMode === 'BUILDING' ? buildingId : null}
        dungeonId={viewMode === 'DUNGEON' ? dungeonId : null}
        floor={viewMode === 'DUNGEON' ? selectedFloor : null}
        currentPos={currentPos}
        confidants={confidants}
        showNPCs={showNPCs}
        showLabels={showLabels}
        showFog={showFog}
      />

      <div className="absolute bottom-5 left-4 z-20 flex gap-2">
        <button
          onClick={() => setShowNPCs(!showNPCs)}
          className={`px-3 py-2 text-[10px] border rounded ${showNPCs ? 'text-pink-300 border-pink-400' : 'text-zinc-500 border-zinc-700'}`}
        >
          {showNPCs ? <Eye size={12}/> : <EyeOff size={12}/>} NPC
        </button>
        <button
          onClick={() => setShowLabels(!showLabels)}
          className={`px-3 py-2 text-[10px] border rounded ${showLabels ? 'text-blue-300 border-blue-400' : 'text-zinc-500 border-zinc-700'}`}
        >
          {showLabels ? <Eye size={12}/> : <EyeOff size={12}/>} 标签
        </button>
        {viewMode === 'DUNGEON' && (
          <button
            onClick={() => setShowFog(!showFog)}
            className={`px-3 py-2 text-[10px] border rounded ${showFog ? 'text-emerald-300 border-emerald-400' : 'text-zinc-500 border-zinc-700'}`}
          >
            {showFog ? <Eye size={12}/> : <EyeOff size={12}/>} 迷雾
          </button>
        )}
      </div>

      <div className="absolute bottom-5 right-4 z-20 text-[10px] text-zinc-300 bg-black/70 border border-zinc-700 px-2 py-1 rounded">
        <Layers size={12} className="inline-block mr-1 text-blue-400" />
        {location || '未知地点'} | X:{Math.round(currentPos.x)} Y:{Math.round(currentPos.y)}
      </div>
    </div>
  );
};
