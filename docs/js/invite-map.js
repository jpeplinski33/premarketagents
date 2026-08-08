/**
 * Pre Market Agents — invite map (Leaflet)
 * Parcels from Franklin County public GIS (cached GeoJSON).
 * Owner labels: invite-only, decluttered. Subject listing owner is never shown.
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
    /** Never show owner name for the listed parcel (map labels + detail panel). */
    hideSubjectOwner: true,
    /** Frame the subject + nearby neighbors instead of the whole GeoJSON extent. */
    focusSubject: true,
    /** Leaflet pad() around subject bounds — higher = more neighbors visible. */
    subjectPad: 3.5,
    focusMaxZoom: 17,
    focusMinZoom: 16,
    analytics: null
  };

  function zillowSearchUrl(address) {
    return "https://www.zillow.com/homes/" + encodeURIComponent(address.replace(/,/g, " ")) + "_rb/";
  }

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

    // Ensure container has layout before Leaflet measures it
    this.map = L.map(this.el, {
      zoomControl: true,
      attributionControl: true
    }).setView(this.opts.center, this.opts.zoom);

    var satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles © Esri · Parcels Franklin County OH", maxZoom: 19 }
    ).addTo(this.map);
    var labels = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Labels © Esri", maxZoom: 19, opacity: 0.85 }
    ).addTo(this.map);
    var streets = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap",
      maxZoom: 19
    });
    L.control
      .layers(
        { Satellite: satellite, Streets: streets },
        { Labels: labels },
        { position: "topright", collapsed: true }
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
    // Cache-bust when version query not already present
    if (dataUrl && dataUrl.indexOf("?") === -1) {
      dataUrl = dataUrl + "?v=2";
    }

    return fetch(dataUrl)
      .then(function (r) {
        if (!r.ok) throw new Error("parcel fetch " + r.status);
        return r.json();
      })
      .then(function (geo) {
        self._addParcels(geo);
        self._track("map_ready", { features: (geo.features || []).length });
        // Leaflet needs a second measure pass when the map was inside a gated/hidden layout
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
          return {
            color: "#e8c99a",
            weight: 3,
            fillColor: "#c4a574",
            fillOpacity: 0.34,
            opacity: 1
          };
        }
        return {
          color: "rgba(255,255,255,0.82)",
          weight: 1.6,
          fillColor: "#1a1a1d",
          fillOpacity: 0.08,
          opacity: 1
        };
      },
      onEachFeature: function (feature, layer) {
        if (feature.properties && feature.properties.PARCELID === subjectId) {
          self._subjectLayer = layer;
        }
        layer.on("mouseover", function () {
          if (feature.properties && feature.properties.PARCELID !== subjectId) {
            layer.setStyle({ weight: 2.4, fillOpacity: 0.2 });
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

    // Frame subject + neighbors (not the entire dataset — that zooms out too far)
    try {
      if (this.opts.focusSubject !== false && this._subjectLayer) {
        var sb = this._subjectLayer.getBounds();
        if (sb.isValid()) {
          this.map.fitBounds(sb.pad(this.opts.subjectPad != null ? this.opts.subjectPad : 3.5), {
            maxZoom: this.opts.focusMaxZoom || 17,
            animate: false
          });
          // Keep a useful neighborhood zoom floor
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

    // Open the listing parcel in the side panel so visitors know what they're looking at
    if (this._subjectLayer && this._subjectLayer.feature) {
      this.selectFeature(this._subjectLayer.feature, this._subjectLayer);
    }

    this._refreshLabels();
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
    var fullAddr = addr ? addr + ", New Albany, OH" : this.opts.subjectAddress;
    // Hide owner on the listed parcel (privacy for the home being sold)
    var showOwner =
      this.opts.showOwners &&
      !(this.opts.hideSubjectOwner && isSubject);
    var owner = showOwner ? ownerLabel(p.OWNERNME1) : null;
    var zUrl = zillowSearchUrl(fullAddr);
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
      '" target="_blank" rel="noopener">More on county site ↗</a>';
    html +=
      '<a class="btn-link ghost" data-external="zillow" href="' +
      zUrl +
      '" target="_blank" rel="noopener">Compare on Zillow ↗</a>';
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

  /**
   * Decluttered owner labels. Subject parcel owner is never labeled.
   */
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
      candidates.push({
        latlng: c,
        name: name,
        priority: 1,
        parcelId: f.properties.PARCELID
      });
    });

    var maxLabels = zoom >= 18 ? 48 : zoom >= 17 ? 32 : zoom >= 16 ? 22 : 12;
    var map = this.map;
    var count = 0;

    candidates.forEach(function (c) {
      if (count >= maxLabels) return;
      var pt = map.latLngToContainerPoint(c.latlng);
      var w = Math.min(140, 8 + c.name.length * 6.2);
      var h = 16;
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

  InviteMap.zillowSearchUrl = zillowSearchUrl;
  InviteMap.countyParcelUrl = countyParcelUrl;
  global.PMAInviteMap = InviteMap;
})(typeof window !== "undefined" ? window : globalThis);
