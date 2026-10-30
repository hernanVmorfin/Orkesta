# Repository Guidelines

## Project Structure & Module Organization

Application code lives in `src/`. `src/components/` contains desktop UI components, while `src/components/mobile/` contains the read-only phone experience. Keep shared domain types in `src/types.ts`, Zustand state and actions in `src/store/usePlanStore.ts`, and focused utilities in `src/lib/` (geometry, seating, CSV, sharing, persistence, and exports). Default plan data belongs in `src/data/`. Static files are served from `public/`; production output is generated in `dist/` and must not be edited or committed.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server, normally at `http://localhost:5173`.
- `npm run build` runs TypeScript project checks and creates the production bundle in `dist/`.
- `npm run preview` serves the built bundle locally for final verification.
- `npm test` runs the built-in Node test runner against `*.test.ts` files.
- `npm run lint` runs Oxlint with React, TypeScript, and hooks rules.

Run `npm run lint` and `npm run build` before opening a pull request.

## Coding Style & Naming Conventions

Use TypeScript and functional React components. Follow the existing style: two-space indentation, single quotes, no semicolons, and trailing commas where multiline syntax benefits from them. Name components and component files in PascalCase (`FloorCanvas.tsx`), hooks with a `use` prefix (`useMediaQuery.ts`), and utilities with descriptive camelCase names. Keep browser-side effects in hooks or dedicated `src/lib/` modules. Prefer `import type` for type-only imports. TypeScript rejects unused locals, unused parameters, and switch fallthrough.

## Testing Guidelines

Tests use Node's built-in test runner; no coverage threshold is configured. Colocate tests as `*.test.ts` or `*.test.tsx`. For every change, run the suite, lint, build, and manually verify the affected desktop, tablet, and mobile flows. Check persistence, undo/redo, imports/exports, and view-only links when relevant.

## Commit & Pull Request Guidelines

History uses short, imperative subjects such as `Add satellite view under the plan`; optional Conventional Commit prefixes are also acceptable. Keep commits focused. Pull requests should explain the user-visible impact, list verification performed, link the relevant issue, and include screenshots or recordings for UI changes. Call out schema, persistence, sharing, or export compatibility risks.

Use the repository-configured Git identity for commits. Do not add Codex/OpenAI attribution or co-author trailers unless explicitly requested.
