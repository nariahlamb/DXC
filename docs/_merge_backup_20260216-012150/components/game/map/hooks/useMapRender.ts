import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { Confidant, GeoPoint, WorldMapData } from '../../../../types';
import { drawWorldMapCanvas, resizeCanvasToContainer } from '../../../../utils/mapCanvas.ts';

export const useMapRender = ({
  enabled = true,
  canvasRef,
  containerRef,
  mapData,
  floor,
  scale,
  offset,
  showTerritories,
  showNPCs,
  showPlayer,
  showLabels,
  currentPos,
  confidants
}: {
  enabled?: boolean;
  canvasRef: RefObject<HTMLCanvasElement>;
  containerRef: RefObject<HTMLDivElement>;
  mapData: WorldMapData;
  floor: number;
  scale: number;
  offset: { x: number; y: number };
  showTerritories: boolean;
  showNPCs: boolean;
  showPlayer: boolean;
  showLabels?: boolean;
  currentPos: GeoPoint;
  confidants: Confidant[];
}) => {
  const rafRef = useRef<number | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const draw = () => {
      resizeCanvasToContainer(canvas, container);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawWorldMapCanvas(ctx, mapData, {
        floor,
        scale,
        offset,
        showTerritories,
        showNPCs,
        showPlayer,
        showLabels,
        currentPos,
        confidants
      });
    };

    const schedule = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(draw);
    };

    schedule();

    if (!resizeObserverRef.current) {
      resizeObserverRef.current = new ResizeObserver(() => schedule());
      resizeObserverRef.current.observe(container);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
        resizeObserverRef.current = null;
      }
    };
  }, [
    enabled,
    canvasRef,
    containerRef,
    mapData,
    floor,
    scale,
    offset,
    showTerritories,
    showNPCs,
    showPlayer,
    showLabels,
    currentPos,
    confidants
  ]);
};
