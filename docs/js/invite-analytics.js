/**
 * Pre Market Agents — invite-scoped analytics (client MVP)
 * Events are keyed by invite token (agentSlug + listingCode).
 * Storage: localStorage (this browser) + optional remote beacon endpoint.
 * Agent dashboard reads the same store when opened with ?key=…
 */
(function (global) {
  "use strict";

  var STORAGE_PREFIX = "pma_invite_events_v1:";
  var SESSION_KEY = "pma_invite_session_v1";
  var MAX_EVENTS = 800;
  var FLUSH_MS = 4000;

  function now() {
    return Date.now();
  }

  function uuid() {
    if (global.crypto && crypto.randomUUID) return crypto.randomUUID();
    return "s-" + now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  function deviceHint() {
    var ua = navigator.userAgent || "";
    var mobile = /Mobi|Android|iPhone|iPad/i.test(ua);
    return {
      mobile: mobile,
      w: global.innerWidth || 0,
      h: global.innerHeight || 0,
      lang: navigator.language || ""
    };
  }

  function loadEvents(inviteId) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + inviteId);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveEvents(inviteId, events) {
    try {
      if (events.length > MAX_EVENTS) events = events.slice(events.length - MAX_EVENTS);
      localStorage.setItem(STORAGE_PREFIX + inviteId, JSON.stringify(events));
    } catch (e) {}
  }

  function getOrCreateSession(inviteId) {
    try {
      var s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
      if (s && s.inviteId === inviteId && s.sessionId) return s;
    } catch (e) {}
    var session = {
      inviteId: inviteId,
      sessionId: uuid(),
      startedAt: now(),
      device: deviceHint()
    };
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) {}
    return session;
  }

  function InviteAnalytics(opts) {
    opts = opts || {};
    this.agentSlug = opts.agentSlug || "";
    this.listingCode = opts.listingCode || "";
    this.inviteId = this.agentSlug + "/" + this.listingCode;
    this.endpoint = opts.endpoint || ""; // optional POST URL for multi-device later
    this.agentKey = opts.agentKey || "";
    this.disclosed = false;
    this.session = getOrCreateSession(this.inviteId);
    this.queue = [];
    this._photoStarted = null;
    this._photoIndex = null;
    this._scrollMax = 0;
    this._flushTimer = null;
    this._bound = false;
  }

  InviteAnalytics.prototype.disclose = function () {
    this.disclosed = true;
    this.track("disclosure_ack", {});
  };

  InviteAnalytics.prototype.track = function (type, props) {
    if (!this.disclosed && type !== "page_view" && type !== "disclosure_shown") {
      // still queue page_view before ack so agent sees open; other events after ack preferred
    }
    var evt = {
      t: now(),
      type: type,
      inviteId: this.inviteId,
      agentSlug: this.agentSlug,
      listingCode: this.listingCode,
      sessionId: this.session.sessionId,
      props: props || {}
    };
    this.queue.push(evt);
    var all = loadEvents(this.inviteId);
    all.push(evt);
    saveEvents(this.inviteId, all);
    this._scheduleFlush();
    return evt;
  };

  InviteAnalytics.prototype._scheduleFlush = function () {
    var self = this;
    if (this._flushTimer) return;
    this._flushTimer = setTimeout(function () {
      self._flushTimer = null;
      self.flush();
    }, FLUSH_MS);
  };

  InviteAnalytics.prototype.flush = function () {
    if (!this.endpoint || !this.queue.length) {
      this.queue = [];
      return;
    }
    var batch = this.queue.slice();
    this.queue = [];
    var body = JSON.stringify({
      inviteId: this.inviteId,
      agentKey: this.agentKey,
      events: batch
    });
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(this.endpoint, blob);
      } else {
        fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true,
          mode: "cors"
        }).catch(function () {});
      }
    } catch (e) {}
  };

  InviteAnalytics.prototype.photoShow = function (index, total) {
    var t = now();
    if (this._photoIndex != null && this._photoStarted != null) {
      this.track("photo_dwell", {
        index: this._photoIndex,
        dwell_ms: t - this._photoStarted
      });
    }
    this._photoIndex = index;
    this._photoStarted = t;
    this.track("photo_view", { index: index, total: total || null });
  };

  InviteAnalytics.prototype.bindListing = function () {
    if (this._bound) return;
    this._bound = true;
    var self = this;

    this.track("page_view", {
      path: location.pathname,
      ref: document.referrer || "",
      device: this.session.device
    });

    // scroll depth
    var onScroll = function () {
      var el = document.documentElement;
      var max = Math.max(el.scrollHeight - el.clientHeight, 1);
      var pct = Math.min(100, Math.round((el.scrollTop / max) * 100));
      if (pct > self._scrollMax) {
        var prev = self._scrollMax;
        self._scrollMax = pct;
        if (pct >= 25 && prev < 25) self.track("scroll_depth", { pct: 25 });
        if (pct >= 50 && prev < 50) self.track("scroll_depth", { pct: 50 });
        if (pct >= 75 && prev < 75) self.track("scroll_depth", { pct: 75 });
        if (pct >= 90 && prev < 90) self.track("scroll_depth", { pct: 90 });
      }
    };
    global.addEventListener("scroll", onScroll, { passive: true });

    // CTAs
    document.querySelectorAll('a[href^="tel:"], a[href^="mailto:"], [data-track]').forEach(function (a) {
      a.addEventListener("click", function () {
        var kind = a.getAttribute("data-track") || (a.href && a.href.indexOf("tel:") === 0 ? "cta_call" : a.href && a.href.indexOf("mailto:") === 0 ? "cta_email" : "cta_click");
        self.track(kind, { href: a.getAttribute("href") || "", label: (a.textContent || "").trim().slice(0, 80) });
      });
    });

    // floor plan tabs
    document.querySelectorAll(".fp-tab, [data-fp]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        self.track("floorplan_open", {
          src: tab.getAttribute("data-fp") || tab.dataset.fp || "",
          label: (tab.textContent || "").trim()
        });
      });
    });

    // external history links
    document.querySelectorAll('a[data-external="zillow"], a[data-external="redfin"], a[data-external="county"]').forEach(function (a) {
      a.addEventListener("click", function () {
        self.track("open_external_link", {
          provider: a.getAttribute("data-external"),
          href: a.href
        });
      });
    });

    global.addEventListener("beforeunload", function () {
      if (self._photoIndex != null && self._photoStarted != null) {
        self.track("photo_dwell", {
          index: self._photoIndex,
          dwell_ms: now() - self._photoStarted
        });
      }
      self.track("session_end", {
        duration_ms: now() - self.session.startedAt,
        scroll_max: self._scrollMax
      });
      self.flush();
    });

    // visibility
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") self.flush();
    });
  };

  InviteAnalytics.prototype.mountDisclosure = function (opts) {
    opts = opts || {};
    var agentName = opts.agentName || "the listing agent";
    var self = this;
    if (document.getElementById("pma-disclosure")) return;

    var bar = document.createElement("div");
    bar.id = "pma-disclosure";
    bar.setAttribute("role", "dialog");
    bar.setAttribute("aria-label", "Activity disclosure");
    bar.innerHTML =
      '<div class="pma-disc-inner">' +
      "<p><strong>Activity notice.</strong> " +
      agentName +
      " can see how you use this private preview (time on page, photos viewed, map areas, and links you open). " +
      "This helps them follow up thoughtfully. We do not sell this activity.</p>" +
      '<div class="pma-disc-actions">' +
      '<button type="button" class="pma-disc-btn" id="pma-disc-ok">Got it</button>' +
      '<a class="pma-disc-link" href="/privacy/">Privacy</a>' +
      "</div></div>";

    var style = document.createElement("style");
    style.textContent =
      "#pma-disclosure{position:fixed;left:0;right:0;bottom:0;z-index:300;padding:14px;background:rgba(12,12,13,.96);border-top:1px solid rgba(196,165,116,.35);backdrop-filter:blur(10px)}" +
      ".pma-disc-inner{max-width:720px;margin:0 auto;font-size:13px;line-height:1.5;color:#d8d3c8}" +
      ".pma-disc-inner strong{color:#f5f2eb}" +
      ".pma-disc-actions{display:flex;align-items:center;gap:14px;margin-top:10px}" +
      ".pma-disc-btn{background:#c4a574;color:#0c0c0d;border:0;font-weight:700;font-size:12px;letter-spacing:.08em;text-transform:uppercase;padding:10px 16px;cursor:pointer}" +
      ".pma-disc-btn:hover{background:#d4bc94}" +
      ".pma-disc-link{font-size:12px;color:#9a958c;letter-spacing:.06em;text-transform:uppercase}";
    document.head.appendChild(style);
    document.body.appendChild(bar);

    this.track("disclosure_shown", {});
    document.getElementById("pma-disc-ok").addEventListener("click", function () {
      self.disclose();
      try {
        sessionStorage.setItem("pma_disc_ack_" + self.inviteId, "1");
      } catch (e) {}
      bar.remove();
    });

    try {
      if (sessionStorage.getItem("pma_disc_ack_" + self.inviteId) === "1") {
        self.disclosed = true;
        bar.remove();
      }
    } catch (e) {}
  };

  // —— Aggregate helpers for agent dashboard ——
  InviteAnalytics.summarize = function (events) {
    events = events || [];
    var sessions = {};
    var photos = {};
    var externals = {};
    var ctas = {};
    var mapEvents = 0;
    var scrollMax = 0;
    var first = null;
    var last = null;

    events.forEach(function (e) {
      if (!first || e.t < first) first = e.t;
      if (!last || e.t > last) last = e.t;
      sessions[e.sessionId] = sessions[e.sessionId] || { id: e.sessionId, events: 0, start: e.t, end: e.t };
      sessions[e.sessionId].events++;
      sessions[e.sessionId].start = Math.min(sessions[e.sessionId].start, e.t);
      sessions[e.sessionId].end = Math.max(sessions[e.sessionId].end, e.t);

      if (e.type === "photo_view" && e.props && e.props.index != null) {
        var k = String(e.props.index);
        photos[k] = (photos[k] || 0) + 1;
      }
      if (e.type === "photo_dwell" && e.props && e.props.index != null) {
        var pk = "d" + e.props.index;
        photos[pk] = (photos[pk] || 0) + (e.props.dwell_ms || 0);
      }
      if (e.type === "open_external_link" && e.props) {
        var p = e.props.provider || "other";
        externals[p] = (externals[p] || 0) + 1;
      }
      if (e.type && e.type.indexOf("cta_") === 0) {
        ctas[e.type] = (ctas[e.type] || 0) + 1;
      }
      if (e.type && (e.type.indexOf("map_") === 0 || e.type.indexOf("parcel_") === 0)) {
        mapEvents++;
      }
      if (e.type === "scroll_depth" && e.props && e.props.pct) {
        scrollMax = Math.max(scrollMax, e.props.pct);
      }
      if (e.type === "session_end" && e.props && e.props.scroll_max) {
        scrollMax = Math.max(scrollMax, e.props.scroll_max);
      }
    });

    var photoViews = Object.keys(photos)
      .filter(function (k) {
        return k.indexOf("d") !== 0;
      })
      .map(function (k) {
        return { index: Number(k), views: photos[k], dwell_ms: photos["d" + k] || 0 };
      })
      .sort(function (a, b) {
        return b.views - a.views || b.dwell_ms - a.dwell_ms;
      });

    return {
      eventCount: events.length,
      sessionCount: Object.keys(sessions).length,
      sessions: Object.keys(sessions).map(function (id) {
        return sessions[id];
      }),
      photoViews: photoViews.slice(0, 15),
      externals: externals,
      ctas: ctas,
      mapEvents: mapEvents,
      scrollMax: scrollMax,
      first: first,
      last: last
    };
  };

  InviteAnalytics.loadEvents = loadEvents;
  InviteAnalytics.saveEvents = saveEvents;

  global.PMAInviteAnalytics = InviteAnalytics;
})(typeof window !== "undefined" ? window : globalThis);
