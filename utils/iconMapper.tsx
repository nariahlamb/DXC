import React from 'react';
import {
  GiBroadsword,
  GiShield,
  GiHealthPotion,
  GiScrollUnfurled,
  GiTwoCoins,
  GiBackpack,
  GiMagicSwirl,
  GiPowerLightning,
  GiHeartPlus,
  GiUpCard,
  GiCrossedSwords,
  GiCheckedShield,
  GiOpenBook,
  GiWorld,
  GiLockedChest,
  GiKey,
  GiGems,
  GiShoulderArmor,
  GiGauntlet,
  GiLegArmor,
  GiBoots,
  GiRing,
  GiNecklace,
  GiHelmet,
  GiChestArmor,
  GiSwordSpade,
  GiDaggers,
  GiBattleAxe,
  GiSpearFeather,
  GiBowman,
  GiMagicTrident,
  GiHammerDrop,
  GiSpikedMace,
  GiWizardStaff,
  GiFist,
  GiVial,
  GiPowder,
  GiMeat,
  GiFruitBowl,
  GiDiamonds,
  GiMetalBar,
  GiWoodPile,
  GiAnimalHide,
  GiFeather,
  GiSpiderWeb,
  GiWolfHead,
  GiGoblinHead,
  GiDragonHead,
  GiSkeleton,
  GiTrophyCup,
  GiNotebook,
  GiSmartphone,
  GiTeamUpgrade,
  GiTavernSign,
  GiVillage,
  GiDungeonGate,
  GiTorch,
  GiCampfire,
  GiCompass,
  GiTreasureMap,
  GiSettingsKnobs,
  GiExitDoor,
  GiSaveArrow,
  GiLoad
} from 'react-icons/gi';
import {
  LucideProps,
  X,
  Check,
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  Search,
  Filter,
  Menu,
  MoreVertical,
  Plus,
  Minus,
  Trash2,
  Edit2,
  Save,
  RotateCcw,
  Maximize2,
  Minimize2,
  AlertTriangle,
  Info,
  HelpCircle,
  Loader2,
  LogOut,
  User,
  Users,
  LayoutGrid,
  List,
  Eye,
  EyeOff,
  Crown,
  MessageSquare,
} from 'lucide-react';

// Define a union type for both icon libraries props
type IconProps = LucideProps & { size?: number | string; className?: string };

// Color mapping from Tailwind classes to actual color values
const colorMap: Record<string, string> = {
  // Accent colors from tailwind.config.js
  'text-accent-gold': '#fbbf24',
  'text-accent-blue': '#38bdf8',
  'text-accent-red': '#f43f5e',
  'text-accent-green': '#10b981',
  // Content colors
  'text-content-primary': '#f0f4f8',
  'text-content-secondary': '#94a3b8',
  'text-content-muted': '#475569',
  // Standard Tailwind colors used in the app
  'text-purple-400': '#c084fc',
  'text-purple-300': '#d8b4fe',
  'text-purple-200': '#e9d5ff',
  'text-yellow-400': '#facc15',
  'text-cyan-300': '#67e8f9',
  'text-cyan-400': '#22d3ee',
  'text-violet-400': '#a78bfa',
  'text-red-400': '#f87171',
  'text-blue-400': '#60a5fa',
  'text-emerald-400': '#34d399',
};

// Helper to extract color from className
const extractColor = (className?: string): string | undefined => {
  if (!className) return undefined;
  const classes = className.split(' ');
  for (const cls of classes) {
    if (colorMap[cls]) {
      return colorMap[cls];
    }
  }
  return undefined;
};

// Helper to wrap Game Icons to match Lucide interface approximately
const wrapGi = (Icon: React.ElementType) => (props: IconProps) => {
  const { size = 24, className, ...rest } = props;
  const color = extractColor(className);
  const style = color ? { color, ...rest.style } : rest.style;
  return <Icon size={size} className={className} style={style} {...rest} />;
};

// Central Icon Registry
export const Icons = {
  // UI Generic
  Close: X,
  Check: Check,
  ChevronRight: ChevronRight,
  ChevronDown: ChevronDown,
  ChevronLeft: ChevronLeft,
  Search: Search,
  Filter: Filter,
  Menu: Menu,
  More: MoreVertical,
  Plus: Plus,
  Minus: Minus,
  Delete: Trash2,
  Edit: Edit2,
  Save: Save,
  Reset: RotateCcw,
  Maximize: Maximize2,
  Minimize: Minimize2,
  Warning: AlertTriangle,
  Info: Info,
  Help: HelpCircle,
  Loading: Loader2,
  Logout: LogOut,
  Settings: wrapGi(GiSettingsKnobs),
  User: User,
  Users: Users,
  Grid: LayoutGrid,
  List: List,
  Eye: Eye,
  EyeOff: EyeOff,
  Chat: MessageSquare,

  // RPG / Game Specific
  Backpack: wrapGi(GiBackpack),
  Map: wrapGi(GiWorld),
  Treasure: wrapGi(GiLockedChest), // Loot
  Gold: wrapGi(GiTwoCoins),
  Skill: wrapGi(GiMagicSwirl),
  Magic: wrapGi(GiPowerLightning),
  Sword: wrapGi(GiBroadsword),
  Shield: wrapGi(GiShield),
  Potion: wrapGi(GiHealthPotion),
  Scroll: wrapGi(GiScrollUnfurled),
  Key: wrapGi(GiKey),
  Jewel: wrapGi(GiGems),
  Book: wrapGi(GiOpenBook),
  Quest: wrapGi(GiScrollUnfurled), // Contract/Quest
  Loot: wrapGi(GiTrophyCup),
  
  // Equipment Slots
  SlotMainHand: wrapGi(GiBroadsword),
  SlotOffHand: wrapGi(GiShield),
  SlotHead: wrapGi(GiHelmet),
  SlotBody: wrapGi(GiChestArmor),
  SlotHand: wrapGi(GiGauntlet),
  SlotLegs: wrapGi(GiLegArmor),
  SlotFeet: wrapGi(GiBoots),
  SlotAccessory: wrapGi(GiRing),
  SlotNecklace: wrapGi(GiNecklace),
  
  // Weapon Types
  WeaponSword: wrapGi(GiBroadsword),
  WeaponDagger: wrapGi(GiDaggers),
  WeaponAxe: wrapGi(GiBattleAxe),
  WeaponSpear: wrapGi(GiSpearFeather),
  WeaponBow: wrapGi(GiBowman),
  WeaponStaff: wrapGi(GiWizardStaff),
  WeaponMace: wrapGi(GiSpikedMace),
  WeaponHammer: wrapGi(GiHammerDrop),
  WeaponFist: wrapGi(GiFist),
  
  // Item Categories
  ItemConsumable: wrapGi(GiVial),
  ItemMaterial: wrapGi(GiDiamonds), // Generic material
  ItemKey: wrapGi(GiKey),
  ItemLoot: wrapGi(GiTwoCoins),
  
  // Skills Categories
  SkillActive: wrapGi(GiBroadsword), // Attack skills
  SkillPassive: wrapGi(GiOpenBook),
  SkillSupport: wrapGi(GiTeamUpgrade),
  SkillHeal: wrapGi(GiHeartPlus),
  SkillBuff: wrapGi(GiUpCard),
  
  // Locations / Navigation
  LocHome: wrapGi(GiTavernSign), // Familia Home
  LocCity: wrapGi(GiVillage),
  LocDungeon: wrapGi(GiDungeonGate),
  LocCamp: wrapGi(GiCampfire),
  LocUnknown: wrapGi(GiCompass),
  
  // System
  SysSave: wrapGi(GiSaveArrow),
  SysLoad: wrapGi(GiLoad),
  SysExit: wrapGi(GiExitDoor),
  SysPhone: wrapGi(GiSmartphone),
  SysNote: wrapGi(GiNotebook),
  Familia: Crown,
};

export type IconName = keyof typeof Icons;

export const getIcon = (name: IconName) => {
  return Icons[name];
};

export default Icons;
