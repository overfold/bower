# Principles

These principles come from six rounds of UI audits and the decisions that followed them (see [records](records/README.md)). Every rule in this guide traces back to at least one of them. When a situation isn't covered, start from the principles.

## 1. Tell the operational truth

Bower is where people learn whether their software is running, so the UI must never look healthier, or more certain, than the data allows.

- Show **live** health for things that are running (services, allocations, nodes). Show **historical** results for things that already happened (deployments, events). Don't mix the two in one column.
- When data can't be read, say so ("Couldn't check the cluster", "Unavailable · 2 desired"). Never fall back to "All clear", "Healthy", or a blank.
- Spinners mean work is happening now. A finished lifecycle step is a static point on a timeline.
- Don't invent data. If Trellis doesn't provide a drain start time, show "—" and explain why.

*Sources: A2-B1, A2-B2, A2-B7, A3-L26, A1 P0-06, P0-10, P1-19, B21.*

## 2. Surface problems with a cause and a next step

A red chip is only half an answer. Wherever something is wrong, show what is wrong, why, and the most likely next action.

- Home and the project Overview open with **Needs attention**: one row per symptom, naming the service, the cause, the time, and one action.
- A failing service's chip opens a popover with the failure count, the last message, the next restart, and "Restart now" or "View logs".
- A failed deployment leads with "Roll back to {last good}" when a good release exists.

*Sources: A3-L02, A3-L19, A3-F21, A4-Q01, A4-Q02, A2-G7.*

## 3. One meaning per signal

Color, words, and component shapes each have one job. When the same signal means two things, people learn to ignore it.

- Each tone has one meaning: green for success, red for failure, amber for "needs attention", purple for "Rolled back" only, neutral for everything else. Brand teal marks selection, links, and the primary action. It never means "healthy".
- Each object has one status word per state, for example "Failing" for a service or allocation that isn't running.
- Chips are for state that changes. Static attributes are plain text.
- Each verb has one meaning: Delete, Remove, and Revoke are never interchangeable.

*Sources: A1 P1-02, P1-03, P1-04, P2-20, A3-T04 to T06, A3-S01 to S12, A4-Q09.*

## 4. Calm by default, color on purpose

Bower is a working tool that people look at for hours. The resting state is quiet: neutral surfaces, borders without shadows, one accent. That keeps the few colored things on screen noticeable.

- Cards have a border and no shadow. Elevation is for things that float: menus, dialogs, toasts.
- Each card has one primary action. Destructive red appears in rows only on hover, and solid red only at the final confirmation.
- Descriptions appear only where they add information.

*Sources: A3-T08, A3-C02, A3-C04, A3-S21, A3-U04.*

## 5. Plain language, with technical detail available

Users are technical, but they shouldn't need to know Trellis internals. Cluster, node, ingress, and allocation are fine. Revisions, incarnations, convergence, and "replacement backoff" are not.

- Use plain labels, and put retained Trellis terms in a tooltip ("Allocation ⓘ").
- Name things the way people think of them: "Restart pending", not "replacement backoff". "Can roll back", not "retained Trellis versions".
- Show readable names first and machine IDs as copyable metadata.

*Sources: A2-A1, A2-G2, A2-G3, A3-S05, A3-S06, A3-S17, A2-A6.*

## 6. Make the safe path the easy path

Friction should match how hard an action is to undo.

| Consequence | Friction |
| --- | --- |
| Reversible, or a recovery action (rollback, restart) | One confirmation with a brand primary button |
| Destroys something | A confirmation that names the object, with a solid red final button |
| Destroys a container of many things (project, domain, organization) | The confirmation also requires typing the slug or hostname |
| Would break something that depends on it (a mounted volume, a domain in use) | The action is blocked, and the dialog explains how to unblock it |

*Sources: A1 P1-14, A3-F02, A3-F07, A3-F08, A3-F09, A3-C06.*

## 7. Consistency comes from shared sources

Consistency is enforced by code, not by memory. Each pattern has exactly one owner (a token, a primitive, a helper, a label map). If a pattern needs to change, change its owner and every consumer changes with it. Page-level overrides cause the drift that the audits kept finding.

*Sources: AGENTS.md, A1 P1-01, P1-05, A3 B12, B14.*

## 8. Accessible by construction

Accessibility is built into the primitives so that pages get it for free.

- Focus indicators reach 3:1 contrast. Status never relies on color alone. Every control has a label, and every dialog has a title.
- Tables scroll inside their card, not the page. They become a focusable region only when they actually overflow.
- Motion respects `prefers-reduced-motion`.

*Sources: A2-H1, A2-H2, A4-Q17, A5-H7.*

## 9. Predictable structure

The same kind of page has the same anatomy, so people can find things without reading.

- A page has an H1, then a status chip right after it, then meta, then actions on the right.
- Under a tab, there is an H2 that matches the tab label exactly.
- Breadcrumbs end at the entity and act as the way back. There are no separate back links.
- Continuation links ("View all deployments →") go in card footers. Create actions go in card headers.

*Sources: A4-Q21, A4-Q25, A2-E1, A1 P1-12, A5-V1, A3-C03.*

## Resolving conflicts between principles

- **Truth (1) beats calm (4).** If something is broken, show it, even if the page gets louder.
- **Safety (6) beats speed.** Add a confirmation step before you remove one.
- **Shared source (7) beats a local fix.** If a page needs a variant, add it to the primitive with a name and a reason, then document it here.
- **Plain language (5) never removes information.** It moves detail into a tooltip, a secondary line, or an expanded section.
