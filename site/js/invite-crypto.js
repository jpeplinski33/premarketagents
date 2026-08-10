/**
 * Pre Market Agents — invite content encryption
 *
 * Why this exists: the site is static (GitHub Pages), so a password gate that
 * only hides a DOM node is theatre — the listing text sits in view-source for
 * anyone who opens the URL. Here the private content ships as ciphertext and
 * is only recoverable with the buyer's password.
 *
 * Scheme
 *   Each listing has one random 256-bit content key K.
 *   The private content is AES-GCM encrypted under K at build time.
 *   Per invite, the agent's dashboard wraps K with that buyer's password:
 *       KEK  = PBKDF2-SHA256(password, salt, ITERATIONS)
 *       blob = version | salt | iv | AES-GCM(KEK, K)
 *   The blob rides in the URL fragment as #k=<base64url>. Fragments are never
 *   sent to the server, so K's wrapper never reaches GitHub's logs.
 *
 * Consequences that matter:
 *   - The link ALONE cannot decrypt. Password is genuinely required, not a
 *     client-side comparison an attacker can skip.
 *   - A wrong password fails as a GCM auth-tag mismatch, so there is no
 *     separate hash to compare and no `#ph=` needed.
 *   - K never appears in the repo. The agent holds it (entered once into
 *     their dashboard), so leaking the static site does not leak listings.
 *
 * Same file is loaded by the browser and required by scripts/build-encrypt.js,
 * so both sides cannot drift apart.
 */
(function (root, factory) {
  "use strict";
  var api = factory(
    typeof crypto !== "undefined" && crypto.subtle
      ? crypto
      : require("crypto").webcrypto
  );
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.PMAInviteCrypto = api;
})(typeof window !== "undefined" ? window : this, function (cryptoObj) {
  "use strict";

  var subtle = cryptoObj.subtle;
  var VERSION = 1;
  var ITERATIONS = 210000; // OWASP 2023 floor for PBKDF2-SHA256
  var SALT_LEN = 16;
  var IV_LEN = 12;
  var KEY_LEN = 32;

  function utf8(str) {
    return new TextEncoder().encode(str);
  }

  function fromUtf8(bytes) {
    return new TextDecoder().decode(bytes);
  }

  /** base64url — no padding, URL/SMS safe */
  function b64uEncode(bytes) {
    var bin = "";
    var arr = new Uint8Array(bytes);
    for (var i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
    var b64 =
      typeof btoa === "function"
        ? btoa(bin)
        : Buffer.from(arr).toString("base64");
    return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }

  function b64uDecode(str) {
    var b64 = String(str).replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    if (typeof atob === "function") {
      var bin = atob(b64);
      var out = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    return new Uint8Array(Buffer.from(b64, "base64"));
  }

  function randomBytes(n) {
    var b = new Uint8Array(n);
    cryptoObj.getRandomValues(b);
    return b;
  }

  function concat(parts) {
    var total = 0;
    parts.forEach(function (p) {
      total += p.length;
    });
    var out = new Uint8Array(total);
    var off = 0;
    parts.forEach(function (p) {
      out.set(p, off);
      off += p.length;
    });
    return out;
  }

  /** PBKDF2 password -> AES-GCM key-encryption key */
  function deriveKek(password, salt) {
    return subtle
      .importKey("raw", utf8(password), "PBKDF2", false, ["deriveKey"])
      .then(function (base) {
        return subtle.deriveKey(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-256"
          },
          base,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"]
        );
      });
  }

  function importContentKey(rawKey, usages) {
    return subtle.importKey("raw", rawKey, { name: "AES-GCM" }, false, usages);
  }

  /** New random content key K (build time, one per listing) */
  function generateContentKey() {
    return randomBytes(KEY_LEN);
  }

  /** Encrypt listing payload under K. Returns base64url string. */
  function encryptContent(plaintext, rawKey) {
    var iv = randomBytes(IV_LEN);
    return importContentKey(rawKey, ["encrypt"])
      .then(function (key) {
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, key, utf8(plaintext));
      })
      .then(function (ct) {
        return b64uEncode(
          concat([new Uint8Array([VERSION]), iv, new Uint8Array(ct)])
        );
      });
  }

  /** Decrypt listing payload with K. Rejects if K is wrong (GCM tag). */
  function decryptContent(blobB64, rawKey) {
    var raw = b64uDecode(blobB64);
    if (raw[0] !== VERSION) {
      return Promise.reject(new Error("unsupported payload version"));
    }
    var iv = raw.slice(1, 1 + IV_LEN);
    var ct = raw.slice(1 + IV_LEN);
    return importContentKey(rawKey, ["decrypt"])
      .then(function (key) {
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, key, ct);
      })
      .then(function (buf) {
        return fromUtf8(new Uint8Array(buf));
      });
  }

  /** Wrap K with a buyer password -> base64url blob for the #k= fragment. */
  function wrapKey(rawKey, password) {
    var salt = randomBytes(SALT_LEN);
    var iv = randomBytes(IV_LEN);
    return deriveKek(password, salt)
      .then(function (kek) {
        return subtle.encrypt({ name: "AES-GCM", iv: iv }, kek, rawKey);
      })
      .then(function (ct) {
        return b64uEncode(
          concat([new Uint8Array([VERSION]), salt, iv, new Uint8Array(ct)])
        );
      });
  }

  /**
   * Unwrap K from the fragment blob using the password the buyer typed.
   * Rejects on a wrong password — that rejection IS the password check.
   */
  function unwrapKey(blobB64, password) {
    var raw;
    try {
      raw = b64uDecode(blobB64);
    } catch (e) {
      return Promise.reject(new Error("malformed key"));
    }
    if (raw.length < 1 + SALT_LEN + IV_LEN + KEY_LEN) {
      return Promise.reject(new Error("malformed key"));
    }
    if (raw[0] !== VERSION) {
      return Promise.reject(new Error("unsupported key version"));
    }
    var salt = raw.slice(1, 1 + SALT_LEN);
    var iv = raw.slice(1 + SALT_LEN, 1 + SALT_LEN + IV_LEN);
    var ct = raw.slice(1 + SALT_LEN + IV_LEN);
    return deriveKek(password, salt)
      .then(function (kek) {
        return subtle.decrypt({ name: "AES-GCM", iv: iv }, kek, ct);
      })
      .then(function (buf) {
        return new Uint8Array(buf);
      });
  }

  /**
   * Password verifier for the agent dashboard sign-in.
   *
   * Static hosting means the verifier ships to the client, so this is not a
   * secret — it only stops the password itself being readable in view-source.
   * An attacker can still brute-force it offline, which is exactly why the
   * dashboard password must be long and random. Rotate with
   * scripts/set-dashboard-password.js.
   */
  function derivePasswordHash(password, saltB64, iterations) {
    var salt = b64uDecode(saltB64);
    return subtle
      .importKey("raw", utf8(password), "PBKDF2", false, ["deriveBits"])
      .then(function (base) {
        return subtle.deriveBits(
          {
            name: "PBKDF2",
            salt: salt,
            iterations: iterations || ITERATIONS,
            hash: "SHA-256"
          },
          base,
          256
        );
      })
      .then(function (bits) {
        return b64uEncode(new Uint8Array(bits));
      });
  }

  /** Constant-time-ish compare so a wrong guess leaks no timing signal. */
  function verifyPassword(password, verifier) {
    return derivePasswordHash(
      password,
      verifier.salt,
      verifier.iterations
    ).then(function (got) {
      var want = String(verifier.hash);
      if (got.length !== want.length) return false;
      var diff = 0;
      for (var i = 0; i < got.length; i++) {
        diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
      }
      return diff === 0;
    });
  }

  function randomSaltB64() {
    return b64uEncode(randomBytes(SALT_LEN));
  }

  /** Content key <-> printable form the agent pastes into their dashboard */
  function keyToString(rawKey) {
    return b64uEncode(rawKey);
  }

  function keyFromString(str) {
    var raw = b64uDecode(str);
    if (raw.length !== KEY_LEN) throw new Error("listing key must be 32 bytes");
    return raw;
  }

  return {
    VERSION: VERSION,
    ITERATIONS: ITERATIONS,
    generateContentKey: generateContentKey,
    encryptContent: encryptContent,
    decryptContent: decryptContent,
    wrapKey: wrapKey,
    unwrapKey: unwrapKey,
    derivePasswordHash: derivePasswordHash,
    verifyPassword: verifyPassword,
    randomSaltB64: randomSaltB64,
    keyToString: keyToString,
    keyFromString: keyFromString,
    b64uEncode: b64uEncode,
    b64uDecode: b64uDecode
  };
});
