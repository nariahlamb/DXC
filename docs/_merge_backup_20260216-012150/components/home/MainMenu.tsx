import React from 'react';
import { Play, Lock, Settings } from 'lucide-react';
import { P5Button } from '../ui/P5Button';

interface MainMenuProps {
  onNewGame: () => void;
  onLoadGame: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({ onNewGame, onLoadGame, onOpenSettings }) => {
  return (
    <div className="flex flex-col gap-4 w-full max-w-sm z-20">
        <div className="w-full animate-in fade-in duration-500 delay-300">
            <P5Button
                label="开始游戏"
                variant="gold"
                icon={<Play className="fill-current" />}
                onClick={onNewGame}
                className="w-full shadow-[6px_6px_0_rgba(251,191,36,0.25)] hover:shadow-[8px_8px_0_rgba(251,191,36,0.3)] transition-shadow duration-300"
            />
        </div>

        <div className="w-full animate-in fade-in duration-500 delay-400">
            <P5Button
                label="继续冒险"
                variant="black"
                icon={<Lock />}
                onClick={onLoadGame}
                className="w-full shadow-[6px_6px_0_rgba(255,255,255,0.15)] hover:shadow-[8px_8px_0_rgba(255,255,255,0.2)] transition-shadow duration-300"
            />
        </div>

        <div className="w-full animate-in fade-in duration-500 delay-500">
            <P5Button
                label="系统设置"
                variant="white"
                icon={<Settings className="animate-spin-slow" />}
                onClick={onOpenSettings}
                className="w-full shadow-[6px_6px_0_rgba(37,99,235,0.35)] hover:shadow-[8px_8px_0_rgba(37,99,235,0.4)] transition-shadow duration-300"
            />
        </div>
    </div>
  );
};
