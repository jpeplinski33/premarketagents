#!/usr/bin/env node
/**
 * Rotate an agent dashboard password.
 *
 *   node scripts/set-dashboard-password.js natasha-petroff 'new password here'
 *   node scripts/set-dashboard-password.js --generate natasha-petroff
 *
 * Writes the PBKDF2 verifier into the agent's dashboard page and into the
 * shared /login/ page. The password itself is never written anywhere.
 *
 * IMPORTANT: the verifier is public — it ships in a static page. It stops the
 * password being readable in view-source, but an attacker can still guess
 * offline. Use a long random password (--generate), not a memorable one.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const C = require(path.join(__dirname, "..", "site", "js", "invite-crypto.js"));

function fail(m) {
  console.error("ERROR: " + m);
  process.exit(1);
}

function generatePassword() {
  // 4 words of random base32-ish — long enough that offline guessing is moot.
  const alpha = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = require("crypto").randomBytes(20);
  let out = "";
  for (let i = 0; i < 20; i++) {
    if (i && i % 5 === 0) out += "-";
    out += alpha[bytes[i] % alpha.length];
  }
  return out;
}

async function main() {
  const args = process.argv.slice(2);
  const generate = args[0] === "--generate";
  const slug = generate ? args[1] : args[0];
  let password = generate ? generatePassword() : args[1];

  if (!slug || !password) {
    fail(
      "usage: set-dashboard-password.js <agent-slug> '<password>'\n" +
        "   or: set-dashboard-password.js --generate <agent-slug>"
    );
  }
  if (!generate && password.length < 12) {
    fail("password must be at least 12 characters — this verifier is public");
  }

  const salt = C.randomSaltB64();
  const hash = await C.derivePasswordHash(password, salt, C.ITERATIONS);
  const verifier =
    "{ salt: \"" +
    salt +
    "\", iterations: " +
    C.ITERATIONS +
    ", hash: \"" +
    hash +
    "\" }";

  const dash = path.join(
    __dirname,
    "..",
    "site",
    "r",
    slug,
    "dashboard",
    "index.html"
  );
  if (!fs.existsSync(dash)) fail("no dashboard for agent: " + slug);

  let html = fs.readFileSync(dash, "utf8");
  const re = /var DASH_AUTH = \{[^}]*\};/;
  if (!re.test(html)) fail("no DASH_AUTH block in " + dash);
  html = html.replace(re, "var DASH_AUTH = " + verifier + ";");
  fs.writeFileSync(dash, html, "utf8");
  console.log("updated " + dash);

  // Keep the shared login page's verifier for this agent in step.
  const login = path.join(__dirname, "..", "site", "login", "index.html");
  if (fs.existsSync(login)) {
    let lh = fs.readFileSync(login, "utf8");
    // An agent can have several email aliases (alan@ and alanh@). Replace
    // EVERY entry for the slug — missing one leaves an alias still accepting
    // the old password, which looks rotated but is not.
    const lre = new RegExp(
      "(slug: \"" + slug + "\"[\\s\\S]{0,200}?verifier: )\\{[^}]*\\}",
      "g"
    );
    const hits = (lh.match(lre) || []).length;
    if (hits) {
      lh = lh.replace(lre, "$1" + verifier);
      fs.writeFileSync(login, lh, "utf8");
      console.log("updated " + login + " (" + hits + " entr(y/ies))");
    } else {
      console.warn("WARNING: no verifier entry for " + slug + " in /login/");
    }
  }

  console.log("\nPassword for " + slug + ":");
  console.log("  " + password);
  console.log("\nGive this to the agent directly. It is not stored anywhere.");
  console.log("Run `rsync -a --delete site/ docs/` before committing.");
}

main().catch((e) => fail(e && e.stack ? e.stack : String(e)));
