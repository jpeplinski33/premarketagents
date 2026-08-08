# Landing page recommendations (research → decisions)

## Competitive / market context
- Luxury RE sites (e.g. Sotheby’s-style) win with **photography quality, restraint, and clear hierarchy**—not busy MLS grids.  
- “Coming soon / pre-marketing” is a hot industry topic (portals and brokerages expanding pre-MLS tools). Positioning as **agent-controlled private presentation** differentiates from public portals.  
- High-converting RE landing pages typically have: one primary CTA, short “how it works,” social/trust proof, FAQ for SEO long-tail.

## Recommended brand direction (what we shipped v1)
| Choice | Why |
|--------|-----|
| Dark, gold, serif/sans luxury | Matches existing listing UI; signals exclusivity vs mass-market consumer portals |
| No listing grid / no map | Explicit product rule: public site ≠ inventory |
| Agent CTAs only | ICP is listing agents first; buyers arrive via invite links |
| FAQ block | Cheap SEO for “what is pre-market,” “browse without invite,” etc. |
| JSON-LD + canonical + sitemap | Technical SEO baseline |

## Alternate looks to A/B later
1. **Editorial light** — cream paper background, black type, full-bleed lifestyle photo (more “magazine”).  
2. **Brokerage toolkit** — slightly more SaaS (feature grid, pricing later). Risk: feels less exclusive.  
3. **Video hero** — muted tour clip background; heavier production.

## SEO strategy (ongoing)
### Primary keywords (homepage)
- pre-market listings for agents / realtors  
- pre-MLS listing presentation  
- exclusive coming soon listings agents  
- invite-only off-market listing page  

### On-page (done or next)
- [x] Unique title + meta description  
- [x] H1 with primary intent  
- [x] Canonical URL  
- [x] Organization + WebSite schema  
- [x] robots.txt (block `/r/` invite paths)  
- [x] sitemap.xml (public pages only)  
- [ ] Blog / guides: “How pre-market listings work in Ohio,” compliance-aware  
- [ ] Local landing pages later (e.g. Columbus) only if service area is intentional  
- [ ] Google Business Profile only if you want local pack (optional for SaaS)

### Invite listings SEO policy
- Listing URLs under `/r/{agent}/{code}` should be **`noindex`** so Google doesn’t treat private homes as public inventory.  
- Homeowners still open the link directly; crawlers are discouraged.

## Conversion CTAs
**Now:** `mailto:hello@premarketagents.com` (replace with real inbox or form).  
**Next:** Waitlist form (name, brokerage, market, phone) → CRM.  
**Later:** Agent login. Do not put login that reveals listings without auth.

## What must never appear on the public landing page
- Map (any basemap / parcels / owners)  
- Listing cards, addresses, prices, photo carousels of live inventory  
- Directory of agents that deep-links into open listings without auth  
- “View sample listing” that is a real unlisted home (use a clearly fake demo if needed)

## Suggested IA (next pages)
| Path | Purpose | Index? |
|------|---------|--------|
| `/` | Marketing home | Yes |
| `/for-listing-agents` | Deep benefits + onboarding | Yes |
| `/how-it-works` | Expand process | Yes |
| `/privacy` `/terms` | Trust + compliance | Yes |
| `/r/{agent}/{code}` | Invite listing | **No** |
| `/login` | Future auth | Noindex or low priority |
