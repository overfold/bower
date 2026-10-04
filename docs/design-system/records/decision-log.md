# Decision log

This is the consolidated list of design decisions **currently in force**, grouped by topic. Each row gives the rule as it stands, the decision IDs it comes from (latest first), and anything it superseded. The guide pages describe how to apply these rules. This page records **that** a choice was made and where it came from.

**ID prefixes:** `A1 P0-01` (audit 1 finding), `A2-B1` (audit 2 decision), `A3-T01` (audit 3 decision), `A3 B01` (audit 3 fix-list item), `A4-Q01` (audit 4 decision), `A4-F01` (audit 4 finding), `A5-C1` (audit 5 finding and its embedded choices), and "portal review" (revisions requested after audit 1). See [audits](README.md#audits).

**Precedence:** a later audit overrides an earlier one, and the code overrides all of them (see [Where the truth lives](../README.md#where-the-truth-lives)). When you change a rule, edit its row here, keep the old IDs under "Supersedes", and add a [changelog](../changelog.md) entry.

## Audience and language

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Audience | Technical app developers and platform engineers. Hide Trellis internals. Cluster, node, ingress, and allocation are fine | A2-A1 | — |
| Trellis jargon | Plain labels, with retained Trellis terms in an ⓘ tooltip | A3-S17 | — |
| Retained terms | Keep "Allocation", "Entity", and the `@/` volume path, each with a tooltip | A3-S06, S18, S19, A2-G5 | — |
| Crash backoff | "Restart pending" (status). "Restart cooldown" names the Status section | A3-S05, A2-G2 | "Replacement backoff" |
| Retained versions | Fold into deployment history as a "can roll back" row action | A2-G3 | "Retained Trellis versions" table |
| Page descriptions | Only where they add information (Volumes, Access, Domains) | A3-U04, A3-S21 | A3-N17 "drop descriptions" |
| Capitalization | Sentence case everywhere. No CSS `capitalize` | A1 P1-06, P3-11 | — |

## Foundations

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Token names | Bower semantic names only, with no generic aliases | A1 P1-01 | Generic shadcn aliases |
| Radius | 4 / 6 / 8 / 12 (sm, md, lg, xl). Checkbox 4, chip 6, control 8, card 12 | A3-T01 | A2-A2 (6/8/12) |
| Control borders | `line-strong` on form controls. Cards keep `line` | A3-T02 | — |
| Button focus | 2px `brand-500` ring, 2px offset | A2-A3 | brand-300 ring |
| Field focus | `brand-500` border plus a 3px `brand-100` halo | A4-Q17 | A3-T03 (`brand-300` border) |
| Invalid fields | Danger border and ring in every state, including focus | A3 B11 | — |
| `ink-faint` | Decorative and non-text only (linted) | A2-A4, A1 P3-01 | Near-duplicate of muted |
| Success color | Separate green (`ok`), not brand teal | A3-T04, A1 P1-02 | Brand-as-success |
| In-progress color | Neutral with a spinner | A3-T05, A2-B4, A1 P1-04 | Warn or purple for progress |
| Purple (`info`) | Rolled back only | A3-T06 | Four meanings |
| One tone system | One `Tone` type shared by chips, notices, toasts, and banners | A1 P1-03 | Per-component tones |
| Card elevation | Border only. Shadows on overlays only | A3-T08, A1 P3-06 | Border plus `shadow-card` |
| Canvas | Keep the current canvas color | A3-T09 | — |
| Overline | One style: 11px, 600, uppercase, slight tracking | A3-T07 | Four styles |
| Type scale | Named steps only (2xs 11, xs 12, sm 13, code 12.5, tile 14, md 15, lg 18, xl 22, 2xl 26), linted | A1 P1-05, A5-L1 (tile) | 11 ad-hoc pixel sizes |
| Heading scale | H1 26 bold · H2 18 semibold · card 13–14 semibold · item 14 medium | A4-Q20, A2-A5 | — |
| Monospace | For anything a user might copy. One size (12.5px). Titles stay sans | A3-T11, A3-U06, A2-A7 | Mono on labels and titles |
| Machine-ID pages | Readable sans H1, mono ID as metadata | A2-A6 | Mono H1 |
| Disabled buttons | Neutral: sunken fill, muted text, no opacity. Ghost and link get muted text only | A4-Q18, A5-H1 | 50% opacity |
| Ghost hover | `bg-ink/5` | A5-L11 | `bg-sunken` (invisible on canvas) |
| Primary hover | `bg-brand-600`, active `brand-700` | A1 P3-03 | `brightness-90` |
| Dialog backdrop | `bg-ink/25` | A1 P3-04 | `bg-black/30` |
| Unknown colors | Lint rejects color utilities not declared in `@theme` | A5-C2 | — |
| Overlay animation | `tw-animate-css` imported | A5-L8 | Silent no-op classes |
| Project icon | Folder | A3-T17 | Three icons |
| Avatar | Neutral tile with a `line-strong` border | A3-T18 | Brand tint, black squares |
| Theme control | A select in Account › Appearance. Not more prominent while dark mode is untested | A4-Q38, A3-N03 | — |

## Data formats

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Timestamps | Relative in lists, absolute on detail pages, a tooltip both ways | A3-T15 | A2-A8 ("always relative") |
| Time zone | Viewer's local time, UTC in the tooltip | A3-T16 | UTC everywhere |
| Inline time size | Inherit from surrounding text | A3-T10 | Fixed 12px |
| Time column name | "Time" in every table | A4-Q49 | "Started", "When" |
| Future times | "in 7 days", with the full date in the tooltip | A5-M3 | — |
| Durations | "1m 30s" | A3-T13 | "90s" |
| CPU | Cores ("0.5 cores"), at most 2 decimals | A2-A9, A2-M14 | mCPU, millicores |
| Memory | Automatic MB or GB ("512 MB", "16 GB"). Inputs in MB | A3-T14 | MiB/GiB mix |
| Ready count | "2/2 ready" | A3-T12 | — |
| Ratios and counts | "2/10 uses", bare numbers in count columns, "67%" | A4-Q22 | — |
| IDs | Readable names. Middle-truncated opaque IDs with a tooltip and copy (`ResourceId`) | A1 P0-02 | `slice(0, 8)` |
| Images in tables | Tag on top, repository muted beneath. Compact presets show the target tag only | A5-M8 / Q03, A4-Q05 | — |

## Status

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Service status meaning | Live health from running allocations | A2-B1, A1 P0-06 | Last deployment result |
| Live but newest deploy failed | Live chip plus a "Last deploy failed" warning marker | A2-B2 | — |
| Non-running service | "Failing" | A3-S01 | "Down" |
| Allocation that exited | "Failing" everywhere | A4-Q09 | "Failed" |
| Allocation chip | One chip: health while running, otherwise the phase | A2-B6 | Two chips |
| Successful deployment | "Succeeded" | A3-S02, A2-B3 | "Healthy" |
| Working node | "Healthy" | A3-S03 | "Ready" |
| Finished drain | "Drained" (neutral), "Ready for maintenance" | A4-Q11 | Endless "Draining" |
| Project health | "Healthy", "*N* of *M* failing", or "No services" | A3-S04, A4-Q69 | Worst status, "Not deployed" |
| Chips vs text | Chips for changing state. Static attributes as plain text. Duplicates merged | A1 P2-20, A2-B5 | Chips for everything |
| Status column position | Directly after the name | A2-B10 | — |
| Node status | A chip column, not a color dot only | A2-B9, A2-H2 | — |
| Status chip on detail pages | Right after the H1, outside the heading element | A4-Q21, A5-H4 | Under the title, inside the H1 |
| Failing explanation | A popover on the chip (with ⓘ and a hover state). Title = chip word | A3-L19, A4-Q10, A5-H6 | Banner |
| Cluster chip | All healthy / *N* draining / *N* drained / *N* unhealthy | A4-Q08, A5-M6, A1 P0-10 | Always green |
| Undeployed changes | A warn chip in the service header, and Deploy highlighted | A3-F04 | — |
| Allocation health tile | Counts failed allocations of the current version, from the same selector as Needs attention | A2-B7, A2-C2 | — |
| Needs attention form | A table (Status, What, Cause, Time, action), hidden when empty | A3-L02 | A2-B8 (chip strip) |
| Needs attention rows | One per symptom. The service name, with the specific ID beneath | A4-Q02, Q03 | — |
| Failed deployments in attention | Only when it is the service's newest deployment | A4-Q01 | All failures in the last 24h |
| Project Overview attention | The same table, scoped to the project | A4-Q06 | — |
| Superseded failed deployment | A neutral "Superseded by …" notice, no primary | A5-C3 | Roll back as primary |

## Navigation and structure

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Landing page name | "Home" | A3-S08, A2-C10 | "Overview" |
| Cluster page name | "Status" everywhere | A3-S07, A2-C6 | "Cluster" |
| Sidebar groups | Workspace, then Recent projects, then Platform | A1 P3-13, portal review | Flat list |
| Recent projects | Always shown (up to 5), most recent first | A3-N01, A2-E3 | — |
| Global cluster indicator | None. The Status page covers it | A3-N04, A4-Q29 | Sidebar connection footer |
| Org switcher | The first breadcrumb item. "Manage organizations" for instance admins. Hidden on instance pages | A3-N02, A3 B73, A5-L6, portal review | Sidebar header |
| Breadcrumb end | End at the entity, not the tab | A2-E1 | — |
| Breadcrumb collapse | Past 4 levels: first, `⋯`, last two | A3-N14, A2-E2 | — |
| Breadcrumb labels | Resolved names. Never prettified IDs | A3 B02, A1 P2-19 | — |
| Back links | None. The breadcrumb is the way back | A1 P1-12 | Four back-link patterns |
| Project tabs | 6: Overview, Services, Deployments, Routes, Environment, Settings | A3-N08 | 9 tabs |
| Tab order | Predefined by usage, never dynamic | A3-N09 | — |
| Project header | Title, health chip, description, tabs | A3-N18, A3-U05 | Meta row |
| Tab H2 | Kept, and exactly the tab label | A4-Q25, A3-N17 | Renamed headings |
| Single-card tab | The card header shows only the count and action | A3 B53, A5-M1 / Q58 | — |
| Service tabs | Overview, Configuration, Mounts, Deployments | A4-Q30, A3-N10, A3-S09 | 5 tabs, with History and Advanced |
| Advanced settings | A collapsed section in Configuration, part of the draft | A4-Q30, A5-M9 | Advanced tab |
| Allocation page | Its own page and header, with Logs · Details · Lifecycle tabs | A3-N12, N13 | Nested under the service |
| Page tabs vs segmented | Underline tabs for pages. Segmented only inside cards | A4-Q24 | — |
| Project Settings | One page with sections, a sticky anchor `SubNav`, and the Danger zone last | A4-Q26, Q27, A3-N08 | Separate pages |
| Settings navigation | Grouped side `SubNav`: Personal (Account), Instance (Organizations), Organization (Organization, Members, Teams, Domains) | A3-N06, A2-C4, A3 B27, A5-M10 | Flat tabs (A1 P1-10 restored tabs, then A2-C4 replaced them) |
| Settings title | A "Settings" H1 above the navigation. The section as H2 | A2-C5 | — |
| SubNav active style | `brand-50` fill with `brand-700` text, no edge bar | A5-M10 / Q55 | Grey fill |
| Org settings | General and the Trellis connection merged. `/settings/cluster` redirects | A3-F11, A4-Q28 | — |
| Connection status in settings | None (the Status page has it). No link from Status to settings | A4-Q29, A3-U01 | A3-N05 |
| Content width | Full width. Controls are capped individually | A3-N07, A2-A10, A4-Q37 | A1 P3-12 (narrow forms) |
| Command palette | Recent, then Go to, then Actions. Type icons. Places before actions | A3-N19, A4-Q32, A5-H2 | Actions first |
| Palette no results | "No results for "…"" only | A3-N20 | Create row |
| Instance › Organizations rows | Clicking switches organization | A3-N22 | Static rows |

## Pages

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Home title | "Home", no summary sentence | A3-N16 | A2-C9 (health subtitle) |
| Home order | Attention, stats, recent deployments (8), plus Cluster and Activity | A3-L01, L04, L05, A4-Q04 | A2-C8 |
| Home chart | Thin stacked bars on a baseline, sentence-case legend | A3-L03, A4-Q07 | — |
| Home activity | 5 rows. Read-only events only in the Audit log | A5-M6 / Q35, A5-M7 / Q33 | — |
| CPU and memory on the Cluster card | Removed (shown in the stat tiles) | A2-C7 | — |
| Projects list | A table. Search only above 8 projects | A3-L06, L07 | Cards |
| Project Overview | Attention, health strip of service tiles, deployments plus routes | A3-L08 | — |
| Empty project | One setup checklist card | A3-L09 | Three empty cards |
| Service header | Status, image, replicas, public URL | A2-C3 | Name only |
| Service Overview | Usage tiles, current allocations, 5 recent deployments. No log tail | A3-L20, A4-Q31 | — |
| Status page | Summary strip (Home's tiles), then the existing section order. Empty sections as one slim line | A4-Q53, A5-M4, A3-L13, L14 | — |
| Status columns | Restart pending: Service, Failures, Last failure, Next restart. Ingress: Proxy, Routes, Status, Updated | A4-Q51, Q52 | Trellis column names |
| Node page | Merged sections, allocations on the node, an allocated bar with a used overlay, heartbeat once | A3-L15, L17, L18, A4-Q54, A5-M5 | C12, four sections |
| Node actions | In the `⋯` menu | A3-L16, A4-Q12 | Visible buttons |
| Deployment detail title | The image tag in sans, the service linked above | A3-N15 | A2-E5 |
| Deployment summary | Image, Strategy, Duration, Revision in a 3-column grid | A4-Q44, A5-M2 | — |
| Event keys | Hidden, shown in the title tooltip | A4-Q46 | Visible key line |
| Lifecycle | Vertical timeline, toned dots, no spinners | A3-L26 | — |
| Logs | Fill the viewport, sticky toolbar, WARN and ERROR colored only | A5-M18, A3-C24 | 384px box |
| Teams | List plus a team detail page | A2-C14 | Accordion |
| Member detail | Details card, Roles card (org and instance roles, one Save), Danger zone | A5-M11 / Q62, A4-Q39 | — |
| Member roles in table | Text only. Change them on the detail page | A3-F14 (follow-up) | A2-C16 (inline selects) |
| Instance role column | Visible to instance admins only. Labels Admin / User | A3-F17, A2-C17 | "Instance admin" |
| Domains | DNS expands into a full-width row, one at a time. Route count only | A3-L23, L24, A4-Q40 | — |
| Verified domain DNS cell | Empty | A4-Q41 | — |
| Environment page | One matrix of variables against where they apply | A3-L10 | Card per service |
| Variables visibility | All values masked. Reveal one at a time | A3-L11, A3-U02 | — |
| Variable editing | A pencil per row opens a dialog. New and Paste .env open dialogs | A3-U03 | Inline editing |
| Service variables | Key · Value · Source. Inherited rows show "—" and "Shared" | A4-Q35, A5-M19 | "↳ Shared" (A4-Q34) |
| Write-only shared value | `••••••••` plus a lock icon | A4-Q33 | "Unavailable" |
| Variables on Configuration | Part of the draft | A4-Q36 | Immediate save |
| Project Access | Everyone with access, with a Source column. "4 with access" | A3-F16, A4-Q68 | Explicit grants |

## Components and interaction

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Row actions | `⋯` for 2+ actions. A single icon button for one | A3-C01 | A2-D1 (`⋯` always) |
| Destructive row icon | Neutral, red on hover | A3-C02, A2-D2 | Always red |
| Actions header | Visually hidden everywhere | A4-Q56 | — |
| `⋯` with a chevron | `⋯` directly before the chevron | A4-Q57 | — |
| Clickable rows | Whole row, hover, chevron, link-styled name | A3-N21, A2-M22, D3 | — |
| Card headers | Title, count, status, and create actions | A3-C03 | — |
| Continuation links | In the card footer (`PanelFooter`), only when rows are cut off | A5-V1 | "View all" in the header (A4-Q08) |
| Primary buttons | One per card | A3-C04 | — |
| `+` icon | On create and attach triggers, never on submit buttons | A6 (A5-L3), A3-C05 | — |
| Destructive buttons | Outlined to open, solid to confirm. Solid red never on a page | A3-C06, A5-M11 | — |
| Disabled submit | Keep enabled and validate on click | A3-C07, A4-Q19 | Disabled until valid |
| Validation errors | Inline under the field, replacing the hint. Banner only for server errors | A4-Q60 | Top banner |
| Toast style | Neutral surface (`bg-surface border-line`), tone on the icon only, `rounded-lg`, compact padding, fit-content width up to 22rem | Toast redesign (Oct 2026) | Tinted `toneClasses` toast, `p-4`, `rounded-xl`, full width |
| Toast timing | `danger` toasts stay until dismissed. Others leave after 5s, paused while the stack is hovered or focused | Toast redesign (Oct 2026) | Every toast auto-dismissed after 5s |
| Toast live regions | Two always-mounted sibling regions, polite and assertive (danger). Toasts carry no role | Toast redesign (Oct 2026) | `role="alert"` toasts inside a polite container |
| Toast titles | No closing period. Full-sentence descriptions end with one | Toast redesign (Oct 2026), content and copy | Mixed punctuation |
| Page banner dismissal | Condition banners are not dismissible and show exactly while the condition holds. A banner may opt in with `dismissible` and an explicit `id`; there is no title fallback | Toast redesign (Oct 2026) | A1 P2-24 (every banner dismissible, remembered for the session by title) |
| Page banner actions | In the `action` slot beside the text, as for `InlineNotice` | A2-H9 | Buttons nested inside the banner message |
| Feedback tones | The shared `Tone` names only. No `error` or `warning` aliases | A1 P1-03 | `error` and `warning` aliases |
| Placeholders | None in forms. Rules in hints. Search keeps "Search" | A3-C17 | — |
| Optional fields | "(optional)" | A2-F4 | — |
| Numeric fields | Fill the grid column, units as a suffix | A3-C19, A2-F2 | Fixed narrow width |
| Settings field widths | About 560px, URLs and textareas about 720px | A4-Q37 | ~900px fields |
| Strategy help | A hint under the select for the chosen option | A3-C18 | — |
| Default strategy | Rolling. One option order everywhere | A3-F22 | Recreate |
| Booleans | Checkbox in forms, switch for live toggles | A3-C13, A2-D5 | — |
| Option sets | Selects everywhere | Portal review, A3-L25 | Segmented controls (A1 audit table) |
| Team selection | Multi-select with chips | A3-C14 | Checkbox list |
| Expiry | Presets plus a date-only field | A3-C16 | Native datetime |
| Save model | A floating bar centered on the content column for drafts | A3-F05, A2-D6 | Per-card Save |
| Save wording | "Save changes". Password: "Update password" | A2-D7 | Four labels |
| Password form | Its own button in the card | A3-F10 | Floating bar |
| Unsaved bar summary | Counts without zero parts | A5-L5 | — |
| Dialog widths | sm confirmations, md forms, lg editors | A3-C11, A1 P2-21 | Ad-hoc widths |
| Confirmation ✕ | Added | A3-C12 | Cancel and Esc only |
| Growable dialogs | Pinned near the top, with scroll shadows | A5-M12 | Centered |
| Joined inputs | No inner rounded corners where they meet | A6 (A5-M12 change) | — |
| Empty states | Large style everywhere, with a next action | A3-C09, A2-D9 | Compact in cards |
| Filtered-empty | "Clear filters" as the main action | A3-C10 | — |
| Pagination | Range plus Previous/Next (ghost, brand text) | A3-C23, A2-D4, A5-H1 | Plain text |
| Tab counts | Services only, hidden at 0. Inactive pill on white with a border | A3-C22, A4-Q23, A2-D8 | All tabs |
| Disclosure | A chevron button everywhere | A2-D3 | Native `<details>` |
| Stat loading | A skeleton bar | A3-C21 | "Sampling…" |
| Meter thresholds | Always a track. Warn at 85%, danger at 100% | A4-Q55 | Prototype 70/85 |
| Search fields | Grow to fill (min 240px), placeholder "Search", the shared `SearchInput` | A4-Q59, A5-M16 | Four implementations |
| Filter placement | In the card header | A5-M17 / Q19 | Separate row |
| Select menus | Trigger-width minimum, max-w-xs, truncate | A5-M17 | Wrapping |
| Trigger column | Icon plus label, actor beneath | A3-C26 | — |
| Terminal | A large panel with full screen, the allocation in the title | A3-C25, A4-Q63 | Modal |
| One-time secrets | Labelled, read-only mono field plus Copy. One warning. Done always enabled. Values wrap | A3-C08, A3-F19, A5-H3, A4-Q64 | Three layouts, copy gating |
| Activity actors | Four icon types, no initials | A5-M7 / Q60 | Person glyph everywhere |
| Audit entry | A sentence, then a mono key line. Diffs as `old → new` with a muted old value | A3-S14, S15, S16, A5-C1 | Raw action names |
| Audit fallback | "… performed project.update on …" | A4-Q50 | "updated" |

## Flows

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Rollback entry | A header picker of earlier successful releases, plus a row icon on eligible history rows | A3-F01, A4-Q48 | — |
| Rollback confirm | Primary (brand) | A3-F02 | Red |
| Rollback on the running release | Not offered. "Roll back…" is a secondary button | A4-Q15, A3 B03 | — |
| Rollback dialog | Names the service and the running release. Labelled picker. Diff preview | A4-Q16, A5-M15 | — |
| Failed deployment primary | Roll back to the last good release when one exists | A3-F21, A2-G7 | Redeploy |
| Deploy confirmation | Shows what changes. Variables masked per key. Other fields as sentences | A3-F03, A4-Q13, Q14 | Raw JSON |
| Route editing | A full edit dialog | A3-F06 | Protection only |
| Route port default | The service's known port, with the source in an ⓘ | A2-F3 | 8080 |
| Hostname input | One combined control, with the preview beneath | A5-M12 / Q51 | Domain shown three times |
| Type-to-confirm | Project, organization, domain with routes, using the slug or hostname | A3-F07, F08, A2-F7 | Display name |
| Mounted volume delete | Blocked, listing services with links to their Mounts tab | A3-F09, A5-M21 | — |
| Slugs | Locked after creation, read-only mono | A4-Q42 | Editable |
| Invitations | Invite links only. Org role, teams, uses, expiry, note. Instance role for instance admins only | A2-F6, A3-F18, A3 B26 | Add by email |
| Grant access | Search as you type. Hide people who already have access. Role shown from the start | A3-C15, F15, A4-Q43 | — |
| Team rename | In the page header. Delete in the Danger zone | A3-F12 | — |
| Create service | No health check field and no slug field (project) | A5-M13 / Q29, Q53 | — |
| Secret binding | "Bind secret", with the variable name prefilled | A5-M14 | — |
| Invitation decline | "Decline" offered | A3-F20 | — |

## Auth and public

| Decision | Current rule | Source | Supersedes |
| --- | --- | --- | --- |
| Auth layout | Full-page dark background with the animated trellis and a centered card | A4-F40 / Q65, A3-A01 | 40% split panel (A1 P3-09, A2-H1) |
| Auth buttons | Full width, md (36px) | A3-A02, A4-Q66 | 44px |
| Protected route page | Neutral light page: hostname, password, "Protected by Bower" footer | A3-A03, A5-H5 | Sign-in branding |
| Password rules | Helper text under the field | A3-A04 | Placeholder |
| Forgotten password | "Ask an instance admin to reset it." | A4-Q67 | — |
| Login link | "Don't have an account? Create one" | A2-G6 | "Register" |
| Invitation page | Organization, inviter, role, expiry. Accept and Decline. Signed-in account | A2-H2, A3 B63 | — |
| Not found | Page-size title, the path in mono, actions | A2-H3, A1 P0-08 | Next.js default |

## Rejected or explicitly not done

| Proposal | Outcome | Source |
| --- | --- | --- |
| Further trimming of section headings | Rejected | A6 (A5-M1) |
| Segmented controls for option sets | Rejected after trial, replaced by selects | Portal review |
| Service size presets (Small, Medium, Large) | Removed. Explicit resource fields | Portal review |
| Disclosure for health check, isolation, and API access | Rejected. Always visible | Portal review, A2-C18 |
| Add member by email | Removed | A2-F6 |
| Theme switch in the profile menu | Not done while dark mode is untested | A4-Q38 |
| Global cluster health indicator | Not done | A3-N04 |
| Copy gating on one-time secrets | Not done | A3-F19 |
| Organization deletion UI | Not supported (no operation exists) | A3 B57 |
| Revealing shared write-only values | Not possible (the backend can't read them back) | A3 B15 |
