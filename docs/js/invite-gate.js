/**
 * Pre Market Agents — password gate for private invite pages
 *
 * This gate no longer hides content, it decrypts it. The private listing ships
 * as ciphertext (see scripts/build-encrypt.js); until the buyer types the right
 * password there is nothing in the DOM to reveal and nothing in view-source to
 * read. A wrong password fails as an AES-GCM auth-tag mismatch, so there is no
 * hash comparison an attacker can step over in the debugger.
 *
 * URL shapes
 *   /r/{agent}/{listing}/?i={token}#k={password-wrapped listing key}   buyer
 *   /r/{agent}/{listing}/?preview=1#lk={raw listing key}               realtor
 *
 * Fragments never reach the server, so neither key material nor its wrapper
 * appears in GitHub Pages logs. Unfurlers fetch without the fragment and still
 * get the plaintext og: tags in <head>, which is what builds the iMessage card.
 *
 * Links issued before encryption carry #ph= and cannot be decrypted at all.
 * Those get an explicit "ask for a new link" message rather than a dead page.
 */
(function (global) {
  "use strict";

  var UNLOCK_PREFIX = "pma_invite_unlock_v2:";

  function fragParams() {
    var out = {};
    try {
      var h = String(global.location.hash || "").replace(/^#/, "");
      if (!h) return out;
      h.split("&").forEach(function (pair) {
        var i = pair.indexOf("=");
        if (i > 0) {
          out[pair.slice(0, i)] = decodeURIComponent(pair.slice(i + 1));
        }
      });
    } catch (e) {}
    return out;
  }

  function inviteId(agentSlug, listingCode) {
    return String(agentSlug || "") + "/" + String(listingCode || "");
  }

  function isUnlocked(id) {
    try {
      return sessionStorage.getItem(UNLOCK_PREFIX + id) === "1";
    } catch (e) {
      return false;
    }
  }

  function setUnlocked(id) {
    try {
      sessionStorage.setItem(UNLOCK_PREFIX + id, "1");
    } catch (e) {}
  }

  /**
   * Cache the decrypted payload for this tab only. sessionStorage dies with the
   * tab, so a shared/borrowed device does not keep the listing readable, but a
   * reload inside the session does not re-prompt.
   */
  function cachePayload(id, payload) {
    try {
      sessionStorage.setItem(UNLOCK_PREFIX + id + ":p", JSON.stringify(payload));
    } catch (e) {}
  }

  function readPayload(id) {
    try {
      var raw = sessionStorage.getItem(UNLOCK_PREFIX + id + ":p");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function cipherFromPage() {
    var el = document.getElementById("pma-enc");
    return el ? String(el.textContent || "").trim() : "";
  }

  /**
   * Mount gate over the page.
   * opts: { agentSlug, listingCode, agentName, address, onUnlock(info) }
   * onUnlock receives { payload: {html, photos}, clientToken, isPreview }.
   */
  function mount(opts) {
    opts = opts || {};
    var agentSlug = opts.agentSlug || "";
    var listingCode = opts.listingCode || "";
    var clientToken =
      (global.PMAInviteRegistry && PMAInviteRegistry.tokenFromLocation()) || "";

    var frag = fragParams();
    var unlockId = clientToken
      ? agentSlug + "/" + listingCode + "/" + clientToken
      : inviteId(agentSlug, listingCode);

    var content = document.getElementById("invite-content");
    var gate = document.getElementById("invite-gate");
    var form = document.getElementById("invite-gate-form");
    var input = document.getElementById("invite-gate-password");
    var err = document.getElementById("invite-gate-error");
    var cipher = cipherFromPage();

    var isPreview = false;
    try {
      var params = new URLSearchParams(location.search);
      isPreview = params.get("preview") === "1";
    } catch (e2) {}

    function showError(msg) {
      if (err) {
        err.style.display = "block";
        err.textContent = msg;
      }
    }

    function showGateMessage(title, message, hideForm) {
      if (content) content.hidden = true;
      if (gate) gate.hidden = false;
      var card = gate && gate.querySelector(".gate-card");
      if (card) {
        var h1 = card.querySelector("h1");
        var p = card.querySelector("p");
        if (h1 && title) h1.textContent = title;
        if (p && message) p.textContent = message;
      }
      if (hideForm && form) form.style.display = "none";
    }

    /** Inject decrypted markup and hand the payload back to the page. */
    function reveal(payload) {
      if (content) {
        content.innerHTML = payload.html;
        content.hidden = false;
      }
      if (gate) gate.hidden = true;
      document.documentElement.classList.add("pma-invite-unlocked");
      setUnlocked(unlockId);
      cachePayload(unlockId, payload);
      if (typeof opts.onUnlock === "function") {
        opts.onUnlock({
          payload: payload,
          clientToken: clientToken,
          inviteId: unlockId,
          isPreview: isPreview
        });
      }
    }

    function decryptWith(rawKey) {
      return global.PMAInviteCrypto.decryptContent(cipher, rawKey).then(
        function (json) {
          return JSON.parse(json);
        }
      );
    }

    if (!cipher) {
      showGateMessage(
        "Listing unavailable",
        "This page is missing its listing content. Please contact your realtor.",
        true
      );
      return { unlocked: false, inviteId: unlockId };
    }

    // Already unlocked in this tab — restore without re-prompting.
    var cached = isUnlocked(unlockId) && readPayload(unlockId);
    if (cached) {
      reveal(cached);
      return { unlocked: true, inviteId: unlockId, clientToken: clientToken };
    }

    // Realtor preview: raw listing key straight in the fragment, no password.
    if (isPreview && frag.lk) {
      var rawPreviewKey;
      try {
        rawPreviewKey = global.PMAInviteCrypto.keyFromString(frag.lk);
      } catch (e3) {
        showGateMessage("Preview key invalid", "That listing key is not valid.", true);
        return { unlocked: false, inviteId: unlockId };
      }
      decryptWith(rawPreviewKey)
        .then(reveal)
        .catch(function () {
          showGateMessage(
            "Preview key invalid",
            "That listing key does not match this listing.",
            true
          );
        });
      return { unlocked: false, inviteId: unlockId, isPreview: true };
    }

    // A realtor landing on ?preview=1 without a key came from a stale bookmark
    // or a nav link. Tell them where the key comes from instead of implying
    // their link is broken.
    if (isPreview && !frag.lk && !frag.k) {
      showGateMessage(
        "Open this preview from your dashboard",
        "Listing previews need your listing key. Use the “Preview selected " +
          "listing” button in your dashboard, which supplies it automatically.",
        true
      );
      return { unlocked: false, inviteId: unlockId };
    }

    // Pre-encryption links carried #ph=. They can never be decrypted.
    if (!frag.k) {
      showGateMessage(
        "This invite link is out of date",
        "Ask " +
          (opts.agentName || "your realtor") +
          " to resend your private link — this one was issued before a security " +
          "update and no longer opens.",
        true
      );
      return { unlocked: false, inviteId: unlockId, staleLink: true };
    }

    if (content) content.hidden = true;
    if (gate) gate.hidden = false;
    if (form) form.style.display = "";

    if (form && !form._pmaBound) {
      form._pmaBound = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = (input && input.value) || "";
        if (err) {
          err.style.display = "none";
          err.textContent = "";
        }
        var submit = form.querySelector('button[type="submit"], button');
        if (submit) submit.disabled = true;

        global.PMAInviteCrypto.unwrapKey(frag.k, pw)
          .then(decryptWith)
          .then(function (payload) {
            reveal(payload);
          })
          .catch(function () {
            // Unwrap and decrypt failures are indistinguishable on purpose:
            // both mean "that password does not open this listing".
            showError("Incorrect password. Check with your realtor.");
          })
          .then(function () {
            if (submit) submit.disabled = false;
          });
      });
    }

    return { unlocked: false, inviteId: unlockId, clientToken: clientToken };
  }

  global.PMAInviteGate = {
    inviteId: inviteId,
    isUnlocked: isUnlocked,
    setUnlocked: setUnlocked,
    mount: mount
  };
})(typeof window !== "undefined" ? window : this);
