# Learn content queue — Pre Market Agents

Cadence target: **2–4 solid posts / month** (quality over volume).

Draft pipeline: `scripts/draft-learn-article.sh` → human/Claude edit → publish under `site/learn/<slug>/`.

## Status legend
- `idea` — not started
- `draft` — AI draft exists, needs edit
- `edit` — in human review
- `ready` — fact-checked, ready to publish
- `live` — on site

## Queue

| Slug | Title | Pillar | Priority | Status | Keywords |
|------|-------|--------|----------|--------|----------|
| what-is-a-pre-market-listing | What is a pre-market listing? | Basics | P0 | live | pre-market listing, private listing, off-market |
| questions-to-ask-before-a-private-showing | Questions to ask before a private showing | Buying | P0 | live | private showing, exclusive listing questions |
| how-neighborhood-research-helps-sellers | How neighborhood research helps sellers | Selling | P0 | live | neighborhood comps, seller research |
| pre-market-vs-mls | Pre-market vs MLS: what buyers should know | Basics | P1 | live | pre-MLS, coming soon listing |
| how-invite-links-work | How private invite links work (and why) | Trust | P1 | idea | invite-only listing, realtor share link |
| new-albany-buyer-checklist | New Albany buyer checklist for pre-market opportunities | Local | P2 | idea | New Albany OH homes, Ebrington |
| reading-a-parcel-card | How to read a county parcel / tax card | Education | P2 | idea | Franklin County parcel, property card |
| agent-analytics-explained | Why listing agents see invite activity (and how it’s disclosed) | Trust | P1 | idea | listing activity, privacy disclosure |

## Editorial rules
1. No invented stats — cite public sources or say “typically / often.”
2. Homeowner tone on public site; agent vanity copy only behind `/realtors/`.
3. Never instruct scraping MLS/Zillow photos.
4. Link to `/explore/` and `/realtors/` where natural; never expose invite URLs in sitemap.
5. Each article: unique title, meta description, canonical, Article JSON-LD.

## Automation notes
- Gemini / DeepSeek for first draft (see `scripts/draft-learn-article.sh`)
- Always human-edit before `ready` → deploy
