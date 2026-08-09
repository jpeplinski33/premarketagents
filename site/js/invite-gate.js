/**
 * Pre Market Agents — password gate for private invite pages
 *
 * All realtor client invites require a password the agent sets in their dashboard.
 * Pilot: client-side SHA-256 check (not production auth).
 *
 * Sources of truth (first match wins for the hash):
 *   1. localStorage pma_invite_passwords_v1[inviteId].hash  (set from agent dashboard)
 *   2. window.PMA_INVITE_SEED.passwordHash                   (embedded seed on the page)
 *
 * Unlock token: sessionStorage pma_invite_unlock_v1:{inviteId}
 */
(function (global) {
  "use strict";

  var STORE_KEY = "pma_invite_passwords_v1";
  var UNLOCK_PREFIX = "pma_invite_unlock_v1:";

  function phFromLocation() {
    try {
      var params = new URLSearchParams(location.search);
      var q = params.get("ph");
      if (q && /^[a-f0-9]{64}$/i.test(q)) return q.toLowerCase();
    } catch (e) {}
    try {
      var h = String(location.hash || "").replace(/^#/, "");
      if (!h) return "";
      // #ph=hex or #ph=hex&other
      var hp = new URLSearchParams(h.indexOf("ph=") === 0 || h.indexOf("ph=") > 0 ? h : "ph=");
      // also support raw #ph=...
      var m = h.match(/(?:^|[&#])ph=([a-f0-9]{64})/i);
      if (m) return m[1].toLowerCase();
      var v = hp.get("ph");
      if (v && /^[a-f0-9]{64}$/i.test(v)) return v.toLowerCase();
    } catch (e2) {}
    return "";
  }

  function inviteId(agentSlug, listingCode) {
    return String(agentSlug || "") + "/" + String(listingCode || "");
  }

  function loadStore() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}") || {};
    } catch (e) {
      return {};
    }
  }

  function saveStore(store) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
    } catch (e) {}
  }

  function getConfig(id, opts) {
    opts = opts || {};
    // 1) Per-homeowner invite password from registry (preferred)
    if (opts.clientToken && global.PMAInviteRegistry) {
      var rec = PMAInviteRegistry.get(opts.agentSlug, opts.listingCode, opts.clientToken);
      if (rec && rec.passwordHash) {
        return {
          hash: rec.passwordHash,
          required: true,
          label: ((rec.firstName || "") + " " + (rec.lastName || "")).trim(),
          updatedAt: rec.createdAt || null,
          homeowner: rec
        };
      }
    }
    // 2) Dashboard-set listing password (legacy)
    var store = loadStore();
    if (store[id] && store[id].hash) return store[id];
    // 3) Embedded seed (legacy general listing password — avoid for new invites)
    var seed = global.PMA_INVITE_SEED || {};
    if (seed.passwordHash && !opts.requireClientToken) {
      return {
        hash: seed.passwordHash,
        required: seed.required !== false,
        label: seed.label || "",
        updatedAt: seed.updatedAt || null
      };
    }
    return { hash: "", required: true, label: "" };
  }

  function setPassword(id, plainPassword, meta) {
    meta = meta || {};
    return sha256(plainPassword).then(function (hash) {
      var store = loadStore();
      store[id] = {
        hash: hash,
        required: true,
        label: meta.label || (store[id] && store[id].label) || "",
        updatedAt: Date.now()
      };
      saveStore(store);
      return store[id];
    });
  }

  function clearPassword(id) {
    var store = loadStore();
    delete store[id];
    saveStore(store);
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

  function verify(id, plainPassword, opts) {
    var cfg = getConfig(id, opts);
    if (!cfg.hash) {
      return Promise.resolve(false);
    }
    return sha256(plainPassword).then(function (hash) {
      return hash === cfg.hash;
    });
  }

  /**
   * Mount gate over the page. Hides #invite-content until unlocked.
   * opts: {
   *   agentSlug, listingCode, agentName, address,
   *   clientToken (homeowner id from ?i=),
   *   requireClientToken (default true — bare listing URLs blocked)
   * }
   */
  function mount(opts) {
    opts = opts || {};
    var agentSlug = opts.agentSlug || "";
    var listingCode = opts.listingCode || "";
    var clientToken =
      opts.clientToken ||
      (global.PMAInviteRegistry ? PMAInviteRegistry.tokenFromLocation() : "") ||
      "";
    opts.clientToken = clientToken;
    opts.requireClientToken = opts.requireClientToken !== false;

    // Unlock key is per-homeowner when token present
    var unlockId = clientToken
      ? agentSlug + "/" + listingCode + "/" + clientToken
      : inviteId(agentSlug, listingCode);
    var listingId = inviteId(agentSlug, listingCode);
    var gateOpts = {
      agentSlug: agentSlug,
      listingCode: listingCode,
      clientToken: clientToken,
      requireClientToken: opts.requireClientToken
    };
    var cfg = getConfig(listingId, gateOpts);
    var content = document.getElementById("invite-content");
    var gate = document.getElementById("invite-gate");
    var form = document.getElementById("invite-gate-form");
    var input = document.getElementById("invite-gate-password");
    var err = document.getElementById("invite-gate-error");
    var isPreview = false;

    try {
      var params = new URLSearchParams(location.search);
      if (params.get("preview") === "1" || params.get("key") === "invite-preview-2026") {
        isPreview = true;
        setUnlocked(unlockId);
      }
    } catch (e) {}

    function showUnlocked() {
      if (gate) gate.hidden = true;
      if (content) content.hidden = false;
      document.documentElement.classList.add("pma-invite-unlocked");
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

    // Homeowner links must include ?i=token (except internal preview)
    if (!isPreview && opts.requireClientToken && !clientToken) {
      showGateMessage(
        "Personal invite required",
        "This page needs a personal invite link from your realtor. Ask them to send your private trackable link."
      );
      if (form) form.style.display = "none";
      return { unlocked: false, inviteId: unlockId, missingClientToken: true };
    }

    // Token present but not found in this browser registry (normal for homeowner devices)
    // Password still works if we stored hash only on realtor machine — PROBLEM
    // Homeowner won't have localStorage registry with password hash!
    //
    // CRITICAL: Per-homeowner password hash must travel with the link OR be in page seed.
    // For static pilot without backend, embed hash in URL: ?i=token&h=hashPrefix is weak.
    // Better approach for pilot: password is shared listing password BUT tracking uses token.
    // User asked for trackable links WITH create form including password per invite.
    //
    // Options:
    // A) Hash in URL fragment (not sent to server): ?i=token#p=plain — bad security
    // B) Put invite records in a public JSON file written at create time — needs deploy
    // C) Encode hash in token URL: ?i=token&ph=sha256hash — works cross-device, hash is public but still need password
    // D) Password is always the one realtor sets; we put hash in query: &ph=
    //
    // Use C: URL includes &ph={sha256} so any browser can verify without localStorage.
    // Registry on realtor browser still has full homeowner PII for dashboard.
    // When homeowner opens link, gate uses ph from query if registry miss.

    if (!cfg.hash) {
      var ph0 = phFromLocation();
      if (ph0) {
        cfg = { hash: ph0, required: true, label: "" };
      }
    }

    if (isPreview || isUnlocked(unlockId)) {
      showUnlocked();
      return {
        unlocked: true,
        inviteId: unlockId,
        clientToken: clientToken,
        isPreview: isPreview
      };
    }

    if (content) content.hidden = true;
    if (gate) gate.hidden = false;
    if (form) form.style.display = "";

    // Personalize gate copy when we know the homeowner name (realtor browser / same device)
    if (cfg.homeowner && cfg.homeowner.firstName) {
      var intro = gate && gate.querySelector(".gate-card p");
      if (intro) {
        intro.innerHTML =
          "Hi <strong style=\"color:var(--ink)\">" +
          cfg.homeowner.firstName +
          "</strong> — enter the invite password your realtor sent you to view this private Pre Market listing.";
      }
    }

    if (form && !form._pmaBound) {
      form._pmaBound = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = (input && input.value) || "";
        if (err) {
          err.style.display = "none";
          err.textContent = "";
        }
        // Re-read ph each submit
        var liveOpts = {
          agentSlug: agentSlug,
          listingCode: listingCode,
          clientToken: clientToken,
          requireClientToken: opts.requireClientToken
        };
        var liveCfg = getConfig(listingId, liveOpts);
        if (!liveCfg.hash) {
          var ph2 = phFromLocation();
          if (ph2) liveCfg.hash = ph2;
        }
        if (!liveCfg.hash) {
          if (err) {
            err.style.display = "block";
            err.textContent = "This invite is missing a password. Ask your realtor for a new link.";
          }
          return;
        }
        sha256(pw).then(function (hash) {
          if (hash !== liveCfg.hash) {
            if (err) {
              err.style.display = "block";
              err.textContent = "Incorrect password. Check with your realtor.";
            }
            return;
          }
          setUnlocked(unlockId);
          showUnlocked();
          if (typeof opts.onUnlock === "function") {
            opts.onUnlock({ clientToken: clientToken, inviteId: unlockId });
          }
        });
      });
    }

    return { unlocked: false, inviteId: unlockId, clientToken: clientToken };
  }

  global.PMAInviteGate = {
    inviteId: inviteId,
    getConfig: getConfig,
    setPassword: setPassword,
    clearPassword: clearPassword,
    verify: verify,
    isUnlocked: isUnlocked,
    setUnlocked: setUnlocked,
    sha256: sha256,
    loadStore: loadStore,
    mount: mount,
    STORE_KEY: STORE_KEY
  };
})(typeof window !== "undefined" ? window : this);
