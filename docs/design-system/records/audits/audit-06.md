# Audit 6: Deferred-item review

| | |
| --- | --- |
| **Date** | October 2026 (sixth round) |
| **Scope** | The 15 findings deferred in [audit 5](audit-05.md), re-presented with current and suggested mock-ups, plus one new finding (A5-V1, preview-card footers) |
| **Output** | 10 accepted, 4 accepted with changes, 1 rejected |
| **Follow-up** | Implemented in commit `52d7c55` ("Address dashboard UI review and audit actor attribution", Oct 3): one `SubNav` for Settings and Project Settings, `PanelFooter`, scroll shadows in `DialogBody`, `text-tile`, audit actor types (user, system, API key, webhook) with a migration, and the Status summary strip reusing Home's tiles |

> Historical record. Finding details are in [audit 5](audit-05.md#finding-details).

## Outcomes

| ID | Finding | Outcome | Reviewer note |
| --- | --- | --- | --- |
| A5-H3 | One-time secret values have no visible labels; the webhook dialog repeats its warning | Accepted | — |
| A5-H6 | A failing service's cause is hidden behind a chip that doesn't look clickable | Accepted | — |
| A5-M1 | Section headings drift from C03, C04 and A4-Q25 | **Rejected** | The current heading structure stays (tab H2 + card headers as built) |
| A5-M2 | Deployment summary is a single column across 1,140px | Accepted | — |
| A5-M4 | Status › Nodes: unlabelled meters, wrapping cells, lopsided summary strip | Accepted | — |
| A5-M7 | Activity feeds: key line, read-only events, identical icons | Accepted | — |
| A5-M8 | Deployment tables: column order, image format and service tab tools | Accepted with changes | "Agreed with most, but make sure not to remove revision!" |
| A5-M10 | Secondary navigation: active item is nearly invisible; two components | Accepted | — |
| A5-M11 | Member detail: solid red button on the page; danger zone titles differ | Accepted with changes | "No tip text of 'Instance role is shown only to instance admins'" |
| A5-M12 | Create route: body scrolls with no cue; domain shown three times; dialog jumps | Accepted with changes | "The two inputs for hostname should merge smoothly instead of having rounded corners in the edge where they meet" |
| A5-M17 | Filter bars differ; select menus wrap long names | Accepted | — |
| A5-L1 | Project Overview service tiles are larger than their card title | Accepted | — |
| A5-L3 | "+ Attach volume" and "Attach a volume" | Accepted with changes | "Use 'Attach volume' in both places, but keep the +" |
| A5-L6 | Breadcrumb scope and labels | Accepted | — |
| A5-L9 | Deploy, rollback and restart details would print raw IDs | Accepted | — |
| A5-V1 | "View all" links sit in card headers, before the rows they continue | Added and implemented | Continuation links move to `PanelFooter`. The Cluster card always shows its footer |

## What changed in the rules

- **Joined controls** (the hostname prefix and its domain) merge without inner rounded corners.
- **"+ Attach volume"** keeps its `+`, which refines A3-C05: the `+` goes on create **and attach** triggers.
- **The revision column** stays in service deployment history.
- **Member roles** go in one horizontal Roles card. The instance-role select is visible to instance admins only, with no explanatory tip.
- **Section heading structure** is settled. A5-M1's further trimming was rejected.
- **Continuation links** go in card footers, and the header holds the title, count, status, and create actions.
