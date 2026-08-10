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

    // The listing key unlocks the encrypted page content. Without it the
    // invite would open to a permanently undecryptable listing, so refuse
    // to create one rather than hand the buyer a dead link.
    var listingKey = opts.listingKey;
    if (!listingKey) {
      return Promise.reject(
        new Error("listing key required — add it in Listing key above")
      );
    }
    var rawKey;
    try {
      rawKey = global.PMAInviteCrypto.keyFromString(listingKey);
    } catch (e) {
      return Promise.reject(new Error("listing key looks wrong — re-copy it"));
    }

    return Promise.all([
      sha256(password),
      global.PMAInviteCrypto.wrapKey(rawKey, password)
    ]).then(function (out) {
      var hash = out[0];
      var wrappedKey = out[1];
      var rec = {
        wrappedKey: wrappedKey,
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
    // Token in query for analytics. The password-wrapped listing key rides in
    // the # fragment: fragments are never sent to the server, and unfurlers
    // fetch without it — so the branded og:image still resolves.
    var q = "?i=" + encodeURIComponent(rec.token);
    var hash = rec.wrappedKey ? "#k=" + encodeURIComponent(rec.wrappedKey) : "";
    return origin + "/r/" + rec.agentSlug + "/" + rec.listingCode + "/" + q + hash;
  }

  /** Greeting → listing → password → sign-off. No URL. */
  function introLines(rec, agentName) {
    var who = rec.firstName || "there";
    var where = rec.listingLabel || "a private listing";
    var price = rec.listingPrice ? " · " + rec.listingPrice : "";
    var pw = rec.passwordPlain || "(ask your agent)";
    var agent = agentName || "Your realtor";
    // Plain-English: say WHAT this is (a private home showing, pre-market)
    // and WHAT to do (open link, enter password) — a recipient with zero
    // context should understand it in one read.
    return [
      "Hi " + who + ",",
      "",
      "You're invited to a private showing of " + where + price +
        " — before it goes on the market.",
      "",
      "When you open your private link, enter this password to view the home:",
      "Password: " + pw,
      "",
      "— " + agent
    ];
  }

  /**
   * Message 1 of 2 for texting — details only, no link.
   * The link follows in its own message (see inviteLink).
   */
  function inviteIntro(rec, agentName) {
    return introLines(rec, agentName)
      .concat(["", "Your private link is in the next text."])
      .join("\n");
  }

  /**
   * Message 2 of 2 for texting — the URL and NOTHING else.
   *
   * iMessage renders the large branded preview card only for a message whose
   * body is the bare link. Text after the link suppresses the card, and so
   * does a second detectable link in the same message — a street address
   * counts, and every invite body names one. Sending the URL alone is the
   * only shape that reliably produces the card.
   */
  function inviteLink(rec, origin) {
    return inviteUrl(rec, origin);
  }

  /**
   * Single combined body — details with the URL last.
   * Used for email, where clients do not unfurl the way iMessage does.
   */
  function inviteMessage(rec, agentName, origin) {
    return introLines(rec, agentName)
      .concat(["", inviteUrl(rec, origin)])
      .join("\n");
  }

  /** part: "intro" | "link" | "full" (default) */
  function smsBody(rec, agentName, origin, part) {
    if (part === "intro") return inviteIntro(rec, agentName);
    if (part === "link") return inviteLink(rec, origin);
    return inviteMessage(rec, agentName, origin);
  }

  /** Digits-only for sms: links */
  function phoneDigits(phone) {
    var d = String(phone || "").replace(/\D/g, "");
    if (d.length === 10) d = "1" + d; // US default
    return d;
  }

  /** sms: href for an already-built body */
  function smsHrefForBody(rec, body) {
    var to = phoneDigits(rec.phone);
    // iOS/macOS Messages: sms:number?&body= works most reliably with long bodies
    if (to) {
      return "sms:" + to + "?&body=" + encodeURIComponent(body);
    }
    return "sms:?&body=" + encodeURIComponent(body);
  }

  /** Open device Messages with invite pre-filled */
  function smsHref(rec, agentName, origin, part) {
    return smsHrefForBody(rec, smsBody(rec, agentName, origin, part));
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
  function openSend(rec, mode, agentName, origin, opts) {
    mode = mode || "text";
    opts = opts || {};
    var part = opts.part || "full";
    var body = opts.body || smsBody(rec, agentName, origin, part);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(body).catch(function () {});
      }
    } catch (e) {}
    if (mode === "text" || mode === "both") {
      openHref(smsHrefForBody(rec, body));
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
    inviteIntro: inviteIntro,
    inviteLink: inviteLink,
    smsBody: smsBody,
    phoneDigits: phoneDigits,
    smsHref: smsHref,
    smsHrefForBody: smsHrefForBody,
    emailHref: emailHref,
    openSend: openSend,
    tokenFromLocation: tokenFromLocation
  };
})(typeof window !== "undefined" ? window : this);
