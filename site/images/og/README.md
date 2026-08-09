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

## If the buyer is not seeing the card, it is probably NOT this image

Check the message shape before touching any artwork. iMessage renders the big
card only when the link is sent as its **own message**. Text and link in one
message, anything typed after the link, or a second detectable link in the same
message (a street address counts) — any of those and the buyer just gets a plain
blue URL, no matter how correct the OG tags are.

The dashboard "Send to buyer" panel therefore sends **two messages**: details
first, then the bare URL (`PMAInviteRegistry.inviteIntro` then `inviteLink`).
Do not merge them back into one body.

Before re-cutting an image, verify the server side is actually at fault:

```
curl -sI https://premarketagents.com/images/og/{file}.jpg | head -3
curl -s -A "facebookexternalhit/1.1" "{invite-url}" | grep og:image
```

If those return 200 and the right filename, the image is fine — the problem is
in how the link was sent.
