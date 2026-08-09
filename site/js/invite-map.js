/**
 * Pre Market Agents — invite map (Leaflet)
 * Parcels from Franklin County public GIS (cached GeoJSON).
 * Owner labels: invite-only, decluttered. Subject listing owner is never shown.
 * HARD RULE: never mention or link to Zillow (or Zestimate) on the map or panel.
 */
(function (global) {
  "use strict";

  var DEFAULTS = {
    center: [40.06678, -82.83724],
    zoom: 17,
    subjectParcelId: "222-004841",
    subjectAddress: "7013 Hanbys Loop, New Albany, OH 43054",
    subjectLabel: "",
    dataUrl: "/data/hanbys-parcels-invite.geojson",
    showOwners: true,
    hideSubjectOwner: true,
    focusSubject: true,
    subjectPad: 3.5,
    focusMaxZoom: 17,
    focusMinZoom: 16,
    analytics: null
  };

  function countyParcelUrl(parcelId) {
    var compact = String(parcelId || "").replace(/-/g, "");
    if (compact.length < 10) compact = compact.padEnd(11, "0");
    return "https://audr-apps.franklincountyohio.gov/redir/Link/Parcel/" + compact;
  }

  function titleCaseAddr(s) {
    if (!s) return "";
    return String(s)
      .toLowerCase()
      .replace(/\b\w/g, function (c) {
        return c.toUpperCase();
      })
      .replace(/\bLp\b/g, "Loop")
      .replace(/\bSt\b/g, "St")
      .replace(/\bDr\b/g, "Dr");
  }

  function ownerLabel(name) {
    if (!name) return "";
    var parts = String(name).trim().split(/\s+/);
    if (parts.length >= 2) return parts.slice(1).join(" ") + " " + parts[0];
    return name;
  }

  function fmtMoney(n) {
    if (n == null || n === "" || isNaN(Number(n))) return null;
    return "$" + Number(n).toLocaleString("en-US");
  }

  function InviteMap(el, opts) {
    this.el = typeof el === "string" ? document.querySelector(el) : el;
    this.opts = Object.assign({}, DEFAULTS, opts || {});
    this.map = null;
    this.parcelLayer = null;
    this.labelLayer = null;
    this.selected = null;
    this._subjectLayer = null;
  }

  InviteMap.prototype.init = function () {
    var self = this;
    if (!this.el || !global.L) {
      console.warn("PMAInviteMap: Leaflet or container missing");
      return Promise.reject(new Error("leaflet"));
    }

    this.map = L.map(this.el, {
      zoomControl: true,
      attributionControl: true
    }).setView(this.opts.center, this.opts.zoom);

    // Basemaps — default Satellite so aerial roof/lot detail stays readable
    var satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri · Parcels Franklin County OH", maxZoom: 19 }
    );
    var hybridLabels = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Labels © Esri", maxZoom: 19, opacity: 0.9 }
    );
    // Hybrid group: imagery + place labels
    var hybrid = L.layerGroup([
      L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { attribution: "Tiles © Esri", maxZoom: 19 }
      ),
      hybridLabels
    ]);
    var streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19
    });
    // LiDAR-style terrain (Esri multi-directional hillshade) — elevation relief view
    var lidar = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Hillshade © Esri", maxZoom: 16, maxNativeZoom: 16 }
    );

    satellite.addTo(this.map);

    L.control
      .layers(
        {
          Satellite: satellite,
          Hybrid: hybrid,
          Streets: streets,
          LiDAR: lidar
        },
        {},
        { position: "topright", collapsed: false }
      )
      .addTo(this.map);

    this.labelLayer = L.layerGroup().addTo(this.map);
    this.panel = this._mountPanel();

    this.map.on("moveend", function () {
      self._track("map_view", {
        zoom: self.map.getZoom(),
        center: self.map.getCenter()
      });
      self._refreshLabels();
    });
    this.map.on("zoomend", function () {
      self._refreshLabels();
    });

    var dataUrl = this.opts.dataUrl;
    if (dataUrl && dataUrl.indexOf("?") === -1) {
      dataUrl = dataUrl + "?v=4";
    }

    return fetch(dataUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("parcel fetch " + r.status);
        return r.json();
      })
      .then(function (geo) {
        self._addParcels(geo);
        self._track("map_ready", { features: (geo.features || []).length });
        [100, 350, 800, 1500].forEach(function (ms) {
          setTimeout(function () {
            if (self.map) {
              self.map.invalidateSize();
              self._refreshLabels();
            }
          }, ms);
        });
      })
      .catch(function (err) {
        console.warn("parcel load failed", err);
        self._track("map_error", { message: String(err && err.message) });
      });
  };

  InviteMap.prototype._track = function (type, props) {
    if (this.opts.analytics && typeof this.opts.analytics.track === "function") {
      this.opts.analytics.track(type, props || {});
    }
  };

  InviteMap.prototype._mountPanel = function () {
    var wrap = this.el.parentElement || this.el;
    var panel = document.createElement("div");
    panel.className = "pma-map-panel";
    panel.innerHTML =
      '<div class="pma-map-panel-head">Property details</div>' +
      '<div class="pma-map-panel-body" id="pma-map-panel-body">' +
      '<p class="muted">Select a parcel to see public county facts for this neighborhood.</p>' +
      "</div>";
    wrap.appendChild(panel);
    return panel;
  };

  InviteMap.prototype._addParcels = function (geo) {
    var self = this;
    var subjectId = this.opts.subjectParcelId;
    var features = (geo && geo.features) || [];
    if (!features.length) {
      console.warn("PMAInviteMap: no parcel features in", this.opts.dataUrl);
      return;
    }

    this.parcelLayer = L.geoJSON(geo, {
      style: function (feature) {
        var id = feature.properties && feature.properties.PARCELID;
        if (id === subjectId) {
          // Outline only — no grey/gold fill so aerial imagery of the home stays visible
          return {
            color: "#e8c99a",
            weight: 2.75,
            fillColor: "#c4a574",
            fillOpacity: 0,
            opacity: 1
          };
        }
        return {
          color: "rgba(255,255,255,0.78)",
          weight: 1.4,
          fillColor: "#ffffff",
          fillOpacity: 0,
          opacity: 0.95
        };
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.PARCELID === subjectId) {
          self._subjectLayer = layer;
        }
        layer.on("mouseover", function () {
          if (feature.properties && feature.properties.PARCELID !== subjectId) {
            layer.setStyle({ weight: 2.2, fillOpacity: 0.06, fillColor: "#c4a574" });
          } else {
            layer.setStyle({ weight: 3.4 });
          }
          self._track("parcel_hover", { parcelId: feature.properties && feature.properties.PARCELID });
        });
        layer.on("mouseout", function () {
          self.parcelLayer.resetStyle(layer);
        });
        layer.on("click", function () {
          self.selectFeature(feature, layer);
        });
      }
    }).addTo(this.map);

    try {
      if (this.opts.focusSubject !== false && this._subjectLayer) {
        var sb = this._subjectLayer.getBounds();
        if (sb.isValid()) {
          this.map.fitBounds(sb.pad(this.opts.subjectPad != null ? this.opts.subjectPad : 3.5), {
            maxZoom: this.opts.focusMaxZoom || 17,
            animate: false
          });
          if (this.map.getZoom() < (this.opts.focusMinZoom || 16)) {
            this.map.setView(sb.getCenter(), this.opts.focusMinZoom || 16, { animate: false });
          }
        }
      } else {
        var b = this.parcelLayer.getBounds();
        if (b.isValid()) {
          this.map.fitBounds(b.pad(0.08), { maxZoom: 16, animate: false });
        }
      }
    } catch (e) {
      this.map.setView(this.opts.center, this.opts.zoom || 17);
    }

    if (this._subjectLayer && this._subjectLayer.feature) {
      this.selectFeature(this._subjectLayer.feature, this._subjectLayer);
      this._placeSubjectBadge();
    }

    this._refreshLabels();
  };

  /**
   * Branded Pre Market marker on the listed parcel so buyers can spot it
   * without greying out aerial imagery.
   */
  InviteMap.prototype._placeSubjectBadge = function () {
    if (!this.map || !this._subjectLayer || !global.L) return;
    if (this._subjectBadge) {
      try {
        this.map.removeLayer(this._subjectBadge);
      } catch (e) {}
      this._subjectBadge = null;
    }

    var center;
    try {
      var b = this._subjectLayer.getBounds();
      if (b && b.isValid()) center = b.getCenter();
    } catch (e2) {}
    if (!center && this.opts.center) {
      center = L.latLng(this.opts.center[0], this.opts.center[1]);
    }
    if (!center) return;

    var label =
      this.opts.subjectBadgeLabel ||
      this.opts.subjectLabel ||
      "This listing";
    // Keep short for pin: prefer street number/name if long
    if (label.length > 28) {
      label = (this.opts.subjectLabel || "Pre Market listing").slice(0, 28);
    }

    if (!document.getElementById("pma-subject-badge-css")) {
      var style = document.createElement("style");
      style.id = "pma-subject-badge-css";
      style.textContent =
        ".pma-subject-badge{background:transparent!important;border:none!important;}" +
        ".pma-subject-badge .pma-sb-inner{" +
        "display:flex;flex-direction:column;align-items:center;gap:0;" +
        "transform:translateY(-8px);pointer-events:none;user-select:none;}" +
        ".pma-subject-badge .pma-sb-pill{" +
        "display:flex;flex-direction:column;align-items:center;justify-content:center;" +
        "min-width:92px;padding:8px 12px 7px;" +
        "background:rgba(12,12,13,0.92);border:1px solid rgba(196,165,116,0.55);" +
        "box-shadow:0 4px 18px rgba(0,0,0,0.45);backdrop-filter:blur(8px);}" +
        ".pma-subject-badge .pma-sb-pre{" +
        "font-family:Cormorant Garamond,Georgia,serif;font-weight:600;" +
        "font-size:13px;letter-spacing:0.2em;text-transform:uppercase;" +
        "color:#f5f2eb;line-height:1.05;}" +
        ".pma-subject-badge .pma-sb-agents{" +
        "font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;" +
        "font-size:8px;font-weight:700;letter-spacing:0.34em;text-transform:uppercase;" +
        "color:#c4a574;margin-top:3px;line-height:1;}" +
        ".pma-subject-badge .pma-sb-sub{" +
        "font-family:Inter,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;" +
        "font-size:9px;font-weight:600;letter-spacing:0.06em;" +
        "color:rgba(245,242,235,0.78);margin-top:5px;max-width:120px;" +
        "text-align:center;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}" +
        ".pma-subject-badge .pma-sb-pin{" +
        "width:0;height:0;margin-top:-1px;" +
        "border-left:8px solid transparent;border-right:8px solid transparent;" +
        "border-top:10px solid rgba(196,165,116,0.9);" +
        "filter:drop-shadow(0 2px 2px rgba(0,0,0,0.35));}";
      document.head.appendChild(style);
    }

    var html =
      '<div class="pma-sb-inner">' +
      '<div class="pma-sb-pill">' +
      '<span class="pma-sb-pre">Pre Market</span>' +
      '<span class="pma-sb-agents">Agents</span>' +
      (label
        ? '<span class="pma-sb-sub">' +
          String(label)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;") +
          "</span>"
        : "") +
      "</div>" +
      '<div class="pma-sb-pin" aria-hidden="true"></div>' +
      "</div>";

    var icon = L.divIcon({
      className: "pma-subject-badge",
      html: html,
      iconSize: [120, 72],
      iconAnchor: [60, 72]
    });

    this._subjectBadge = L.marker(center, {
      icon: icon,
      interactive: false,
      keyboard: false,
      zIndexOffset: 800
    }).addTo(this.map);
  };

  InviteMap.prototype.selectFeature = function (feature, layer) {
    this.selected = feature;
    var p = feature.properties || {};
    var isSubject = p.PARCELID === this.opts.subjectParcelId;
    this._track("parcel_select", {
      parcelId: p.PARCELID,
      address: p.SITEADDRESS
    });

    var addr = titleCaseAddr(p.SITEADDRESS || "");
    var showOwner = this.opts.showOwners && !(this.opts.hideSubjectOwner && isSubject);
    var owner = showOwner ? ownerLabel(p.OWNERNME1) : null;
    var cUrl = countyParcelUrl(p.PARCELID);
    var sale = fmtMoney(p.SALEPRICE);
    var ag =
      p.RESFLRAREA_AG != null && p.RESFLRAREA_AG !== ""
        ? Number(p.RESFLRAREA_AG).toLocaleString("en-US") + " sqft"
        : null;
    var year = p.RESYRBLT || null;
    var acres =
      p.ACRES != null && p.ACRES !== ""
        ? Number(p.ACRES).toFixed(2) + " acres"
        : p.STATEDAREA != null && p.STATEDAREA !== ""
        ? Number(p.STATEDAREA).toFixed(2) + " acres"
        : null;
    var saleDate = null;
    if (p.SALEDATE != null && p.SALEDATE !== "") {
      var sd = p.SALEDATE;
      if (typeof sd === "number" || /^\d{10,13}$/.test(String(sd))) {
        var ms = Number(sd);
        if (ms < 1e12) ms *= 1000;
        var d = new Date(ms);
        if (!isNaN(d.getTime())) {
          saleDate = d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
        }
      } else {
        saleDate = String(sd).slice(0, 10);
      }
    }

    var body = this.panel.querySelector("#pma-map-panel-body");
    var html = "";
    html += "<h4>" + (addr || "Parcel " + (p.PARCELID || "")) + "</h4>";
    if (isSubject) {
      var subjectTag = this.opts.subjectLabel || this.opts.subjectAddress || "This listing";
      html += '<p class="tag">This listing · ' + escapeHtml(subjectTag) + "</p>";
    }
    if (owner) html += "<p><span class=\"k\">Owner</span> " + escapeHtml(owner) + "</p>";
    html += "<p><span class=\"k\">Parcel ID</span> " + escapeHtml(p.PARCELID || "—") + "</p>";
    if (p.CLASSDSCRP) html += "<p><span class=\"k\">Use</span> " + escapeHtml(p.CLASSDSCRP) + "</p>";
    if (year) html += "<p><span class=\"k\">Year built</span> " + escapeHtml(String(year)) + "</p>";
    if (ag)
      html +=
        "<p><span class=\"k\">Living area</span> " +
        escapeHtml(ag) +
        ' <span class="note">(above-grade, county)</span></p>';
    if (acres) html += "<p><span class=\"k\">Lot size</span> " + escapeHtml(acres) + "</p>";
    if (p.SCHLDSCRP) html += "<p><span class=\"k\">School district</span> " + escapeHtml(p.SCHLDSCRP) + "</p>";
    if (p.CVTTXDSCRP) html += "<p><span class=\"k\">Tax district</span> " + escapeHtml(p.CVTTXDSCRP) + "</p>";
    if (sale || saleDate) {
      html +=
        "<p><span class=\"k\">Last recorded sale</span> " +
        escapeHtml(sale || "—") +
        (saleDate ? " · " + escapeHtml(saleDate) : "") +
        "</p>";
    }
    html += '<div class="pma-map-links">';
    html +=
      '<a class="btn-link ghost" data-external="county" href="' +
      cUrl +
      '" target="_blank" rel="noopener">County parcel record ↗</a>';
    html += "</div>";
    body.innerHTML = html;

    var self = this;
    body.querySelectorAll("a[data-external]").forEach(function (a) {
      a.addEventListener("click", function () {
        if (self.opts.analytics) {
          self.opts.analytics.track("open_external_link", {
            provider: a.getAttribute("data-external"),
            parcelId: p.PARCELID,
            href: a.href
          });
        }
      });
    });
  };

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  InviteMap.prototype._refreshLabels = function () {
    if (!this.labelLayer || !this.parcelLayer || !this.opts.showOwners) {
      if (this.labelLayer) this.labelLayer.clearLayers();
      return;
    }
    var zoom = this.map.getZoom();
    this.labelLayer.clearLayers();
    if (zoom < 15) return;

    var bounds = this.map.getBounds();
    var placed = [];
    var candidates = [];
    var subjectId = this.opts.subjectParcelId;
    var hideSubject = this.opts.hideSubjectOwner !== false;

    this.parcelLayer.eachLayer(function (layer) {
      var f = layer.feature;
      if (!f || !f.properties) return;
      if (hideSubject && f.properties.PARCELID === subjectId) return;
      var c = layer.getBounds && layer.getBounds().isValid() ? layer.getBounds().getCenter() : null;
      if (!c || !bounds.contains(c)) return;
      var name = ownerLabel(f.properties.OWNERNME1);
      if (!name) return;
      candidates.push({ latlng: c, name: name, parcelId: f.properties.PARCELID });
    });

    var maxLabels = zoom >= 18 ? 48 : zoom >= 17 ? 32 : zoom >= 16 ? 22 : 12;
    var map = this.map;
    var count = 0;

    candidates.forEach(function (c) {
      if (count >= maxLabels) return;
      var pt = map.latLngToContainerPoint(c.latlng);
      var w = Math.min(150, 10 + c.name.length * 6.4);
      var h = 18;
      var box = { x: pt.x - w / 2, y: pt.y - h / 2, w: w, h: h };
      var hit = placed.some(function (p) {
        return !(box.x + box.w < p.x || p.x + p.w < box.x || box.y + box.h < p.y || p.y + p.h < box.y);
      });
      if (hit) return;
      placed.push(box);
      count++;

      var icon = L.divIcon({
        className: "pma-owner-label",
        html: "<span>" + escapeHtml(c.name) + "</span>",
        iconSize: [w, h],
        iconAnchor: [w / 2, h / 2]
      });
      L.marker(c.latlng, { icon: icon, interactive: false, keyboard: false }).addTo(this.labelLayer);
    }, this);
  };

  InviteMap.countyParcelUrl = countyParcelUrl;
  global.PMAInviteMap = InviteMap;
})(typeof window !== "undefined" ? window : globalThis);
