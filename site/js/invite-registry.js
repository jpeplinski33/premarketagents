/**
 * Pre Market Agents — per-homeowner trackable invite registry (pilot / client-side)
 *
 * Each invite is a unique token scoped to one listing + one homeowner.
 * URL shape: /r/{agent}/{listing}/?i={token}
 * Analytics inviteId: {agent}/{listing}/{token}
 *
 * Storage: localStorage pma_client_invites_v1 (realtor browser for create;
 * homeowner browser only needs the token in the URL + password gate).
 */
(function (global) {
  "use strict";

  var STORE_KEY = "pma_client_invites_v1";
  var ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

  function loadAll() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveAll(store) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function fullId(agentSlug, listingCode, token) {
    return agentSlug + "/" + listingCode + "/" + token;
  }

  function genToken(len) {
    len = len || 8;
    var out = "";
    var arr;
    if (global.crypto && crypto.getRandomValues) {
      arr = new Uint8Array(len);
      crypto.getRandomValues(arr);
      for (var i = 0; i < len; i++) out += ALPHABET[arr[i] % ALPHABET.length];
    } else {
      for (var j = 0; j < len; j++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
    }
    return out;
  }

  /** Human-friendly password (no ambiguous 0/O/1/l) — auto for realtor */
  function genPassword() {
    // e.g. k7m2-n4pq
    return genToken(4) + "-" + genToken(4);
  }

  function sha256(text) {
    var enc = new TextEncoder().encode(String(text));
    return crypto.subtle.digest("SHA-256", enc).then(function (buf) {
      return Array.from(new Uint8Array(buf))
        .map(function (b) {
          return b.toString(16).padStart(2, "0");
        })
        .join("");
    });
  }

  function listForListing(agentSlug, listingCode) {
    var store = loadAll();
    var prefix = agentSlug + "/" + listingCode + "/";
    return Object.keys(store)
      .filter(function (k) {
        return k.indexOf(prefix) === 0;
      })
      .map(function (k) {
        return store[k];
      })
      .sort(function (a, b) {
        return (b.createdAt || 0) - (a.createdAt || 0);
      });
  }

  function get(agentSlug, listingCode, token) {
    if (!token) return null;
    var store = loadAll();
    return store[fullId(agentSlug, listingCode, token)] || null;
  }

  function getByFullId(id) {
    var store = loadAll();
    return store[id] || null;
  }

  /**
   * Create invite. password plain required.
   * Returns Promise<inviteRecord>
   */
  function create(opts) {
    opts = opts || {};
    var agentSlug = opts.agentSlug;
    var listingCode = opts.listingCode;
    var firstName = String(opts.firstName || "").trim();
    var lastName = String(opts.lastName || "").trim();
    var phone = String(opts.phone || "").trim();
    var email = String(opts.email || "").trim();
    var password = String(opts.password || "").trim();
    var listingLabel = opts.listingLabel || "";
    var listingPrice = opts.listingPrice || "";

    if (!agentSlug || !listingCode) return Promise.reject(new Error("missing listing"));
    if (!firstName || !lastName) return Promise.reject(new Error("name required"));
    if (!phone) return Promise.reject(new Error("phone required"));
    if (!email || email.indexOf("@") < 1) return Promise.reject(new Error("email required"));
    // Auto-generate password if realtor leaves it blank
    if (!password || password.length < 4) password = genPassword();

    var token = genToken(8);
    var store = loadAll();
    // collision check
    while (store[fullId(agentSlug, listingCode, token)]) token = genToken(8);

    return sha256(password).then(function (hash) {
      var rec = {
        token: token,
        agentSlug: agentSlug,
        listingCode: listingCode,
        listingLabel: listingLabel,
        listingPrice: listingPrice,
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        passwordHash: hash,
        // pilot: keep plain in realtor browser so they can re-copy / re-send
        passwordPlain: password,
        createdAt: Date.now(),
        id: fullId(agentSlug, listingCode, token)
      };
      store[rec.id] = rec;
      saveAll(store);
      return rec;
    });
  }

  function remove(id) {
    var store = loadAll();
    delete store[id];
    saveAll(store);
  }

  /** Always ship production share links (not localhost) so buyer unfurl + OG work. */
  function shareOrigin(origin) {
    if (origin && /^https?:\/\//i.test(origin) && origin.indexOf("premarketagents.com") !== -1) {
      return origin.replace(/\/$/, "");
    }
    return "https://premarketagents.com";
  }

  function inviteUrl(rec, origin) {
    origin = shareOrigin(origin);
    // Token in query. Password hash in # fragment so iMessage unfurlers fetch
    // the page without the fragment and still get branded og:image. Gate reads #ph=.
    var q = "?i=" + encodeURIComponent(rec.token);
    var hash = rec.passwordHash ? "#ph=" + encodeURIComponent(rec.passwordHash) : "";
    return origin + "/r/" + rec.agentSlug + "/" + rec.listingCode + "/" + q + hash;
  }

  /**
   * Full SMS/email body for the buyer.
   * Order: greeting → listing → password → sign-off → blank → URL alone last
   * so the link preview card sits under the text when iMessage unfurls.
   */
  function inviteMessage(rec, agentName, origin) {
    var url = inviteUrl(rec, origin);
    var who = rec.firstName || "there";
    var where = rec.listingLabel || "a private listing";
    var price = rec.listingPrice ? " · " + rec.listingPrice : "";
    var pw = rec.passwordPlain || "(ask your agent)";
    var agent = agentName || "Your realtor";
    return [
      "Hi " + who + ",",
      "",
      "Private Pre Market exclusive invite for " + where + price + ".",
      "",
      "Password: " + pw,
      "(Enter it on the page after you open the link.)",
      "",
      "— " + agent,
      "",
      url
    ].join("\n");
  }

  /** Digits-only for sms: links */
  function phoneDigits(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length === 10) d = "1" + d; // US default
    return d;
  }

  /** Open device Messages with invite pre-filled */
  function smsHref(rec, agentName, origin) {
    var body = inviteMessage(rec, agentName, origin);
    var to = phoneDigits(rec.phone);
    // iOS/macOS Messages: sms:number?&body= works most reliably with long bodies
    if (to) {
      return "sms:" + to + "?&body=" + encodeURIComponent(body);
    }
    return "sms:?&body=" + encodeURIComponent(body);
  }

  /** Open email client with invite pre-filled */
  function emailHref(rec, agentName, origin) {
    var body = inviteMessage(rec, agentName, origin);
    var sub =
      "Your private Pre Market preview" +
      (rec.listingLabel ? " · " + rec.listingLabel : "");
    return (
      "mailto:" +
      encodeURIComponent(rec.email || "") +
      "?subject=" +
      encodeURIComponent(sub) +
      "&body=" +
      encodeURIComponent(body)
    );
  }

  function openHref(href) {
    try {
      var a = document.createElement("a");
      a.setAttribute("href", href);
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        try {
          document.body.removeChild(a);
        } catch (e) {}
      }, 0);
    } catch (e2) {
      try {
        global.location.href = href;
      } catch (e3) {
        global.open(href, "_blank");
      }
    }
  }

  /**
   * Send invite to buyer: copies full message, then opens Messages and/or Mail
   * with body pre-filled. Realtor hits Send in the native app.
   */
  function openSend(rec, mode, agentName, origin) {
    mode = mode || "text";
    var body = inviteMessage(rec, agentName, origin);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(body).catch(function () {});
      }
    } catch (e) {}
    if (mode === "text" || mode === "both") {
      openHref(smsHref(rec, agentName, origin));
    }
    if (mode === "email" || mode === "both") {
      var href = emailHref(rec, agentName, origin);
      if (mode === "both") {
        setTimeout(function () {
          openHref(href);
        }, 600);
      } else {
        openHref(href);
      }
    }
    return body;
  }

  /** Parse client token from current page URL (?i=) */
  function tokenFromLocation() {
    try {
      return new URLSearchParams(location.search).get("i") || "";
    } catch (e) {
      return "";
    }
  }

  global.PMAInviteRegistry = {
    STORE_KEY: STORE_KEY,
    fullId: fullId,
    genToken: genToken,
    genPassword: genPassword,
    sha256: sha256,
    loadAll: loadAll,
    listForListing: listForListing,
    get: get,
    getByFullId: getByFullId,
    create: create,
    remove: remove,
    inviteUrl: inviteUrl,
    inviteMessage: inviteMessage,
    phoneDigits: phoneDigits,
    smsHref: smsHref,
    emailHref: emailHref,
    openSend: openSend,
    tokenFromLocation: tokenFromLocation
  };
})(typeof window !== "undefined" ? window : this);
