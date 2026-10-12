# Repository Guidelines

## Project Structure & Module Organization

This is a Nuxt 4 starter using Vue, TypeScript, Nuxt UI, and Tailwind CSS. Application code lives in `app/`: `pages/` defines routes, `components/` holds reusable Vue components, and `assets/css/main.css` is the stylesheet entry point. `app.vue` provides the application shell; `app.config.ts` configures UI colors. Place directly served static files in `public/`. Nuxt modules and route rules live in `nuxt.config.ts`; the home route is prerendered. Generated `.nuxt/` and `.output/` directories are ignored and should not be edited.

## Build, Test, and Development Commands

Use Bun 1.3.14 and Node.js 24.11.0 or newer in the 24.x series.

- `bun install`: install dependencies and run `nuxt prepare` to generate types and ESLint configuration.
- `bun run dev`: start development at `http://localhost:3000`.
- `bun run build`: create the production build in `.output/`.
- `bun run preview`: preview the production build locally.
- `bun run lint`: run ESLint, including Tailwind correctness checks.
- `bun run typecheck`: check Nuxt and Vue TypeScript types.

Commit `bun.lock` when changing dependencies. CI uses `bun install --frozen-lockfile`, then runs lint and typecheck.

## Coding Style & Naming Conventions

Follow `.editorconfig`: two-space indentation, UTF-8, LF line endings, and a final newline. Match existing JavaScript and TypeScript style: single quotes, no semicolons, no trailing commas, and same-line opening braces. ESLint uses Nuxt's stylistic configuration and `eslint-plugin-better-tailwindcss`. Name reusable components in PascalCase, such as `TemplateMenu.vue`; use Nuxt route filenames such as `pages/index.vue`. Prefer Nuxt UI components and existing theme settings for interface changes.

## Testing Guidelines

No automated test framework, test script, or coverage threshold is configured. Run lint, typecheck, and a production build before submitting changes. For interface changes, verify affected routes, responsive layouts, and light/dark appearance in the browser. Document manual verification in the pull request.

## Commit & Pull Request Guidelines

History contains only `Initial commit`, so no recurring commit convention is established. Use concise, imperative subjects, such as `Add navigation menu`. Keep changes focused. Pull requests should describe the behavior changed, link relevant issues, list validation results, and include screenshots for visual changes.

## Security & Configuration

Keep secrets in ignored `.env` files; provide placeholder settings in `.env.example` when needed. Dependency lifecycle scripts are restricted through `trustedDependencies` in `package.json`; review changes to that list carefully.
