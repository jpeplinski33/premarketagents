const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, LevelFormat } = require("docx");
const fs = require("fs");

const GOLD = "8B7355";
const INK = "1A1A1A";
const MUTED = "555555";
const LIGHT = "F7F4EF";
const b = { style: BorderStyle.SINGLE, size: 4, color: "D0C8B8" };
const B = { top: b, bottom: b, left: b, right: b };

function run(text, o = {}) {
  return new TextRun({
    text: String(text),
    font: "Arial",
    size: o.size || 22,
    bold: !!o.bold,
    italics: !!o.italics,
    color: o.color || INK,
  });
}

function para(text, o = {}) {
  return new Paragraph({
    spacing: { after: o.after ?? 140, before: o.before ?? 0, line: 276 },
    alignment: o.align,
    children: [run(text, o)],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 320, after: 160 },
    children: [run(text, { size: 28, bold: true })],
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [run(text, { size: 24, bold: true, color: GOLD })],
  });
}

function li(text, ref) {
  return new Paragraph({
    numbering: { reference: ref, level: 0 },
    spacing: { after: 70, line: 276 },
    children: [run(text, { size: 21 })],
  });
}

function cell(text, width, header = false, alt = false) {
  return new TableCell({
    borders: B,
    width: { size: width, type: WidthType.DXA },
    shading: header
      ? { fill: "2C2A26", type: ShadingType.CLEAR }
      : alt
      ? { fill: LIGHT, type: ShadingType.CLEAR }
      : undefined,
    margins: { top: 70, bottom: 70, left: 100, right: 100 },
    children: [
      new Paragraph({
        children: [
          run(text, {
            size: header ? 18 : 19,
            bold: header,
            color: header ? "F5F2EB" : INK,
          }),
        ],
      }),
    ],
  });
}

function table2(rows, w1 = 3200, w2 = 6160) {
  return new Table({
    width: { size: w1 + w2, type: WidthType.DXA },
    columnWidths: [w1, w2],
    rows: rows.map(
      (r, i) =>
        new TableRow({
          children: [
            cell(r[0], w1, i === 0, i > 0 && i % 2 === 0),
            cell(r[1], w2, i === 0, i > 0 && i % 2 === 0),
          ],
        })
    ),
  });
}

const children = [];

// Title
children.push(
  new Paragraph({
    spacing: { after: 60 },
    children: [run("PRE MARKET AGENTS", { size: 18, bold: true, color: GOLD })],
  })
);
children.push(
  new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: "Marketing Visual Design Research",
        font: "Georgia",
        size: 40,
        bold: true,
        color: INK,
      }),
    ],
  })
);
children.push(
  para(
    "How a classy, exclusive public site should feel good—not cold, empty, or try-hard.",
    { italics: true, color: MUTED, size: 21 }
  )
);
children.push(para("Date: August 3, 2026", { size: 19, color: MUTED, after: 40 }));
children.push(
  para(
    "Scope: Public marketing pages (home, learn, explore). Invite listings stay product-rich separately.",
    { size: 19, color: MUTED, after: 240 }
  )
);

// Section 1
children.push(h1("1. What went wrong on the current public site"));
children.push(
  table2([
    ["Problem", "Why it fails marketing"],
    [
      "Almost no photography",
      "Luxury real estate is visual first; empty chrome reads as incomplete, not premium.",
    ],
    [
      "Dark type-only pages",
      "Minimalism without emotion feels empty—not quiet luxury.",
    ],
    [
      "You can't have X exclusivity copy",
      "Sounds insecure and cheap; exclusivity should be experienced, not announced.",
    ],
    [
      "Logic over life",
      "People buy homes on emotion; education-only UI feels like a brochure, not a future.",
    ],
  ])
);
children.push(
  new Paragraph({
    spacing: { before: 200, after: 200 },
    children: [
      run("Core finding: ", { bold: true }),
      run(
        "Premium is not the same as barren. Classy + exclusive still needs warmth, life, and pictures."
      ),
    ],
  })
);

// Section 2
children.push(h1("2. Core marketing thesis for this product"));
children.push(para("PreMarketAgents has two audiences on the public web:"));
children.push(
  li(
    "Homeowners / buyers — calm, hopeful, informed. Want to feel what private-preview life is like without a public free-for-all of inventory.",
    "b1"
  )
);
children.push(
  li(
    "Realtors (behind gate) — control, polish, and a client experience that makes them look good.",
    "b1"
  )
);
children.push(
  para(
    "Public homepage job is not to flex the vault. Public homepage job is: make someone feel warm, welcome, and quietly ambitious—then guide them to learn, explore, or get a realtor invite.",
    { before: 100 }
  )
);
children.push(
  new Paragraph({
    spacing: { before: 140, after: 200 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 10 },
    },
    indent: { left: 200 },
    children: [
      run("Brand emotion to aim for: ", { bold: true }),
      run("Belonging + possibility — not gatekeeping + scarcity theater.", {
        italics: true,
      }),
    ],
  })
);

// Section 3
children.push(h1("3. What the research says (synthesized)"));

children.push(h2("3.1 Luxury real estate web design"));
children.push(
  para(
    "High-end real estate sites that work share six features (Vide Infra / industry practice):"
  )
);
[
  "Brand idea — one emotional core (not feature laundry lists)",
  "Storytelling — scroll = narrative (problem → way of living → how it works → next step)",
  "Lifestyle demonstration — people, seasons, time-of-day, what it feels like to live here",
  "Reliability — beauty + polish builds trust (ugly/broken = untrusted project)",
  "Selective innovation — maps and interactives only if they serve the story",
  "Symbolic content — neighborhood culture, education, taste — not just square footage",
].forEach((t) => children.push(li(t, "n1")));
children.push(
  para(
    "Critical warning: minimalism is a tool, not a default. It works when the brand is already famous or the single object is the whole value (watch, bag). Real estate is multi-dimensional; clients need to feel living there. Empty minimalism wastes attention.",
    { before: 100 }
  )
);
children.push(
  para(
    'Source: Vide Infra, "Luxury Real Estate Website Design: Principles, Strategy, and Best Practices" (2025).',
    { size: 18, italics: true, color: MUTED }
  )
);

children.push(h2("3.2 Lifestyle photography beats empty rooms"));
children.push(
  para(
    "Industry reporting on lifestyle real estate photography (HomeJab synthesis of market practice):"
  )
);
children.push(
  li("Listings/pages with lifestyle imagery get about 40% more clicks", "b2")
);
children.push(li("Viewers stay 3–5× longer", "b2"));
children.push(
  li(
    "About 65% more inquiries claimed vs traditional empty-room only",
    "b2"
  )
);
children.push(
  para(
    "Traditional photography focuses on empty rooms, structure, and features. Lifestyle photography shows people enjoying space, daily life, community, and emotion.",
    { before: 100 }
  )
);
children.push(para("What works in images:", { bold: true, after: 60 }));
[
  "Daily life (coffee, kids on lawn, evening patio)",
  "Community / water / outdoors (life beyond walls)",
  "Personal staging touches (lived-in warmth, not sterile museum)",
  "Real people where possible; avoid plastic over-perfect stock energy",
].forEach((t) => children.push(li(t, "b3")));

children.push(h2("3.3 Luxury marketing is shifting: aspiration → inspiration"));
children.push(
  para(
    "Classic luxury = be jealous of this life. Modern luxury that sells to people who can actually buy (and to aspirational public traffic):"
  )
);
[
  "Inspiration and meaning, not pure status flex (Robin Report: move from aspiration theater to inspiration)",
  "Emotional connection over cold exclusivity",
  "Feel special and wanted — not iced out by velvet-rope copy",
].forEach((t) => children.push(li(t, "b4")));
children.push(
  para(
    "For PreMarketAgents public site: Welcome first. Rarity second. Never list what people are locked out of.",
    { before: 100, bold: true }
  )
);

children.push(h2("3.4 Quiet luxury art direction (without death-by-beige)"));
children.push(
  para(
    "Quiet luxury = refined materials, restraint, no logos screaming. Risk: boring, samey, cold."
  )
);
children.push(para("Fix for PreMarketAgents:", { bold: true, before: 80, after: 60 }));
[
  "Keep dark refined chrome + gold type",
  "Flood with warm photography (dusk homes, water, people, soft interiors)",
  "Use gold as accent, not as the whole personality",
  "Let photos carry warmth; UI carries class",
].forEach((t) => children.push(li(t, "b5")));

children.push(h2("3.5 Conversion / landing-page mechanics"));
children.push(
  para(
    "Even educational luxury pages still need (HousingWire and related practice):"
  )
);
[
  "One clear emotional promise in the hero",
  "Emotionally compelling images that sell the benefit (happy life / calm private look), not the product schema",
  "Simple CTAs (Learn how previews work, Explore the neighborhood)",
  "Social proof later when you have it — do not invent",
].forEach((t) => children.push(li(t, "b6")));
children.push(
  para(
    "Luxury buyers still expect discretion — but discretion is how access works, not a homepage lecture.",
    { before: 100 }
  )
);

children.push(h2("3.6 Editorial luxury (Sotheby's-style lesson)"));
children.push(
  para(
    "Sotheby's International Realty's redesign emphasized editorial, Instagrammable, high-resolution photography and mobile-first rich content. Lesson: premium real estate brands treat the site like a magazine of living, not a form warehouse."
  )
);

// Section 4
children.push(h1("4. Design direction for PreMarketAgents"));
children.push(h2("Emotional north star"));
children.push(
  new Paragraph({
    spacing: { before: 60, after: 140 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 24, color: GOLD, space: 10 },
    },
    indent: { left: 200 },
    children: [
      new TextRun({
        text:
          '"This is the feeling of seeing a beautiful home at the right moment—calm, private, hopeful."',
        font: "Georgia",
        size: 22,
        italics: true,
        color: INK,
      }),
    ],
  })
);
children.push(
  para('Not: "We\'re exclusive and you\'re not in yet."', {
    italics: true,
    color: MUTED,
  })
);

children.push(h2("Visual system"));
children.push(
  table2([
    ["Layer", "Direction"],
    [
      "Hero",
      "Full-bleed dusk estate or water lifestyle; dark gradient overlay; short warm headline",
    ],
    [
      "Mood strip",
      "Mixed: homes + water + boats + kids + couple — life, not product catalog",
    ],
    ["How it works", "Photo cards (not text boxes only)"],
    ["Explore", "Map + lifestyle still; no what-you-don't-get copy"],
    ["Guides", "Thumbnail images per article"],
    ["Footer", "Light; calm; no cheesy scarcity"],
  ])
);

children.push(h2("Photography mix (so people feel good)"));
children.push(
  table2([
    ["Type", "Role / share"],
    [
      "Classy homes (exterior dusk, warm interiors)",
      "Desire for place · about 40%",
    ],
    ["Water / boats / outdoors", "Joy, leisure, open air · about 25%"],
    [
      "People: couples, kids (wholesome)",
      'Belonging, "that could be us" · about 25%',
    ],
    ["Quiet detail (wine lounge, kitchen)", "Craft / quality · about 10%"],
  ])
);
children.push(
  para(
    "Avoid: only empty mansions (cold envy); only champagne flex (try-hard); you-can't-see-owner-names messaging; stock that looks like a bank commercial.",
    { before: 140 }
  )
);

children.push(h2("Copy tone"));
[
  "Warm, specific, calm",
  "Sell the feeling and the path (realtor invite when ready)",
  "Never list withholdings on public pages",
].forEach((t) => children.push(li(t, "b7")));
children.push(
  para(
    "What stays exclusive is product, not copy: invite pages keep full galleries, deep map, analytics. Public site teases life, not inventory.",
    { before: 100 }
  )
);

// Section 5
children.push(h1("5. Implementation plan"));
children.push(
  table2([
    ["Action", "Status / gate"],
    ["Research report (this document)", "Done"],
    ["Wire marketing photos into homepage", "Shipped live"],
    ['Soften remaining "vault/withhold" public copy', "Ongoing"],
    ["Optional: real local photoshoot", "Human gate when budget/time"],
    ["Optional: subtle motion (hero fade / parallax)", "Later"],
  ])
);
children.push(
  para(
    "Human gate: If AI-generated lifestyle faces/kids feel wrong, swap to homes + water only or commission real shoots.",
    { before: 140 }
  )
);

// Section 6
children.push(h1("6. Sources (research trail)"));
[
  "Vide Infra — Luxury Real Estate Website Design principles (brand idea, storytelling, lifestyle, reliability)",
  "HomeJab — lifestyle photography humanizes real estate brands (click/time/inquiry claims; traditional vs lifestyle)",
  "HousingWire — high-converting real estate landing pages (emotional images, single offer, clear CTAs)",
  "Sotheby's International Realty editorial website launch (high-res / magazine presentation)",
  "Robin Report — luxury marketing higher calling (aspiration → inspiration)",
  "Industry luxury discourse — emotional desire, quiet luxury, connection over cold exclusivity",
].forEach((t) => children.push(li(t, "b8")));
children.push(
  para(
    "Web research session August 3, 2026. Marketing stats are industry-reported, not PreMarketAgents A/B tests.",
    { size: 18, italics: true, color: MUTED, before: 100 }
  )
);

// Section 7
children.push(h1("7. Success criteria"));
children.push(para("Visitors should say:"));
children.push(li('"This feels nice" / "I want that life"', "b9"));
children.push(
  li('Not: "This is exclusive theater" / "There\'s nothing here"', "b9")
);
children.push(
  para(
    "Metrics later: time on homepage, scroll depth, clicks to Learn / Explore / Realtors.",
    { before: 100 }
  )
);

console.log("children count:", children.length);

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      {
        id: "Heading1",
        name: "Heading 1",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: INK },
        paragraph: { spacing: { before: 320, after: 160 }, outlineLevel: 0 },
      },
      {
        id: "Heading2",
        name: "Heading 2",
        basedOn: "Normal",
        next: "Normal",
        quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: GOLD },
        paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 1 },
      },
    ],
  },
  numbering: {
    config: ["b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "n1"].map(
      (ref) => ({
        reference: ref,
        levels: [
          {
            level: 0,
            format: ref === "n1" ? LevelFormat.DECIMAL : LevelFormat.BULLET,
            text: ref === "n1" ? "%1." : "•",
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          },
        ],
      })
    ),
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              border: {
                bottom: {
                  style: BorderStyle.SINGLE,
                  size: 8,
                  color: GOLD,
                  space: 8,
                },
              },
              spacing: { after: 160 },
              children: [
                run("Pre Market Agents", { size: 18, bold: true }),
                run("  ·  Marketing Visual Design Research", {
                  size: 18,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              border: {
                top: {
                  style: BorderStyle.SINGLE,
                  size: 6,
                  color: "D0C8B8",
                  space: 8,
                },
              },
              spacing: { before: 100 },
              alignment: AlignmentType.RIGHT,
              children: [
                run("Confidential research  ·  Page ", {
                  size: 16,
                  color: MUTED,
                }),
                new TextRun({
                  children: [PageNumber.CURRENT],
                  font: "Arial",
                  size: 16,
                  color: MUTED,
                }),
              ],
            }),
          ],
        }),
      },
      children,
    },
  ],
});

Packer.toBuffer(doc)
  .then((buf) => {
    const out =
      "/Users/jpmackbookpro/Projects/premarketagents/deliverables/PreMarketAgents-Marketing-Visual-Design-Research.docx";
    fs.writeFileSync(out, buf);
    fs.writeFileSync(
      "/Users/jpmackbookpro/Desktop/PreMarketAgents-Marketing-Visual-Design-Research.docx",
      buf
    );
    console.log("Wrote", out, buf.length, "bytes");
  })
  .catch((e) => {
    console.error("PACK FAIL", e);
    process.exit(1);
  });
