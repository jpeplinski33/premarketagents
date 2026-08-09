#!/usr/bin/env node
/**
 * Encrypt a listing page's private content in place.
 *
 * Takes the plaintext `#invite-content` block and the PHOTOS manifest out of
 * the page, encrypts both under a fresh random listing key K, and leaves the
 * page shipping only ciphertext. Prints K — the realtor pastes it into their
 * dashboard once per device, and it is never written into the repo.
 *
 *   node scripts/build-encrypt.js site/r/natasha-petroff/n2pfrv7/index.html
 *
 * Re-running on an already-encrypted page is refused: the plaintext is gone by
 * then, so a second pass would encrypt the ciphertext and destroy the listing.
 * To re-key, restore the page from git first.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const C = require(path.join(__dirname, "..", "site", "js", "invite-crypto.js"));

const OPEN = '<div id="invite-content" hidden>';
const CLOSE = "</div><!-- /invite-content -->";
const MARKER = 'id="pma-enc"';

function fail(msg) {
  console.error("ERROR: " + msg);
  process.exit(1);
}

/**
 * The manifest is a JS object literal (unquoted keys), not JSON, so it has to
 * be evaluated rather than JSON.parse'd. Input is our own checked-in page.
 */
function parseArray(text) {
  return new Function("return (" + text + ");")();
}

/** Pull `var|const|let PHOTOS = [ ... ];` out as source text, brackets balanced. */
function extractPhotos(src) {
  // Pages differ: some declare PHOTOS with var, the Hanbys page uses const.
  const m = /(?:var|const|let)\s+PHOTOS\s*=\s*\[/.exec(src);
  if (!m) return null;
  const start = m.index;
  let i = m.index + m[0].length - 1;
  let depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === "[") depth++;
    else if (src[i] === "]") {
      depth--;
      if (depth === 0) break;
    }
  }
  if (depth !== 0) fail("could not find the end of the PHOTOS array");
  const arrayText = src.slice(m.index + m[0].length - 1, i + 1);
  return { start, end: src.indexOf(";", i) + 1, arrayText };
}

async function main() {
  const file = process.argv[2];
  if (!file) fail("usage: build-encrypt.js <listing-index.html>");
  if (!fs.existsSync(file)) fail("no such file: " + file);

  let html = fs.readFileSync(file, "utf8");

  if (html.includes(MARKER)) {
    fail(
      file +
        " is already encrypted. Restore it from git before re-keying, or the " +
        "ciphertext would be encrypted a second time and the listing lost."
    );
  }

  const open = html.indexOf(OPEN);
  const close = html.indexOf(CLOSE);
  if (open === -1 || close === -1 || close < open) {
    fail("could not locate the #invite-content block (need the closing marker)");
  }

  const contentHtml = html.slice(open + OPEN.length, close);

  const photos = extractPhotos(html);
  if (!photos) fail("could not locate `var PHOTOS = [ ... ];`");
  if (/for\s*\(/.test(html.slice(photos.start - 200, photos.start))) {
    console.warn(
      "WARNING: PHOTOS may still be built by a loop — check the page was " +
        "converted to an explicit array first, or photo paths will leak."
    );
  }

  const payload = JSON.stringify({
    html: contentHtml,
    photos: parseArray(photos.arrayText)
  });

  const K = C.generateContentKey();
  const cipher = await C.encryptContent(payload, K);

  // Replace the PHOTOS literal first (later offset), then the content block.
  html =
    html.slice(0, photos.start) +
    "var PHOTOS = []; // filled from the encrypted payload after unlock" +
    html.slice(photos.end);

  const encBlock =
    OPEN +
    "\n  " +
    '<script type="application/octet-stream" ' +
    MARKER +
    ">" +
    cipher +
    "</scr" +
    "ipt>\n  " +
    CLOSE;

  const open2 = html.indexOf(OPEN);
  const close2 = html.indexOf(CLOSE);
  html = html.slice(0, open2) + encBlock + html.slice(close2 + CLOSE.length);

  fs.writeFileSync(file, html, "utf8");

  const before = Buffer.byteLength(contentHtml, "utf8");
  const after = Buffer.byteLength(cipher, "utf8");
  console.log("encrypted: " + file);
  console.log("  content " + before + " B -> ciphertext " + after + " B");
  console.log("  photos encrypted: " + parseArray(photos.arrayText).length);
  console.log("  LISTING KEY (give to the realtor, never commit):");
  console.log("  " + C.keyToString(K));
}

main().catch(function (e) {
  fail(e && e.stack ? e.stack : String(e));
});
