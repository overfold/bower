# Destructive actions

## Verbs

| Verb | Use when | Example |
| --- | --- | --- |
| **Delete** | The object and its data are destroyed | Delete project, Delete volume, Delete domain, Delete team |
| **Remove** | A relationship ends, and both objects survive | Remove from organization, Remove from team, detach a mount |
| **Revoke** | A credential or grant stops working | Revoke API key, Revoke invitation, revoke project access |
| **Stop** | A running thing stops, and it can be started again | Stop allocation |
| **Drain node** | Allocations move off a node | Explain the effect on allocations in the confirmation (A1 P0-09) |

Source: A3-S12.

## Graduated friction

| Level | When | UI |
| --- | --- | --- |
| 1. Confirm | Any delete, remove, revoke, stop, or drain | `AlertDialog`: a question title naming the object, a one-line consequence, then Cancel and a **solid red** confirm |
| 2. Type to confirm | Deleting a **project**, an **organization**, or a **domain** (A3-F07). Volumes are blocked while mounted instead | Level 1, plus "Type `commerce` to confirm". The confirm stays disabled until the input matches |
| 3. Blocked | Deleting would break dependents: a mounted volume, a domain with routes | The confirm is disabled and the dialog explains why, linking to where to fix it |

Recovery actions such as **rollback** and **restart** are not destructive. Their confirmation uses the **primary** brand button (A3-F02).

## Button styles

- The trigger on the page is `variant="danger"` (an outlined red button) or a red menu item.
- The final confirmation is `variant="destructive"` (solid red), the default for `AlertDialogAction`.
- Never put a solid red button directly on a page (A3-C06, A5-M11).
- A single trash icon in a table row is **neutral until hover** (A3-C02). Inside a `⋯` menu, the destructive item comes last, after a separator, in red (A2-D2).

## Confirmation content

```
Delete Commerce Platform?                                   ✕
Deletes 3 services, 2 routes, 2 volumes, all secrets and
deployment history. This can't be undone.
─────────────────────────────────────────────────────────────
Type commerce to confirm
[                                                          ]
─────────────────────────────────────────────────────────────
                                       [Cancel] [Delete project]
```

- **Title:** a question that names the object: "Delete Commerce Platform?", "Remove Jamie Chen?", "Revoke API key GitHub Actions?"
- **For people:** the name goes in the title, and the email goes in the description (A3-S13).
- **Description:** one sentence with **real counts** of what goes, and whether it can be undone. Don't repeat it in a bullet list (A2-F7).
- **Type-to-confirm value:** the **slug** (projects, organizations) or the hostname (domains). It is shown in mono in the label, and it is visible elsewhere (the slug is shown read-only in Settings › General) (A3-F08).
- **Confirm label:** the verb and the object ("Delete project"), not "OK" or "Confirm".
- Domain deletion also says "DNS records are left untouched."

## Danger zone

- A card with `border-danger-200` titled **"Danger zone"** in `text-danger-500` (A3-S10, A5-M11).
- It is **last** on the page (A4-Q26).
- Each row is a short sentence on the consequence, plus a `danger` button.
- Only destructive actions belong here. Rename and role changes go elsewhere (A3-F12).

Used on: Project Settings (Delete project), Team (Delete team), Member (Remove from organization).

## Blocked deletes

When an object is in use:

- **Volume mounted by services:** "Delete volume" is disabled in the dialog. A warning notice lists each service and mount path, **each linking to that service's Mounts tab** (A3-F09, A5-M21).
- **Domain with routes:** deletion is blocked, and the disabled control explains "Remove the 3 routes using this domain first" (A1 P2-08, A3 B57).
- **Owner role:** "Owner role can't be changed" is shown inline.

Never offer a delete that the server will reject, and never let a delete silently cascade into breaking something running.

## Unsupported

Organization deletion is **not currently supported**. Don't add UI for it until there is an operation. The type-to-confirm pattern above already covers it if one is added (A3 B57).
