# Ohio real estate license verification research

**For:** PreMarketAgents realtor gate (`/realtors/`)  
**Date:** 2026-08-03  
**Scope:** Programmatic / practical verification of Ohio salesperson & broker licenses against public records.  
**Method:** Official Division pages, OAR FAQs, historic eLicense UI, Zillow license-format notes. **No APIs invented.** Unconfirmed items marked **UNKNOWN**.

---

## Executive summary

| Need | Finding |
|------|---------|
| Official public lookup | **Yes** — new LPI lookup + historic (stale) eLicense3 + **daily XLSX** |
| Free public REST API | **None found** (as of research date) |
| Legitimate bulk data | **Yes** — Division posts a daily Excel file (intended for download/search) |
| Scrape eLicense/LPI | **Not recommended** — no documented API; third-party scrapers exist but ToS/stability risk |
| Ship hard verify on static GH Pages alone | **No** — needs a Worker/cron + KV/R2 (or similar) backed by the daily file |
| Best hard-verify path | **Ingest daily XLSX → index by license # → match name + active status server-side** |

---

## 1. Verified sources (URLs)

### Primary (Division of Real Estate & Professional Licensing)

| Resource | URL | Notes |
|----------|-----|--------|
| **License lookup notice + daily DB** | https://com.ohio.gov/divisions-and-programs/real-estate-and-professional-licensing/salespersons-and-brokers/guides-and-resources/notice-license-lookup | Official notice; links daily file; posts ~9 a.m. |
| **Daily license database (XLSX)** | https://dam.assets.ohio.gov/raw/upload/com.ohio.gov/REPL/LPI/repl_LicenseLookUpwithAffiliations.xlsx | Fixed URL; combines eLicense + LPI during transition |
| **New public license lookup (LPI)** | https://elicense.lpi.ohio.gov/s/licenseshome | Current official interactive lookup (individual / business) |
| **LPI portal (login / claim / renew)** | https://lpi.elicense.ohio.gov/ | Not for anonymous verify; OHID required for licensee actions |
| **Historic License Lookup** | https://elicense3.com.ohio.gov/Lookup/LicenseLookup.aspx | **Retired / no longer updated** after ~2025-10-16 (OAR: 10/20/2025 go-live). Still useful for finding numbers during claim transition |
| **REPL home** | https://com.ohio.gov/divisions-and-programs/real-estate-and-professional-licensing | Division landing |
| **Real Estate FAQ** | https://com.ohio.gov/divisions-and-programs/real-estate-and-professional-licensing/salespersons-and-brokers/guides-and-resources/real-estate-faq | Documents daily DB + historic lookup guidance |
| **New eLicense LPI portal guide** | https://com.ohio.gov/divisions-and-programs/real-estate-and-professional-licensing/salespersons-and-brokers/guides-and-resources/new-elicense-lpi-portal | Claim/transition instructions |

### Secondary (industry; not authoritative for law)

| Resource | URL | Notes |
|----------|-----|--------|
| OAR FAQs on new LPI | https://www.ohiorealtors.org/blog/2314/faqs-about-the-new-lpi-system/ | Confirms historic stopped updating; daily DB for current status |
| Zillow agent license formats | https://zillow.zendesk.com/hc/en-us/articles/360008632554-Agent-Licensing-Profile-Entry | **Third-party** format normalization for OH (see §4) |

### Current PreMarketAgents gate (as shipped)

| Resource | Path |
|----------|------|
| Soft gate UI | `site/realtors/index.html` (and mirrored `docs/realtors/`) |
| Storage | `sessionStorage` key `pma_realtor_gate_v1` |
| Method flag | `method: "soft_attestation_v1"` |
| Link-out today | `https://elicense.ohio.gov/OH_HomePage` — **stale target**; prefer LPI lookup + notice page (see MVP) |

### Explicitly **not** found

- Documented free **REST/GraphQL** “verify license” API from Ohio Commerce / LPI / eLicense for anonymous server calls.
- Open dataset on data.ohio.gov specifically titled for Division of Real Estate salesperson/broker bulk export (other state licensure datasets exist under DAS; **REPL daily XLSX is the authoritative bulk path documented by the Division**).
- Stable programmatic endpoint behind `elicense.lpi.ohio.gov` search forms (UI only from public docs).

---

## 2. System transition (important for implementers)

As of late 2025 / 2026:

1. **Legacy eLicense3** historic lookup is **frozen** (no new updates after mid/late Oct 2025). Banner on form states retirement effective **10/16/25**.
2. **eLicense LPI** is live for claim, renew, transfer, etc. Public lookup: `elicense.lpi.ohio.gov`.
3. During transition, LPI public lookup may be incomplete until licensees **claim** licenses. Division therefore publishes a **daily combined spreadsheet**.
4. Division guidance: for **current status** (active / suspended / transfer), use the **daily database**; for finding an old number during claim, historic lookup may still work.

**Implication for hard verify:** Prefer the **daily XLSX** as source of truth for “is this license active right now?” Do not depend solely on scraping LPI or the frozen historic site.

---

## 3. Free API / open data / bulk lookup

### Official bulk (recommended for hard verify)

- **What:** Daily Excel file `repl_LicenseLookUpwithAffiliations.xlsx`
- **Where:** Fixed dam.assets.ohio.gov URL (see table above)
- **Cadence:** Posted ~**9:00 a.m.** (per Division notice)
- **How Division says to use it:** Download → filter/search by **name** or **license number**
- **Claimed status hint (documented):** If license claimed in LPI, name appears in **“Organization: Account Name”**; if blank, not claimed yet
- **Exact column schema:** **UNKNOWN until first successful parse of the live file** (file is large XLSX; not inspected in this research pass). Ticket must open file and record headers + status enum values before coding match rules.

### Interactive public lookup (human / link-out only)

- **LPI:** Search for individual or business → open detail for status, affiliation, etc.
- **Historic:** Prefix dropdown + license number / name fields (stale data).

### Unofficial / third-party

- Commercial scrapers (e.g. Apify “Ohio eLicense Scraper”) target general `elicense.ohio.gov` multi-board verify UIs — **not** an official API, **not** recommended for production PreMarketAgents.
- Risk: ToS, IP blocks, HTML/JS churn (especially post-LPI), liability if over-fetching.

### API verdict

| Approach | Official? | Free? | Suitable for gate? |
|----------|-----------|-------|---------------------|
| Daily XLSX download + own index | **Yes** (Division posts it for public use) | Yes | **Yes — primary hard path** |
| Link-out to LPI lookup | Yes | Yes | Soft / semi-hard only |
| REST verify endpoint | **Not found** | — | N/A |
| Scrape LPI / eLicense HTML | No docs; likely ToS risk | — | **Avoid** |

---

## 4. License number format patterns

### From official UI / job aids (verified)

Historic eLicense **license type prefixes** present in the retired lookup form include (non-exhaustive for all REPL programs):

**Sales / broker / company (relevant to realtor gate):**

| Prefix | Likely meaning | Notes |
|--------|----------------|-------|
| `SAL` | Salesperson | Primary agent credential |
| `SALM` | Sales-related (variant) | Exact legal meaning **UNKNOWN** from public text alone |
| `BRK` | Broker | |
| `BRKA` | Broker associate (common industry reading) | Exact legal meaning **UNKNOWN** |
| `BRKM` | Broker variant | **UNKNOWN** |
| `BRKP` | Principal broker (common industry reading) | **UNKNOWN** official expansion |
| `REC` | Real estate company / brokerage | e.g. public transfer guides use `REC.2020008417` |
| `RECE` | Company variant | **UNKNOWN** |
| `SOLE` | Sole proprietor brokerage (common reading) | **UNKNOWN** |

Many other prefixes (appraiser / home inspector / AMC, etc.) appear on the same form (`ACG*`, `HICE`, `OHI`, …) — **exclude** from “active realtor” match unless product expands credential types.

**Format shape (official examples):**

- Division job-aid style example: **`SAL.12345`** (prefix + **dot** + digits)
- Brokerage example in industry transfer docs: **`REC.2020008417`**
- UI shows prefix selector separate from numeric field with placeholder pattern `. . -` — exact historic serialization **UNKNOWN** beyond `PREFIX.` + number

### From Zillow (third-party normalization — not Ohio statute)

Zillow documents Ohio as:

> Mixed; prefix indicating license type, followed by a **dot**, followed by **exactly 10 digits with leading zeroes**.  
> Examples: `brk.0000012345`, `brkp.0000123456`, `sal.0000123456`

Treat as **normalization target**, not the only accepted user input. Agents may type:

- `SAL.123456`
- `sal.0000123456`
- `123456` (digits only — **ambiguous**; may still match if unique in DB)
- Spaces / mixed case

### Recommended client normalize (Ohio)

```text
normalize(license) =
  upper(trim)
  remove spaces
  if matches /^[A-Z]{2,5}\.?\d+$/ then ensure single '.' after alpha prefix
  optional: pad numeric part to 10 digits for Zillow-style compare
  keep original user string for audit
```

**Canonical compare key for hard verify (recommended):**

1. Exact match on full license string as published in daily file (after upper/trim).
2. Fallback: same prefix + numeric value equality ignoring leading zeros on the numeric segment.
3. Do **not** accept bare numeric-only as sole hard-pass unless unique + name strong-match (collision risk **UNKNOWN**).

---

## 5. Verification tiers

### Tier A — Soft attestation (**shipped**)

| Item | Detail |
|------|--------|
| Fields | Legal name, state, license #, credential type, attestation checkbox |
| Storage | Browser `sessionStorage` only |
| Server | None |
| Strength | Deterrence for casual consumers; **not** proof of license |
| Gaps | Any string ≥4 chars passes; no active-status check; spoofable |

### Tier B — Semi-hard (static site **today** + optional light Worker later)

| Item | Detail |
|------|--------|
| Format checks | OH: require `PREFIX.digits` or digits + known prefix dropdown for OH |
| Link-out | Button: “Confirm on Ohio license lookup” → LPI home |
| UX | Optional: “I opened the state lookup and confirmed my license is active” second checkbox |
| Analytics | Client event: gate_submit / gate_format_ok / gate_linkout (no PII off-device unless opted) |
| Storage | Still `sessionStorage`; method `semi_hard_format_v1` |
| Strength | Filters garbage numbers; **still not authoritative** |

### Tier C — Hard (server-side match) — **backlog ticket**

| Item | Detail |
|------|--------|
| Source | Daily Division XLSX |
| Runtime | Cloudflare Worker (or similar) + KV/R2/D1 |
| Match | License # (normalized) + name (fuzzy) + status ∈ active-equivalent |
| Response | `{ ok, reason, matchedName?, licenseType?, status?, asOf }` — no full dump of PII |
| Client | Call Worker on submit; only unlock if `ok`; store `method: hard_oh_xlsx_v1` + `asOf` |
| Strength | Real public-record match suitable for “prove realtor status” |

---

## 6. Recommended MVP for PreMarketAgents **today** (static GH Pages)

Ship **Tier B** without blocking on backend:

1. **Keep soft attestation** (name + state + license + checkbox).
2. **Add OH format validation** when `state === "OH"`:
   - Accept `/^(SAL|SALM|BRK|BRKA|BRKM|BRKP)\.?\d{3,12}$/i` for salesperson/broker paths.
   - Optionally allow bare `\d{3,12}` with warning: “Include prefix if you have it (e.g. SAL.…)”.
   - Reject known non-RE prefixes if user pastes full string with wrong prefix (appraiser etc.) when credential type is salesperson/broker.
3. **Fix link-out** on gate copy:
   - Primary: https://elicense.lpi.ohio.gov/s/licenseshome  
   - Secondary (status / daily file explanation): notice-license-lookup page  
   - Deprecate sole link to `elicense.ohio.gov/OH_HomePage` for Ohio RE.
4. **Placeholder helper text:** `e.g. SAL.0000123456 or BRK.0000012345`
5. **Do not** scrape from the browser (CORS, ToS, flaky).
6. **Do not** host the full statewide XLSX on GitHub Pages (size, freshness, redistribution optics).

This raises friction for non-realtors while remaining fully static.

---

## 7. Exact next backend ticket — hard verify

### Title

`OH-HARD-VERIFY: Ingest Division daily license XLSX → Worker verify endpoint`

### Acceptance criteria

1. **Cron** (Cloudflare Cron Trigger or equivalent) daily after **09:30 America/New_York**:
   - `GET` `https://dam.assets.ohio.gov/raw/upload/com.ohio.gov/REPL/LPI/repl_LicenseLookUpwithAffiliations.xlsx`
   - Store raw blob (R2) with `asOf` date from file header if present, else download timestamp.
2. **Parse** XLSX → rows; log full column headers once; document in ticket notes.
3. **Index** (KV or D1) by normalized license key → `{ displayName, status, licenseType, affiliation?, raw }`.
4. **HTTP endpoint** e.g. `POST /v1/verify/oh-real-estate`

**Request shape:**

```json
{
  "fullName": "Jane Q Public",
  "license": "SAL.0000123456",
  "licenseType": "salesperson"
}
```

**Response shape:**

```json
{
  "ok": true,
  "reason": "matched_active",
  "asOf": "2026-08-03",
  "matched": {
    "license": "SAL.0000123456",
    "name": "JANE Q PUBLIC",
    "status": "Active",
    "type": "SAL"
  }
}
```

**Failure reasons (enum):**  
`invalid_input` | `not_found` | `name_mismatch` | `inactive_or_suspended` | `wrong_credential_class` | `stale_source` | `upstream_unavailable`

5. **Match rules (v1):**
   - License normalize + lookup.
   - Name: casefold; strip punctuation; require last-token exact match **and** first-token prefix/fuzzy (Levenshtein ≤1 or Soundex) — tune after sampling real rows.
   - Status: allowlist from file (exact strings **UNKNOWN** until parse). Expect values like Active / Inactive / Suspended / Expired — **confirm from file**.
   - Type: if client says salesperson, accept `SAL*`; if broker, accept `BRK*`; reject company-only `REC*` for individual gate unless product wants brokerage logins.
6. **Rate limit** by IP (e.g. 20/hour); no logging of full SSN/DOB (none collected).
7. **Privacy:** Store attestation events only if product needs audit — default: ephemeral verify, client keeps sessionStorage unlock with `asOf` + `ok`.
8. **Staleness:** If last successful ingest > 36h, return `stale_source` with soft-fail policy **product decision** (recommend: fail closed for hard mode, or soft-pass with warning flag).
9. **Manual QA:** 3 known active agents (with consent) + 1 suspended/inactive + 1 random fake number.
10. **Legal note in code comments:** Data is public license status published by the Division for lookup; redistributing bulk file publicly as a downloadable asset on premarketagents.com is **not** required — use for verification only.

### Out of scope for v1

- Other states
- Contact harvesting
- Scraping LPI HTML
- Guaranteeing identity (name+license match ≠ proof of person; it proves **a** license record exists)

### Failure modes to handle

| Mode | Handling |
|------|----------|
| XLSX URL 404 / changed path | Alert; keep last good index; `upstream_unavailable` |
| Schema columns renamed | Ingest fails closed; page alert |
| Licensee not claimed / missing from LPI only | Daily combined file should still help — if missing, `not_found` + link-out |
| Multiple name matches same license | Should not happen; if name multi-match on search-by-name path, require license # |
| Preferred / maiden name | May fail name match — allow optional middle initial ignore; document “use legal name on license” |
| Leading-zero variance | Normalize numeric segment |
| User enters brokerage REC # | Reject for individual salesperson/broker gate |

### ToS / legal risk notes

| Action | Risk |
|--------|------|
| Linking to official public lookup | **Low** |
| Downloading daily file Division posts for public search | **Low–moderate** (intended use is lookup; keep use to verification, cache privately, don’t resell as a competing license DB product without counsel) |
| High-volume scrape of LPI/eLicense UI | **High** (ToS, blocks, ethics) |
| Storing license # + name in analytics | **Moderate** — minimize; treat as professional identifier; privacy policy mention |
| Claiming “state-verified identity” | **Avoid** — claim only “matched public license record” |

**UNKNOWN:** Explicit machine-readable license or API terms for the XLSX. If needed, email Division (`webreal@com.ohio.gov` appears on FAQ for licensee ops) for confirmation of automated download for verification use.

---

## 8. Code sketches

### 8.1 Client — Ohio format validation + semi-hard gate (drop into `/realtors/`)

```javascript
// Ohio RE individual prefixes (salesperson/broker family). Expand after XLSX audit.
var OH_INDIVIDUAL_PREFIXES = ["SAL", "SALM", "BRK", "BRKA", "BRKM", "BRKP"];
var OH_LICENSE_RE = /^(SAL|SALM|BRK|BRKA|BRKM|BRKP)\.?\d{3,12}$/i;
var OH_DIGITS_ONLY_RE = /^\d{3,12}$/;

function normalizeOhLicense(raw) {
  var s = String(raw || "").trim().toUpperCase().replace(/\s+/g, "");
  // SAL12345 → SAL.12345
  var m = s.match(/^([A-Z]{2,5})(\d{3,12})$/);
  if (m) s = m[1] + "." + m[2];
  // ensure single dot form
  s = s.replace(/^([A-Z]{2,5})\.+/, "$1.");
  return s;
}

function validateOhLicense(raw, licenseType) {
  var s = normalizeOhLicense(raw);
  if (OH_LICENSE_RE.test(s)) {
    var prefix = s.split(".")[0];
    if (licenseType === "salesperson" && !/^SAL/.test(prefix)) {
      return { ok: false, error: "Salesperson licenses usually start with SAL. Use your salesperson number, or change credential type." };
    }
    if (licenseType === "broker" && !/^BRK/.test(prefix)) {
      return { ok: false, error: "Broker licenses usually start with BRK/BRKP/BRKA. Check your number or credential type." };
    }
    return { ok: true, normalized: s, strength: "format" };
  }
  if (OH_DIGITS_ONLY_RE.test(s.replace(/\./g, ""))) {
    // Allow but flag weak — hard path should prefer prefix
    return {
      ok: true,
      normalized: s.replace(/\D/g, ""),
      strength: "digits_only",
      warn: "Add your prefix if you have it (e.g. SAL.0000123456) for a stronger match."
    };
  }
  return {
    ok: false,
    error: "Ohio license format looks off. Example: SAL.0000123456 or BRK.0000012345"
  };
}

// On submit (OH branch):
// var v = validateOhLicense(license, licenseType);
// if (!v.ok) { show error; return; }
// payload.license = v.normalized;
// payload.method = "semi_hard_format_v1";
// optional: fetch hard endpoint when available
```

### 8.2 Client — hard verify call (when Worker exists)

```javascript
async function hardVerifyOh(payload) {
  var res = await fetch("https://api.premarketagents.com/v1/verify/oh-real-estate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      fullName: payload.fullName,
      license: payload.license,
      licenseType: payload.licenseType
    })
  });
  if (!res.ok) throw new Error("verify_http_" + res.status);
  return res.json();
}

// submit handler excerpt:
// try {
//   var result = await hardVerifyOh(payload);
//   if (!result.ok) { err.textContent = humanReason(result.reason); return; }
//   payload.method = "hard_oh_xlsx_v1";
//   payload.asOf = result.asOf;
//   payload.matchedStatus = result.matched && result.matched.status;
//   sessionStorage.setItem(KEY, JSON.stringify(payload));
//   showAgent(payload);
// } catch (e) {
//   // Policy: fail closed, or soft-fallback with banner — product decision
//   err.textContent = "Could not reach license verification. Try again or use the state lookup link.";
// }
```

### 8.3 Server stub — Worker verify (pseudocode)

```javascript
// Cloudflare Worker sketch — NOT production-ready
export default {
  async fetch(req, env) {
    if (req.method !== "POST") return new Response("method", { status: 405 });
    const body = await req.json();
    const license = normalizeOhLicense(body.license);
    if (!license) return json({ ok: false, reason: "invalid_input" }, 400);

    const meta = await env.LICENSE_KV.get("oh:meta", "json");
    if (!meta || ageHours(meta.asOf) > 36) {
      return json({ ok: false, reason: "stale_source", asOf: meta && meta.asOf }, 503);
    }

    const row = await env.LICENSE_KV.get("oh:lic:" + license, "json")
      || await env.LICENSE_KV.get("oh:lic:" + stripLeadingZerosKey(license), "json");

    if (!row) return json({ ok: false, reason: "not_found", asOf: meta.asOf });

    if (!isActiveStatus(row.status)) {
      return json({ ok: false, reason: "inactive_or_suspended", asOf: meta.asOf, matched: publicFields(row) });
    }
    if (!nameMatches(body.fullName, row.displayName)) {
      return json({ ok: false, reason: "name_mismatch", asOf: meta.asOf });
    }
    if (!typeMatches(body.licenseType, row.licenseType)) {
      return json({ ok: false, reason: "wrong_credential_class", asOf: meta.asOf });
    }

    return json({
      ok: true,
      reason: "matched_active",
      asOf: meta.asOf,
      matched: publicFields(row)
    });
  },

  // Cron: download XLSX → parse → write KV keys oh:lic:* + oh:meta
  async scheduled(event, env, ctx) {
    ctx.waitUntil(ingestDailyXlsx(env));
  }
};

async function ingestDailyXlsx(env) {
  const url = "https://dam.assets.ohio.gov/raw/upload/com.ohio.gov/REPL/LPI/repl_LicenseLookUpwithAffiliations.xlsx";
  const res = await fetch(url);
  if (!res.ok) throw new Error("xlsx_fetch_" + res.status);
  const buf = await res.arrayBuffer();
  // parse with a small xlsx library; map columns after first-run inspection
  // for each row: put oh:lic:{NORMALIZED} = { displayName, status, licenseType, affiliation }
  // put oh:meta = { asOf, rowCount, sourceUrl }
}
```

**Implementer must fill:** column names, status allowlist, and name-matching thresholds after opening the real spreadsheet.

---

## 9. Practical field mapping (expected — confirm from XLSX)

| Gate field | Match against daily file |
|------------|---------------------------|
| License number | License / credential number column (**name UNKNOWN**) |
| Full name | Individual legal name column (**UNKNOWN** exact header) |
| Active? | Status column (**UNKNOWN** enum) |
| Salesperson vs broker | License type / prefix / board type (**UNKNOWN**) |
| Optional later: brokerage | Affiliation / organization columns (file name includes “withAffiliations”) |

Division-documented field:

- **Organization: Account Name** — non-blank ≈ claimed in LPI

---

## 10. Recommendations (ordered)

1. **Today (static):** Tier B format checks + update link-out to LPI lookup + notice page; keep soft attestation unlock.
2. **This week ticket:** Hard verify Worker + daily XLSX ingest (ticket in §7).
3. **Do not** build HTML scrapers for eLicense/LPI for production.
4. **After hard verify:** Optionally store server-side audit log (hash of license + day + result) for abuse review — still no email/phone harvest at gate.
5. **Multi-state later:** Per-state adapters; OH is the only state with a clear free bulk file in this research.

---

## 11. Source checklist (re-verify before build)

- [x] Daily DB notice page  
- [x] Daily XLSX fixed URL  
- [x] LPI public lookup URL  
- [x] Historic lookup retired / stale  
- [x] No documented free REST verify API found  
- [ ] **Open XLSX once** → record headers + status values + sample license strings  
- [ ] Confirm automated download is acceptable if counsel wants belt-and-suspenders  

---

## 12. UNKNOWN log

| Item | Status |
|------|--------|
| Exact XLSX column headers | UNKNOWN (file not parsed in this pass) |
| Exact status vocabulary (Active vs ACTIVE vs “Active - …” ) | UNKNOWN |
| Official legal expansions of BRKA/BRKP/SALM/SOLE | UNKNOWN (prefixes present in UI) |
| Whether bare numeric license is unique statewide | UNKNOWN |
| Documented REST API for REPL | Not found → treat as none |
| Explicit license grant text for bulk automated use of XLSX | UNKNOWN (file is publicly posted for lookup) |
| Rate limits / bot policy on dam.assets.ohio.gov | UNKNOWN |
| LPI lookup AJAX endpoints stability | UNKNOWN — do not depend |

---

*End of research deliverable.*
