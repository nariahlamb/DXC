import React from 'react';
import type { MapFurniture, MapRoom, MapSmallLayout } from '../../../types';
import { buildHandDrawnPath } from '../../../utils/mapMath.ts';

type HoverPayload = {
  kind: 'room' | 'furniture' | 'entrance';
  id: string;
  name: string;
  description?: string;
};

type LocalMapSVGProps = {
  layout: MapSmallLayout;
  layoutWidth: number;
  layoutHeight: number;
  unit: number;
  player?: { x: number; y: number; label?: string };
  npcs?: Array<{ name: string; x: number; y: number }>;
  onHover?: (payload: HoverPayload | null) => void;
  onSelect?: (payload: HoverPayload) => void;
};

export const LocalMapSVG: React.FC<LocalMapSVGProps> = ({
  layout,
  layoutWidth,
  layoutHeight,
  unit,
  player,
  npcs = [],
  onHover,
  onSelect
}) => {
  const widthPx = layoutWidth * unit;
  const heightPx = layoutHeight * unit;

  const handleHover = (payload: HoverPayload | null) => {
    if (onHover) onHover(payload);
  };

  const handleSelect = (payload: HoverPayload) => {
    if (onSelect) onSelect(payload);
  };

  const renderRoom = (room: MapRoom) => {
    const points = [
        { x: room.bounds.x * unit, y: room.bounds.y * unit },
        { x: (room.bounds.x + room.bounds.width) * unit, y: room.bounds.y * unit },
        { x: (room.bounds.x + room.bounds.width) * unit, y: (room.bounds.y + room.bounds.height) * unit },
        { x: room.bounds.x * unit, y: (room.bounds.y + room.bounds.height) * unit },
    ];
    return (
        <path
        key={room.id}
        d={buildHandDrawnPath(points, true, 1.5)}
        fill="rgba(10, 10, 12, 0.6)"
        stroke="rgba(255, 255, 255, 0.1)"
        strokeWidth={1.5}
        className="transition-colors duration-300 hover:fill-white/5 cursor-pointer"
        onMouseEnter={() => handleHover({ kind: 'room', id: room.id, name: room.name })}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleSelect({ kind: 'room', id: room.id, name: room.name })}
        />
    );
  };

  const renderFurniture = (item: MapFurniture) => {
      const x = item.position.x * unit;
      const y = item.position.y * unit;
      const w = (item.size?.width || 1) * unit;
      const h = (item.size?.height || 1) * unit;
      
      const points = [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h }
      ];

      return (
        <path
        key={item.id}
        d={buildHandDrawnPath(points, true, 0.5)}
        fill="rgba(217, 119, 6, 0.2)"
        stroke="rgba(217, 119, 6, 0.4)"
        strokeWidth={1}
        className="pointer-events-auto cursor-help hover:fill-amber-500/40 transition-colors"
        onMouseEnter={() => handleHover({ kind: 'furniture', id: item.id, name: item.name, description: item.description })}
        onMouseLeave={() => handleHover(null)}
        onClick={() => handleSelect({ kind: 'furniture', id: item.id, name: item.name, description: item.description })}
        />
    );
  };

  return (
    <svg
      width={widthPx}
      height={heightPx}
      viewBox={`0 0 ${widthPx} ${heightPx}`}
      className="block bg-[#050505]"
      style={{ fontFamily: '"Indie Flower", cursive' }}
    >
      <defs>
        <pattern id="grid" width={unit} height={unit} patternUnits="userSpaceOnUse">
          <path d={`M ${unit} 0 L 0 0 0 ${unit}`} fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" />
        </pattern>
        {/* Player Glow Filter */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={widthPx} height={heightPx} fill="url(#grid)" />

      {layout.rooms.map(renderRoom)}
      {layout.furniture.map(renderFurniture)}

      {layout.entrances.map(entrance => (
        <circle
          key={entrance.id}
          cx={entrance.position.x * unit}
          cy={entrance.position.y * unit}
          r={unit * 0.3}
          fill="#0ea5e9"
          stroke="rgba(0,0,0,0.5)"
          strokeWidth={1}
          className="cursor-pointer hover:r-4 transition-all"
          onMouseEnter={() => handleHover({ kind: 'entrance', id: entrance.id, name: entrance.name })}
          onMouseLeave={() => handleHover(null)}
          onClick={() => handleSelect({ kind: 'entrance', id: entrance.id, name: entrance.name })}
        />
      ))}

      {player && (
        <g filter="url(#glow)">
          <circle
            cx={player.x * unit}
            cy={player.y * unit}
            r={unit * 0.4}
            fill="#10b981"
            className="animate-pulse"
          />
          <circle
             cx={player.x * unit}
             cy={player.y * unit}
             r={unit * 0.2}
             fill="#ffffff"
          />
          {player.label && (
            <text
              x={player.x * unit}
              y={player.y * unit - unit * 0.8}
              textAnchor="middle"
              fontSize={unit * 0.7}
              fill="#e2e8f0"
              fontWeight="600"
              style={{ textShadow: '0 2px 4px rgba(0,0,0,0.8)' }}
            >
              {player.label}
            </text>
          )}
        </g>
      )}

      {npcs.map(npc => (
        <g key={npc.name}>
          <circle
            cx={npc.x * unit}
            cy={npc.y * unit}
            r={unit * 0.35}
            fill="#ec4899"
            stroke="#ffffff"
            strokeWidth={1}
          />
        </g>
      ))}
    </svg>
  );
};