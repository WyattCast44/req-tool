# Repository Guidelines

## Project Structure & Module Organization

This repository contains an offline Operational Test Requirements Manager built with React, TypeScript, and Vite. Application code lives in `src/`: route-level screens are in `src/pages`, reusable UI in `src/components`, project state in `src/store`, data and export helpers in `src/lib`, and shared models in `src/types`. Global styling is in `src/index.css`; static assets belong in `public/`. Node utilities in `scripts/` generate and validate `.otreq` files, while `examples/` contains importable demo and stress datasets. Production output is written to ignored `dist/`.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies from `package-lock.json`.
- `npm run dev` starts the Vite development server.
- `npm run lint` runs Oxlint across the project.
- `npm run build` runs TypeScript project checks and creates the self-contained `dist/index.html`.
- `npm run preview` serves the production build locally.
- `npm run smoke` validates a previously built offline bundle and performs an `.otreq` round trip; run it after `npm run build`.
- `npm run generate:example` and `npm run generate:stress` regenerate the checked-in sample datasets.

## Coding Style & Naming Conventions

Follow the existing TypeScript style: two-space indentation, single quotes, no semicolons, and trailing commas in multiline constructs. Use `PascalCase` for React components and page files, `camelCase` for functions and variables, and descriptive domain names such as `RequirementDetailPage.tsx`. Prefer type-only imports where appropriate. Keep reusable logic out of page components by placing it in `src/lib` or `src/store`. TypeScript enables unused-symbol and fallthrough checks; resolve those rather than suppressing them. Run `npm run lint` before submitting changes.

## Testing Guidelines

There is currently no unit-test framework or coverage threshold. Every change should pass `npm run lint`, `npm run build`, and `npm run smoke`. Manually exercise affected workflows in both Review and Edit modes. For import, graph, table, or performance changes, test both files in `examples/`. Verify that production remains usable from `file://` without network resources.

## Commit & Pull Request Guidelines

Recent commits use short, imperative subjects such as `Fix large-project freezes...` and `Add TanStack Table...`. Keep each commit focused and avoid vague subjects. Pull requests should explain the user-visible effect, list validation performed, and link relevant issues. Include screenshots for UI changes and call out `.otreq` schema, migration, offline-build, or performance impacts explicitly.
