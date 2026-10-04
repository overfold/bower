# Secrets and credentials

## One-time secrets

API keys, webhook endpoints (URL and token), and invitation links are shown **once**. They all use `OneTimeSecret` (A3-C08, A3 B55).

After the create action succeeds, the **same dialog** switches to its result state:

```
API key created                                              ✕
Copy this key now. You won't see it again.   ← one warning, under the description
─────────────────────────────────────────────────────────────
API key                                      ← visible label
┌──────────────────────────────────────────────┐ [⧉ Copy]
│ bwr_live_9f2c… (mono, sunken, wraps)          │
└──────────────────────────────────────────────┘
─────────────────────────────────────────────────────────────
                                                       [Done]
```

- The **title** changes to the result: "API key created", "Webhook created", "Invitation created" (A1 P1-15).
- There is **one warning per dialog**, placed under the description. Don't repeat it per field (A5-H3).
- **Each value has a visible label** ("Endpoint URL", "Token") (A5-H3).
- The field is read-only and mono on `sunken`, and the **value wraps** (`break-all`) so nothing is hidden (A4-Q64).
- Copy is centered on the field. It shows "Copied" for 2s and a success toast. Failure shows a danger toast.
- **Done is always enabled.** Closing isn't gated on copying (A3-F19).
- Webhooks also show an example request. Invitations add a sentence describing the role, uses, and expiry (A5-L10).

## Masked values

Variables and secrets are masked everywhere, including the project matrix, service configuration, and deploy review (A3-L11).

| Value type | Display | Interaction |
| --- | --- | --- |
| Revealable (service variable) | `••••••••` + eye button | Click to reveal **one** value, with Copy. It re-masks on blur (A3-U02) |
| Write-only shared value | `••••••••` + lock icon | Not clickable. Tooltip "Write-only. Set {time}." The backend can't read it back, and the UI says so (A3 B15, A4-Q33) |
| Inherited (service view) | A muted "—", Source "Shared" | — (A5-M19) |
| Secret binding | Lock icon + the secret's **name** (`DATABASE_URL`) + its target | Hover shows the full binding (A3-S20) |
| Deploy diff | One row per key with an Added, Changed, or Removed chip, key in mono, value masked | (A4-Q13) |

## Entering secrets

- A **masked multi-line** textarea with show and hide, and an **Upload file** option, for certificates and keys (A1 P2-13).
- Bind a secret to a service in the dialog titled **"Bind secret"**, with the variable name prefilled from the key (A5-M14).
- The scope option reads just the service name ("Storefront"). Secret keys appear in mono in selects.

## Never

- Log, toast, or put a secret value in the audit details.
- Show a secret in a placeholder, URL, or `title` attribute.
- Make a write-only value look revealable.
- Expose the Trellis-internal secret name where the secret's own name exists (A3 B16).
