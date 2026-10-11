# Navigation

Sources: `src/components/sidebar.tsx`, `mobile-drawer.tsx`, `header-bar.tsx`, `org-team-picker.tsx`, `notifications-menu.tsx`, `project-tabs.tsx`, `src/app/(dashboard)/projects/[slug]/services/[serviceSlug]/service-tabs.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/sub-nav.tsx`, `src/components/settings-anchor-nav.tsx`, `src/lib/breadcrumbs.ts`.

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
- Inside a project, Projects retains its active colors, but the matching Recent projects link is bold ink (`font-semibold text-ink`) and carries `aria-current="page"` instead (N2).

There is **no** global cluster-health indicator or connection footer in the sidebar (A3-N04). The Status page covers it.

## Header bar and breadcrumbs

The sticky header, `h-14`. From left to right: the mobile drawer button, the **organization picker**, the **breadcrumbs**, the **Search ⌘K** button, then the **notifications** bell.

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
- Instance pages read "Settings › Instance › Organizations", with no organization crumb (N1).
- On narrow screens, intermediate crumbs and their separators are hidden.
- Breadcrumbs are **the** way back. Don't add "← Back to …" links (A1 P1-12).

### Search button

A `surface` button with a `line` border showing "Search" and a `⌘K` key hint (from `md`). It opens the [command palette](overlays.md#command-palette).

### Notifications menu

`NotificationsMenu` is a bell `IconButton` with the Search button's border and size, opening a `DropdownMenu` aligned to its end. It answers "what happened to deployments while I was elsewhere?" It is not a channel for the results of your own clicks (see [Notices and toasts](status-and-feedback.md#notices-and-toasts)).

- **What it lists:** deployment outcomes and failing-service incidents in accessible projects, filtered on the server. Rolled-back outcomes notify like failures; failing services notify once per incident (G1/G2; see changelog). Preserve the feed's access checks and read-state policy.
- **Unread badge:** a `brand-500` count pill on the bell, capped at "9+", hidden at 0. The button's accessible name carries the exact count ("Notifications, 3 unread"), so the badge itself is `aria-hidden`.
- **Rows:** focusable menu-item links with a hover state. Failing-service items open the service; deployment outcomes open the deployment (N5). Use the appropriate shared status component and relative `Time`. Unread rows add a dot, a semibold title, and a hidden "Unread:" prefix.
- **Read state:** opening the menu marks everything it loaded as read. The server stores one last-seen time per user and organization. Unread markers stay visible until the menu closes. A user's first visit starts with nothing unread.
- **States:** `EmptyState` when there's nothing. Initial load errors and "Couldn't refresh. Showing earlier results." both offer **Try again**, rerunning refresh (S6).
- **Freshness:** the layout renders the first feed. The client refreshes from `/api/notifications` every 60 seconds while the tab is visible, and again when the window regains focus or the tab becomes visible. There are no WebSockets.
- There is no "View all deployments" footer (N5); each item opens its own target.

## Page tabs

Project and service pages use **underline tabs** built as links (`ProjectTabs` and `ServiceTabs`), not the segmented `Tabs` primitive (A4-Q24).

- `<nav aria-label="Project">` holds links (`aria-current="page"` on the active one).
- Items: `px-3 py-2.5 text-sm font-medium`. Active is `text-ink`. Inactive is `text-ink-muted`, hover `text-ink`.
- The active indicator is a 2px `brand-500` underline (`rounded-full`) that **slides** between tabs (`motion` `layoutId`, 220ms, `ease-move`).
- **Count pills:** Services only, hidden at 0. Keep identical border/padding box metrics in active and inactive states; only colors change, so switching tabs never shifts the bar (S4). Active: `bg-brand-50 text-brand-700`; inactive: `border-line bg-surface text-ink-soft`.
- The row scrolls horizontally on narrow screens, with `.scroll-horizontal` shadows.
- The same component renders on every tab of the entity (in the shared layout), so the header doesn't flash while a tab loads (A2-H3).

## Segmented tabs

`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` from `src/components/ui/tabs.tsx`: a `sunken` track with a raised white active segment (`shadow-card`).

Use these only to switch **views inside a card**. Never use them for page navigation, and never as a form control for options (use `Select`) (A4-Q24, A5 "Option controls" kept).

## SubNav

`src/components/ui/sub-nav.tsx` is a vertical list of links for secondary navigation. One component serves both uses (A5-M10):

| Use | Wrapper | Behavior |
| --- | --- | --- |
| **Settings** | `SettingsNav` | Grouped under `.overline` labels in order: **Personal** (Account), **Organization** (Organization, Members, Teams, Domains), **Instance** (Organizations, instance admins only) (N3). A 180px column from `md` |
| **Project Settings** | `SettingsAnchorNav` | A sticky (`top-20`) in-page list of anchors (General, Access, Integrations, Volumes, Danger zone). It highlights the section in view (IntersectionObserver). A 10rem column from `lg` (A4-Q27) |

Items match the sidebar's active pattern: `bg-brand-50 text-brand-700`, with no colored edge bar (A5-M10 / Q55).

## Links

- Inline links use `.text-link` (or `text-link` for color only): `brand-700`, underlined on hover with a 4px offset, and a 2px `brand-500` focus outline.
- Card-footer continuation links read "View all deployments →" (`PanelFooter`).
- External links (a public route hostname) add an `ExternalLink` icon.
