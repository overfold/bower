# Audit 4: Dashboard and interface review

| | |
| --- | --- |
| **Date** | October 2026 (fourth round) |
| **Scope** | The interface after the B01–B73 fix list. Desktop captures, plus measurements (contrast, widths) |
| **Output** | 48 findings (2 critical, 13 high, 26 medium, 7 low), numbered here `A4-F01`–`A4-F48` in report order, and a 70-question decision form (`A4-Q01`–`A4-Q70`) |
| **Follow-up** | Implemented in commit `26fb95f` ("Address dashboard and interface review checklist", Oct 3). Field focus moved to a `brand-500` border, disabled buttons became neutral, configuration drafts gained variables, and validation moved inline |

> Historical record. Finding numbers are positional (the original report didn't number its items). "Decisions" lists the form questions each finding depended on.

## Summary

Audit 4 checked the audit 3 changes against real data shapes. It found logic bugs (Needs attention listing failures that were already fixed), layouts that broke with real content (deployment tables crushed into the Home column), and accessibility regressions (the soft focus halo measured about 1.3:1, and the border about 2.4:1). The form answered the remaining structural questions: compact deployment presets, Advanced folded into Configuration, the Project Settings anchor navigation, the heading scale, the status chip position, ratio formats, and the Status page columns.

## Findings

| # | Severity | Area | Finding | Decisions |
| --- | --- | --- | --- | --- |
| A4-F01 | Critical | Home | “Needs attention” lists failed deployments that a later deployment already fixed | A4-Q01 |
| A4-F02 | Critical | Home | Recent deployments table is crushed into the two-thirds column | A4-Q04, A4-Q05 |
| A4-F03 | High | Home | Needs attention rows name the subject inconsistently and disagree on status words | A4-Q02, A4-Q03, A4-Q06, A4-Q09, A4-Q10 |
| A4-F04 | High | Services | Deploy dialog shows changes as raw JSON | A4-Q13, A4-Q14 |
| A4-F05 | High | Foundations | Input focus indicator is below 3:1 | A4-Q17 |
| A4-F06 | High | Forms | Disabled buttons look like a different colour, and two Save buttons are disabled until changed | A4-Q18, A4-Q19 |
| A4-F07 | High | Services | Variables table is mostly dots and “unavailable” | A4-Q33, A4-Q34, A4-Q35 |
| A4-F08 | High | Services | Variable edits on Configuration save immediately while the rest is a draft | A4-Q36 |
| A4-F09 | High | Deployments | Rollback: primary on the live release, unnamed dialog, and a red confirm | A4-Q15, A4-Q16 |
| A4-F10 | High | Forms | Validation errors show twice, and the field hint stays neutral | A4-Q60 |
| A4-F11 | High | Status & copy | Common audit actions fall back to “Project update” | A4-Q50 |
| A4-F12 | High | Services | Service Overview repeats the Deployments tab | A4-Q31 |
| A4-F13 | High | Project pages | Project Settings: Danger zone in the middle, no way to jump between sections | A4-Q26, A4-Q27 |
| A4-F14 | High | Settings | Orphaned /settings/cluster page is still linked from the error banner | A4-Q28, A4-Q29 |
| A4-F15 | High | Cluster | A drained node keeps saying “Draining” with nothing left to move | A4-Q11, A4-Q12 |
| A4-F16 | Medium | Foundations | Section headings are as large as page titles | A4-Q20 |
| A4-F17 | Medium | Navigation | Tab section headings rename the tab | A4-Q25 |
| A4-F18 | Medium | Navigation | Allocation page uses the segmented control for page tabs | A4-Q24 |
| A4-F19 | Medium | Foundations | Status chip position differs on every detail page | A4-Q21 |
| A4-F20 | Medium | Components | Tab count pill is invisible on the canvas | A4-Q23 |
| A4-F21 | Medium | Forms | Settings inputs stretch to about 900px | A4-Q37, A4-Q38 |
| A4-F22 | Medium | Access & members | Member detail shows the role twice and has a stray ⋯ | A4-Q39 |
| A4-F23 | Medium | Deployments | Deployment Summary repeats the header | A4-Q44 |
| A4-F24 | Medium | Deployments | Failure notice contradicts itself | A4-Q45 |
| A4-F25 | Medium | Status & copy | Timelines show machine keys and lowercase phase names | A4-Q46 |
| A4-F26 | Medium | Foundations | UTC still appears next to local time | — |
| A4-F27 | Medium | Foundations | Counts and ratios use different formats | A4-Q22 |
| A4-F28 | Medium | Cluster | Status page: Trellis column names and a mostly empty top row | A4-Q51, A4-Q52, A4-Q53 |
| A4-F29 | Medium | Cluster | Node capacity bar uses purple and an unclear tick | A4-Q54 |
| A4-F30 | Medium | Services | Usage cards: wrong label and a disappearing meter | A4-Q55 |
| A4-F31 | Medium | Components | Action column header and ⋯ position vary | A4-Q56, A4-Q57 |
| A4-F32 | Medium | Settings | Domains: triple explanation and misplaced copy buttons | A4-Q40, A4-Q41 |
| A4-F33 | Medium | Forms | Filter search fields clip their text | A4-Q59 |
| A4-F34 | Medium | Forms | Create route: group labels look like field labels | A4-Q61 |
| A4-F35 | Medium | Services | Health check fields take two rows | A4-Q62 |
| A4-F36 | Medium | Services | Fold the Advanced tab into Configuration | A4-Q30 |
| A4-F37 | Medium | Deployments | Service Deployments table: Rev, Roll back column, time header | A4-Q47, A4-Q48, A4-Q49 |
| A4-F38 | Medium | Navigation | Command palette: missing Recent section, “Page” on every row | A4-Q32 |
| A4-F39 | Medium | Allocations | Terminal dialog | A4-Q63 |
| A4-F40 | Medium | Auth & public | Sign-in pages: make the brand background full-page, vines vertical | A4-Q65 |
| A4-F41 | Medium | Settings | Lock slugs after creation | A4-Q42 |
| A4-F42 | Low | Home | Deployment chart and Cluster card link | A4-Q07, A4-Q08 |
| A4-F43 | Low | Project pages | Routes table target and TLS | A4-Q58 |
| A4-F44 | Low | Access & members | Grant access: show Role from the start | A4-Q43 |
| A4-F45 | Low | Forms | One-time secret field cuts the value off | A4-Q64 |
| A4-F46 | Low | Auth & public | Auth buttons and forgotten password | A4-Q66, A4-Q67 |
| A4-F47 | Low | Status & copy | Small copy fixes | A4-Q68, A4-Q69, A4-Q70 |
| A4-F48 | Low | Foundations | Check the gap in “http: //” in mono text | — |

## Decisions

| ID | Section | Question | Decision |
| --- | --- | --- | --- |
| A4-Q01 | Home | Which failed deployments belong in “Needs attention”? | Only if it is the service’s newest deployment |
| A4-Q02 | Home | How should one problem with several symptoms be grouped? | Keep one row per symptom |
| A4-Q03 | Home | What goes in the “What” column? | Service display name, ID underneath when relevant |
| A4-Q04 | Home | Home “Recent deployments” no longer fits its column. What should it become? | Compact preset: Service, Image tag, Status, Started |
| A4-Q05 | Home | How is the image shown in compact deployment tables? | Target tag only |
| A4-Q06 | Home | Project Overview “Needs attention”: same table as Home? | Same table and grouping as Home, scoped to the project |
| A4-Q07 | Home | 14-day deployment chart style | Thin stacked bars, sentence-case legend |
| A4-Q08 | Home | Where does the Cluster card’s “View status” link go? | Card header, brand link — “Does this cluster card have a Healthy pill/tag or anything like that?” |
| A4-Q09 | Status words | What does an allocation whose process exited show? | “Failing” everywhere |
| A4-Q10 | Status words | Failing-service popover title | Title = chip word; restart state under it |
| A4-Q11 | Status words | What does a node show once a drain has finished? | “Drained · ready for maintenance” |
| A4-Q12 | Status words | Show “Resume scheduling” as a visible button on a draining or drained node? | Keep everything in ⋯ (L16) |
| A4-Q13 | Deploy & rollback | How does the Deploy dialog show variable changes? | One row per key, values masked |
| A4-Q14 | Deploy & rollback | How are other changes formatted in the Deploy dialog? | Plain sentences per field |
| A4-Q15 | Deploy & rollback | Header actions on the deployment that is currently running | No primary; “Roll back…” as a secondary button |
| A4-Q16 | Deploy & rollback | Rollback dialog title and picker | Name the service and the running release |
| A4-Q17 | Foundations | Input focus indicator | Brand-500 border, keep the brand-100 halo |
| A4-Q18 | Foundations | Disabled solid button style | Neutral: sunken fill, muted text |
| A4-Q19 | Foundations | Save buttons on unchanged forms (member role, password) | Always enabled; validate on click |
| A4-Q20 | Foundations | Heading scale | H1 26 · H2 18 · card 14 · item 14 |
| A4-Q21 | Foundations | Where does the status chip go on detail pages? | Right after the H1, everywhere |
| A4-Q22 | Foundations | Ratio and count formats | “2/10 uses”, bare numbers in count columns, “67%” |
| A4-Q23 | Foundations | Tab count pill when the tab is not active | White with a border |
| A4-Q24 | Navigation & structure | Page-level tabs on the allocation page | Underline tabs everywhere; segmented only inside cards |
| A4-Q25 | Navigation & structure | Tab section headings | Keep the H2, but make it exactly the tab label |
| A4-Q26 | Navigation & structure | Project Settings: where does the Danger zone go? | Last on the page |
| A4-Q27 | Navigation & structure | Navigation within the 2,300px Project Settings page | Sticky in-page list on the left |
| A4-Q28 | Navigation & structure | What happens to the old /settings/cluster page? | Redirect to Organization › Trellis connection |
| A4-Q29 | Navigation & structure | Show the connection status in the Trellis connection card? | No status here (Status page has it) |
| A4-Q30 | Navigation & structure | Advanced tab (two selects) | Fold into Configuration as a collapsed “Advanced” section |
| A4-Q31 | Navigation & structure | Service Overview’s Recent deployments | 5 latest, no Service column, “View all” |
| A4-Q32 | Navigation & structure | Command palette row subtitle | No subtitle; icon per type |
| A4-Q33 | Variables | Shared write-only value cell | Lock icon and “Set” — “I'm thinking •••••••• (lock icon)” |
| A4-Q34 | Variables | Service cell that inherits the shared value | Muted “↳ Shared” |
| A4-Q35 | Variables | Variables table in a single service’s Configuration | Key · Value · Source |
| A4-Q36 | Variables | Variables on the Configuration tab save immediately while the rest is a draft | Make variable edits part of the draft |
| A4-Q37 | Settings & members | Maximum width of settings inputs | About 560px; long URLs up to 720px |
| A4-Q38 | Settings & members | Theme control | “Let's keep as-is for now, since dark theme isn't fully tested and I don't want to make it more prominent” |
| A4-Q39 | Settings & members | Member detail layout | Details card + Role card + Danger zone |
| A4-Q40 | Settings & members | Domains: three explanations of verification | Page description only; instructions inside the expanded DNS row — “How many DNS rows can be expanded at once?” |
| A4-Q41 | Settings & members | DNS cell for a verified domain | Empty |
| A4-Q42 | Settings & members | Slug fields (organization and project) | Lock after creation |
| A4-Q43 | Settings & members | Grant access dialog | Show Role from the start (default Viewer) |
| A4-Q44 | Deployments & timelines | Deployment detail Summary | Image, Strategy, Duration, Revision only |
| A4-Q45 | Deployments & timelines | Failure notice when no logs were captured | Muted line; button “Open allocation” |
| A4-Q46 | Deployments & timelines | Event key placement in timelines | Hide keys (tooltip on the title) |
| A4-Q47 | Deployments & timelines | Service Deployments tab: Rev column | Keep it, blank when unknown |
| A4-Q48 | Deployments & timelines | Roll back on a history row | Icon button with tooltip (single action, per C01) |
| A4-Q49 | Deployments & timelines | Time column name | “Use "Time" everywhere” |
| A4-Q50 | Deployments & timelines | Audit fallback sentence for actions without a written sentence | “Alex Morgan performed project.update on Commerce Platform” |
| A4-Q51 | Status page & nodes | Restart-pending table columns | Service · Failures · Last failure · Next restart |
| A4-Q52 | Status page & nodes | Managed ingress columns | Proxy · Routes · Status (Applied / Pending) · Updated |
| A4-Q53 | Status page & nodes | Top of the Status page | One summary strip: connection, nodes, CPU, memory |
| A4-Q54 | Status page & nodes | Node capacity bar | Light brand = allocated, dark brand = used, over it |
| A4-Q55 | Status page & nodes | Usage cards on service and allocation pages | “… usage”, always draw the track, warn at 85%, danger at 100% |
| A4-Q56 | Tables & row actions | Actions column header | Visually hidden everywhere |
| A4-Q57 | Tables & row actions | Rows that have both ⋯ and a chevron | ⋯ right next to the chevron |
| A4-Q58 | Tables & row actions | Routes table: target and TLS | “Checkout API · port 3000”; TLS shown only when it is not automatic |
| A4-Q59 | Tables & row actions | Filter search width (Deployments, Members, Audit) | Grows to fill (min 240px), placeholder “Search” |
| A4-Q60 | Forms & dialogs | Field validation errors | Inline under the field, replacing the hint; banner only for server errors |
| A4-Q61 | Forms & dialogs | Group labels in long dialogs (Create route) | Overline label with a divider above |
| A4-Q62 | Forms & dialogs | Health check fields layout | Type, Path, Port on one row |
| A4-Q63 | Forms & dialogs | Terminal dialog | Title names the allocation; Full screen beside ✕ |
| A4-Q64 | Forms & dialogs | One-time secret field | Wrap the value |
| A4-Q65 | Sign-in | Sign-in brand panel | “I'm not sure I understand this question. The visuals are also pretty unclear. You can a follow-up and ask the question again, but better” |
| A4-Q66 | Sign-in | Auth button height | 36px (match the app) |
| A4-Q67 | Sign-in | Forgotten password | Hint: “Forgot your password? Ask an instance admin to reset it.” |
| A4-Q68 | Copy | Project access count | “4 with access” |
| A4-Q69 | Copy | Health of a project with no services | “No services” |
| A4-Q70 | Copy | Mounts tab description | “Attach project volumes to this service.” |

## Kept as decided

- **Node actions**: Resume scheduling stays in the ⋯ menu (Q12, L16).
- **Trellis connection card**: No connection status in Settings; the Status page covers it (Q29).
- **Theme control**: Stays a select in Account; not made more prominent while dark theme is untested (Q38).
- **Needs attention rows**: One row per symptom, each naming the service (Q02).
- **Domains DNS rows**: One expanded at a time (Q40 follow-up).
- **Home layout**: Recent deployments beside Cluster and Recent activity (Q04, L05).
- **Tab section headings**: H2 under each tab stays (Q25, N17).
- **Sign-in**: Animated trellis stays, now full-page (Q65, A01).

## Excluded as fixture artifacts

- **Durations “0s” on older deployments**: seed.mjs inserts the six older deployments with completed_at but no started_at.
- **Identical “1m 30s” durations**: seed.mjs sets completed_at = started_at + 90s for every recent deployment.
- **“Webhook · Alex Morgan” and “Manual · System” triggers**: seed.mjs sets triggered_by_user_id to the owner on all recent rows and leaves older rows without a user.
- **Succeeded, failed and rolled-back rows with the same image**: seed.mjs uses v2.3.0 → v2.4.1 for all three recent deployments of each service.
- **Rev “2” appearing twice in service history**: seed.mjs gives the retained older row revision 2, and the recent failed row 3 − j = 2.
- **Audit details identical for every action; resource always “Commerce Platform”**: seed.mjs writes the same details and the project ID for all five audit entries.
- **Events and lifecycle timestamps later than the deployment; all log lines share one time**: Seeded events use the default created_at; trellis.mjs stamps events and logs with now().
- **“Undeployed changes” on Storefront, and the PORT / LOG_FORMAT values in the Deploy diff**: The seeded running job_spec has no env, while the service config has PORT and LOG_FORMAT. (The raw-JSON format is a real bug, listed above.)
- **Draining node with 0 allocations**: trellis.mjs places allocations only on node-eu-west-01 and -02. (The missing “drained” state is listed above.)
- **Used CPU above allocated on node detail; “1 core / 1 core” on Storefront**: trellis.mjs returns synthetic metrics (cpu_usage: 0.23 + i × 0.12, cpu_usage_nanoseconds: Date.now() × 200000).
- **Focus ring on Cancel when the Deploy dialog opens**: capture.spec.mjs opens it from ?action=deploy with no pointer interaction, so the browser shows focus-visible on the auto-focused button.
- **“AM” avatars, Audit Project / Member names, “target audit-conf”, terminal text, redacted secrets**: Seed names; trellis.mjs strings; capture.spec.mjs:604–611 replaces secret values before the screenshot.
- **Sidebar ending partway down tall captures**: Full-page screenshot of a sticky full-height sidebar.
- **Times shown as “GMT+2”**: playwright.config.mjs sets timezoneId: Europe/Madrid; local time is the intended behaviour (T15).
