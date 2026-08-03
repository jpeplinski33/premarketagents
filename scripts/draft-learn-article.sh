#!/usr/bin/env bash
# Draft a /learn/ article via DeepSeek or Gemini.
# Keys: ~/.config/ai-brain/secrets.env (DEEPSEEK_API_KEY or GEMINI_API_KEY)
#
# Usage:
#   ./scripts/draft-learn-article.sh --slug pre-market-vs-mls \
#     --title "Pre-market vs MLS: what buyers should know" --pillar Basics
#
# Output: site/content/drafts/<slug>.md  (never auto-publishes to /learn/)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG=""
TITLE=""
PILLAR="Basics"
PROVIDER="${PMA_DRAFT_PROVIDER:-deepseek}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --slug) SLUG="$2"; shift 2 ;;
    --title) TITLE="$2"; shift 2 ;;
    --pillar) PILLAR="$2"; shift 2 ;;
    --provider) PROVIDER="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,12p' "$0"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ -z "$SLUG" || -z "$TITLE" ]]; then
  echo "Required: --slug and --title" >&2
  exit 2
fi

SECRETS="${HOME}/.config/ai-brain/secrets.env"
if [[ -f "$SECRETS" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$SECRETS"
  set +a
fi

mkdir -p "$ROOT/site/content/drafts"
OUT="$ROOT/site/content/drafts/${SLUG}.md"

export PMA_DRAFT_SLUG="$SLUG"
export PMA_DRAFT_TITLE="$TITLE"
export PMA_DRAFT_PILLAR="$PILLAR"
export PMA_DRAFT_PROVIDER="$PROVIDER"
export PMA_DRAFT_OUT="$OUT"

python3 <<'PY'
import json, os, urllib.request, urllib.error
from pathlib import Path

slug = os.environ["PMA_DRAFT_SLUG"]
title = os.environ["PMA_DRAFT_TITLE"]
pillar = os.environ["PMA_DRAFT_PILLAR"]
provider = os.environ["PMA_DRAFT_PROVIDER"]
out = Path(os.environ["PMA_DRAFT_OUT"])

prompt = f"""You are drafting an educational homeowner article for PreMarketAgents.com (not a sales pitch).

Title: {title}
Pillar: {pillar}
Slug: {slug}

Constraints:
- Helpful, calm, accurate. No invented statistics.
- Do NOT use the phrase "makes the listing agent look exceptional".
- Explain pre-market / private invite concepts clearly.
- Mention that full maps with owner intel and private galleries are invite-only.
- 700–1100 words. Short sections with ## headings.
- End with 3 practical takeaways and a soft CTA to talk to a licensed realtor.
- Output Markdown only starting with # title. No front matter.
"""

def write_stub(reason: str):
    out.write_text(
        f"# {title}\n\n> STUB — {reason}\n\n"
        f"## Why this matters\n\n## How it works\n\n"
        f"## What to ask your realtor\n\n## Takeaways\n\n1.\n2.\n3.\n"
    )
    print(f"Wrote stub → {out} ({reason})")

if provider == "deepseek":
    key = os.environ.get("DEEPSEEK_API_KEY")
    if not key:
        write_stub("add DEEPSEEK_API_KEY and re-run")
        raise SystemExit(0)
    body = {
        "model": "deepseek-chat",
        "messages": [
            {"role": "system", "content": "You write clear educational real-estate explainers for homeowners."},
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.4,
    }
    req = urllib.request.Request(
        "https://api.deepseek.com/chat/completions",
        data=json.dumps(body).encode(),
        headers={
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
        text = data["choices"][0]["message"]["content"].strip() + "\n"
    except Exception as e:
        write_stub(f"DeepSeek error: {e}")
        raise SystemExit(1)
    out.write_text(text)
    print(f"Wrote draft → {out} ({len(text)} chars)")

elif provider == "gemini":
    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        write_stub("add GEMINI_API_KEY and re-run")
        raise SystemExit(0)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={key}"
    body = {"contents": [{"parts": [{"text": prompt}]}]}
    req = urllib.request.Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            data = json.load(resp)
        text = data["candidates"][0]["content"]["parts"][0]["text"].strip() + "\n"
    except Exception as e:
        write_stub(f"Gemini error: {e}")
        raise SystemExit(1)
    out.write_text(text)
    print(f"Wrote draft → {out} ({len(text)} chars)")

else:
    raise SystemExit(f"Unknown provider: {provider}")

print(f"Next: edit draft, publish site/learn/{slug}/index.html, update content/queue.md + sitemap.")
PY
