/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dungeon-black': '#050508', // Darker, deeper black
        'hestia-blue': {
          50: '#f0f9ff',
          100: '#e0f2fe',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          900: '#0c4a6e',
          glow: '#38bdf8', // Lighter glow for moonlight effect
        },
        'guild-gold': {
          50: '#fffbeb',
          100: '#fef3c7',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          DEFAULT: '#fbbf24',
        },
        'runic-gold': '#ffd700', // Bright gold for runes
        'moonlight': '#e0f2fe', // Pale blue for moonlight
        'hud-black': 'rgba(5, 5, 8, 0.85)',
        'dungeon-grey': {
          300: '#71717a',
          500: '#52525b',
          700: '#3f3f46',
          DEFAULT: '#3f3f46',
        },
        'bronze': {
          200: '#eaddc5',
          400: '#b4873d',
          900: '#5a4723',
        },
        'iron': {
          900: '#12141a',
        },
        // 新增：游戏化UI色系
        'parchment': {
          50: '#fdfbf7',
          100: '#f8f4ed',
          200: '#f0ebe0',
          300: '#e8dcc8',
          400: '#dcc9a8',
          500: '#c9b288',
          DEFAULT: '#f8f4ed',
        },
        'dungeon-stone': {
          100: '#3a3a45',
          200: '#2d2d35',
          300: '#23232a',
          400: '#1a1a20',
          500: '#15151a',
          DEFAULT: '#2d2d35',
        },
        'magic-glow': {
          blue: '#60a5fa',
          purple: '#a855f7',
          gold: '#fbbf24',
          DEFAULT: '#60a5fa',
        },
        'bronze-trim': {
          100: '#e8d4b8',
          200: '#d4b896',
          300: '#c8a773',
          400: '#cd7f32',
          500: '#b8722d',
          600: '#9a5f24',
          DEFAULT: '#cd7f32',
        },
        // Science Fantasy / HSR Palette
        'astral': {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98', /* Base UI Grey-Blue */
          600: '#486581',
          700: '#334e68', /* Deep Panel Bg */
          800: '#243b53',
          900: '#102a43', /* Darkest Depth */
          950: '#0a0e14'  /* Void */
        },
        'cinematic': {
          mask: 'rgba(0,0,0,0.8)',
          overlay: 'rgba(5, 5, 8, 0.6)'
        },
        'yorha': {
          100: '#e0e0d0', /* Off-white text */
          200: '#d1d1c1',
          300: '#a5a59a', /* Disabled/Muted */
          400: '#8a8a80', 
          500: '#6e6e65', /* Borders */
          600: '#52524b',
          700: '#4b4b45',
          800: '#32322d',
          900: '#262622', /* Panel Backgrounds */
        },
        'quantum': {
          300: '#79ffe1', /* Cyan Highlight */
          400: '#22d3ee',
          500: '#0ea5e9', /* Primary Interaction */
          600: '#0284c7',
        },
        // Semantic Layer System (Frosted Fluid)
        'surface': {
          'base': '#050508', // Deepest background
          'overlay': 'rgba(16, 42, 67, 0.6)', // Panel background
          'glass': 'rgba(255, 255, 255, 0.03)', // Frosted glass base
          'floating': 'rgba(30, 30, 40, 0.9)', // High opacity for tooltips/dropdowns
        },
        'content': {
          'primary': '#f0f4f8',
          'secondary': '#94a3b8',
          'muted': '#475569',
          'inverted': '#0f172a',
        },
        'accent': {
          'gold': '#fbbf24', // Legendary/Key interaction
          'blue': '#38bdf8', // Magic/Tech
          'red': '#f43f5e', // Danger/HP
          'green': '#10b981', // Success/Safe
        }
      },
      fontFamily: {
        body: ['Noto Sans SC', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Cinzel', 'Noto Serif SC', 'serif'],
        ui: ['Inter', 'Noto Sans SC', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'halftone-blue': "radial-gradient(rgba(37, 99, 235, 0.3) 1px, transparent 1px)",
        'noise': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E\")",
        'location-banner': "linear-gradient(to right, transparent, rgba(0,0,0,0.8) 20%, rgba(0,0,0,0.8) 80%, transparent)",
      },
      animation: {
        'spin-slow': 'spin 20s linear infinite',
        'spin-reverse-slow': 'spin-reverse 25s linear infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'pulse-soft': 'pulse 6s ease-in-out infinite',
        'motion-none': 'none',
      },
      keyframes: {
        'spin-reverse': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(-360deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-20px)' },
        }
      }
    },
  },
  plugins: [],
}
