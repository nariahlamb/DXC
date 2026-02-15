import { WorldMapData, Confidant, GeoPoint } from "../types";
import { getGridSpacing } from "./mapMath";

export interface MapDrawOptions {
    floor: number;
    scale: number;
    offset: { x: number; y: number };
    showTerritories: boolean;
    showNPCs: boolean;
    showPlayer: boolean;
    showLabels?: boolean;
    currentPos: GeoPoint;
    confidants: Confidant[];
}

export const resizeCanvasToContainer = (canvas: HTMLCanvasElement, container: HTMLDivElement | null) => {
    if (!container) return;
    const dpr = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = container;
    const width = Math.max(1, Math.floor(clientWidth * dpr));
    const height = Math.max(1, Math.floor(clientHeight * dpr));
    if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
    }
};

const getVisibleEntities = (confidants: Confidant[]) =>
    confidants.filter(c => (c.是否在场 || c.特别关注 || c.是否队友) && c.坐标);

// Helper to draw rounded rect
const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    if (w < 2 * r) r = w / 2;
    if (h < 2 * r) r = h / 2;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
};

export const drawWorldMapCanvas = (
    ctx: CanvasRenderingContext2D,
    mapData: WorldMapData,
    options: MapDrawOptions
) => {
    const { floor, scale, offset, showTerritories, showNPCs, showPlayer, showLabels, currentPos, confidants } = options;
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    
    // Clear & Setup
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Fill Background
    ctx.fillStyle = "#050505";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Coordinate Projection Helpers
    const toScreenX = (worldX: number) => (worldX * scale + offset.x) * dpr;
    const toScreenY = (worldY: number) => (worldY * scale + offset.y) * dpr;
    const toScreenSize = (worldSize: number) => worldSize * scale * dpr;

    // --- World Space Rendering Layer ---
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offset.x * dpr, offset.y * dpr);

    // 1. Grid (Subtle)
    const gridSpacing = getGridSpacing(scale);
    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1 / scale; // Constant 1px width regardless of zoom
    
    // Optimize grid drawing: only draw visible lines
    // Visible world bounds:
    const startX = Math.floor(-offset.x / scale / gridSpacing) * gridSpacing;
    const endX = startX + (canvas.width / dpr / scale) + gridSpacing;
    const startY = Math.floor(-offset.y / scale / gridSpacing) * gridSpacing;
    const endY = startY + (canvas.height / dpr / scale) + gridSpacing;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += gridSpacing) {
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSpacing) {
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
    }
    ctx.stroke();
    ctx.restore();

    // 2. Territories
    if (showTerritories) {
        const territories = mapData.territories.filter(t => (t.floor || 0) === floor);
        territories.forEach(t => {
            let path: Path2D | null = null;
            if (t.sector) {
                 const startRad = (t.sector.startAngle * Math.PI) / 180;
                const endRad = (t.sector.endAngle * Math.PI) / 180;
                const innerRadius = Math.max(0, t.sector.innerRadius || 0);
                const outerRadius = t.sector.outerRadius;
                path = new Path2D();
                const cx = t.centerX;
                const cy = t.centerY;
                path.moveTo(cx + innerRadius * Math.cos(startRad), cy + innerRadius * Math.sin(startRad));
                path.arc(cx, cy, outerRadius, startRad, endRad);
                if (innerRadius > 0) {
                    path.arc(cx, cy, innerRadius, endRad, startRad, true);
                } else {
                    path.lineTo(cx, cy);
                }
                path.closePath();
            } else if (t.points && t.points.length > 2) {
                path = new Path2D();
                path.moveTo(t.points[0].x, t.points[0].y);
                t.points.slice(1).forEach(p => path!.lineTo(p.x, p.y));
                path.closePath();
            } else if (t.boundary) {
                path = new Path2D(t.boundary);
            }

            if (!path) return;

            // Fill
            ctx.save();
            ctx.globalAlpha = t.opacity ? t.opacity * 0.5 : 0.1; // Reduced opacity
            ctx.fillStyle = t.color;
            ctx.fill(path);
            ctx.restore();

            // Stroke
            ctx.save();
            ctx.strokeStyle = t.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 1 / scale; // Thin hair-line
            ctx.stroke(path);
            ctx.restore();
        });
    }

    // 3. Terrain
    mapData.terrain.filter(f => (f.floor || 0) === floor).forEach(feat => {
        const path = new Path2D(feat.path);
        const color = feat.color?.toLowerCase();
        if (color && color !== 'none') {
            ctx.fillStyle = feat.color;
            ctx.fill(path);
        }
        if (feat.strokeColor) {
            ctx.strokeStyle = feat.strokeColor;
            ctx.lineWidth = (feat.strokeWidth || 1) / scale;
            ctx.stroke(path);
        }
    });

    // 4. Routes
    mapData.routes.filter(r => (r.floor || 0) === floor).forEach(route => {
        const path = new Path2D(route.path);
        ctx.save();
        ctx.strokeStyle = route.color;
        ctx.lineWidth = Math.max(1 / scale, (route.width || 2) * (1/scale) * 0.5); // Thinner
        ctx.globalAlpha = 0.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        if (route.type === 'ALLEY') ctx.setLineDash([5 / scale, 5 / scale]);
        if (route.type === 'TRADE_ROUTE') ctx.setLineDash([10 / scale, 5 / scale]);
        ctx.stroke(path);
        ctx.restore();
    });

    // 5. Locations (Geometry)
    const locations = mapData.surfaceLocations.filter(l => (l.floor || 0) === floor);
    locations.forEach(loc => {
        const visited = loc.visited !== false;
        
        // Outer Circle (Area)
        ctx.beginPath();
        ctx.arc(loc.coordinates.x, loc.coordinates.y, loc.radius, 0, Math.PI * 2);
        ctx.fillStyle = visited 
            ? (loc.type === 'GUILD' ? 'rgba(59, 130, 246, 0.05)' : 'rgba(255, 255, 255, 0.02)') 
            : 'rgba(0,0,0,0)';
        ctx.fill();
        
        if (visited) {
            ctx.strokeStyle = loc.type === 'GUILD' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 1 / scale;
            ctx.stroke();
        }

        // Center Dot
        ctx.beginPath();
        const dotSize = Math.max(3 / scale, 3); // Minimum 3px dot
        ctx.arc(loc.coordinates.x, loc.coordinates.y, dotSize, 0, Math.PI * 2);
        ctx.fillStyle = visited ? "#fff" : "#444";
        ctx.fill();
    });

    // --- Screen Space Rendering Layer (Text & UI) ---
    // Reset transform to draw text/icons at fixed screen size
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    if (showLabels) {
        ctx.font = "12px Inter, Roboto, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        // Location Labels
        locations.forEach(loc => {
            const visited = loc.visited !== false;
            if (!visited || !loc.name) return;

            const sx = toScreenX(loc.coordinates.x) / dpr;
            const sy = toScreenY(loc.coordinates.y) / dpr;

            // Simple culling
            if (sx < -100 || sx > canvas.width/dpr + 100 || sy < -100 || sy > canvas.height/dpr + 100) return;

            // Offset label below the dot
            const labelY = sy + 15;
            
            const metrics = ctx.measureText(loc.name);
            const bgPadding = 6;
            const bgW = metrics.width + bgPadding * 2;
            const bgH = 20;
            const bgX = sx - bgW / 2;
            const bgY = labelY - bgH / 2;

            // Draw Label Background (Glassy & Premium)
            ctx.save();
            ctx.fillStyle = "rgba(2, 6, 23, 0.85)"; // Deep dark blue-black
            ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
            ctx.shadowBlur = 6;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
            ctx.lineWidth = 0.5;
            
            roundRect(ctx, bgX, bgY, bgW, bgH, 4);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            // Draw Text
            ctx.fillStyle = "#f8fafc";
            ctx.font = "500 11px Inter, Roboto, sans-serif"; // Slightly smaller, refined weight
            ctx.fillText(loc.name, sx, labelY);
        });

        // Territory Labels (if zoomed out enough)
        if (showTerritories && scale < 0.2) {
             const territories = mapData.territories.filter(t => (t.floor || 0) === floor);
             territories.forEach(t => {
                 const sx = toScreenX(t.centerX) / dpr;
                 const sy = toScreenY(t.centerY) / dpr;
                  // Simple culling
                 if (sx < -100 || sx > canvas.width/dpr + 100 || sy < -100 || sy > canvas.height/dpr + 100) return;

                 ctx.save();
                 ctx.font = "bold 14px Inter, sans-serif";
                 ctx.globalAlpha = 0.6;
                 ctx.fillStyle = t.color;
                 ctx.shadowColor = "black";
                 ctx.shadowBlur = 4;
                 ctx.fillText(t.name, sx, sy);
                 ctx.restore();
             });
        }
    }

    // Player Marker (Screen Space for consistent size)
    if (showPlayer) {
        const sx = toScreenX(currentPos.x) / dpr;
        const sy = toScreenY(currentPos.y) / dpr;

        if (sx >= -50 && sx <= canvas.width/dpr + 50 && sy >= -50 && sy <= canvas.height/dpr + 50) {
            // Pulse Ring
            ctx.beginPath();
            ctx.arc(sx, sy, 12, 0, Math.PI * 2);
            ctx.fillStyle = "rgba(16, 185, 129, 0.3)";
            ctx.fill();

            // Core Dot
            ctx.beginPath();
            ctx.arc(sx, sy, 5, 0, Math.PI * 2);
            ctx.fillStyle = "#10b981";
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label
            if (showLabels) {
                 const labelY = sy - 20;
                 const text = "YOU";
                 ctx.font = "bold 10px monospace";
                 const metrics = ctx.measureText(text);
                 const bgW = metrics.width + 8;
                 const bgH = 16;
                 ctx.fillStyle = "rgba(16, 185, 129, 0.9)";
                 roundRect(ctx, sx - bgW/2, labelY - bgH/2, bgW, bgH, 3);
                 ctx.fill();
                 
                 ctx.fillStyle = "#fff";
                 ctx.fillText(text, sx, labelY + 1);
            }
        }
    }

    // NPC Markers
    if (showNPCs) {
        const entities = getVisibleEntities(confidants);
        entities.forEach(npc => {
            if (!npc.坐标) return;
            const sx = toScreenX(npc.坐标.x) / dpr;
            const sy = toScreenY(npc.坐标.y) / dpr;
            if (sx < -20 || sx > canvas.width/dpr + 20 || sy < -20 || sy > canvas.height/dpr + 20) return;

            ctx.beginPath();
            ctx.arc(sx, sy, 4, 0, Math.PI * 2);
            ctx.fillStyle = npc.是否队友 ? '#a855f7' : '#ec4899';
            ctx.fill();
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = 1;
            ctx.stroke();

             if (showLabels) {
                 const labelY = sy - 14;
                 ctx.font = "10px sans-serif";
                 const text = npc.姓名;
                 const metrics = ctx.measureText(text);
                 const bgW = metrics.width + 6;
                 const bgH = 14;
                 ctx.fillStyle = "rgba(0,0,0,0.7)";
                 roundRect(ctx, sx - bgW/2, labelY - bgH/2, bgW, bgH, 2);
                 ctx.fill();

                 ctx.fillStyle = "#fbcfe8"; // light pink text
                 ctx.fillText(text, sx, labelY);
            }
        });
    }
};