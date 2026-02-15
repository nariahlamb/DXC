[Root](../../CLAUDE.md) > **prompts**

# Prompts Module (AI Core)

## Role & Responsibility
This module contains the "brain" of the DXC system. It defines the System Instructions, World Lore, Game Logic, and Command Schemas that are fed into the Google Gemini API. Modifying these files directly changes the game's rules and narrative style.

## Key Files
- `index.ts`: Aggregator that assembles the full system prompt.
- `system.ts`: Core identity (You are an AI Dungeon Master...) and output format rules.
- `commands.ts`: **CRITICAL**. Defines the JSON schema for `tavern_commands`. Any change here requires a corresponding update in `types/story.ts` and `hooks/useGameLogic.ts`.
- `logic.ts`: Rules for combat, checks, and stats.
- `story.ts`: Narrative tone, pacing, and formatting guidelines.
- `world_values.ts`: Lore constants (Gods, Locations, Items).

## Development Guidelines
1. **JSON Protocol**: The AI is strictly bound to output JSON commands for state updates.
   - Example: `{"type": "UPDATE_SHEET", "target": "Bell", "changes": {"hp": 50}}`
2. **Deterministic Logic**: When defining rules in `logic.ts`, be explicit. Use formulas where possible so the AI can calculate outcomes consistently.
3. **Hot Reloading**: Changes here usually require a page refresh (or restarting the chat session) to take effect, as they are sent at the *start* of the context window.

## Testing Prompts
- Use the **Preview** mode in the UI to see the raw system prompt being generated.
- Verify that the AI output strictly adheres to the schema defined in `commands.ts`.
