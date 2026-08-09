# Pre Market Agents — product decisions (2026-08-03)

## 1. Realtor verification (no contact harvest)

### Collect at gate
| Field | Why |
|--------|-----|
| Legal name | Match to license record |
| State | Which board/database |
| License number | Primary proof |
| License type | Salesperson vs broker |
| Attestation checkbox | Legal “I am licensed” statement |

### Do **not** collect at gate
Email, phone, brokerage, MLS ID (optional later), marketing opt-ins.

### Best verification method (recommended stack)

**Primary (best balance):** **State real estate license number + name + state**, verified against the **public state license lookup** (Ohio: eLicense / Division of Real Estate & Professional Licensing).

Why not “MLS number” alone?
- MLS member IDs are **MLS-specific**, often not a single national public API.
- “REALTOR®” / NRDS is NAR-related and not a free open verification API for every visitor.
- State **license** is the legal authority to practice; MLS is a membership on top.

**Implementation tiers:**
1. **Now (shipped soft gate):** Attestation + fields stored in `sessionStorage`. Keeps consumers out of agent marketing pages. Honest labeling: “may verify.”
2. **Next (hard gate):** Server checks Ohio (then other states) public license status = active + name fuzzy-match. No email required.
3. **Later (optional lead gen):** After gate, *optional* “Get updates” with email — never required to enter.

**Do not:** scrape NAR or resell license data; claim “NAR verified” without rights.

### Future lead gen
Gate proves *professional*. Separate opt-in can capture contact for recruiting. Keep those steps separate so the gate never feels like a lead form.

---

## 2. Public landing vs realtor copy

| Audience | Message |
|----------|---------|
| Homeowners / buyers | Clarity, calm exclusivity, education, invite path |
| Realtors (behind gate) | “Look exceptional,” invite branding, analytics, control |

Removed from public hero: *“makes the listing agent look exceptional.”* That line lives on `/realtors/` after gate.

---

## 3. Map tiers & compliance posture

### Risks if full JobShutter map is public
| Risk | Why it matters |
|------|----------------|
| Owner-name carpet bombing | Privacy optics + possible limits on bulk republication of PII even when “public record” |
| County GIS ToS | Franklin Auditor data is as-is; commercial reuse at scale should be careful |
| Activity → realtor leads without consent | Feels like surveillance; needs disclosure + often consent banners |
| Dilutes exclusivity | If public map is “the good stuff,” invites lose power |

### Recommended tier split

| Tier | Who | What they get | Tracking |
|------|-----|----------------|----------|
| **Public Explore** | Anyone | School districts, high-level neighborhood education, **no owner names**, no private inventory, limited zoom tools | Aggregate anonymous only (if any) |
| **Realtor workshop** | License-gated | Demo of full product, sample analytics UI, playbooks | Session tied to license attestation |
| **Invite preview** | Client with `/r/agent/code` | Full listing + deep map + disclosed agent analytics | Full invite-scoped intel |

**Hold back for invites (the “real cards”):**
- Owner-name labels / neighbor directory
- Full parcel intelligence + public county deep-link packs per pin
- “Homes this client lingered on” agent dashboard
- Full photo galleries of private listings

**Safe public hooks that still entice:**
- Educational map mock / “coming soon” explore
- School-district explainers
- Blog content
- Clear CTA: “Get a private invite from your realtor”

### Can public map feed realtor leads?
Only if:
1. User is told activity may be used to connect them with professionals **or**
2. Tracking is aggregate (heatmaps of popular *areas*, not identified people) **or**
3. User creates a voluntary session (still no full vault)

Do **not** put full agent analytics on anonymous public map users.

---

## 4. SEO plan (“SEO the shit out of this”)

### Technical (done / ongoing)
- Unique titles + meta descriptions per page
- Canonical URLs
- JSON-LD Organization / WebSite / Article
- `sitemap.xml` with all public URLs
- `robots.txt`: allow public; **disallow `/r/`** invite paths
- Invite pages: `noindex`

### Content pillars (homeowner)
1. Pre-market / coming soon explainers  
2. Buyer checklists for private showings  
3. Seller neighborhood / pricing education  
4. Local (Franklin / New Albany / Columbus) guides later  
5. “How private invites work” trust content  

### Authority / backlinks (your “articles on trusted sites” idea)
Yes — that’s **off-site SEO / digital PR**, not a magic on-site switch:

| Tactic | Purpose |
|--------|---------|
| Guest posts on local business journals, Realtor association blogs (where allowed) | Backlinks + brand |
| Original data reports (“Franklin County sales education” — not scraped MLS photos) | Link magnets |
| Partnerships with agents who cite your guides | Referral + links |
| Consistent NAP only if you do local business SEO | Local pack (optional) |

On-site blog supports keywords; **external mentions** raise domain authority. Both matter.

### Automation for articles
| Layer | Approach |
|-------|----------|
| Editorial calendar | Topics + keywords queue in repo (`content/queue.md`) |
| Draft generation | Gemini/DeepSeek draft → human or Claude edit for accuracy |
| Fact lock | No invented stats; cite public sources |
| Publish | Static pages under `/learn/slug/` or future CMS |
| Cadence | 2–4 solid posts/month beats 30 thin AI spam pages (Google quality systems punish junk) |

---

## 5. Shipped this pass
- Homeowner-first homepage (agent vanity line removed)
- `/realtors/` license gate (name + state + license #, no email/phone)
- `/learn/` + 3 educational articles + schema
- `/privacy/` summary
- SEO sitemap/robots updates
- This decision doc

## 5b. Shipped 2026-08-03 (backlog sprint)
- **Invite analytics MVP:** `site/js/invite-analytics.js` — page/photo/scroll/CTA/map events, disclosure bar, localStorage store, optional remote `endpoint`
- **Agent dashboard:** `/r/alan-hinson/dashboard/` (demo key `alan-hanbys-2026`) — sessions, top photos, CTAs; multi-device backend still optional
- **Invite map:** Leaflet + Esri satellite + Franklin parcel GeoJSON, decluttered owner labels, county link-outs only (no MLS photo scrape; no Zillow)
- **Public explore:** `/explore/` — same sample area, **no owner names**, no tracking product
- **Realtor gate v2:** stronger OH format checks, localStorage session, `VERIFY_ENDPOINT` stub for hard eLicense match
- **Content pipeline:** `site/content/queue.md` + `scripts/draft-learn-article.sh` (DeepSeek/Gemini → drafts only)

## 6. Still not fully built (honest gaps)
- **Hard server-side Ohio eLicense verification** — client ready; needs Worker/API + ToS-safe data source
- **Multi-device analytics store** — client beacon ready; needs hosted endpoint + auth
- **Live comps feed** — Franklin sales layer stale (max sale ~2025-07-16); freshness guard required before shipping comps
- **Automated content production run** — pipeline scaffolded; human edit still required before publish
- Optional: realtor lead-gen opt-in after gate


## 7. Shipped 2026-08-08 — Natasha + password invites
- **Agent:** Natasha Petroff (Thomas|Riddle / New Albany Realty) — dashboard `/r/natasha-petroff/dashboard/`
- **Listing:** 4879 Yantis Dr · invite `/r/natasha-petroff/n2pfrv7/` · 68 listing photos (private invite, noindex)
- **Password-protected invites (all agents):** realtor sets password in dashboard; buyers enter on invite page (`invite-gate.js`)
- **Pilot logins:** Natasha `natashap@thomasriddle.com` / `PreMarket2026`; Alan unchanged; seed invite passwords `Yantis2026` / `Hanbys2026`


## HARD RULE — No Zillow (2026-08-08)

**Never** mention, link to, or brand against **Zillow** (including Zestimate®) on any Pre Market Agents surface — listings, maps, marketing pages, dashboards, agent profiles, emails/templates generated for clients.

| Do | Don't |
|----|--------|
| County auditor / Franklin GIS parcel links | Zillow homedetails links |
| Public recorded sale history from county | "View on Zillow" CTAs |
| Neutral "public portals" wording if needed | Competitor-name comparisons in product UI |

Internal research notes may name third parties; **anything under `site/` / live domain must not.**


## 8. Trackable homeowner invites (2026-08-08)

Realtor dashboards create **per-homeowner** invite links (first, last, phone, email + password).

| Piece | Shape |
|-------|--------|
| URL | `/r/{agent}/{listing}/?i={token}&ph={sha256}` |
| Analytics id | `{agent}/{listing}/{token}` |
| Registry | `localStorage pma_client_invites_v1` (realtor browser + PII) |
| Password verify | `ph` query hash works on any device; registry used when present |

Bare listing URLs without `?i=` are blocked (except `?preview=1` internal bypass).
No general listing activity feed — only per-homeowner stats. No Export JSON on dashboard.


## 9. Invite link preview image (OG prototype — 2026-08-08)

Canonical design: Alan Yantis share card (`/images/og/yantis-alan-premarket.jpg`),
generated by `scripts/make-og-image.py`. All new listings must use this layout
(brand + EXCLUSIVE INVITE + private showing + address/price/agent). Absolute
`og:image` URLs only so text/iMessage unfurls correctly.
