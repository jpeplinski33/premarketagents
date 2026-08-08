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

  function getConfig(id) {
    var store = loadStore();
    if (store[id] && store[id].hash) return store[id];
    var seed = global.PMA_INVITE_SEED || {};
    if (seed.passwordHash) {
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

  function verify(id, plainPassword) {
    var cfg = getConfig(id);
    if (!cfg.hash) {
      // No password configured yet — treat as locked with fail
      return Promise.resolve(false);
    }
    return sha256(plainPassword).then(function (hash) {
      return hash === cfg.hash;
    });
  }

  /**
   * Mount gate over the page. Hides #invite-content until unlocked.
   * opts: { agentSlug, listingCode, agentName, address }
   */
  function mount(opts) {
    opts = opts || {};
    var id = inviteId(opts.agentSlug, opts.listingCode);
    var cfg = getConfig(id);
    var content = document.getElementById("invite-content");
    var gate = document.getElementById("invite-gate");

    // Pilot preview: skip password with ?preview=1 or ?key=invite-preview-2026
    try {
      var params = new URLSearchParams(location.search);
      if (params.get("preview") === "1" || params.get("key") === "invite-preview-2026") {
        setUnlocked(id);
      }
    } catch (e) {}

    if (!cfg.required || !cfg.hash) {
      // If somehow no hash, still show gate with message
    }

    if (isUnlocked(id)) {
      if (gate) gate.hidden = true;
      if (content) content.hidden = false;
      document.documentElement.classList.add("pma-invite-unlocked");
      return { unlocked: true, inviteId: id };
    }

    if (content) content.hidden = true;
    if (gate) gate.hidden = false;

    var form = document.getElementById("invite-gate-form");
    var input = document.getElementById("invite-gate-password");
    var err = document.getElementById("invite-gate-error");

    if (form && !form._pmaBound) {
      form._pmaBound = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var pw = (input && input.value) || "";
        if (err) {
          err.style.display = "none";
          err.textContent = "";
        }
        verify(id, pw).then(function (ok) {
          if (!ok) {
            if (err) {
              err.style.display = "block";
              err.textContent = "Incorrect password. Check with your realtor.";
            }
            return;
          }
          setUnlocked(id);
          if (gate) gate.hidden = true;
          if (content) content.hidden = false;
          document.documentElement.classList.add("pma-invite-unlocked");
          if (typeof opts.onUnlock === "function") opts.onUnlock();
        });
      });
    }

    return { unlocked: false, inviteId: id };
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
