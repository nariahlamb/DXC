import React, { useState } from 'react';
import { Eye, EyeOff, Layers, Minus, Plus, RotateCcw, Target } from 'lucide-react';

export const MapControls: React.FC<{
  onZoomIn: () => void;
  onZoomOut: () => void;
  onCenter: () => void;
  onReset?: () => void;
  showTerritories?: boolean;
  onToggleTerritories?: () => void;
  showNPCs?: boolean;
  onToggleNPCs?: () => void;
  isLayoutView?: boolean;
  className?: string;
}> = ({onZoomIn,
  onZoomOut,
  onCenter,
  onReset,
  showTerritories,
  onToggleTerritories,
  showNPCs,
  onToggleNPCs,
  isLayoutView,
  className
}) => {
  const [showLayerMenu, setShowLayerMenu] = useState(false);

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {/* Zoom / Nav Dock */}
      <div className="flex flex-col bg-black/80 backdrop-blur-md rounded-full border border-white/10 shadow-2xl p-2 gap-2">
        <button
          onClick={onZoomIn}
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
          title="放大"
        >
          <Plus size={18} />
        </button>
        <button
          onClick={onZoomOut
          }
          className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
          title="缩小"
        >
          <Minus size={18} />
        </button>
        <div className="w-full h-px bg-white/10 my-1" />
        <button
          onClick={onCenter}
          className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/20 rounded-full transition-all"
          title="定位玩家"
        >
          <Target size={18} />
        </button>
        {onReset && (
          <button
            onClick={onReset}
            className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
            title="重置视图"
          >
            <RotateCcw size={16} />
          </button>
        )}
      </div>

      {/* Layer Control */}
      {!isLayoutView && (onToggleTerritories || onToggleNPCs) && (
        <div className="relative group">
          <button
             onClick={() => setShowLayerMenu(!showLayerMenu)}
             className={`p-3 rounded-full border border-white/10 shadow-xl backdrop-blur-md transition-all ${showLayerMenu ? 'bg-blue-600 text-white' : 'bg-black/80 text-zinc-400 hover:text-white'}`}
             title="图层控制"
          >
            <Layers size={18} />
          </button>
          
          {/* Popup Menu (appears to the left) */}
          {(showLayerMenu || false) && (
             <div className="absolute right-full top-0 mr-3 w-32 bg-black/90 border border-zinc-800 rounded-lg p-2 shadow-2xl backdrop-blur-xl flex flex-col gap-1">
                {onToggleTerritories && (
                  <button
                    onClick={onToggleTerritories}
                    className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${showTerritories ? 'text-blue-200 bg-blue-900/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <span>领地</span>
                    {showTerritories ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                )}
                {onToggleNPCs && (
                  <button
                    onClick={onToggleNPCs}
                    className={`flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors ${showNPCs ? 'text-blue-200 bg-blue-900/30' : 'text-zinc-500 hover:text-zinc-300'}`}
                  >
                    <span>NPC</span>
                    {showNPCs ? <Eye size={12} /> : <EyeOff size={12} />}
                  </button>
                )}
             </div>
          )}
        </div>
      )}
    </div>
  );
};