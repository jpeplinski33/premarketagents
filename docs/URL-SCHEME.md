# PreMarketAgents share URL scheme

## Public share link (homeowner / buyer agent / client)

```
https://premarketagents.com/r/{agent-slug}/{listing-code}
```

**Examples:**
```
https://premarketagents.com/r/alan-hinson/3czjbv9
https://premarketagents.com/r/natasha-petroff/n2pfrv7
```

### Why this shape
| Piece | Role |
|--------|------|
| `/r/` | “Realtor share” route (invite link). Not a public search index. |
| `{agent-slug}` | Human-recognizable: *this came from Alan Hinson*. e.g. `alan-hinson` |
| `{listing-code}` | Opaque 7-char id (no ambiguous 0/O/1/l). **Many listings per agent.** |

### Password-protected invites (required)
Every `/r/{agent}/{code}` page requires an **invite password** the realtor sets in their dashboard (`/r/{agent}/dashboard/`).

| Actor | What they share |
|--------|------------------|
| Realtor | Link + password (copy from dashboard) |
| Buyer | Opens link → enters password → full listing |

Pilot: password hash stored client-side (`localStorage` + page seed). Not production auth.

### Agent dashboards
```
https://premarketagents.com/r/{agent-slug}/dashboard/
```

| Agent | Login (pilot) | Dashboard |
|--------|----------------|-----------|
| Alan Hinson | `alan@newalbanyrealty.com` / `PreMarket2026` | `/r/alan-hinson/dashboard/` |
| Natasha Petroff | `natashap@thomasriddle.com` / `PreMarket2026` | `/r/natasha-petroff/dashboard/` |

### Avoid
- `/alan-hinson` alone → looks like a single personal homepage / one listing
- Sequential `/listing/1` → guessable, scrapable
- Full street address in path → ugly + privacy + long to text

### Future (login required)
Same path; server checks session + invite grant for `(agent, listing-code)`.
Optional vanity later: custom code the agent picks if unique.

### Code generation
- 7 chars from `abcdefghjkmnpqrstuvwxyz23456789`
- ~35^7 ≈ 64B space; collision-check in DB when multi-tenant
