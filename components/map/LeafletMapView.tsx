import React, { useMemo, useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { WorldMapData, GeoPoint, MapArea, MapSmallLocation, Confidant } from '../../types';

interface LeafletMapViewProps {
  mapData: WorldMapData;
  viewMode: 'macro' | 'mid' | 'small';
  floor: number;
  selectedMidId?: string | null;
  selectedSmallId?: string | null;
  currentPos?: GeoPoint;
  confidants?: Confidant[];
  showTerritories?: boolean;
  showNPCs?: boolean;
  showLabels?: boolean;
  onSelectLocation?: (payload: { name: string; type?: string; description?: string; coordinates: GeoPoint; floor?: number }) => void;
  onMapReady?: (map: L.Map) => void;
}

const toLatLng = (point: GeoPoint) => L.latLng(point.y, point.x);

const toBounds = (bounds: { minX: number; minY: number; maxX: number; maxY: number }) =>
  L.latLngBounds([bounds.minY, bounds.minX], [bounds.maxY, bounds.maxX]);

const renderArea = (area: MapArea, color: string, fillOpacity: number): L.Layer | null => {
  if (area.shape === 'CIRCLE' && area.center && area.radius) {
    return L.circle(toLatLng(area.center), {
      radius: area.radius,
      color,
      weight: 1,
      fillColor: color,
      fillOpacity
    });
  }
  if (area.shape === 'RECT' && area.center && area.width && area.height) {
    const halfW = area.width / 2;
    const halfH = area.height / 2;
    const bounds = L.latLngBounds(
      [area.center.y - halfH, area.center.x - halfW],
      [area.center.y + halfH, area.center.x + halfW]
    );
    return L.rectangle(bounds, {
      color,
      weight: 1,
      fillColor: color,
      fillOpacity
    });
  }
  if (area.shape === 'POLYGON' && area.points && area.points.length > 2) {
    const positions = area.points.map(toLatLng);
    return L.polygon(positions, {
      color,
      weight: 1,
      fillColor: color,
      fillOpacity
    });
  }
  return null;
};

export const LeafletMapView: React.FC<LeafletMapViewProps> = ({
  mapData,
  viewMode,
  floor,
  selectedMidId,
  selectedSmallId,
  currentPos,
  confidants,
  showTerritories = true,
  showNPCs = true,
  showLabels = true,
  onSelectLocation,
  onMapReady
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const overlayRef = useRef<L.ImageOverlay | null>(null);
  const areaGroupRef = useRef<L.LayerGroup | null>(null);
  const markerGroupRef = useRef<L.LayerGroup | null>(null);

  const layers = mapData.leaflet?.layers || [];
  const worldLayer = layers.find(l => l.scope === 'macro') || null;
  const dungeonLayer = layers.find(l => l.scope === 'dungeon') || null;
  const midLayer = selectedMidId ? layers.find(l => l.scope === 'mid' && l.ownerId === selectedMidId) || null : null;
  const activeLayer = floor > 0 ? dungeonLayer : (viewMode === 'macro' ? worldLayer : (midLayer || worldLayer));
  const bounds = activeLayer ? toBounds(activeLayer.bounds) : null;
  const [zoom, setZoom] = useState(activeLayer?.defaultZoom ?? 0);

  const midLocations = mapData.midLocations || [];
  const smallLocations = mapData.smallLocations || [];

  const macroMarkers = useMemo(() => midLocations.map(m => ({
    id: m.id,
    name: m.name,
    type: m.type,
    description: m.description,
    coordinates: m.coordinates
  })), [midLocations]);

  const detailMarkers = useMemo(() => {
    if (!selectedMidId) return [] as MapSmallLocation[];
    return smallLocations.filter(s => s.parentId === selectedMidId && s.coordinates);
  }, [smallLocations, selectedMidId]);

  const showMarkerLabels = showLabels && (viewMode === 'macro' ? zoom >= -0.5 : zoom >= 0.8);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      crs: L.CRS.Simple,
      zoomSnap: 0.25,
      zoomDelta: 0.5,
      zoomControl: false,
      attributionControl: false,
      scrollWheelZoom: true
    });
    mapRef.current = map;
    map.on('zoomend', () => setZoom(map.getZoom()));
    onMapReady?.(map);
  }, [onMapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeLayer || !bounds) return;
    if (overlayRef.current) overlayRef.current.remove();
    if (!areaGroupRef.current) areaGroupRef.current = L.layerGroup().addTo(map);
    if (!markerGroupRef.current) markerGroupRef.current = L.layerGroup().addTo(map);
    overlayRef.current = L.imageOverlay(activeLayer.url, bounds).addTo(map);
    map.setMinZoom(activeLayer.minZoom ?? -2);
    map.setMaxZoom(activeLayer.maxZoom ?? 4);
    map.setMaxBounds(bounds);
    map.fitBounds(bounds, { padding: [24, 24] });
    setZoom(map.getZoom());
  }, [activeLayer?.id, activeLayer?.url, bounds]);

  useEffect(() => {
    const map = mapRef.current;
    const areaGroup = areaGroupRef.current;
    const markerGroup = markerGroupRef.current;
    if (!map || !activeLayer || !areaGroup || !markerGroup) return;
    areaGroup.clearLayers();
    markerGroup.clearLayers();

    if (showTerritories && floor === 0 && viewMode === 'macro') {
      midLocations
        .filter(m => m.area)
        .forEach(m => {
          const layer = renderArea(m.area as MapArea, '#3b82f6', 0.08);
          if (layer) areaGroup.addLayer(layer);
        });
    }

    if (showTerritories && floor === 0 && (viewMode === 'mid' || viewMode === 'small')) {
      detailMarkers
        .filter(s => s.area)
        .forEach(s => {
          const layer = renderArea(s.area as MapArea, '#f59e0b', 0.12);
          if (layer) areaGroup.addLayer(layer);
        });
    }

    if (floor === 0 && viewMode === 'macro') {
      macroMarkers.forEach(marker => {
        const circle = L.circleMarker(toLatLng(marker.coordinates), {
          radius: 6,
          color: '#38bdf8',
          weight: 1,
          fillColor: '#0ea5e9',
          fillOpacity: 0.9
        });
        circle.on('click', () => onSelectLocation?.({
          name: marker.name,
          type: marker.type,
          description: marker.description,
          coordinates: marker.coordinates,
          floor: 0
        }));
        circle.bindTooltip(marker.name, {
          direction: 'top',
          offset: [0, -6],
          opacity: 0.9,
          permanent: showMarkerLabels
        });
        markerGroup.addLayer(circle);
      });
    }

    if (floor === 0 && (viewMode === 'mid' || viewMode === 'small')) {
      detailMarkers.forEach(marker => {
        const isActive = marker.id === selectedSmallId;
        const circle = L.circleMarker(toLatLng(marker.coordinates as GeoPoint), {
          radius: isActive ? 7 : 5,
          color: isActive ? '#22d3ee' : '#f59e0b',
          weight: 1,
          fillColor: isActive ? '#0ea5e9' : '#fbbf24',
          fillOpacity: 0.9
        });
        circle.on('click', () => onSelectLocation?.({
          name: marker.name,
          description: marker.description,
          coordinates: marker.coordinates as GeoPoint,
          floor: 0
        }));
        circle.bindTooltip(marker.name, {
          direction: 'top',
          offset: [0, -6],
          opacity: 0.9,
          permanent: showMarkerLabels
        });
        markerGroup.addLayer(circle);
      });
    }

    if (currentPos) {
      const circle = L.circleMarker(toLatLng(currentPos), {
        radius: 6,
        color: '#34d399',
        weight: 1,
        fillColor: '#10b981',
        fillOpacity: 0.95
      });
      circle.bindTooltip('玩家', {
        direction: 'right',
        offset: [8, 0],
        opacity: 0.9,
        permanent: showMarkerLabels
      });
      markerGroup.addLayer(circle);
    }

    if (floor > 0) {
      mapData.surfaceLocations
        .filter(loc => (loc.floor || 0) === floor)
        .forEach(loc => {
          const circle = L.circleMarker(toLatLng(loc.coordinates), {
            radius: Math.max(4, Math.min(10, loc.radius / 50)),
            color: '#f472b6',
            weight: 1,
            fillColor: '#ec4899',
            fillOpacity: 0.8
          });
          circle.on('click', () => onSelectLocation?.({
            name: loc.name,
            type: loc.type,
            description: loc.description,
            coordinates: loc.coordinates,
            floor: loc.floor
          }));
          circle.bindTooltip(loc.name, {
            direction: 'top',
            offset: [0, -6],
            opacity: 0.9,
            permanent: showMarkerLabels
          });
          markerGroup.addLayer(circle);
        });
    }

    if (showNPCs && confidants) {
      confidants
        .filter(c => c.坐标)
        .forEach(c => {
          const circle = L.circleMarker(toLatLng(c.坐标 as GeoPoint), {
            radius: 4,
            color: '#f472b6',
            weight: 1,
            fillColor: '#ec4899',
            fillOpacity: 0.9
          });
          circle.bindTooltip(c.姓名, {
            direction: 'top',
            offset: [0, -6],
            opacity: 0.8,
            permanent: showMarkerLabels
          });
          markerGroup.addLayer(circle);
        });
    }
  }, [
    activeLayer?.id,
    viewMode,
    floor,
    selectedSmallId,
    showTerritories,
    showNPCs,
    showLabels,
    zoom,
    macroMarkers,
    detailMarkers,
    midLocations,
    currentPos,
    confidants,
    mapData.surfaceLocations,
    onSelectLocation
  ]);

  useEffect(() => () => {
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }
  }, []);

  if (!activeLayer || !bounds) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-zinc-400">
        未配置Leaflet底图
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
};
