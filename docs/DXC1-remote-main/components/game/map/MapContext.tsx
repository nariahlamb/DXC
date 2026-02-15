import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { Confidant, GeoPoint, MapMidLocation, WorldMapData } from '../../../types';

export type MapViewMode = 'macro' | 'mid';

export type MapContextValue = {
  mapData: WorldMapData;
  macroLocations: WorldMapData['macroLocations'];
  midLocations: WorldMapData['midLocations'];
  currentPos: GeoPoint;
  floor: number;
  location?: string;
  confidants: Confidant[];
  scale: number;
  setScale: React.Dispatch<React.SetStateAction<number>>;
  offset: { x: number; y: number };
  setOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  layoutScale: number;
  setLayoutScale: React.Dispatch<React.SetStateAction<number>>;
  layoutOffset: { x: number; y: number };
  setLayoutOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  viewMode: MapViewMode;
  setViewMode: React.Dispatch<React.SetStateAction<MapViewMode>>;
  viewingFloor: number;
  setViewingFloor: React.Dispatch<React.SetStateAction<number>>;
  activeMid: MapMidLocation | null;
  setActiveMid: React.Dispatch<React.SetStateAction<MapMidLocation | null>>;
  selectedMacroId: string | null;
  setSelectedMacroId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedMidId: string | null;
  setSelectedMidId: React.Dispatch<React.SetStateAction<string | null>>;
  showTerritories: boolean;
  setShowTerritories: React.Dispatch<React.SetStateAction<boolean>>;
  showNPCs: boolean;
  setShowNPCs: React.Dispatch<React.SetStateAction<boolean>>;
  isLayoutView: boolean;
};

const MapContext = createContext<MapContextValue | null>(null);

const DEFAULT_MAP: WorldMapData = {
  config: { width: 10000, height: 10000 },
  factions: [],
  territories: [],
  terrain: [],
  routes: [],
  surfaceLocations: [],
  dungeonStructure: []
};

const matchByName = (needle?: string, name?: string) => {
  if (!needle || !name) return false;
  return needle.includes(name) || name.includes(needle);
};

export const MapProvider = ({
  worldMap,
  currentPos,
  floor,
  location,
  confidants,
  children
}: {
  worldMap?: WorldMapData;
  currentPos: GeoPoint;
  floor: number;
  location?: string;
  confidants: Confidant[];
  children: React.ReactNode;
}) => {
  const mapData = worldMap || DEFAULT_MAP;
  const macroLocations = mapData.macroLocations || [];
  const midLocations = mapData.midLocations || [];

  const [scale, setScale] = useState(0.5);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [layoutScale, setLayoutScale] = useState(1);
  const [layoutOffset, setLayoutOffset] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState<MapViewMode>('macro');
  const [viewingFloor, setViewingFloor] = useState<number>(floor);
  const [activeMid, setActiveMid] = useState<MapMidLocation | null>(null);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [selectedMidId, setSelectedMidId] = useState<string | null>(null);
  const [showTerritories, setShowTerritories] = useState(true);
  const [showNPCs, setShowNPCs] = useState(true);

  useEffect(() => {
    if (floor !== 0) {
      setViewMode('macro');
      setActiveMid(null);
      setSelectedMidId(null);
      return;
    }

    const midMatch = midLocations.find(m => !!m.mapStructure && matchByName(location, m.name)) || null;

    if (midMatch) {
      setViewMode('mid');
      setActiveMid(midMatch);
      setSelectedMidId(midMatch.id);
    } else {
      setViewMode('macro');
      setActiveMid(null);
      setSelectedMidId(null);
    }
  }, [floor, location, midLocations]);

  useEffect(() => {
    if (!selectedMacroId && macroLocations.length > 0) {
      setSelectedMacroId(macroLocations[0].id);
    }
  }, [macroLocations, selectedMacroId]);

  const isLayoutView = viewingFloor === 0 && viewMode === 'mid' && !!activeMid?.mapStructure;

  const value = useMemo(() => ({
    mapData,
    macroLocations,
    midLocations,
    currentPos,
    floor,
    location,
    confidants,
    scale,
    setScale,
    offset,
    setOffset,
    layoutScale,
    setLayoutScale,
    layoutOffset,
    setLayoutOffset,
    viewMode,
    setViewMode,
    viewingFloor,
    setViewingFloor,
    activeMid,
    setActiveMid,
    selectedMacroId,
    setSelectedMacroId,
    selectedMidId,
    setSelectedMidId,
    showTerritories,
    setShowTerritories,
    showNPCs,
    setShowNPCs,
    isLayoutView
  }), [
    mapData,
    macroLocations,
    midLocations,
    currentPos,
    floor,
    location,
    confidants,
    scale,
    offset,
    layoutScale,
    layoutOffset,
    viewMode,
    viewingFloor,
    activeMid,
    selectedMacroId,
    selectedMidId,
    showTerritories,
    showNPCs,
    isLayoutView
  ]);

  return <MapContext.Provider value={value}>{children}</MapContext.Provider>;
};

export const useMapContext = () => {
  const ctx = useContext(MapContext);
  if (!ctx) throw new Error('useMapContext must be used within MapProvider');
  return ctx;
};
