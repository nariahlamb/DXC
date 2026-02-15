# Preflight Baseline (2026-02-05)

## Typecheck (npx tsc --noEmit)
- Status: **Failed**
- Error count: **36**
- Affected modules/files:
  - components/game/map/hooks/useMapInteraction.ts
  - components/game/modals/SettingsModal.tsx
  - components/game/views/SocialView.tsx
  - components/game/views/WorldView.tsx
  - components/GameInterface.tsx
  - hooks/useAppSettings.ts
  - hooks/useGameLogic.ts
  - utils/aiGenerate.ts
- Blocks verification: **Yes** (type errors present)

## Build (npm run build)
- Status: **Succeeded** (Vite)
- Warnings: Large chunk size warning (>500 kB)
- PWA generated: dist/sw.js, dist/workbox-1d305bb8.js
- Blocks verification: **No** (build completed)

## Notes
- Next steps: address tsc errors above; rerun typecheck afterward.
