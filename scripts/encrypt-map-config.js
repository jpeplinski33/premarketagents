#!/usr/bin/env node
/**
 * Encrypt a discreet page's map config in place.
 *
 * The map config names the address, GPS coordinates, parcel id, and a geojson
 * file whose name identifies the property — all of which sat in plaintext JS.
 * On a discreet page that undoes the whole point, so the config ships
 * encrypted under the SAME listing key as the page content and is decrypted
 * at unlock (see pmaOnUnlock / loadMapConfig in the page).
 *
 *   node scripts/encrypt-map-config.js <page.html> <listing-key>
 *
 * Runtime-only fields (`analytics: analytics`) are stripped before encryption
 * and re-attached by the page after decrypt via Object.assign.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const C = require(path.join(__dirname, "..", "site", "js", "invite-crypto.js"));

function fail(m) { console.error("ERROR: " + m); process.exit(1); }

async function main() {
  const [file, keyStr] = process.argv.slice(2);
  if (!file || !keyStr) fail("usage: encrypt-map-config.js <page.html> <listing-key>");
  let html = fs.readFileSync(file, "utf8");
  if (html.includes("PMA_ENC_MAP")) fail(file + " already has an encrypted map config");

  const marker = 'new PMAInviteMap("#invite-map", {';
  const at = html.indexOf(marker);
  if (at === -1) fail("no PMAInviteMap config in " + file);

  // balanced-brace extraction of the config object literal
  let i = at + marker.length - 1, depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (depth === 0) break; }
  }
  const objText = html.slice(at + marker.length - 1, i + 1);

  // strip runtime-only fields, then evaluate to a plain data object
  const dataText = objText.replace(/^\s*analytics:\s*analytics,?\s*$/m, "");
  const cfg = new Function("return (" + dataText + ");")();
  const json = JSON.stringify(cfg);

  const K = C.keyFromString(keyStr);
  const blob = await C.encryptContent(json, K);

  // config literal -> decrypted-at-unlock global; analytics re-attached live
  html =
    html.slice(0, at) +
    'window.PMA_MAP_CFG ? new PMAInviteMap("#invite-map", Object.assign({ analytics: analytics }, window.PMA_MAP_CFG)) : null' +
    html.slice(i + 1);

  // guard the init chain: no config -> no map, and the existing catch handles it
  html = html.replace(/(\bmap\.init\(\))/, '(map ? map.init() : Promise.reject(new Error("no map config")))');

  // stash the ciphertext next to the invite seed
  const seedEnd = html.indexOf("</script>", html.indexOf("PMA_INVITE_SEED"));
  if (seedEnd === -1) fail("no PMA_INVITE_SEED block");
  html =
    html.slice(0, seedEnd + 9) +
    '\n  <script>window.PMA_ENC_MAP = "' + blob + '";</script>' +
    html.slice(seedEnd + 9);

  fs.writeFileSync(file, html, "utf8");
  console.log("encrypted map config in " + file + " (" + json.length + " B plaintext -> " + blob.length + " B)");
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
