# Repository Guidelines

## Project Structure & Module Organization
- `index.tsx` and `App.tsx` are the React entry points.
- UI lives in `components/` (feature areas: `game`, `combat`, `home`, `ui`, `mobile`, `modals`).
- Game logic lives in `hooks/` and `hooks/gameLogic/`.
- Utilities and adapters live in `utils/` and `adapters/`.
- Prompt rules and narrative modules are in `prompts/` (system/world/logic/story/commands/schema).
- Shared types are in `types/` and `types.ts` (keep in sync with `prompts/schema.ts`).
- Spec/workflow artifacts live in `openspec/`, `.spec-workflow/`, `.workflow/`, and `.agent/`.
- Tests live in `tests/` (Vitest + Testing Library) with shared setup in `tests/setup.ts`.
- Build output is in `dist/` (do not edit by hand). `dev-dist/` is also generated output.
- `docs/` contains mockups, scripts, and reference JSON.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server (default port 3000).
- `npm run build` creates a production build in `dist/`.
- `npm run preview` serves the production build locally.
- `npm test` runs Vitest once; `npm run test:watch` runs in watch mode.
- `npx tsc --noEmit` runs type checking.

## Coding Style & Naming Conventions
- TypeScript + React functional components; keep UI files as `PascalCase.tsx`.
- Utilities use `camelCase.ts` (see `utils/` and `hooks/`).
- Match local formatting in the file you touch; indentation is typically 2 spaces.
- Tailwind classes are used directly in JSX; keep class lists readable and grouped.
- AI output must preserve the `logs` / `tavern_commands` JSON separation.
- Changes to game rules usually require edits in `prompts/` plus matching updates in `types/`.

## AI & Configuration
- AI endpoints are configured in-app: Settings -> AI Services (see `components/game/modals/settings`).
- Provide provider, base URL (can be a local port like `http://localhost:8000`), API key, and model ID.
- Defaults reference Gemini, but providers include `gemini`, `openai`, `deepseek`, and `custom` (see `types/ai.ts`).
- `.env.local` with `GEMINI_API_KEY` is defined in Vite config for legacy compatibility but is not required for normal UI-driven configuration. Do not commit secrets.

## Testing Guidelines
- Tests use Vitest + jsdom + Testing Library (see `vitest.config.ts`).
- Prefer `tests/*.test.ts` or `tests/*.test.tsx`; keep shared setup in `tests/setup.ts`.
- Use `npm test` (single run) or `npm run test:watch` (watch mode).

## Commit & Pull Request Guidelines
- Git history shows short, descriptive messages in both Chinese and English; follow that style and keep messages brief.
- Suggested format: `Fix <area>: <summary>` or a short Chinese summary when appropriate.
- PRs should include a clear summary, testing notes, and screenshots for UI changes. Link related issues when available.
