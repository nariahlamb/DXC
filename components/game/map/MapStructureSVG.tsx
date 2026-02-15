import React, { useId } from 'react';
import type { MapStructure, MapStructureDoor, MapStructureFeature, MapStructureRoom } from '../../../types';
import { buildHandDrawnPath } from '../../../utils/mapMath';

interface MapStructureSVGProps {
  data: MapStructure;
  className?: string;
}

const getRectPoints = (x: number, y: number, width: number, height: number) => ([
  { x, y },
  { x: x + width, y },
  { x: x + width, y: y + height },
  { x, y: y + height }
]);

const getRoomPoints = (room: MapStructureRoom) => {
  if (Array.isArray(room.points) && room.points.length >= 3) return room.points;
  return getRectPoints(room.x, room.y, room.width, room.height);
};

const getRoomWiggle = (room: MapStructureRoom) => {
  const base = Math.max(18, Math.min(room.width || 0, room.height || 0));
  return Math.max(1.8, Math.min(5.5, base / 30));
};

const getRoomPath = (room: MapStructureRoom, wiggleScale = 1) => {
  if (typeof room.path === 'string' && room.path.trim()) return room.path;
  const points = getRoomPoints(room);
  return buildHandDrawnPath(points, true, getRoomWiggle(room) * wiggleScale);
};

const getRoomCenter = (room: MapStructureRoom) => {
  if (Array.isArray(room.points) && room.points.length >= 3) {
    const sum = room.points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    return { x: sum.x / room.points.length, y: sum.y / room.points.length };
  }
  return {
    x: room.x + room.width / 2,
    y: room.y + room.height / 2
  };
};

const renderDoor = (door: MapStructureDoor, index: number) => {
  const isHorizontal = door.orientation === 'horizontal';
  const width = isHorizontal ? 20 : 7;
  const height = isHorizontal ? 7 : 20;
  const cx = door.x;
  const cy = door.y;
  
  const type = door.type || 'door';
  const isOpen = type === 'open';
  const isSecret = type === 'secret_door';
  
  // Hand-drawn door style: just a simple rectangle with wiggle
  const points = [
    { x: cx - width/2, y: cy - height/2 },
    { x: cx + width/2, y: cy - height/2 },
    { x: cx + width/2, y: cy + height/2 },
    { x: cx - width/2, y: cy + height/2 }
  ];
  const d = buildHandDrawnPath(points, true, 0.9);
  const dAlt = buildHandDrawnPath(points, true, 0.45);

  const stroke = isOpen ? '#94a3b8' : isSecret ? '#c084fc' : '#f59e0b';
  const fill = isOpen ? 'transparent' : isSecret ? 'rgba(192, 132, 252, 0.1)' : 'rgba(245, 158, 11, 0.2)';
  
  return (
    <g key={`door-${index}`}>
      <path
        d={d}
        fill={fill}
        stroke={stroke}
        strokeWidth={isOpen ? 1.5 : 2}
        strokeDasharray={isOpen ? '4 3' : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={dAlt}
        fill="none"
        stroke="rgba(15, 23, 42, 0.75)"
        strokeWidth={0.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  );
};

const renderFeature = (feature: MapStructureFeature, index: number) => {
  const type = feature.type || 'feature';
  const color = type.includes('trap')
    ? '#ef4444'
    : type.includes('chest')
      ? '#f59e0b'
      : type.includes('statue')
        ? '#38bdf8'
        : type.includes('fountain')
          ? '#22d3ee'
          : '#a3e635';

  if (type.includes('trap')) {
    return (
      <polygon
        key={`feature-${index}`}
        points={`${feature.x},${feature.y - 6} ${feature.x - 6},${feature.y + 6} ${feature.x + 6},${feature.y + 6}`}
        fill={`${color}55`}
        stroke={color}
        strokeWidth={1.5}
      />
    );
  }
  if (type.includes('chest')) {
    return (
      <rect
        key={`feature-${index}`}
        x={feature.x - 5}
        y={feature.y - 5}
        width={10}
        height={10}
        fill={`${color}55`}
        stroke={color}
        strokeWidth={1.5}
        rx={2}
      />
    );
  }
  if (type.includes('statue')) {
    return (
      <rect
        key={`feature-${index}`}
        x={feature.x - 4}
        y={feature.y - 7}
        width={8}
        height={14}
        fill={`${color}55`}
        stroke={color}
        strokeWidth={1.5}
        rx={3}
      />
    );
  }
  return (
    <circle
      key={`feature-${index}`}
      cx={feature.x}
      cy={feature.y}
      r={5}
      fill={`${color}55`}
      stroke={color}
      strokeWidth={1.5}
    />
  );
};

const getRoomPalette = (room: MapStructureRoom) => {
  const type = (room.type || '').toLowerCase();
  
  // Glassmorphism Palette: semi-transparent fills with bright, thin borders
  if (type.includes('entrance')) return { fill: 'rgba(59, 130, 246, 0.15)', stroke: '#60a5fa' }; // Blue
  if (type.includes('corridor')) return { fill: 'rgba(148, 163, 184, 0.08)', stroke: '#94a3b8' }; // Slate
  if (type.includes('boss')) return { fill: 'rgba(239, 68, 68, 0.15)', stroke: '#f87171' }; // Red
  if (type.includes('secret')) return { fill: 'rgba(192, 132, 252, 0.15)', stroke: '#c084fc' }; // Purple
  if (type.includes('hall')) return { fill: 'rgba(56, 189, 248, 0.12)', stroke: '#38bdf8' }; // Sky
  if (type.includes('tavern') || type.includes('inn')) return { fill: 'rgba(251, 146, 60, 0.15)', stroke: '#fb923c' }; // Orange
  if (type.includes('shop')) return { fill: 'rgba(250, 204, 21, 0.15)', stroke: '#facc15' }; // Yellow
  
  // Default fallback - try to use room color with lowered opacity, or default slate
  return { 
      fill: room.color?.replace(/0\.9\d?/, '0.15') || 'rgba(148, 163, 184, 0.1)', 
      stroke: 'rgba(148, 163, 184, 0.4)' 
  };
};

const getRoomLabel = (room: MapStructureRoom) => {
  if (room.name && room.name.trim()) return room.name.trim();
  if (room.type && room.type.trim()) return room.type.trim();
  return room.id;
};

export const MapStructureSVG: React.FC<MapStructureSVGProps> = ({ data, className }) => {
  const uid = useId().replace(/[:]/g, '_');
  const gridId = `map-structure-grid-${uid}`;
  const grainId = `map-structure-grain-${uid}`;
  const bgId = `map-structure-bg-${uid}`;
  const roughId = `map-structure-rough-${uid}`;
  const roomShadowId = `map-structure-room-shadow-${uid}`;

  return (
    <svg
      width={data.mapSize.width}
      height={data.mapSize.height}
      viewBox={`0 0 ${data.mapSize.width} ${data.mapSize.height}`}
      className={className || 'block bg-[#050505]'}
    >
      <defs>
        <linearGradient id={bgId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#04070d" />
          <stop offset="55%" stopColor="#080d16" />
          <stop offset="100%" stopColor="#03050a" />
        </linearGradient>
        <pattern id={gridId} width={20} height={20} patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255, 255, 255, 0.05)" strokeWidth="1" />
        </pattern>
        <pattern id={grainId} width={6} height={6} patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="0.45" fill="rgba(255,255,255,0.08)" />
          <circle cx="4" cy="3" r="0.35" fill="rgba(255,255,255,0.06)" />
          <circle cx="2" cy="5" r="0.3" fill="rgba(255,255,255,0.05)" />
        </pattern>
        <filter id={roughId} x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="9" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.4" />
        </filter>
        <filter id={roomShadowId} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="4" stdDeviation="6" floodColor="#000000" floodOpacity="0.4" />
        </filter>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${bgId})`} />
      <rect width="100%" height="100%" fill={`url(#${gridId})`} />
      <rect width="100%" height="100%" fill={`url(#${grainId})`} opacity={0.24} />

      <g className="map-structure-rooms">
        {data.rooms.map((room) => {
          const palette = getRoomPalette(room);
          const label = getRoomLabel(room);
          const roomPath = getRoomPath(room, 1.0);
          const roomPathAlt = getRoomPath(room, 0.62);
          const center = getRoomCenter(room);
          const labelX = center.x;
          const labelY = center.y;
          // Replaced with cleaner rendering
          return (
            <g key={room.id} className="group transition-all duration-500">
              <path
                d={roomPath}
                fill={palette.fill}
                stroke={palette.stroke}
                strokeWidth={1.5}
                className="transition-all duration-300 group-hover:fill-opacity-30"
                filter={`url(#${roomShadowId})`}
              >
                {room.description && <title>{room.description}</title>}
              </path>
              
              {/* Subtle sketchy accent line */}
              <path
                d={roomPathAlt}
                fill="none"
                stroke={palette.stroke}
                strokeWidth={1}
                strokeOpacity={0.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter={`url(#${roughId})`}
              />

              {/* Text Label - No background box, using shadow for contrast */}
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={10}
                fill="rgba(255,255,255,0.9)"
                style={{ 
                    fontFamily: 'Inter, sans-serif',
                    textShadow: '0 2px 4px rgba(0,0,0,0.9), 0 0 4px rgba(0,0,0,0.7)',
                    pointerEvents: 'none',
                    letterSpacing: '0.05em'
                }}
                className="opacity-90 group-hover:opacity-100 transition-opacity select-none"
              >
                {label}
              </text>
            </g>
          );
        })}
      </g>

      <g className="map-structure-doors">
        {(Array.isArray(data.doors) ? data.doors : []).map(renderDoor)}
      </g>

      <g className="map-structure-features">
        {(Array.isArray(data.features) ? data.features : []).map(renderFeature)}
      </g>
    </svg>
  );
};
