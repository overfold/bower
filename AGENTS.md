# Bower repository guidance

Keep shared repository instructions here. `CLAUDE.md` imports this file for Claude Code; Codex reads `AGENTS.md` directly. Keep guidance concise and actionable, and link to detailed docs rather than duplicating them. Update commands and paths when their source changes.

## Project and boundaries

Bower is a deployment dashboard for Trellis, built with Next.js App Router, React, TypeScript, Tailwind CSS, Radix UI, and Drizzle/PostgreSQL. Trellis owns scheduling, placement, and container lifecycle; Bower owns the application-platform UI and orchestration.

- `src/app/`: routes, layouts, and API handlers. `src/components/`: shared product components; `src/components/ui/`: design-system primitives.
- `src/lib/`: domain logic, queries, authentication, and Trellis integration; `src/lib/actions/`: server mutations. `src/db/schema.ts` and `drizzle/`: database schema and migrations.
- `exec/`: streaming front server and terminal WebSocket bridge. `proxy/`: managed-ingress support. See [README.md](README.md) and the relevant [configuration](docs/configuration.md), [terminal](docs/terminal.md), or [managed-ingress](docs/managed-ingress.md) docs when working in these areas.
- Follow the owning module and neighboring code. Reuse existing helpers before adding abstractions or dependencies; avoid unrelated refactors and formatting churn.
- Preserve server-side authorization and organization/project/environment ownership checks for every mutation. UI visibility is not authorization. Follow existing audit-recording patterns.

## Local development

- Use Node.js 22 (the version provisioned by `.agents/setup`) and npm with `package-lock.json`. Install dependencies with `npm ci`.
- Follow [README.md](README.md#local-development) for PostgreSQL and `.env.local` setup; use `.env.example` and [docs/configuration.md](docs/configuration.md) as the configuration references. Do not overwrite an existing environment file or expose secrets.
- Run `npm run dev`, not bare `next dev`: `exec/server.mjs` fronts Next.js and handles terminal WebSockets. The default public port is 3000; the internal Next.js port is the public port + 1. Production uses `npm run build` then `npm start` through the same front server.
- Schema changes use `npm run db:generate`; review generated SQL and metadata. `npm run db:migrate` requires `DATABASE_URL` in the process environment. `.env.example` enables `AUTO_MIGRATE`, so confirm the database is disposable/local before starting the app or applying migrations.
- Do not use a live Trellis cluster or shared database for mutation tests without explicit authorization.

## Design system and consistency

Treat the existing design system as the default, not a starting point for a new visual language. Before changing a screen, inspect a comparable current screen and the shared components it uses.

- **Reuse primitives and product patterns.** Use `src/components/ui/` controls, cards, tables, dialogs, feedback, and empty states instead of hand-styled replacements. Reuse `PageHeading`, `DeploymentsTable`, `Time`, `ResourceId`, row actions, and existing project/service shells where applicable. Merge conditional classes with `cn` from `src/lib/utils.ts`.
- **Use semantic tokens.** `src/app/globals.css` is the source of truth for colors, typography, radii, shadows, and motion. Use `canvas`, `surface`, `sunken`, `line`, `ink`, `brand`, `ok`, `warn`, `danger`, and `info` utilities as appropriate; do not introduce arbitrary colors or default Tailwind palettes. Text uses `ink`, `ink-soft`, or `ink-muted`; reserve `ink-faint` for decorative/non-text elements.
- **Keep typography and geometry consistent.** Use the named `text-2xs`, `text-xs`, `text-sm`, `text-code`, `text-md`, `text-lg`, `text-xl`, and `text-2xl` scale, not arbitrary pixel text sizes. Use Inter for prose/actions and JetBrains Mono (`font-mono` / `Mono`) for machine values. Preserve shared heading hierarchy, spacing, control sizes, and the `sm`/`md`/`lg`/`xl` radius scale. Cards are border-only; do not add card shadows just because a shadow token exists. Use the dialog `size` API instead of one-off widths unless the content needs an established exception such as the terminal.
- **Share status semantics.** `src/lib/status.ts` defines labels, tones, and in-progress states; `src/lib/tone.ts` and `src/components/status.tsx` own presentation. Success is `ok` green, not brand teal. Do not invent page-local status maps or use spinners for completed historical events. Use plain text for static attributes such as roles, rather than status chips. Reuse `src/lib/labels.ts` and `src/lib/format.ts` for display copy, units, and timestamps.
- **Follow interaction contracts.** Use Button variants and `loading`, labelled icon controls, shared form controls and their invalid/focus states, and existing dirty-state save/discard patterns. Use `danger` for the initial destructive affordance and `destructive` for the final confirmation. Keep one clear primary action per context and use sentence-case, task-specific labels.
- **Preserve accessibility and responsive behavior.** Retain keyboard navigation, visible focus, field labels, dialog titles/descriptions, and non-color status cues. Respect reduced motion and the existing System/Light/Dark theme mechanism (`color-scheme`, `light-dark()`, and `data-theme`). Constrain scrolling to overflowing tables/tabs rather than the whole page; verify long names and narrow layouts.
- **Change shared behavior at its source.** If a pattern needs to change, update its owning primitive/helper and affected consumers rather than layering page-specific overrides. Update relevant contracts in `src/lib/ui-contracts.test.ts`. Do not restyle unrelated screens.

ESLint enforces named type sizes, declared color utilities, focus contrast, and faint-text restrictions in `eslint.config.mjs`; do not disable these rules to accommodate a design deviation. [docs/ui-fix-checklist.md](docs/ui-fix-checklist.md) records prior decisions and regressions, but current components, tokens, and tests take precedence over historical audit reports.

## Verification

Run checks appropriate to the change and report any failures or checks you could not run. Documentation-only edits need path/command accuracy and whitespace checks, not an application build.

| Check | Command |
| --- | --- |
| Lint, including design-system rules | `npm run lint` |
| TypeScript | `npx tsc --noEmit` |
| Full Node test suite (proxy, exec, and TypeScript) | `npm test` |
| Focused TypeScript regression | `node --import tsx --test src/lib/<name>.test.ts` |
| Production build for routing/configuration/build-sensitive changes | `npm run build` |
| Whitespace errors | `git diff --check` |

- Add regression coverage for changed behavior using the existing Node test runner and neighboring tests. Shared UI changes should exercise the relevant UI contracts, not just snapshot source strings.
- For visual changes, render and inspect representative desktop/mobile states and light/dark themes, including affected loading, empty, error, disabled, or open-dialog states. Exercise changed interactions with DOM/accessibility checks; a successful build is not visual verification.
- `scripts/ui-capture/` provides Playwright capture tests, a seed, and fake Trellis server for fixture-based UI checks. Inspect its configuration and seed before use: it requires a migrated local database ending in `_ui_audit`, and the seed **truncates data**. Never point it at persistent data or a real cluster. The capture suite requires a production build and generated `fixture.json`; it is separate from `npm test`.

## Next.js version guidance

Keep the generated block below intact: the installed Next.js generator checks its exact contents and may restore it during development.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
