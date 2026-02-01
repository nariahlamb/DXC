import React, { useEffect, useMemo, useState } from 'react';
import { X, Map as MapIcon, Eye, EyeOff, ChevronDown, Layers } from 'lucide-react';
import { WorldMapData, GeoPoint, Confidant } from '../../../types';
import { CanvasMapView, MapViewMode } from '../../map/CanvasMapView';

interface MapModalProps {
  isOpen: boolean;
  onClose: () => void;
  worldMap?: WorldMapData;
  currentPos?: GeoPoint;
  floor?: number;
  location?: string;
  playerName?: string;
  confidants?: Confidant[];
}

export const MapModal: React.FC<MapModalProps> = ({
  isOpen,
  onClose,
  worldMap,
  currentPos = { x: 0, y: 0 },
  floor = 0,
  location,
  playerName = 'YOU',
  confidants = []
}) => {
  const mapData = worldMap;
  const currentMode = mapData?.current?.mode || 'REGION';
  const [viewMode, setViewMode] = useState<MapViewMode>(currentMode);
  const [showNPCs, setShowNPCs] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showFog, setShowFog] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<number>(floor || mapData?.current?.floor || 0);
  const [selectedLocation, setSelectedLocation] = useState<{ name: string; description?: string; coordinates: GeoPoint; floor?: number } | null>(null);

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
    if (!isOpen || !mapData) return;
    const mode = mapData.current?.mode || 'REGION';
    setViewMode(mode);
    const nextFloor = mapData.current?.floor || floor || dungeon?.floors?.[0]?.floor || 0;
    setSelectedFloor(nextFloor);
  }, [isOpen, mapData, floor, dungeon]);

  if (!isOpen || !mapData) return null;

  const buildingId = mapData.current?.buildingId || null;
  const dungeonId = mapData.current?.dungeonId || region?.dungeonId || null;
  const worldAllowed = currentMode === 'WORLD' || currentMode === 'REGION';

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in zoom-in-95 duration-200">
      <div className="w-full max-w-6xl h-[90vh] bg-black border-4 border-blue-600 relative flex flex-col shadow-[0_0_60px_rgba(37,99,235,0.4)]">
        <div className="bg-zinc-900 p-4 flex justify-between items-center border-b-2 border-blue-800 shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-blue-600 p-2 text-white shadow-lg"><MapIcon size={24} /></div>
            <div>
              <h2 className="text-2xl font-display uppercase tracking-widest text-white text-shadow-blue">世界战术地图</h2>
              <div className="text-xs font-mono text-blue-400">Coordinates: [{Math.round(currentPos.x)}, {Math.round(currentPos.y)}] | {location}</div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-red-900/20 border border-red-600 text-red-500 hover:bg-red-600 hover:text-white transition-colors"><X size={20} /></button>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-black/80 border-b border-blue-900 p-3 text-xs">
          <div className="flex items-center gap-2">
            <Layers size={14} className="text-blue-400" />
            <span className="text-zinc-300">视图</span>
          </div>
          {worldAllowed && (
            <button onClick={() => setViewMode('WORLD')} className={`px-3 py-1 border ${viewMode === 'WORLD' ? 'bg-blue-700 text-white border-blue-500' : 'text-zinc-400 border-zinc-700'}`}>
              世界
            </button>
          )}
          <button onClick={() => setViewMode('REGION')} className={`px-3 py-1 border ${viewMode === 'REGION' ? 'bg-blue-700 text-white border-blue-500' : 'text-zinc-400 border-zinc-700'}`}>
            区域
          </button>
          {buildingId && (
            <button onClick={() => setViewMode('BUILDING')} className={`px-3 py-1 border ${viewMode === 'BUILDING' ? 'bg-blue-700 text-white border-blue-500' : 'text-zinc-400 border-zinc-700'}`}>
              建筑
            </button>
          )}
          {dungeonId && (
            <button onClick={() => setViewMode('DUNGEON')} className={`px-3 py-1 border ${viewMode === 'DUNGEON' ? 'bg-blue-700 text-white border-blue-500' : 'text-zinc-400 border-zinc-700'}`}>
              地下城
            </button>
          )}

          {viewMode === 'DUNGEON' && floors.length > 0 && (
            <div className="flex items-center gap-2 ml-4">
              <ChevronDown size={14} className="text-zinc-400" />
              <select
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(parseInt(e.target.value, 10))}
                className="bg-zinc-900 text-zinc-200 border border-zinc-700 px-2 py-1"
              >
                {floors.map(f => (
                  <option key={f} value={f}>第 {f} 层</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-3 ml-auto">
            <button onClick={() => setShowNPCs(!showNPCs)} className={`flex items-center gap-1 px-2 py-1 border ${showNPCs ? 'border-pink-400 text-pink-300' : 'border-zinc-700 text-zinc-500'}`}>
              {showNPCs ? <Eye size={12}/> : <EyeOff size={12}/>} NPC
            </button>
            <button onClick={() => setShowLabels(!showLabels)} className={`flex items-center gap-1 px-2 py-1 border ${showLabels ? 'border-blue-400 text-blue-300' : 'border-zinc-700 text-zinc-500'}`}>
              {showLabels ? <Eye size={12}/> : <EyeOff size={12}/>} 标签
            </button>
            {viewMode === 'DUNGEON' && (
              <button onClick={() => setShowFog(!showFog)} className={`flex items-center gap-1 px-2 py-1 border ${showFog ? 'border-emerald-400 text-emerald-300' : 'border-zinc-700 text-zinc-500'}`}>
                {showFog ? <Eye size={12}/> : <EyeOff size={12}/>} 迷雾
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 relative">
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
            onSelectLocation={(payload) => setSelectedLocation(payload)}
          />
        </div>

        {selectedLocation && (
          <div className="absolute bottom-6 left-6 z-30 max-w-sm">
            <div className="bg-black/90 border border-blue-600 rounded-xl p-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] uppercase tracking-widest text-blue-400">地点详情</div>
                  <div className="text-lg font-display text-white">{selectedLocation.name}</div>
                  {selectedLocation.floor ? (
                    <div className="text-[10px] text-blue-200 font-mono uppercase">地下 {selectedLocation.floor} 层</div>
                  ) : null}
                </div>
                <button onClick={() => setSelectedLocation(null)} className="text-zinc-400 hover:text-white transition-colors" aria-label="关闭地点详情">
                  <X size={16} />
                </button>
              </div>
              {selectedLocation.description && (
                <p className="mt-2 text-xs text-zinc-300 leading-relaxed">{selectedLocation.description}</p>
              )}
              <div className="mt-2 text-[10px] text-zinc-400 font-mono">坐标: {Math.round(selectedLocation.coordinates.x)}, {Math.round(selectedLocation.coordinates.y)}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
