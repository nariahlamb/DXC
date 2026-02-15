import React, { useState } from 'react';
import { Clock, MapPin, CloudRain, Sun, Maximize2, Minimize2, Swords, CloudLightning, CloudFog, Snowflake, Moon, Cloud, Signal } from 'lucide-react';
import { GeoPoint } from '../../types';

interface MobileTopNavProps {
    time: string;
    location: string;
    locationHierarchy?: { macro?: string; mid?: string };
    weather: string;
    floor: number;
    coords?: GeoPoint;
    isHellMode?: boolean;
    enableCombatUI?: boolean;
    onToggleCombatUI?: () => void;
    onManualMapUpdate?: () => void;
    isMapUpdating?: boolean;
}

const getWeatherIcon = (weather: string) => {
    if (weather.includes('雨')) return <CloudRain size={14} className="text-blue-400" />;
    if (weather.includes('雪')) return <Snowflake size={14} className="text-white" />;
    if (weather.includes('雷')) return <CloudLightning size={14} className="text-purple-400" />;
    if (weather.includes('雾')) return <CloudFog size={14} className="text-gray-400" />;
    if (weather.includes('云') || weather.includes('阴')) return <Cloud size={14} className="text-gray-300" />;
    if (weather.includes('夜')) return <Moon size={14} className="text-amber-400" />;
    return <Sun size={14} className="text-amber-400" />;
};

export const MobileTopNav: React.FC<MobileTopNavProps> = ({ time, location, locationHierarchy, weather, floor, coords, isHellMode, enableCombatUI = true, onToggleCombatUI, onManualMapUpdate, isMapUpdating }) => {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.log(`Error attempting to enable fullscreen: ${e.message}`);
            });
            setIsFullscreen(true);
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    // Compact Time parsing
    let timeDisplay = "D1 00:00";
    const match = time.match(/第(\d+)日\s+(\d{2}:\d{2})/);
    if (match) {
        timeDisplay = `D${match[1]} ${match[2]}`;
    } else {
         const parts = time.split(' ');
         if (parts.length > 1) {
            timeDisplay = `${parts[0].replace('第','D').replace('日','')} ${parts[1]}`;
         } else {
            timeDisplay = time;
         }
    }

    const mainLocation = locationHierarchy?.mid || locationHierarchy?.macro || location;

    return (
        <div className="h-[calc(3.5rem+env(safe-area-inset-top))] pt-[env(safe-area-inset-top)] bg-black/90 backdrop-blur-xl border-b border-white/10 shadow-lg flex items-center justify-between px-4 shrink-0 z-50 overflow-hidden relative">
            
            {/* Background Tech Details */}
             <div className="absolute inset-0 z-0 opacity-10 pointer-events-none">
                <div className="absolute top-0 left-0 w-1/3 h-[1px] bg-white/50"></div>
                <div className="absolute bottom-0 right-0 w-1/3 h-[1px] bg-white/50"></div>
            </div>

            {/* Left: Time & Signal */}
            <div className="flex flex-col justify-center min-w-[70px] z-10">
                <div className="flex items-center gap-1.5 text-xs font-mono text-white/40 mb-0.5">
                     <Signal size={10} className="text-emerald-500" />
                     <span>NET</span>
                </div>
                <div className="flex items-baseline gap-1">
                     <span className="text-sm font-display font-bold text-amber-500 tracking-wider leading-none">{timeDisplay.split(' ')[1]}</span>
                     <span className="text-[10px] text-white/30 font-mono">{timeDisplay.split(' ')[0]}</span>
                </div>
            </div>

            {/* Center: Location */}
            <div className="flex-1 flex flex-col items-center justify-center px-2 overflow-hidden z-10">
                <span className="text-sm md:text-base font-display font-bold text-white tracking-widest truncate max-w-full drop-shadow-[0_0_5px_rgba(251,191,36,0.3)]">
                    {mainLocation}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                     <span className="text-[10px] text-amber-500/80 font-mono bg-amber-500/10 px-1 rounded border border-amber-500/20">
                        B{floor}
                     </span>
                </div>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-2 min-w-[70px] justify-end z-10">
                {/* Weather */}
                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-white/5">
                     {getWeatherIcon(weather)}
                </div>

                {/* Combat Toggle */}
                <button
                    onClick={onToggleCombatUI}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${enableCombatUI ? 'bg-red-500/20 text-red-500 border border-red-500/30 shadow-[0_0_8px_rgba(239,68,68,0.3)]' : 'bg-white/5 text-white/50 border border-white/10'}`}
                >
                    <Swords size={14} />
                </button>
            </div>
        </div>
    );
};
