import { WorldMapData, Confidant, GeoPoint } from "../types";

export interface MapDrawOptions {
    floor: number;
    scale: number;
    offset: { x: number; y: number };
    showTerritories: boolean;
    showNPCs: boolean;
    showPlayer: boolean;
    showLabels?: boolean;
    scope?: 'macro' | 'mid';
    focusMacroId?: string | null;
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

export const drawWorldMapCanvas = (
    ctx: CanvasRenderingContext2D,
    mapData: WorldMapData,
    options: MapDrawOptions
) => {
    const { floor, scale, offset, showTerritories, showNPCs, showPlayer, showLabels, currentPos, confidants, scope = 'mid', focusMacroId } = options;
    const sizeFactor = Math.max(0.3, Math.min(1.2, mapData.config.width / 60000));
    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offset.x * dpr, offset.y * dpr);

    // Background
    ctx.fillStyle = "#020408";
    ctx.fillRect(0, 0, mapData.config.width, mapData.config.height);

    const macroLocations = Array.isArray(mapData.macroLocations) ? mapData.macroLocations : [];
    const midLocations = Array.isArray(mapData.midLocations) ? mapData.midLocations : [];

    const drawAreaShape = (area: any) => {
        if (!area) return null;
        if (area.shape === 'CIRCLE' && area.center && area.radius) {
            const path = new Path2D();
            path.arc(area.center.x, area.center.y, area.radius, 0, Math.PI * 2);
            return path;
        }
        if (area.shape === 'RECT' && area.center && area.width && area.height) {
            const path = new Path2D();
            path.rect(area.center.x - area.width / 2, area.center.y - area.height / 2, area.width, area.height);
            return path;
        }
        if (area.shape === 'POLYGON' && Array.isArray(area.points) && area.points.length > 2) {
            const path = new Path2D();
            path.moveTo(area.points[0].x, area.points[0].y);
            area.points.slice(1).forEach((p: any) => path.lineTo(p.x, p.y));
            path.closePath();
            return path;
        }
        return null;
    };

    if (scope === 'macro') {
        const useMacros = macroLocations.length > 0 ? macroLocations : [];
        const shouldRenderMids = useMacros.length <= 1 && midLocations.length > 0;
        useMacros.forEach(m => {
            const path = drawAreaShape(m.area);
            if (!path) return;
            const isFocus = focusMacroId && m.id === focusMacroId;
            ctx.save();
            ctx.globalAlpha = isFocus ? 0.28 : 0.18;
            ctx.fillStyle = isFocus ? '#1d4ed8' : '#0f172a';
            ctx.fill(path);
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = isFocus ? '#60a5fa' : '#334155';
            ctx.lineWidth = Math.max(1, 6 * sizeFactor);
            ctx.setLineDash([120 * sizeFactor, 80 * sizeFactor]);
            ctx.stroke(path);
            ctx.setLineDash([]);
            ctx.restore();

            if (showLabels && m.name) {
                ctx.save();
                ctx.globalAlpha = 0.75;
                ctx.fillStyle = '#e2e8f0';
                ctx.font = `bold ${Math.max(12, 70 * sizeFactor)}px 'Noto Serif SC', serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                const labelPos = m.area?.center || m.coordinates;
                ctx.fillText(m.name, labelPos.x, labelPos.y);
                ctx.restore();
            }
        });

        const spotItems = shouldRenderMids ? midLocations : useMacros;
        spotItems.forEach(item => {
            const point = item.coordinates;
            if (!point) return;
            ctx.save();
            ctx.beginPath();
            ctx.arc(point.x, point.y, Math.max(40, 180 * sizeFactor), 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = Math.max(1, 4 * sizeFactor);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            if (showLabels && item.name) {
                ctx.save();
                ctx.fillStyle = '#f8fafc';
                ctx.font = `bold ${Math.max(10, 60 * sizeFactor)}px 'Noto Serif SC', serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillText(item.name, point.x, point.y + Math.max(60, 260 * sizeFactor));
                ctx.restore();
            }
        });
    }

    if (scope === 'mid') {
        // Territories
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
                ctx.save();
                ctx.globalAlpha = t.opacity || 0.18;
                ctx.fillStyle = t.color;
                ctx.fill(path);
                ctx.restore();
                ctx.save();
                ctx.strokeStyle = t.color;
                ctx.lineWidth = Math.max(1, 8 * sizeFactor);
                ctx.setLineDash([80 * sizeFactor, 40 * sizeFactor]);
                ctx.stroke(path);
                ctx.restore();

                if (showLabels) {
                    ctx.save();
                    ctx.globalAlpha = 0.7;
                    ctx.fillStyle = t.color;
                    ctx.font = `bold ${Math.max(12, 80 * sizeFactor)}px 'Noto Serif SC', serif`;
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";
                    ctx.fillText(t.name, t.centerX, t.centerY);
                    ctx.restore();
                }
            });
        }

        // Terrain
        mapData.terrain.filter(f => (f.floor || 0) === floor).forEach(feat => {
            const path = new Path2D(feat.path);
            const color = feat.color?.toLowerCase();
            const shouldFill = !!feat.color && color !== 'none' && color !== 'transparent' && color !== 'rgba(0,0,0,0)';
            if (shouldFill) {
                ctx.fillStyle = feat.color;
                ctx.fill(path);
            }
            if (feat.strokeColor && feat.strokeWidth) {
                ctx.strokeStyle = feat.strokeColor;
                ctx.lineWidth = Math.min(feat.strokeWidth * sizeFactor, 16 * sizeFactor);
                ctx.stroke(path);
            }
        });

        // Routes
        mapData.routes.filter(r => (r.floor || 0) === floor).forEach(route => {
            const path = new Path2D(route.path);
            ctx.save();
            ctx.strokeStyle = route.color;
            ctx.lineWidth = Math.max(1, route.width * sizeFactor);
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (route.type === 'ALLEY') {
                ctx.setLineDash([90 * sizeFactor, 60 * sizeFactor]);
            } else if (route.type === 'TRADE_ROUTE') {
                ctx.setLineDash([160 * sizeFactor, 90 * sizeFactor]);
            }
            ctx.stroke(path);
            ctx.setLineDash([]);
            ctx.restore();
        });

        // Locations
        mapData.surfaceLocations.filter(l => (l.floor || 0) === floor).forEach(loc => {
            ctx.save();
            ctx.beginPath();
            ctx.arc(loc.coordinates.x, loc.coordinates.y, loc.radius, 0, Math.PI * 2);
            ctx.fillStyle = loc.type === 'GUILD' ? 'rgba(59, 130, 246, 0.08)' : 'rgba(251, 191, 36, 0.04)';
            ctx.strokeStyle = loc.type === 'GUILD' ? '#3b82f6' : '#fbbf24';
            ctx.lineWidth = Math.max(1, 4 * sizeFactor);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(loc.coordinates.x, loc.coordinates.y, 40 * sizeFactor, 0, Math.PI * 2);
            ctx.fillStyle = "#000";
            ctx.strokeStyle = "#fff";
            ctx.lineWidth = Math.max(1, 3 * sizeFactor);
            ctx.fill();
            ctx.stroke();
            ctx.restore();

            if (showLabels && loc.name) {
                ctx.save();
                ctx.font = `bold ${Math.max(9, 60 * sizeFactor)}px 'Noto Serif SC', serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.lineWidth = Math.max(1, 8 * sizeFactor);
                ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
                ctx.fillStyle = "#f8fafc";
                const labelY = loc.coordinates.y + loc.radius + 45 * sizeFactor;
                ctx.strokeText(loc.name, loc.coordinates.x, labelY);
                ctx.fillText(loc.name, loc.coordinates.x, labelY);
                ctx.restore();
            }
        });
    }

    // NPCs
    if (showNPCs) {
        const entities = getVisibleEntities(confidants).filter(npc => npc.坐标);
        entities.forEach(npc => {
            if (!npc.坐标) return;
            ctx.save();
            ctx.translate(npc.坐标.x, npc.坐标.y);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = npc.是否队友 ? '#9333ea' : '#ec4899';
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = Math.max(1, 5 * sizeFactor);
            ctx.fillRect(-30 * sizeFactor, -30 * sizeFactor, 60 * sizeFactor, 60 * sizeFactor);
            ctx.strokeRect(-30 * sizeFactor, -30 * sizeFactor, 60 * sizeFactor, 60 * sizeFactor);
            ctx.restore();

            if (showLabels) {
                ctx.save();
                ctx.fillStyle = "#ffffff";
                ctx.font = `${Math.max(9, 50 * sizeFactor)}px sans-serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "bottom";
                ctx.fillText(npc.姓名, npc.坐标.x, npc.坐标.y - 40 * sizeFactor);
                ctx.restore();
            }
        });
    }

    // Player marker
    if (showPlayer) {
        ctx.save();
        ctx.translate(currentPos.x, currentPos.y);
        ctx.beginPath();
        ctx.arc(0, 0, 55 * sizeFactor, 0, Math.PI * 2);
        ctx.fillStyle = "#22c55e";
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = Math.max(1, 7 * sizeFactor);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, 0, 120 * sizeFactor, 0, Math.PI * 2);
        ctx.strokeStyle = "#22c55e";
        ctx.lineWidth = Math.max(1, 4 * sizeFactor);
        ctx.setLineDash([26 * sizeFactor, 8 * sizeFactor]);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();

        if (showLabels) {
            ctx.save();
            ctx.fillStyle = "#e2e8f0";
            ctx.font = `${Math.max(9, 45 * sizeFactor)}px sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "bottom";
            ctx.fillText("玩家", currentPos.x, currentPos.y - 70 * sizeFactor);
            ctx.font = `${Math.max(8, 38 * sizeFactor)}px monospace`;
            ctx.fillText(`${Math.round(currentPos.x)}, ${Math.round(currentPos.y)}`, currentPos.x, currentPos.y - 32 * sizeFactor);
            ctx.restore();
        }
    }
};


