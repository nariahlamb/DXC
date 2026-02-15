import { useCallback, useRef, useEffect } from 'react';
import type { MouseEvent, RefObject, TouchEvent } from 'react';
import { clampScale, computeZoomAnchor, normalizeWheelDelta } from '../../../../utils/mapMath.ts';

type Point = { x: number; y: number };

type UseMapInteractionArgs = {
  enabled?: boolean;
  containerRef: RefObject<HTMLDivElement>;
  scale: number;
  setScale: (value: number) => void;
  offset: Point;
  setOffset: (value: Point) => void;
  onHover?: (clientX: number, clientY: number) => void;
};

export const useMapInteraction = ({
  enabled = true,
  containerRef,
  scale,
  setScale,
  offset,
  setOffset,
  onHover
}: UseMapInteractionArgs) => {
  const isDragging = useRef(false);
  const dragStart = useRef<Point>({ x: 0, y: 0 });
  const pinchStart = useRef<{ distance: number; scale: number; center: Point } | null>(null);

  // State refs to access latest values in event listener without re-binding
  const stateRef = useRef({ scale, offset });
  useEffect(() => { stateRef.current = { scale, offset }; }, [scale, offset]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !enabled) return;

    const onWheel = (e: globalThis.WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const { scale, offset } = stateRef.current;
      
      const delta = normalizeWheelDelta(e.deltaY);
      const anchor = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      const result = computeZoomAnchor({ scale, offset, deltaScale: delta, anchor });
      
      setScale(result.scale);
      setOffset(result.offset);
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [enabled, containerRef, setScale, setOffset]);

  const handleMouseDown = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    isDragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  }, [enabled, offset]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!enabled) return;
    if (isDragging.current) {
      setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
    } else if (onHover) {
      onHover(e.clientX, e.clientY);
    }
  }, [enabled, onHover, setOffset]);

  const handleMouseUp = useCallback(() => {
    if (!enabled) return;
    isDragging.current = false;
  }, [enabled]);

  const handleMouseLeave = useCallback(() => {
    if (!enabled) return;
    isDragging.current = false;
  }, [enabled]);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      isDragging.current = true;
      dragStart.current = { x: touch.clientX - offset.x, y: touch.clientY - offset.y };
    }
    if (e.touches.length === 2) {
      const touches = Array.from(e.touches);
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const distance = Math.hypot(dx, dy);
      const center = { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 };
      pinchStart.current = { distance, scale, center };
    }
  }, [enabled, offset, scale]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!enabled) return;
    if (e.touches.length === 1 && isDragging.current) {
      const touch = e.touches[0];
      setOffset({ x: touch.clientX - dragStart.current.x, y: touch.clientY - dragStart.current.y });
    }
    if (e.touches.length === 2 && pinchStart.current) {
      const touches = Array.from(e.touches);
      const a = touches[0];
      const b = touches[1];
      if (!a || !b) return;
      const dx = a.clientX - b.clientX;
      const dy = a.clientY - b.clientY;
      const distance = Math.hypot(dx, dy);
      const ratio = distance / pinchStart.current.distance;
      const nextScale = clampScale(pinchStart.current.scale * ratio);
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const anchor = {
        x: pinchStart.current.center.x - rect.left,
        y: pinchStart.current.center.y - rect.top
      };
      const deltaScale = nextScale - scale;
      const result = computeZoomAnchor({ scale, offset, deltaScale, anchor });
      setScale(result.scale);
      setOffset(result.offset);
    }
  }, [enabled, containerRef, scale, offset, setScale, setOffset]);

  const handleTouchEnd = useCallback(() => {
    if (!enabled) return;
    isDragging.current = false;
    pinchStart.current = null;
  }, [enabled]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
};
