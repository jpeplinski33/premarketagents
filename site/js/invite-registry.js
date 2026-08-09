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
    var password = String(opts.password || "");
    var listingLabel = opts.listingLabel || "";

    if (!agentSlug || !listingCode) return Promise.reject(new Error("missing listing"));
    if (!firstName || !lastName) return Promise.reject(new Error("name required"));
    if (!phone) return Promise.reject(new Error("phone required"));
    if (!email || email.indexOf("@") < 1) return Promise.reject(new Error("email required"));
    if (!password || password.length < 4) return Promise.reject(new Error("password min 4"));

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
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        passwordHash: hash,
        // pilot: keep plain in realtor browser so they can re-copy invite text
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

  function inviteUrl(rec, origin) {
    origin = origin || (typeof location !== "undefined" ? location.origin : "");
    // Include password hash so any browser can verify without the realtor's localStorage
    var q =
      "?i=" +
      encodeURIComponent(rec.token) +
      (rec.passwordHash ? "&ph=" + encodeURIComponent(rec.passwordHash) : "");
    return origin + "/r/" + rec.agentSlug + "/" + rec.listingCode + "/" + q;
  }

  function inviteMessage(rec, agentName, origin) {
    var url = inviteUrl(rec, origin);
    var name = (rec.firstName || "") + " " + (rec.lastName || "");
    return (
      "Hi " +
      (rec.firstName || "there") +
      ",\n\n" +
      "Here's your private Pre Market preview" +
      (rec.listingLabel ? " of " + rec.listingLabel : "") +
      ":\n\n" +
      url +
      "\n\n" +
      "Password: " +
      (rec.passwordPlain || "(the password your agent set)") +
      "\n\n" +
      "— " +
      (agentName || "Your realtor")
    );
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
    sha256: sha256,
    loadAll: loadAll,
    listForListing: listForListing,
    get: get,
    getByFullId: getByFullId,
    create: create,
    remove: remove,
    inviteUrl: inviteUrl,
    inviteMessage: inviteMessage,
    tokenFromLocation: tokenFromLocation
  };
})(typeof window !== "undefined" ? window : this);
