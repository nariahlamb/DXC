# Lane C — Core Gameplay Logic Issues

**Generated:** 2026-02-05
**Scope:** Tasks 8-10 of Functional Debug Plan

---

## Task 8: Item Command Queue → Preview State Consistency

### Analysis Summary

**Files Reviewed:**
- `components/GameInterface.tsx` (L146-172)
- `hooks/gameLogic/commandQueue.ts`
- `utils/previewState.ts`
- `utils/itemUtils.ts`
- `types/item.ts`

### Findings

#### 8.1 Command Queue Deduplication Logic

**Location:** `hooks/gameLogic/commandQueue.ts:29-39`

**Behavior:**
- Equip/Unequip commands deduplicate by `slotKey` (L33-39)
- Filter removes all commands for the same slot, EXCEPT those with the same `kind`
- This means: `EQUIP` on slot A removes all `UNEQUIP` on slot A (and vice versa)

**Edge Case (PASS):**
```typescript
// Line 37: return c.kind === nextItem.kind;
// If we queue: UNEQUIP 主手 → EQUIP 主手
// The UNEQUIP is correctly removed before adding EQUIP
```

**Verification:** Logic appears correct for toggle scenarios.

---

#### 8.2 Item Identification Strategy

**Location:** `utils/previewState.ts:27-34`

**Strategy:**
1. First try `itemId` exact match (L28-30)
2. Fall back to `itemName` match (L32)
3. Return -1 if neither matches

**Potential Issue (P2):**

**Symptom:** Duplicate item names (e.g., two "生锈短剑") may cause wrong item to be operated on.

**Repro Steps:**
1. Inventory has: `[{ id: "Itm001", 名称: "生锈短剑", 数量: 1 }, { id: "Itm002", 名称: "生锈短剑", 数量: 1 }]`
2. Queue: `EQUIP { itemName: "生锈短剑" }` (no itemId)
3. Preview state uses first match (Itm001)
4. AI command may reference second item (Itm002)

**Expected:** Preview uses itemId when available
**Actual:** Falls back to name-based lookup when itemId missing
**Suspected File:** `utils/previewState.ts:32`

**Regression Check:** Verify `queueEquipItem` in GameInterface.tsx L146-154 always passes `item.id`

**Status:** ✅ VERIFIED - `GameInterface.tsx:151` always passes `itemId: item.id`

---

#### 8.3 Default Equip Slot Resolution

**Location:** `utils/itemUtils.ts:143-149`, `utils/previewState.ts:12-16`

**Behavior:**
- `getDefaultEquipSlot(item)`:
  - Returns `item.装备槽位` if present (L145)
  - Returns `主手` for weapons (L146)
  - Returns `身体` for armor (L147)
  - Returns `''` otherwise (L148)

**Edge Case (P2):**

**Symptom:** Weapon with `装备槽位: "副手"` will still default to `主手` if slot is cleared.

**Repro Steps:**
1. Item: `{ 名称: "短剑", 武器: {...}, 装备槽位: "副手" }`
2. Unequip → `item.装备槽位 = undefined` (previewState.ts:55)
3. Re-equip → `getDefaultEquipSlot` ignores previous slot, returns `主手`

**Expected:** Remember original slot preference
**Actual:** Falls back to weapon default (`主手`)
**Suspected File:** `utils/previewState.ts:55`

**Regression Check:** Verify unequip doesn't permanently lose slot assignment

**Status:** ⚠️ MINOR - Only affects re-equip of previously dual-wielded weapons

---

#### 8.4 USE Command Quantity Edge Case

**Location:** `utils/previewState.ts:57-65`

**Behavior:**
- Consumes `cmd.quantity || 1` from item stack (L61)
- Removes item if `nextQty <= 0` (L62)
- Otherwise updates `item.数量` (L63)

**Edge Case (P2):**

**Symptom:** Item with `数量: undefined` or `数量: 0` treated as quantity=1.

**Repro Steps:**
1. Item: `{ 名称: "魔石", 数量: undefined }`
2. Queue: `USE { itemName: "魔石", quantity: 1 }`
3. Preview: `nextQty = (undefined || 1) - 1 = 0` → item removed

**Expected:** Non-consumables should not be removed on use
**Actual:** Any item with missing `数量` field is treated as single-use
**Suspected File:** `utils/previewState.ts:61`

**Regression Check:** Verify all inventory items have explicit `数量` field (default: 1)

**Status:** ⚠️ MINOR - Depends on item creation ensuring `数量` field

---

### Task 8 Summary

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C-8.1 | P2 | Duplicate item names may cause wrong item selection when `itemId` missing | ✅ Mitigated (GameInterface always passes `itemId`) |
| C-8.2 | P2 | Unequip clears `装备槽位`, re-equip forgets original slot preference | ⚠️ Minor (affects dual-wield only) |
| C-8.3 | P2 | Items with `数量: undefined` treated as single-use consumables | ⚠️ Minor (depends on item schema) |

**Overall:** Preview state logic is **sound** for standard use cases. Edge cases require schema enforcement (always set `数量`, always pass `itemId`).

---

## Task 9: Item Type and Classification Normalization

### Analysis Summary

**Files Reviewed:**
- `utils/itemUtils.ts` (L98-168)
- `types/item.ts` (L9-10)

### Findings

#### 9.1 Type Mapping Coverage

**Location:** `utils/itemUtils.ts:3-45`

**CN/EN Coverage:**

| Category | EN Keywords | CN Keywords | Coverage |
|----------|-------------|-------------|----------|
| WEAPON | weapon | 武器, 兵器, 主手, 副手 | ✅ Good |
| ARMOR | armor | 防具, 护甲, 盔甲, 饰品 | ✅ Good |
| CONSUMABLE | consumable | 消耗品, 药剂, 道具, 补给 | ✅ Good |
| MATERIAL | material | 材料, 素材 | ✅ Good |
| KEY_ITEM | key_item | 关键, 关键物品, 钥匙, 钥匙物品 | ✅ Good |
| LOOT | loot | 战利品, 掉落 | ✅ Good |

**Verification:** All categories have CN/EN mapping ✅

---

#### 9.2 Unknown Type Fallback

**Location:** `utils/itemUtils.ts:112-123`

**Behavior:**
```typescript
export const getItemCategory = (item: InventoryItem): ItemCategory => {
  if (isWeaponItem(item)) return 'WEAPON';
  if (isArmorItem(item)) return 'ARMOR';
  // ... type matching ...
  return 'OTHER'; // Line 122
};
```

**Current Fallback:** `OTHER` (not `LOOT` as mentioned in plan)

**Edge Case (P1):**

**Symptom:** Items with `类型: "未知"` or `类型: "杂项"` are categorized as `OTHER`.

**Repro Steps:**
1. AI generates item: `{ 类型: "未知", ... }`
2. `getItemCategory` checks all sets → no match
3. Returns `OTHER`
4. `ensureTypeTag` (L151-167) maps `OTHER` → `loot` (L165-166)

**Expected:** Unknown types should be explicitly tagged as `loot` (safe fallback)
**Actual:** `OTHER` category exists but has no special behavior (relies on `ensureTypeTag`)
**Suspected File:** `utils/itemUtils.ts:122` + `types/item.ts:9-10`

**Impact:** `getItemCategory` returns `OTHER`, but `ensureTypeTag` converts to `loot`. **No data loss**, but inconsistent.

**Regression Check:** Verify `OTHER` items can be equipped/used correctly (should behave as loot).

**Status:** ⚠️ P2 - Functional but inconsistent. `OTHER` should be removed or aliased to `LOOT`.

---

#### 9.3 Type Schema Validation

**Location:** `types/item.ts:9-10`

**Type Union:**
```typescript
类型: 'consumable' | 'material' | 'key_item' | 'weapon' | 'armor' | 'loot'
  | '消耗品' | '材料' | '关键物品' | '钥匙物品' | '武器' | '防具' | '护甲' | '饰品' | '战利品' | '掉落' | '杂项';
```

**Issue (P2):**

**Symptom:** TypeScript allows `类型: "杂项"` but `getItemCategory` doesn't map it.

**Repro Steps:**
1. AI generates: `{ 类型: "杂项", ... }`
2. TypeScript type check: ✅ passes (valid union member)
3. `getItemCategory`: Returns `OTHER` (no match in any set)
4. `ensureTypeTag`: Converts to `loot`

**Expected:** Either remove `"杂项"` from type union, OR add to `LOOT_TYPES` set
**Actual:** Type system allows value that runtime doesn't recognize
**Suspected File:** `types/item.ts:10` OR `utils/itemUtils.ts:41-45`

**Regression Check:** Search codebase for `类型: "杂项"` usage.

**Status:** ⚠️ P2 - Type safety vs runtime mismatch

---

### Task 9 Summary

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C-9.1 | P2 | `OTHER` category exists but has no semantic meaning (maps to `loot` via `ensureTypeTag`) | ⚠️ Inconsistent but functional |
| C-9.2 | P2 | TypeScript allows `类型: "杂项"` but runtime doesn't map it to any category set | ⚠️ Type/runtime mismatch |

**Recommendation:**
1. Add `"杂项"` to `LOOT_TYPES` set (L41-45)
2. OR remove `"杂项"` from type union (types/item.ts:10)
3. Consider removing `OTHER` category entirely (alias to `LOOT`)

---

## Task 10: Combat State Flow and Data Normalization

### Analysis Summary

**Files Reviewed:**
- `hooks/useGameLogic.ts` (L456-459)
- `hooks/gameLogic/state.ts` (no combat-specific logic found)
- `types/combat.ts` (L57-67)
- `adapters/combatAdapter.ts` (L56-61)

### Findings

#### 10.1 Combat End Cleanup Logic

**Location:** `hooks/useGameLogic.ts:456-459`

**Behavior:**
```typescript
if (state.战斗.是否战斗中 && !nextState.战斗.是否战斗中) {
    nextState.战斗.敌方 = null;
    nextState.战斗.战斗记录 = [];
}
```

**Analysis:**

**Fields Cleared:**
- ✅ `敌方` → `null`
- ✅ `战斗记录` → `[]`

**Fields NOT Cleared:**
- ⚠️ `上一次行动` (combat.ts:62) - **Not cleared**
- ⚠️ `地图` (combat.ts:65) - **Not cleared**
- ⚠️ `视觉` (combat.ts:66) - **Not cleared**

**Edge Case (P1):**

**Symptom:** TavernDB extended fields (`地图`, `视觉`) persist after combat ends.

**Repro Steps:**
1. Enter combat → AI sets `战斗.地图 = [...]`, `战斗.视觉 = {...}`
2. Combat ends → AI sets `是否战斗中: false`
3. Cleanup triggers (L456-459)
4. `地图` and `视觉` remain in state

**Expected:** All combat-specific data cleared on combat end
**Actual:** Only `敌方` and `战斗记录` are cleared
**Suspected File:** `hooks/useGameLogic.ts:456-459`

**Regression Check:** After combat ends, verify `战斗.地图` and `战斗.视觉` are undefined or empty

**Status:** ⚠️ P1 - TavernDB fields leak across combat sessions

---

#### 10.2 normalizeCombatState Input Handling

**Location:** `adapters/combatAdapter.ts:56-61`

**Behavior:**
```typescript
export const normalizeCombatState = (combatState: any, playerLevel: number): CombatUnit[] => {
  const rawEnemies = (combatState as any)?.敌方;
  if (!rawEnemies) return [];
  const list = Array.isArray(rawEnemies) ? rawEnemies : [rawEnemies];
  return list.filter(Boolean).map(e => normalizeEnemy(e, playerLevel));
};
```

**Analysis:**

**Input Handling:**
- ✅ `null` → returns `[]` (L58)
- ✅ Single object → wrapped in array (L59)
- ✅ Array → used directly (L59)
- ✅ Filters out `null`/`undefined` entries (L60)

**Edge Cases Tested:**

| Input | Output |
|-------|--------|
| `{ 敌方: null }` | `[]` ✅ |
| `{ 敌方: { 名称: "哥布林" } }` | `[CombatUnit]` ✅ |
| `{ 敌方: [{...}, null, {...}] }` | `[CombatUnit, CombatUnit]` (null filtered) ✅ |
| `{ 敌方: undefined }` | `[]` ✅ |

**Verification:** All input types handled correctly ✅

**Status:** ✅ PASS - No issues found

---

#### 10.3 Enemy Normalization Null Safety

**Location:** `adapters/combatAdapter.ts:5-20`

**Behavior:**
```typescript
export const normalizeEnemy = (raw: any, playerLevel: number = 1): CombatUnit => {
  if (!raw) {
    return {
      id: 'unknown',
      name: 'Unknown Entity',
      hp: 0,
      maxHp: 1,
      // ... safe defaults
    };
  }
  // ... field mapping
};
```

**Analysis:**

**Null Safety:** ✅ Returns safe default object when `raw` is falsy (L6-19)

**Field Fallbacks:**
- `当前生命值` → `生命值` → `0` (L22-24)
- `最大生命值` → `max(hp, 1)` (L26-28)
- `当前精神MP` → `精神力` → `0` (L30-32)
- `等级` → `1` (L38)
- `技能` → `[]` (L51)

**Verification:** All fields have safe fallbacks ✅

**Status:** ✅ PASS - No issues found

---

### Task 10 Summary

| ID | Severity | Issue | Status |
|----|----------|-------|--------|
| C-10.1 | P1 | Combat end cleanup doesn't clear TavernDB extended fields (`地图`, `视觉`, `上一次行动`) | ⚠️ Data leakage |
| C-10.2 | N/A | `normalizeCombatState` handles null/object/array correctly | ✅ PASS |
| C-10.3 | N/A | `normalizeEnemy` has safe null handling and field fallbacks | ✅ PASS |

**Critical Fix Required:**

```typescript
// hooks/useGameLogic.ts:456-459
if (state.战斗.是否战斗中 && !nextState.战斗.是否战斗中) {
    nextState.战斗.敌方 = null;
    nextState.战斗.战斗记录 = [];
    nextState.战斗.上一次行动 = undefined;  // ADD
    nextState.战斗.地图 = undefined;        // ADD
    nextState.战斗.视觉 = undefined;        // ADD
}
```

---

## Overall Lane C Summary

| Task | Critical Issues | Warnings | Passes |
|------|----------------|----------|--------|
| Task 8 (Item Queue) | 0 | 3 (P2) | Deduplication logic ✅ |
| Task 9 (Type Normalization) | 0 | 2 (P2) | CN/EN mapping ✅ |
| Task 10 (Combat State) | 1 (P1) | 0 | Normalizers ✅ |

**High Priority:**
- **C-10.1 (P1):** Combat cleanup incomplete - TavernDB fields leak

**Medium Priority:**
- **C-8.2:** Unequip forgets original slot preference
- **C-9.1:** `OTHER` category semantic ambiguity
- **C-9.2:** Type/runtime mismatch for `"杂项"`

**Low Priority:**
- **C-8.1:** Mitigated by GameInterface always passing `itemId`
- **C-8.3:** Requires schema enforcement (always set `数量`)

---

## Recommendations

1. **IMMEDIATE:** Fix combat cleanup (C-10.1) - 3 lines of code
2. **SHORT TERM:** Resolve type normalization inconsistencies (C-9.1, C-9.2)
3. **LONG TERM:** Add schema validation for `InventoryItem.数量` field
4. **TESTING:** Add regression test for combat end → verify all fields cleared

---

**Report Generated:** 2026-02-05
**Analyzed By:** Lane C Debug Sweep
**Files Modified:** 0 (analysis only)
