# Menu Panel Optimization Verification Plan

## 1. Goal

Verify that the Menu Panel Optimization (PC & Mobile) has been implemented correctly, addressing duplicate entries, UI inconsistencies, and functionality bugs.

## 2. Changes Implemented

### PC Platform

- **RightPanel.tsx**:
  - **Fixed Active State**: all right-panel entries now reflect active modal/view state correctly (`TASKS` / `EQUIPMENT` / `SKILLS` / `PHONE` / `PARTY` / `WORLD` / `MEMORY` / `SAVE_MANAGER` / `NOTES` / `SETTINGS`).
  - **Removed Dead Props**: deleted unused `onOpenSocial`, `onOpenPresent`, `phoneProcessingScope` props to reduce maintenance ambiguity.
  - **Merged Entry Semantics**: settings entries are unified into single `设置中心` (inside modal by tab), avoiding duplicated “settings-like”入口。
  - **Reduced Entry Duplication**: removed standalone `战利品仓库` menu item; loot management is unified under `背包` multi-tab flow.
  - **Gamified Feedback**: phone processing now shows lightweight in-item pulse indicator.
  - **Map Hub Entry**: `地图` + `世界百科` are converged as single `地图中心`入口（地图内再分层浏览）。

- **GameInterface.tsx**:
  - **Prop Alignment**: right panel now only receives `activeModal` for highlight state, and setting/world actions route into hub entry points.
- **TopNav.tsx**:
  - **Removed Duplicate Entry**: removed desktop top-bar map action button; top bar now focuses on status + system toggles only.

### Mobile Platform

- **MobileMenuOverlay.tsx**:
  - **Added Gamified Status Chips**: quick overview for active tasks / unread messages / loot count.
  - **Added Badge System**: quick-grid and archive-list entries now support numeric badges (任务/终端/队伍/地图中心).
  - **Improved IA Consistency**: "更多功能" renamed to `档案与系统`; map knowledge entry is unified as `地图中心`.
  - **Removed Dead Action Contract**: dropped unused `onOpenSocial` action field.

- **GameInterface.tsx**:
  - **Overlay Summary Injection**: passes shared summary metrics to mobile control center for consistent PC/mobile information architecture.

### Historical Notes (already completed in earlier round)

- **RightPanel.tsx**:
  - **Standardized Icons**: Used `Icons` mapper for consistency (`GiBackpack`, `GiCompass`, `GiQuest`, `GiSmartphone`).
  - **Reorganized Layout**: Split into 4 logical sections: Exploration (`探索`), Adventure (`冒险`), Archives (`档案`), System (`系统`).
  - **Added Missing Entries**: Equipment (`装备`), Skills (`技能`), Story (`剧情`), Party (`队友` - via new button), Notes (`笔记`).
  - **Removed**: Daily Dashboard (`日常仪表盘`).
  - **Gamification**: Added summary bars for Load/Weight.
- **TopNav.tsx**:
  - **Removed**: Daily Dashboard button.
- **SettingsModal.tsx**:
  - **Fixed**: "API Settings" (`API 设置`) link now correctly opens the `AI_SERVICES` view on mobile, bypassing the sidebar.

### Mobile Platform

- **MobileMenuOverlay.tsx**:
  - **Redesigned**: Grid + List layout optimized.
  - **Removed**: Duplicate "Map" (implied, relies on BottomNav or World Encyclopedia), "Daily Dashboard", "Inventory/Map" props usage.
  - **Reordered**: "World Encyclopedia" and "Story" prioritized in the list.
  - **Retained**: "Settings" and "Save" in the Grid.
- **MobileBottomNav.tsx**:
  - **Standardized Icons**: Switched to `Icons` mapper (`GiBackpack`, `GiCompass`, `Icons.Chat`, `Icons.User`, `Icons.Grid`).

### Shared/Utils

- **GameInterface.tsx**:
  - Cleaned up props passed to `MobileMenuOverlay` and `TopNav`.
- **iconMapper.tsx**:
  - Added `Chat` (`MessageSquare`) and fixed duplicate exports.

## 3. Manual Verification Steps

### PC Checks

1.  **Open Right Panel**:
    - Verify the 4 sections: 探索, 冒险, 档案, 系统.
    - Check Icons: Are they using the new Game/Fantasy style icons (e.g. Backpack is a bag, not a briefcase)?
    - Verify `地图中心` is the only map knowledge入口，并进入地图枢纽（不再保留独立`世界百科`按钮）。
    - Verify "Teams/Party" (`队友`) opens the Party Modal (newly added button).
    - Verify "Notes" (`笔记`) opens Notes Modal.
    - Verify `设置中心` is single settings入口，并可在设置内切换到 AI 服务页。
    - Verify active highlight follows actual modal state (e.g., open `任务` then `任务` item is highlighted).
    - Verify right panel does not contain split settings entries (`AI 配置`/`系统设置`) anymore.
    - Verify right panel no longer has standalone `战利品仓库` entry; open `背包` and switch Tab to access Loot Vault.
2.  **Top Nav**:
    - Verify top nav no longer shows map entry button (map access stays in side/bottom hubs).

### Mobile Checks

1.  **Open Mobile Menu (More Button)**:
    - Verify Grid layout does NOT contain "Daily Dashboard".
    - Verify secondary list uses `地图中心` + `剧情档案` as top archive navigation.
    - Verify "Settings" and "Save" are present in the Grid.
    - Verify mobile More no longer has separate `AI 配置` entry; only `设置` as single入口。
    - Verify status chips show task/message/loot metrics and update with game state.
    - Verify badge counts appear for 任务、终端、队伍、地图中心 when relevant.
2.  **Bottom Nav**:
    - Verify Icons are consistent with PC (e.g. Map uses Compass icon, Backpack uses Game style icon).

## 4. Automated Checks (Code Review)

- `grep "DailyDashboard"`: Should return minimal results (only definition/imports, no active UX usage).
- `grep "LayoutGrid"` in `RightPanel`: Should be present (for toggle).
- `grep "Icons."` in `RightPanel`: Should be the primary way of using icons.
- `grep "onOpenSocial"` in `RightPanel` and `MobileMenuOverlay` contracts: should be removed from those component interfaces.
- `grep "onOpenLootVault"` in `RightPanel` and `MobileMenuOverlay` contracts: should be removed to ensure single-entry backpack flow.
- `grep "onOpenLibrary"` in `RightPanel` and `MobileMenuOverlay` contracts: should be removed to ensure single-entry settings flow.
- `grep "onOpenMap"` desktop TopNav action props usage: should be removed to ensure top bar is status-only.
