# Invite link preview images (Open Graph)

**Prototype of record (2026-08-09 v5):** stronger exclusive-invite card used on
listings — heavy brand plate, gold EXCLUSIVE INVITE badge, private showing line,
address/price/agent, gold edges. Generator: `scripts/make-og-image.py` (refresh
to match latest card when design changes).

Current shipping files use unique names (currently `*-exclusive-v5.jpg`) so
messaging apps cannot serve a cached older preview URL. V5 preserves the verified
branded v4 pixels under fresh URLs to invalidate Apple's URL-keyed unfurl cache.

Every new listing must:
1. Generate a new `site/images/og/{slug}-exclusive-vN.jpg`
2. Set absolute `og:image`, `og:image:secure_url`, and `twitter:image` on the invite HTML
3. Never reuse a previously shipped OG filename after a visual redesign
