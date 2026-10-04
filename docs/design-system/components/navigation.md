# Navigation

Sources: `src/components/sidebar.tsx`, `mobile-drawer.tsx`, `header-bar.tsx`, `org-team-picker.tsx`, `project-tabs.tsx`, `src/app/(dashboard)/projects/[slug]/services/[serviceSlug]/service-tabs.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/sub-nav.tsx`, `src/components/settings-anchor-nav.tsx`, `src/lib/breadcrumbs.ts`.

For what goes where (the IA), see [Information architecture](../patterns/information-architecture.md).

## Sidebar

The `surface` column, 236px wide, fixed from `lg`. Below `lg` the same content (`SidebarContent`) opens in `MobileDrawer` from the header's ≡ button.

```
[bower]                 ← Brand (sm), links to Home
WORKSPACE               ← .overline group labels
  Home  Projects  Deployments
RECENT PROJECTS         ← up to 5, most recent first, per user and organization
  Commerce Platform …
PLATFORM
  Status  Audit log  Settings
─────────
[AM] Alex Morgan ▾      ← profile menu: Account settings, Sign out
```

Nav items:
- `flex gap-2.5 rounded-lg px-2.5 py-[7px] text-sm font-medium`, with a 16px icon.
- **Active:** `bg-brand-50 text-brand-700`, with `aria-current="page"`. **Inactive:** `text-ink-soft`, hover `bg-sunken text-ink`.
- Focus: the standard 2px `brand-500` ring with an offset.
- Recent projects (A2-E3, A3-N01): shown whenever the organization has projects. The most recently visited come first, then the group fills up to 5 with other projects. It is stored in `localStorage` per organization and user, wrapped in try/catch.

There is **no** global cluster-health indicator or connection footer in the sidebar (A3-N04). The Status page covers it.

## Header bar and breadcrumbs

The sticky header, `h-14`. From left to right: the mobile drawer button, the **organization picker**, the **breadcrumbs**, then the **Search ⌘K** button.

### Organization picker

`OrgTeamPicker` is the first item of the breadcrumb row (A3-N02). It is a dropdown of organizations. Instance admins also get "Manage organizations" at the bottom (A3 B73). It is hidden on instance-level settings pages, which aren't organization-scoped (A5-L6).

### Breadcrumbs

`<nav aria-label="Breadcrumb">`, with labels from `deriveBreadcrumbs()` (`src/lib/breadcrumbs.ts`, tested in `breadcrumbs.test.ts`).

- Separators are `ChevronRight` icons (`h-3.5`, `ink-faint`).
- Ancestors are links in `text-sm font-medium text-ink-muted`, `max-w-[180px]`, truncating with a `title`. Segments without a page (such as "Allocations") are plain text, never dead links (A1 P0-05).
- The current page is `text-sm font-semibold text-ink` with `aria-current="page"`.
- **End at the entity.** Don't add the active tab's name, because the tab bar already shows it (A2-E1).
- **More than 4 levels:** keep the first and the last two, and collapse the middle into a `⋯` dropdown (A2-E2, A3-N14).
- **Labels are names**, resolved from data: project, service, member, team, and deployment (image and time) names. Never show a prettified UUID. Fall back to the generic noun ("Team") (A3 B02). The 404 crumb shows the requested slug in mono (A5-L6).
- Instance pages read "Instance › Organizations" (A5-L6).
- On narrow screens, intermediate crumbs and their separators are hidden.
- Breadcrumbs are **the** way back. Don't add "← Back to …" links (A1 P1-12).

### Search button

A `surface` button with a `line` border showing "Search" and a `⌘K` key hint (from `md`). It opens the [command palette](overlays.md#command-palette).

## Page tabs

Project and service pages use **underline tabs** built as links (`ProjectTabs` and `ServiceTabs`), not the segmented `Tabs` primitive (A4-Q24).

- `<nav aria-label="Project">` holds links (`aria-current="page"` on the active one).
- Items: `px-3 py-2.5 text-sm font-medium`. Active is `text-ink`. Inactive is `text-ink-muted`, hover `text-ink`.
- The active indicator is a 2px `brand-500` underline (`rounded-full`) that **slides** between tabs (`motion` `layoutId`, 220ms, `ease-move`).
- **Count pills:** only on tabs where a count helps, and hidden at 0. Currently only Services (A3-C22). Active pill: `bg-brand-50 text-brand-700`. Inactive: `border border-line bg-surface text-ink-soft` (A4-Q23).
- The row scrolls horizontally on narrow screens, with `.scroll-horizontal` shadows.
- The same component renders on every tab of the entity (in the shared layout), so the header doesn't flash while a tab loads (A2-H3).

## Segmented tabs

`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `src/components/ui/tabs.tsx`: a `sunken` track with a raised white active segment (`shadow-card`).

Use these only to switch **views inside a card**. Never use them for page navigation, and never as a form control for options (use `Select`) (A4-Q24, A5 "Option controls" kept).

## SubNav

`src/components/ui/sub-nav.tsx` is a vertical list of links for secondary navigation. One component serves both uses (A5-M10):

| Use | Wrapper | Behavior |
| --- | --- | --- |
| **Settings** | `SettingsNav` | Grouped under `.overline` labels: **Personal** (Account), **Instance** (Organizations, instance admins only), **Organization** (Organization, Members, Teams, Domains). A 180px column from `md` |
| **Project Settings** | `SettingsAnchorNav` | A sticky (`top-20`) in-page list of anchors (General, Access, Integrations, Volumes, Danger zone). It highlights the section in view (IntersectionObserver). A 10rem column from `lg` (A4-Q27) |

Items match the sidebar's active pattern: `bg-brand-50 text-brand-700`, with no colored edge bar (A5-M10 / Q55).

## Links

- Inline links use `.text-link` (or `text-link` for color only): `brand-700`, underlined on hover with a 4px offset, and a 2px `brand-500` focus outline.
- Card-footer continuation links read "View all deployments →" (`PanelFooter`).
- External links (a public route hostname) add an `ExternalLink` icon.
