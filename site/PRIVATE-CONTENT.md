# Private listing content — how the encryption works

Shipped 2026-08-09. Replaces the pilot gate that merely set `hidden` on a div,
which left the whole listing readable in view-source without a password.

## Threat model

The site is static (GitHub Pages). There is no server to check a password, so
anything the browser can fetch, anyone can fetch. Two things had to change:

1. **Listing content** must not be readable without the password.
2. **Photos** must not be enumerable. Sequential `/images/gallery-yantis/01.jpg`
   meant the gallery was browsable even with a perfect gate.

## Scheme

Each listing has one random 256-bit content key **K**.

- At build time `scripts/build-encrypt.js` pulls the `#invite-content` block and
  the `PHOTOS` manifest out of the page, encrypts both under K (AES-GCM), and
  leaves the page shipping only ciphertext in `<script id="pma-enc">`.
- Per invite, the realtor's dashboard wraps K with **that buyer's password**:
  `KEK = PBKDF2-SHA256(password, salt, 210000)`, then `AES-GCM(KEK, K)`.
- The wrapped blob rides in the URL fragment as `#k=`. Fragments are never sent
  to the server, so the wrapper never reaches GitHub's logs.
- The buyer types the password, the blob unwraps to K, the content decrypts.

**A wrong password fails as a GCM auth-tag mismatch.** There is no hash compare
to step over in a debugger, and the link alone cannot open a listing.

Photos live at `/images/p/<32 hex>.jpg`, named
`sha256(salt + "/" + original path)`. The salt lives in `site/images/.private-salt`
and is gitignored — knowing it would let anyone recompute every URL from the
original filenames.

## What is still public, deliberately

The `<head>` stays plaintext, because that is what builds the iMessage preview
card: `og:title`, `og:description`, `og:image`, address, price, agent name. The
gate screen also names the address and agent. All of this already appears on the
card that gets texted, so encrypting it would break the preview and protect
nothing.

Note `og:description` currently includes bed/bath/sqft. That is a product
choice, not an oversight — change the meta tag if it should not be public.

## The listing key

`build-encrypt.js` prints K once. It is **never** committed. The realtor pastes
it into their dashboard ("Listing key"), where it is kept in `localStorage` on
that device only. Without it they cannot create invites or preview the listing —
the dashboard refuses rather than issuing a link that can never be opened.

Current keys are in `.agent-runs/private-images-20260809/LISTING-KEYS.txt`
(gitignored, mode 600).

## Re-keying

`build-encrypt.js` refuses to run twice on the same page — the plaintext is gone
after the first pass, so a second would encrypt the ciphertext and destroy the
listing. To re-key: `git checkout` the page, then re-run.

## Consequence: old links die

Invites issued before this change carry `#ph=` and cannot be decrypted by any
means. Those links show "This invite link is out of date — ask your realtor to
resend" rather than a broken page. **Outstanding invites must be resent.**

## Device transfer

Invites live in one browser's `localStorage`. "Move invites to another device"
encrypts the registry plus listing keys under a random 6-character one-time
code and puts the ciphertext in a link fragment. The code travels separately;
the link is useless without it. On import the fragment is stripped from the URL
so the ciphertext does not sit in browser history.
