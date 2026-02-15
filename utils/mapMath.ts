export const clampScale = (value: number, min = 0.1, max = 5) =>
  Math.max(min, Math.min(max, value));

export const buildSvgRoomPath = (bounds: { x: number; y: number; width: number; height: number }) =>
  `M${bounds.x} ${bounds.y} H${bounds.x + bounds.width} V${bounds.y + bounds.height} H${bounds.x} Z`;

export const buildHandDrawnPath = (points: { x: number; y: number }[], close = true, wiggle = 1.0) => {
  if (points.length < 2) return '';
  
  let d = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 0; i < points.length; i++) {
    const start = points[i];
    const end = points[(i + 1) % points.length];
    
    // Skip the last segment if we are not closing the loop
    if (!close && i === points.length - 1) break;

    // Direct line for very short segments
    const dist = Math.hypot(end.x - start.x, end.y - start.y);
    if (dist < 5) {
      d += ` L ${end.x} ${end.y}`;
      continue;
    }

    // Bézier curve for wobble
    const midX = (start.x + end.x) / 2;
    const midY = (start.y + end.y) / 2;
    
    // Deterministic pseudo-random based on coordinates to keep drawing stable
    const seed = (start.x * 123 + start.y * 456 + end.x * 789);
    const rand = (n: number) => {
      const x = Math.sin(seed + n) * 10000;
      return x - Math.floor(x);
    };

    const perpX = -(end.y - start.y);
    const perpY = end.x - start.x;
    const len = Math.sqrt(perpX * perpX + perpY * perpY);
    const nx = perpX / len;
    const ny = perpY / len;

    const offset = (rand(1) - 0.5) * wiggle * 2; // Reduced wobble, customizable
    const cx = midX + nx * offset;
    const cy = midY + ny * offset;

    d += ` Q ${cx} ${cy}, ${end.x} ${end.y}`;
  }

  if (close) d += ' Z';
  return d;
};


export const normalizeWheelDelta = (deltaY: number) =>
  Math.max(-1, Math.min(1, -deltaY * 0.001));

export const clampOffset = (
  offset: { x: number; y: number },
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
) => ({
  x: Math.max(bounds.minX, Math.min(bounds.maxX, offset.x)),
  y: Math.max(bounds.minY, Math.min(bounds.maxY, offset.y))
});

export const getGridSpacing = (scale: number) =>
  (scale <= 0.5 ? 800 : scale <= 1 ? 400 : scale <= 2 ? 200 : 100);

export const computeZoomAnchor = ({
  scale,
  offset,
  deltaScale,
  anchor
}: {
  scale: number;
  offset: { x: number; y: number };
  deltaScale: number;
  anchor: { x: number; y: number };
}) => {
  const nextScale = clampScale(scale + deltaScale);
  const mapX = (anchor.x - offset.x) / scale;
  const mapY = (anchor.y - offset.y) / scale;
  const nextOffset = {
    x: anchor.x - mapX * nextScale,
    y: anchor.y - mapY * nextScale
  };
  return { scale: nextScale, offset: nextOffset };
};
