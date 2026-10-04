# Content and copy

## Voice

Bower speaks like a calm, competent colleague: **specific, plain, and brief**.

- **Say what happened and what to do.** "Worker could not reach database. Restart pending · next attempt in 30s." Not "An error occurred."
- **Name things.** "Delete Commerce Platform?", not "Delete this item?"
- **Don't hype or cheer.** No exclamation marks, no "Oops", no emoji.
- **Don't restate the title.** If a description repeats its heading, delete it (A3-S21).
- **Assume a technical reader, not a Trellis expert** (A2-A1). Cluster, node, ingress, allocation, and image are fine. Revision internals, incarnations, convergence, and "replacement backoff" are not.

## Capitalization and punctuation

- **Sentence case everywhere**: page titles, headings, buttons, labels, menu items, tabs, column headers (rendered uppercase by CSS), chips ("Rolled back", "Audit log", "Restart pending") (A1 P3-11).
- Proper nouns keep their case: Bower, Trellis, GitHub Container Registry, Docker Hub.
- The wordmark is lowercase "bower". In prose it is "Bower".
- Full sentences in descriptions, hints, and notices end with a period. Labels, buttons, chips, and titles don't.
- Use the typographic characters: ellipsis "…", arrow "→", middle dot "·" as a separator, en dash for ranges "1–20", and curly quotes in prose ("can't").
- Use "→" for transitions ("v2.3.0 → v2.4.1") and continuation links ("View all deployments →").

## Verbs

See [Actions and hierarchy › Verbs](actions-and-hierarchy.md#verbs). In short: **New and Create** make things, **Add and Attach** relate things, **Delete** destroys, **Remove** detaches, **Revoke** ends a credential or grant. **Save changes** saves a draft, and **Update password** changes a password.

## Glossary

Use these words, and only these words, for these concepts.

| Use | For | Don't use |
| --- | --- | --- |
| **Home** | The landing page | Overview, Dashboard (A2-C10) |
| **Status** | The cluster page | Cluster (page), Infrastructure (A3-S07) |
| **Project** | A group of services, routes, and environment | App, workspace |
| **Service** | A deployable workload | Job, app |
| **Deployment** | One rollout of a service configuration. The service tab is "Deployments" | Release (except in rollback pickers), Revision, History (A3-S09) |
| **Allocation** | A running copy of a service. Keep the Trellis term, with a tooltip | Instance, replica (A3-S06) |
| **Node** | A cluster machine | Host, server |
| **Replicas** | Desired copies of a service | Instances, count |
| **Restart pending** | Trellis is waiting to restart after repeated crashes | Replacement backoff, crash backoff (A3-S05) |
| **Restart cooldown** | The Status page section explaining restart waits | — (A2-G2) |
| **Can roll back** (row action) | A release that can still be restored | Retained Trellis versions (A2-G3) |
| **Drained** | A draining node with nothing left on it | Draining (once finished) (A4-Q11) |
| **Failing** | A service or allocation that isn't running | Down, Failed (for allocations), Degraded (A3-S01, A4-Q09) |
| **Succeeded** | A deployment that finished well | Healthy, Deployed (A3-S02) |
| **Undeployed changes** | Saved configuration that isn't running yet | Pending changes, draft |
| **Entity** | The first column of Project › Access (teams or people) | Who, Member (A2-G5, A3-S19). The count reads "4 with access" (A4-Q68) |
| **Invite people / invitation link** | Adding people to an organization (links only) | Add member by email (A2-F6) |
| **Danger zone** | The destructive section | Danger area (A3-S10) |
| **Proxy, Applied, Pending** | Managed ingress state | Submission, observed convergence (A4-Q52) |
| **Next restart, Failures, Last failure** | Restart-pending columns | Next replacement, Job / Group (A4-Q51) |

Trellis terms that must stay (Allocation, Group, Job, Current try, the `@/` volume path) get an ⓘ tooltip explaining them in plain words (A3-S17, A5 "Allocation jargon" kept).

## Labels and helper text

- Field labels are nouns ("Container image", "Rate limit"). Add "(optional)" where it applies.
- Hints explain format, limits, or consequences: "Up to 8 cores per replica", "Visitors enter this password on a Bower page.", "Replaces replicas one at a time. No downtime."
- Never put rules in placeholders (A3-C17).
- Explain the **chosen** option under a select, not every option in a menu (A3-C18).

## People

- In confirmations, the **name** goes in the title and the **email** in the description (A3-S13).
- In tables, show the avatar, then the name (medium weight), then the email in its own column or a muted line.
- Signed-in context: "Not you? Switch account".
- Audit actors: "Alex Morgan", "System", "Alex Morgan via API key GitHub Actions", "Webhook". Show a deleted user as "Deleted user" (A5-M7).

## Audit and activity sentences

`src/lib/labels.ts` (`auditActionSentence`, tested in `labels.test.ts`):

- Each action key has a **readable sentence**: "deployed Storefront v2.4.1", "added jamie@example.test to Platform Engineering", "opened a terminal for storefront-alloc-1" (A2-G1, A3-S14).
- The resource name is in sans, medium weight. Use mono only for copyable values in the sentence.
- Every emitted action must have a sentence. The test fails otherwise (A3 B18).
- The fallback for an unknown key is "Alex Morgan performed project.update on Commerce Platform" (A4-Q50). Never a wrong verb such as "updated".
- The raw key appears as a secondary mono line with the time (A3-S15).

## Pluralization and numbers

- Always pluralize: "1 service", "2 services", "1 core", "0 deployments" (A1 P3-11, A3 B67).
- Count columns use bare numbers. Prose and hints use a number and a noun.
- See [Data formatting](data-formatting.md) for units, ratios, and times.

## Microcopy reference

| Situation | Copy |
| --- | --- |
| One-time secret warning | "You won't see this again." (one warning per dialog, under the description) |
| Invitation created | "Anyone with this link can join Acme Cloud as a member. It works once and expires in 7 days." (A5-L10) |
| Forgotten password | "Forgot your password? Ask an instance admin to reset it." (A4-Q67) |
| Login link to registration | "Don't have an account? Create one" (A2-G6, L1) |
| Not deployed yet | "Not deployed" (service), "No services" (project) |
| Volume storage | "Stored on the node that first used it." (A5-L4) |
| Host paths disabled | "Host paths aren't allowed on this instance." |
| Create without deploy | "The service is created without deploying. Review its configuration, then deploy when ready." |
| Domain deletion | "This removes the domain from Bower. DNS records are left untouched." |
| Workload API access | "Lets this service call the cluster API. Any access is cluster-wide, and only an instance admin can turn it on." (A2-M11) |
