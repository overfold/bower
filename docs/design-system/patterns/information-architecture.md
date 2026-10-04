# Information architecture

## Object model

```
Instance
└── Organization                 (switch with the org picker; Settings › Organization)
    ├── Members, Teams, Domains, Trellis connection
    ├── Cluster → Nodes → Allocations          (Status)
    └── Projects
        ├── Environment (variables, secrets)
        ├── Routes → Domains
        ├── Settings (General, Access, Integrations, Volumes)
        └── Services
            ├── Configuration (incl. variables, health checks, Advanced)
            ├── Mounts → Volumes
            ├── Deployments (history, rollback)
            └── Allocations → Logs, Details, Lifecycle, Terminal
```

Names in the UI follow this model. See the [glossary](content-and-copy.md#glossary) for the words.

## Primary navigation

| Group | Item | Route | Notes |
| --- | --- | --- | --- |
| Workspace | Home | `/dashboard` | The landing page. Called "Home", never "Overview" or "Dashboard" (A2-C10, A3-S08) |
| | Projects | `/projects` | |
| | Deployments | `/deployments` | Organization-wide history |
| Recent projects | (up to 5) | `/projects/[slug]` | Per user and organization, most recent first (A3-N01) |
| Platform | Status | `/status` | Cluster status. Called "Status" everywhere, including the H1 (A3-S07, A3 B46) |
| | Audit log | `/audit` | |
| | Settings | `/settings` → `/settings/account` | |

The order is fixed. Don't reorder dynamically (A3-N09). New top-level destinations need a decision, so record one in the [decision log](../records/decision-log.md).

## Entity navigation

| Entity | Tabs (fixed order) |
| --- | --- |
| Project | Overview · Services · Deployments · Routes · Environment · Settings |
| Service | Overview · Configuration · Mounts · Deployments |
| Allocation | Logs · Details · Lifecycle |
| Project Settings (anchors) | General · Access · Integrations · Volumes · Danger zone |

- Tabs are underline tabs (`ProjectTabs` pattern), never segmented controls (A4-Q24).
- Don't add a tab for a single small form. Fold it into the nearest tab as a section (Advanced → Configuration, A4-Q30. Integrations, Access, and Volumes → project Settings, A3-N08).
- Service tabs stayed separate (A3-N10). Only "History" was renamed to **Deployments**. Its route is still `/revisions`.

## Breadcrumbs

- Organization picker › section › entity › child entity. **End at the entity** (A2-E1).
- Labels are resolved names (`src/lib/breadcrumbs.ts`). Every dynamic segment must be resolvable, and tests cover each one (A3 B02).
- Instance-level pages hide the organization picker and start with "Instance" (A5-L6).
- Collapse past 4 levels: the first crumb, then `⋯`, then the last two (A3-N14).

## Settings

| Group | Item | Content | Visible to |
| --- | --- | --- | --- |
| Personal | Account | Profile, Password, API keys, Appearance | Everyone |
| Instance | Organizations | All organizations. Clicking a row **switches to** that organization (A3-N22) | Instance admins |
| Organization | Organization | General (name, read-only slug) and the Trellis connection (`#connection`) | Organization admins and owners |
| | Members | Members table (filters above 10 members), Invitations card with "Invite people" | |
| | Teams | Teams table → team detail page | |
| | Domains | Domains table, with DNS records expanding into a full-width row | |

There is no link from the Status page to the connection settings (A3-U01). The connection status itself lives only on the Status page (A4-Q29).

## Command palette

The command palette is a shortcut, not a second IA. Everything in it is reachable through normal navigation.

- Recent (up to 5) · Go to (the six primary destinations) · Actions (Deploy {service}…, New project, Invite people) (A3-N19, A1 P3-14).
- Search covers projects and services (with their project), plus the destinations.

## Where actions live

| Action | Location |
| --- | --- |
| Create a project | Projects page header, command palette |
| Create a service | Project › Services card header. Empty-project checklist |
| Deploy, Restart, Roll back… | Service header. Deploy {service}… is also in the palette |
| Roll back to a specific release | Service › Deployments row (↺ icon button), deployment page header |
| Edit configuration | Service › Configuration (draft plus save bar) |
| Variables | Project › Environment (matrix), and the service Configuration › Variables section (same data) (A3-N11) |
| Routes | Project › Routes (card header "+ New route", row `⋯` with Edit route and Delete) |
| Volumes | Project › Settings › Volumes. Attach on Service › Mounts |
| Invite people | Settings › Members › Invitations card header, command palette. **Invite links only** (A2-F6) |
| Drain or resume a node | Node row `⋯` menu, node page `⋯` menu |
| Delete project | Project › Settings › Danger zone |
| Theme | Settings › Account › Appearance |
