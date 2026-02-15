import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import clsx from 'clsx';

export interface P5DropdownOption {
  label: string;
  value: string;
}

interface P5DropdownProps {
  options: P5DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
}

export const P5Dropdown: React.FC<P5DropdownProps> = ({ options, value, onChange, label, className = '' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedOption = options.find(opt => opt.value === value) || options[0];

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {label && (
        <label className="block text-xs font-bold uppercase mb-1 text-content-muted">{label}</label>
      )}
      
      {/* Trigger Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
            "w-full p-3 flex justify-between items-center group transition-all border-b-2",
            "bg-surface-glass backdrop-blur-sm",
            isOpen 
                ? 'border-accent-red text-content-primary shadow-glow' 
                : 'border-white/20 text-content-secondary hover:text-content-primary hover:border-white/40'
        )}
      >
        <span className="font-display uppercase text-sm tracking-wide transform group-hover:translate-x-1 transition-transform">
          {selectedOption.label}
        </span>
        <ChevronDown 
          className={clsx(
              "transition-transform duration-300", 
              isOpen ? 'rotate-180 text-accent-red' : 'text-content-muted'
          )}
          size={16} 
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 w-full z-50 mt-1">
          <div className="relative bg-surface-floating border border-white/10 shadow-xl max-h-60 overflow-y-auto custom-scrollbar transform origin-top animate-in fade-in slide-in-from-top-2 duration-200 rounded-b-lg">
             {options.map((option) => (
               <button
                 key={option.value}
                 onClick={() => {
                   onChange(option.value);
                   setIsOpen(false);
                 }}
                 className={clsx(
                     "w-full text-left px-4 py-2.5 font-ui text-sm transition-all border-b border-white/5 last:border-0",
                     option.value === value 
                       ? 'text-accent-red bg-white/5 font-bold pl-5 border-l-2 border-l-accent-red' 
                       : 'text-content-secondary hover:text-content-primary hover:bg-white/5 hover:pl-5'
                 )}
               >
                 {option.label}
               </button>
             ))}
          </div>
        </div>
      )}
    </div>
  );
};