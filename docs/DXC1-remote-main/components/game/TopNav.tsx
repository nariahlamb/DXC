import React, { useState } from 'react';
import { MapPin, CloudRain, Sun, Maximize2, Minimize2, Swords, RefreshCw, CloudFog, CloudLightning, Snowflake, Moon, Cloud, Radio } from 'lucide-react';
import { GeoPoint } from '../../types';
import { BaseButton } from '../ui/base/BaseButton';

interface TopNavProps {
  time: string;
  location: string;
  locationHierarchy?: { macro?: string; mid?: string };
  floor: number;
  weather: string;
  coords: GeoPoint;
  isHellMode?: boolean;
  onOpenInventory?: () => void;
  onOpenTasks?: () => void;
  onOpenPhone?: () => void;
  hasPhone?: boolean;
  unreadMessages?: number;
  activeTasks?: number;
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

export const TopNav: React.FC<TopNavProps> = ({
    time, location, locationHierarchy, floor, weather, coords,
    enableCombatUI = true, onToggleCombatUI, onManualMapUpdate, isMapUpdating
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  const toggleFullscreen = () => {
      if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(console.error);
          setIsFullscreen(true);
      } else {
          if (document.exitFullscreen) {
              document.exitFullscreen();
              setIsFullscreen(false);
          }
      }
  };

  // Parse time string
  let dayStr = "第 1 日";
  let timeStr = "00:00";
  
  const match = time.match(/第(\d+)日\s+(\d{2}:\d{2})/);
  if (match) {
      dayStr = `第 ${match[1]} 日`;
      timeStr = match[2];
  } else if(time.includes(' ')) {
        const p = time.split(' ');
        dayStr = p[0];
        timeStr = p[1];
  }

  const hasSpecificHierarchy = !!locationHierarchy?.mid;
  const mainLocation = hasSpecificHierarchy
    ? (locationHierarchy?.mid || locationHierarchy?.macro || location)
    : (location || locationHierarchy?.macro || '未知地点');
  const subLocation = locationHierarchy?.mid ? locationHierarchy?.macro : '';

  return (
    <div className="w-full relative z-[60] shrink-0 pointer-events-none">
        {/* Dynamic HUD Bar - Increased to h-16 for better vertical spacing */}
        <div className="bg-black/80 backdrop-blur-md border-b border-white/10 h-16 flex items-center justify-between px-6 pointer-events-auto shadow-lg relative overflow-hidden">
            
            {/* Background Tech Lines */}
            <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-1/2 h-[1px] bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>
                <div className="absolute bottom-0 right-0 w-32 h-[1px] bg-white/30"></div>
                <div className="absolute top-0 left-0 w-32 h-[1px] bg-white/30"></div>
            </div>

            {/* Left: Status Module */}
            <div className="flex items-center h-full relative z-10">
                {/* Time HUD */}
                <div className="flex items-center bg-white/5 rounded-md px-4 py-2 border border-white/5 group hover:border-white/20 transition-colors mr-3">
                    <div className="mr-3 flex flex-col items-end leading-none">
                        <span className="text-xs text-white/40 font-mono tracking-wider mb-1">{dayStr}</span>
                        <span className="text-xl font-display font-bold text-amber-500 tracking-widest tabular-nums leading-none">{timeStr}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10 mx-2"></div>
                    <div className="ml-1 flex flex-col items-start leading-none justify-center h-full">
                         <div className="flex items-center gap-1.5 text-xs text-blue-200/80 mb-1">
                            {getWeatherIcon(weather)}
                            <span>{weather}</span>
                         </div>
                         <div className="flex items-center gap-1.5 text-[10px] text-emerald-500/80 font-mono">
                            <Radio size={10} className="animate-pulse" />
                            <span>ONLINE</span>
                         </div>
                    </div>
                </div>
            </div>

            {/* Center: Location HUD (Absolute Full Centered) */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                 <div className="flex items-center gap-6">
                     {/* Decorative Left Wing */}
                     <div className="hidden lg:flex items-center gap-2 opacity-30">
                         <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50"></div>
                         <div className="w-12 h-px bg-gradient-to-l from-amber-500/50 to-transparent"></div>
                     </div>

                     <div className="flex flex-col items-center justify-center">
                         <div className="flex items-center gap-2 mb-1">
                             <MapPin size={16} className="text-amber-500" />
                             <span className="text-lg md:text-xl font-display font-bold text-white tracking-[0.2em] uppercase drop-shadow-[0_0_10px_rgba(251,191,36,0.2)] leading-none">
                                {mainLocation}
                             </span>
                         </div>
                         <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-white/40 tracking-widest border border-white/10 px-1.5 py-0.5 rounded bg-black/40 leading-none">
                                {floor > 0 ? `B${floor}` : 'SURFACE'}
                            </span>
                            {subLocation && (
                                <span className="text-[10px] text-white/30 tracking-wider font-mono leading-none">
                                    // {subLocation}
                                </span>
                            )}
                         </div>
                     </div>

                     {/* Decorative Right Wing */}
                     <div className="hidden lg:flex items-center gap-2 opacity-30">
                         <div className="w-12 h-px bg-gradient-to-r from-amber-500/50 to-transparent"></div>
                         <div className="w-1.5 h-1.5 rounded-full bg-amber-500/50"></div>
                     </div>
                 </div>
            </div>

            {/* Right: Actions Module */}
            <div className="flex items-center gap-1 relative z-10">
                <div className="bg-black/40 rounded-full p-1.5 border border-white/5 flex items-center gap-1 backdrop-blur-sm">
                    <BaseButton
                        variant="ghost"
                        size="icon"
                        onClick={onManualMapUpdate}
                        disabled={!onManualMapUpdate || isMapUpdating}
                        title={isMapUpdating ? "Updating..." : "Refresh Map"}
                        className={`w-9 h-9 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all ${isMapUpdating ? "animate-spin text-amber-500" : ""}`}
                    >
                        <RefreshCw size={16} />
                    </BaseButton>

                    <BaseButton
                        variant={enableCombatUI ? "danger" : "ghost"}
                        size="icon"
                        onClick={onToggleCombatUI}
                        title="Toggle Combat HUD"
                        className={`w-9 h-9 rounded-full transition-all ${enableCombatUI ? "bg-red-500/20 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.2)] hover:bg-red-500/30" : "hover:bg-white/10 text-white/70 hover:text-white"}`}
                    >
                        <Swords size={16} />
                    </BaseButton>
                    
                    <BaseButton
                        variant="ghost"
                        size="icon"
                        onClick={toggleFullscreen}
                        title="Fullscreen"
                        className="w-9 h-9 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-all"
                    >
                        {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                    </BaseButton>
                </div>
            </div>
        </div>

        {/* Decorative Bottom Line (Scanning Effect) */}
        <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent opacity-50 relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent w-32 animate-[shimmer_3s_infinite] -translate-x-full"></div>
        </div>
    </div>
  );
};
