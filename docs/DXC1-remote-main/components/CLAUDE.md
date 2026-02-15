[Root](../../CLAUDE.md) > **components**

# Components Module

## Responsibility
Handles the visual presentation of the DXC game. Built with React and Tailwind CSS, focusing on the "DanMachi" aesthetic.

## Structure
- `game/`: Core gameplay views.
  - `modals/`: Overlay windows (Inventory, Status, Shop, Familia).
    - `FamiliaModal.tsx`: Displays Familia stats, warehouse, and facilities.
  - `Map.tsx`: Dungeon traversal visualization.
  - `CombatPanel.tsx`: Turn-based battle interface.
- `ui/`: Reusable UI elements.
  - `TypewriterText.tsx`: Effect for displaying narrative text.
  - `P5Dropdown.tsx`: Stylized dropdown menus.
- `App.tsx` (in parent): Main layout container.

## Design Patterns
- **Glassmorphism**: Heavy use of `backdrop-blur`, `bg-black/XX`, and semi-transparent borders.
- **Atomic Design**: Small reusable bits in `ui/`, complex business logic components in `game/`.
- **Props**: Most components receive data from the central `GameState` object managed by `hooks/useGameLogic.ts`.

## Common Tasks
- **New Modal**: Create file in `game/modals/`, add state boolean in `App.tsx` or `useGameLogic`, and render conditionally.
- **Styling**: Use `text-blue-400` and `font-display` (custom font) for headers to match the theme.
