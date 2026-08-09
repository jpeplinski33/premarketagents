# Invite link preview images (Open Graph)

**Prototype (locked 2026-08-08):** the branded share card design used on Alan’s
Yantis listing — dark overlay, **PRE MARKET / AGENTS** mark, gold **EXCLUSIVE INVITE**
badge, “Private pre-market showing”, address, price, agent line, gold bottom edge.

- Generator: `scripts/make-og-image.py` (do not freestyle a new layout)
- Canonical sample: `prototype-exclusive-invite.jpg` and `yantis-alan-premarket.jpg`
- Per-listing files: `{listing}-premarket.jpg` with correct agent line
- Meta: absolute `https://premarketagents.com/images/og/...` on each invite page
  (`og:image` + `twitter:image`, 1200×630)

Every new listing invite **must** generate an OG image with this script before ship.
