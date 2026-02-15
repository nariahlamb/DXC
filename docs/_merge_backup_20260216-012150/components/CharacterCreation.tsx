
import React, { useState } from 'react';
import { P5Button } from './ui/P5Button';
import { GameState } from '../types';
import { createNewGameState } from '../utils/dataMapper';
import { User, ArrowRight, Dna, Shield, Calendar, Clock, Edit3, Skull, AlertTriangle, Package, ChevronLeft, Terminal } from 'lucide-react';
import { Difficulty } from '../types/enums';
import { motion, AnimatePresence } from 'framer-motion';

interface CharacterCreationProps {
  onComplete: (initialState: GameState) => void;
  onBack: () => void;
}

type Gender = '男' | '女';
type RaceId = 'Human' | 'Elf' | 'Dwarf' | 'Pallum' | 'Amazon' | 'Beastman';
type InitialPackage = 'standard' | 'combat' | 'survival' | 'wealth';

export const CharacterCreation: React.FC<CharacterCreationProps> = ({ onComplete, onBack }) => {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('男');
  const [race, setRace] = useState<RaceId>('Human');
  const [age, setAge] = useState(14);
  const [birthMonth, setBirthMonth] = useState('01');
  const [birthDay, setBirthDay] = useState('01');
  const [appearance, setAppearance] = useState('');
  const [background, setBackground] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.NORMAL);
  const [initialPackage, setInitialPackage] = useState<InitialPackage>('standard');

  const races: Array<{ id: RaceId; label: string }> = [
      { id: 'Human', label: '人类' },
      { id: 'Elf', label: '精灵' },
      { id: 'Dwarf', label: '矮人' },
      { id: 'Pallum', label: '小人族' },
      { id: 'Amazon', label: '亚马逊' },
      { id: 'Beastman', label: '兽人' }
  ];
  const genders: Gender[] = ['男', '女'];
  const packageOptions: Array<{ id: InitialPackage; label: string; desc: string }> = [
      { id: 'standard', label: 'STD', desc: '基础物资' },
      { id: 'combat', label: 'ATK', desc: '战斗补给' },
      { id: 'survival', label: 'SUR', desc: '野外生存' },
      { id: 'wealth', label: 'GLD', desc: '启动资金' }
  ];

  const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      const birthday = `${birthMonth}-${birthDay}`;
      const newState = createNewGameState(name, gender, race, age, birthday, appearance, background, difficulty, initialPackage);
      onComplete(newState);
  };

  const isHell = difficulty === Difficulty.HELL;

  // Theme Config
  const variants = {
    normal: {
        accent: 'text-cyan-400',
        border: 'border-cyan-500',
        bg: 'shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]',
        button: 'bg-cyan-600 hover:bg-cyan-500',
        glow: 'shadow-cyan-500/50'
    },
    hell: {
        accent: 'text-red-500',
        border: 'border-red-600',
        bg: 'shadow-[0_0_30px_-5px_rgba(220,38,38,0.2)]',
        button: 'bg-red-700 hover:bg-red-600',
        glow: 'shadow-red-500/50'
    }
  };
  const currentTheme = isHell ? variants.hell : variants.normal;

  return (
    <div className="w-full h-full min-h-[100dvh] bg-[#050505] relative flex items-center justify-center overflow-hidden">
        {/* Cinematic Background */}
        <div className="absolute inset-0 pointer-events-none">
            <div className={`absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,${isHell ? '#450a0a' : '#083344'}_1%,transparent_70%)]`} />
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />
        </div>

        {/* Floating Particles */}
        {isHell && (
            <div className="absolute inset-0 pointer-events-none mix-blend-screen">
                {[...Array(20)].map((_,i) => (
                    <motion.div 
                        key={i}
                        className="absolute w-1 h-1 bg-red-500 rounded-full blur-[1px]"
                        initial={{ opacity: 0, scale: 0, x: Math.random() * 100 + "%", y: "100%" }}
                        animate={{ opacity: [0, 1, 0], scale: [0, 1.5, 0], y: "-10%" }}
                        transition={{ duration: 3 + Math.random() * 5, repeat: Infinity, ease: "linear", delay: Math.random() * 5 }}
                    />
                ))}
            </div>
        )}

        {/* Main Content Card */}
        <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`
                relative z-10 w-full max-w-4xl max-h-[90vh] flex flex-col md:flex-row
                bg-[#0a0a0f]/90 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden
                ${currentTheme.bg} transition-all duration-700
            `}
        >
            {/* Left Sidebar (Visual & Stats) */}
            <div className="hidden md:flex flex-col w-64 bg-black/40 border-r border-white/5 p-6 relative">
                 <div className="mb-8">
                     <div className={`text-[10px] font-mono uppercase tracking-[0.2em] ${currentTheme.accent} mb-1 flex items-center gap-2`}>
                        <Terminal size={12} /> System Int
                     </div>
                     <h2 className="text-2xl font-display uppercase font-bold text-white leading-none">
                         Identity<br/>Config
                     </h2>
                 </div>

                 <div className="flex-1 space-y-6">
                     <StatDisplay label="Mode" value={isHell ? "ABYSS" : "STANDARD"} active={isHell} theme={currentTheme} />
                     <StatDisplay label="Race" value={races.find(r => r.id === race)?.label} theme={currentTheme} />
                     <StatDisplay label="Origin" value="UNKNOWN" theme={currentTheme} />
                 </div>

                 <div className="mt-auto pt-6 border-t border-white/5">
                     <p className="text-[10px] text-zinc-600 font-mono leading-relaxed">
                         所有数据将被刻录至灵魂契约。<br/>
                         All data will be etched into the soul contract.
                     </p>
                 </div>
            </div>

            {/* Right Content (Form) */}
            <div className="flex-1 flex flex-col min-h-0 relative">
                {/* Header */}
                <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-white/[0.02]">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-zinc-400">Adventurer Registration</h3>
                    <div className="flex gap-2">
                        <div className="w-2 h-2 rounded-full bg-zinc-700" />
                        <div className={`w-2 h-2 rounded-full ${isHell ? 'bg-red-500 animate-pulse' : 'bg-cyan-500 animate-pulse'}`} />
                    </div>
                </div>

                {/* Form Scroll Area */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-6 md:p-8 space-y-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        
                        {/* Section 1: Identity */}
                        <div className="space-y-4">
                            <SectionTitle icon={<User size={14}/>} title="Basic Information" theme={currentTheme} />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1.5 col-span-2 md:col-span-1">
                                    <Label>Full Name / 姓名</Label>
                                    <div className={`group relative bg-black/50 border-b ${currentTheme.border} transition-colors`}>
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            className="w-full bg-transparent p-3 text-lg font-bold text-white outline-none font-display placeholder:text-zinc-700"
                                            placeholder="ENTER NAME..."
                                            autoFocus
                                        />
                                        <div className={`absolute bottom-0 left-0 h-[1px] w-0 bg-white/50 group-focus-within:w-full transition-all duration-500`} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                     <Label>Gender / 性别</Label>
                                     <div className="flex gap-1 h-[52px]">
                                         {genders.map(g => (
                                             <button
                                                type="button"
                                                key={g}
                                                onClick={() => setGender(g)}
                                                className={`flex-1 font-bold text-sm transition-all border border-transparent
                                                    ${gender === g ? 'bg-white/10 text-white border-white/20' : 'bg-black/30 text-zinc-500 hover:text-zinc-300'}
                                                `}
                                             >
                                                 {g === '男' ? 'MALE' : 'FEMALE'}
                                             </button>
                                         ))}
                                     </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Physical */}
                        <div className="space-y-4">
                             <SectionTitle icon={<Dna size={14}/>} title="Physical Attributes" theme={currentTheme} />
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                 {/* Race Selector */}
                                 <div className="col-span-1 md:col-span-3 space-y-2">
                                     <Label>Race / 种族</Label>
                                     <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                                         {races.map(r => (
                                             <button
                                                type="button"
                                                key={r.id}
                                                onClick={() => setRace(r.id)}
                                                className={`py-2 px-1 text-xs font-bold uppercase transition-all rounded-sm border
                                                    ${race === r.id 
                                                        ? `${currentTheme.button} ${currentTheme.border} text-white` 
                                                        : 'bg-black/40 border-zinc-800 text-zinc-500 hover:border-zinc-600'}
                                                `}
                                             >
                                                 {r.label}
                                             </button>
                                         ))}
                                     </div>
                                 </div>

                                 {/* Age */}
                                 <div className="space-y-1.5">
                                      <Label>Age / 年龄</Label>
                                      <input 
                                        type="number"
                                        min="12" max="100"
                                        value={age}
                                        onChange={(e) => setAge(parseInt(e.target.value))}
                                        className="w-full bg-black/50 border border-zinc-800 p-3 text-white font-mono text-center outline-none focus:border-zinc-500"
                                      />
                                 </div>

                                 {/* Birthday */}
                                 <div className="col-span-2 space-y-1.5">
                                     <Label>Date of Birth / 生日</Label>
                                     <div className="flex gap-2">
                                          <select value={birthMonth} onChange={e => setBirthMonth(e.target.value)} className="flex-1 bg-black/50 border border-zinc-800 p-3 text-white font-mono outline-none focus:border-zinc-500">
                                              {Array.from({length: 12}, (_, i) => (i + 1).toString().padStart(2, '0')).map(m => <option key={m} value={m}>{m}月</option>)}
                                          </select>
                                          <select value={birthDay} onChange={e => setBirthDay(e.target.value)} className="flex-1 bg-black/50 border border-zinc-800 p-3 text-white font-mono outline-none focus:border-zinc-500">
                                              {Array.from({length: 31}, (_, i) => (i + 1).toString().padStart(2, '0')).map(d => <option key={d} value={d}>{d}日</option>)}
                                          </select>
                                     </div>
                                 </div>
                             </div>
                        </div>

                         {/* Section 3: Background */}
                         <div className="space-y-4">
                             <SectionTitle icon={<Edit3 size={14}/>} title="Personal History" theme={currentTheme} />
                             <div className="space-y-3">
                                 <div>
                                    <Label className="mb-1 block">Appearance / 外貌特征</Label>
                                    <textarea 
                                        value={appearance}
                                        onChange={e => setAppearance(e.target.value)}
                                        className="w-full bg-black/50 border border-zinc-800 p-3 text-xs text-zinc-300 font-mono outline-none focus:border-zinc-500 h-20 resize-none"
                                        placeholder=">> No data entered..."
                                    />
                                 </div>
                                 <div>
                                    <Label className="mb-1 block">Background / 出身背景</Label>
                                    <textarea 
                                        value={background}
                                        onChange={e => setBackground(e.target.value)}
                                        className="w-full bg-black/50 border border-zinc-800 p-3 text-xs text-zinc-300 font-mono outline-none focus:border-zinc-500 h-20 resize-none"
                                        placeholder=">> No data entered..."
                                    />
                                 </div>
                             </div>
                         </div>

                         {/* Section 4: Configuration */}
                         <div className="space-y-4">
                             <SectionTitle icon={<AlertTriangle size={14}/>} title="World Configuration" theme={currentTheme} />
                             
                             {/* Difficulty */}
                             <div className="space-y-2">
                                 <Label>Difficulty Assessment / 难度分级</Label>
                                 <div className="grid grid-cols-4 gap-2">
                                     {[Difficulty.EASY, Difficulty.NORMAL, Difficulty.HARD, Difficulty.HELL].map(d => (
                                         <button
                                            type="button"
                                            key={d}
                                            onClick={() => setDifficulty(d)}
                                            className={`py-2 text-[10px] md:text-xs font-bold uppercase border transition-all relative overflow-hidden group
                                                ${difficulty === d 
                                                    ? (d === Difficulty.HELL ? 'bg-red-900/40 border-red-500 text-red-100' : 'bg-cyan-900/40 border-cyan-500 text-cyan-100')
                                                    : 'bg-black/40 border-zinc-800 text-zinc-600 hover:border-zinc-600'}
                                            `}
                                         >  
                                             {difficulty === d && <div className={`absolute top-0 left-0 w-[2px] h-full ${d === Difficulty.HELL ? 'bg-red-500' : 'bg-cyan-500'}`} />}
                                             {d}
                                         </button>
                                     ))}
                                 </div>
                             </div>

                             {/* Initial Package */}
                             <div className="space-y-2">
                                 <Label>Standard Issue / 初始补给</Label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {packageOptions.map(p => (
                                         <button
                                            type="button"
                                            key={p.id}
                                            onClick={() => setInitialPackage(p.id)}
                                            className={`p-2 border transition-all text-left group
                                                ${initialPackage === p.id 
                                                    ? (isHell ? 'bg-red-900/20 border-red-600/50' : 'bg-cyan-900/20 border-cyan-600/50')
                                                    : 'bg-black/40 border-zinc-800 hover:bg-white/5'}
                                            `}
                                         >
                                             <div className={`text-xs font-bold ${initialPackage === p.id ? (isHell ? 'text-red-400' : 'text-cyan-400') : 'text-zinc-500'}`}>{p.label}</div>
                                             <div className="text-[10px] text-zinc-600 group-hover:text-zinc-400">{p.desc}</div>
                                         </button>
                                     ))}
                                 </div>
                             </div>
                         </div>
                    </form>
                </div>

                {/* Footer / Actions */}
                <div className="p-6 border-t border-white/5 bg-black/20 backdrop-blur-md flex items-center justify-between gap-4">
                    <button 
                        onClick={onBack}
                        className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors text-xs uppercase tracking-widest font-bold px-4 py-2 hover:bg-white/5 rounded"
                    >
                        <ChevronLeft size={14} /> Abort
                    </button>
                    
                    <button
                        onClick={handleSubmit}
                        disabled={!name.trim()}
                        className={`
                            px-8 py-3 font-display font-bold uppercase tracking-widest text-sm transition-all
                            flex items-center gap-2 clip-path-slant relative group overflow-hidden
                            ${!name.trim() ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed' : (isHell ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(8,145,178,0.4)]')}
                        `}
                    >
                        <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 pointer-events-none" />
                        Init_Dive() <ArrowRight size={16} />
                    </button>
                </div>
            </div>
        </motion.div>
    </div>
  );
};

const SectionTitle = ({ icon, title, theme }: { icon: React.ReactNode, title: string, theme: any }) => (
    <div className={`flex items-center gap-2 pb-2 border-b ${theme.border} border-opacity-30 mb-2`}>
        <div className={theme.accent}>{icon}</div>
        <span className={`text-xs font-bold uppercase tracking-widest ${theme.accent}`}>{title}</span>
    </div>
);

const Label = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <div className={`text-[10px] font-bold text-zinc-500 uppercase tracking-widest ${className}`}>
        {children}
    </div>
);

const StatDisplay = ({ label, value, active, theme }: any) => (
    <div>
        <div className="text-[9px] text-zinc-600 uppercase mb-0.5">{label}</div>
        <div className={`font-mono text-sm ${active ? 'text-red-500 font-bold animate-pulse' : 'text-zinc-300'}`}>
            {value || '---'}
        </div>
    </div>
);
