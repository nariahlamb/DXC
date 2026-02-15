import React from 'react';
import { Radio } from 'lucide-react';
import { normalizeNewsItems } from '../../utils/normalizers';
import type { NewsItem } from '../../types';

interface BottomBannerProps {
  isHellMode?: boolean;
  announcements?: NewsItem[] | string[];
}

export const BottomBanner: React.FC<BottomBannerProps> = ({ isHellMode, announcements }) => {
  const normalized = normalizeNewsItems(announcements);
  const baseAnnouncements = normalized
    .map((item) => item.标题)
    .filter((item) => typeof item === 'string' && item.trim().length > 0);
    
  const displayItems = baseAnnouncements.length > 0
    ? baseAnnouncements
    : ['暂无最新公告'];
    
  // Duplicate for smooth loop
  const loopItems = displayItems.length > 0 ? [...displayItems, ...displayItems, ...displayItems] : ['System Normal'];

  return (
    <div className="w-full h-auto min-h-[32px] relative z-40 shrink-0 bg-[#0a0c10]">
        <div className="relative w-full h-8 flex items-center bg-surface-glass backdrop-blur-md border-t border-white/5 overflow-hidden">

            {/* Left Label */}
            <div className="hidden md:flex items-center gap-2 px-4 h-full bg-surface-base/50 border-r border-white/5 text-[10px] font-bold uppercase tracking-widest text-accent-gold z-10">
                <Radio size={12} className="animate-pulse" />
                <span>系统广播</span>
            </div>

            {/* Scrolling Ticker */}
            <div className="flex-1 relative h-full overflow-hidden mask-fade-sides">
                <div className="absolute top-0 h-full flex items-center whitespace-nowrap animate-marquee gap-8 pl-4">
                    {loopItems.map((item, idx) => (
                        <div key={`${item}-${idx}`} className="flex items-center gap-2 text-xs font-mono text-content-secondary">
                            <span className="w-1.5 h-1.5 bg-content-muted rounded-full opacity-50" />
                            <span>{item === 'System Normal' ? '系统运行正常' : item}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Decorative Right Edge */}
            <div className="w-12 h-full bg-gradient-to-l from-surface-base to-transparent pointer-events-none z-10" />
        </div>

        {/* Safe Area Spacer */}
        <div className="w-full h-safe-bottom bg-[#0a0c10]" />
    </div>
  );
};