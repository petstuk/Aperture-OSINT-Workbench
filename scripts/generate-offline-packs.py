#!/usr/bin/env python3
"""Rebuild compact offline packs in extension/aperture-packs.js.

Indexes live in the extension package. Install must not copy them into
chrome.storage or IndexedDB. Run from repo root:

  python3 scripts/generate-offline-packs.py
"""
from __future__ import annotations

import json
import ssl
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "extension" / "aperture-packs.js"

ATTACK_STIX = (
    "https://raw.githubusercontent.com/mitre-attack/attack-stix-data/"
    "master/enterprise-attack/enterprise-attack.json"
)
LOLBAS_API = "https://lolbas-project.github.io/api/lolbas.json"
GTFOBINS_API = "https://gtfobins.github.io/api.json"
GTFOBINS_PAGE = "https://gtfobins.github.io/gtfobins/{name}/"

UA = "Aperture-OSINT-Workbench/4.2 (offline pack generator; local-first indexes)"


def fetch_json(url: str):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
    ctx = ssl.create_default_context()
    with urllib.request.urlopen(req, context=ctx, timeout=300) as resp:
        return json.load(resp)


def attack_rows(bundle: dict) -> list[dict]:
    tactic_names = {}
    for obj in bundle.get("objects") or []:
        if obj.get("type") != "x-mitre-tactic":
            continue
        short = obj.get("x_mitre_shortname")
        name = obj.get("name")
        if short and name:
            tactic_names[short] = name

    rows = []
    for obj in bundle.get("objects") or []:
        if obj.get("type") != "attack-pattern":
            continue
        if obj.get("revoked") or obj.get("x_mitre_deprecated"):
            continue
        ext_id = None
        url = None
        for ref in obj.get("external_references") or []:
            if ref.get("source_name") == "mitre-attack" and ref.get("external_id"):
                ext_id = ref["external_id"]
                url = ref.get("url") or ""
                break
        if not ext_id or not ext_id.startswith("T"):
            continue
        tactics = []
        seen = set()
        for phase in obj.get("kill_chain_phases") or []:
            chain = (phase.get("kill_chain_name") or "").lower()
            if "mitre" not in chain and "attack" not in chain:
                continue
            short = phase.get("phase_name") or ""
            label = tactic_names.get(short) or short.replace("-", " ").title()
            if label and label not in seen:
                seen.add(label)
                tactics.append(label)
        row = {"id": ext_id, "name": obj.get("name") or ext_id, "tactics": tactics}
        if url:
            row["url"] = url
        rows.append(row)
    rows.sort(key=lambda r: r["id"])
    return rows


def lolbas_rows(items: list) -> list[dict]:
    rows = []
    for item in items:
        name = (item.get("Name") or "").strip()
        url = (item.get("url") or "").strip()
        if not name or not url:
            continue
        cats = []
        tids = []
        for cmd in item.get("Commands") or []:
            cat = (cmd.get("Category") or "").strip()
            if cat and cat not in cats:
                cats.append(cat)
            tid = (cmd.get("MitreID") or "").strip().upper()
            if tid and tid not in tids:
                tids.append(tid)
        row = {"name": name, "url": url}
        if cats:
            row["categories"] = cats
        if tids:
            row["attack"] = tids
        rows.append(row)
    rows.sort(key=lambda r: r["name"].lower())
    return rows


def gtfobins_rows(payload: dict) -> list[dict]:
    execs = payload.get("executables") or {}
    rows = []
    for name, entry in execs.items():
        name = str(name).strip()
        if not name:
            continue
        fns = sorted((entry or {}).get("functions") or {})
        row = {"name": name, "url": GTFOBINS_PAGE.format(name=name)}
        if fns:
            row["functions"] = fns
        rows.append(row)
    rows.sort(key=lambda r: r["name"].lower())
    return rows


def dumps_data(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def pack_block(pid: str, name: str, description: str, data: list) -> str:
    return (
        f"    {json.dumps(pid)}: {{\n"
        f"      id: {json.dumps(pid)},\n"
        f"      name: {json.dumps(name)},\n"
        f"      description: {json.dumps(description)},\n"
        f"      data: {dumps_data(data)}\n"
        f"    }}"
    )


def render(attack: list, lolbas: list, gtfobins: list) -> str:
    pack_js = ",\n".join(
        [
            pack_block(
                "attack-stix-lite",
                "MITRE ATT&CK (enterprise)",
                "Enterprise techniques — id, name, tactics. Compact index, no STIX blob.",
                attack,
            ),
            pack_block(
                "lolbas-index",
                "LOLBAS index",
                "Living-off-the-Land Windows binaries — name, page, categories. No command recipes.",
                lolbas,
            ),
            pack_block(
                "gtfobins-index",
                "GTFOBins index",
                "Unix binaries used to bypass local restrictions — name, page, functions. No shell recipes.",
                gtfobins,
            ),
        ]
    )
    return f"""/* Offline dataset packs — compact indexes bundled in the extension.
 * Install records a boolean in chrome.storage.local only (not the dataset).
 * Regenerated by: python3 scripts/generate-offline-packs.py
 * Sources: MITRE ATT&CK enterprise STIX, LOLBAS api/lolbas.json, GTFOBins api.json
 */
(function (global) {{
  const PACKS = {{
{pack_js}
  }};

  const LOOKUP_EMPTY = 20;
  const LOOKUP_LIMIT = 40;

  function listPacks() {{
    return Object.values(PACKS).map((p) => ({{
      id: p.id,
      name: p.name,
      description: p.description,
      entries: p.data.length
    }}));
  }}

  function getEmbeddedPack(id) {{
    return PACKS[id] || null;
  }}

  function packHay(row) {{
    const parts = [row.id, row.name, row.url, row.alias];
    const lists = [row.tactics, row.categories, row.attack, row.functions];
    for (let i = 0; i < lists.length; i++) {{
      const list = lists[i];
      if (list && list.length) parts.push(list.join(' '));
    }}
    return parts.filter(Boolean).join(' ').toLowerCase();
  }}

  function lookupPack(id, query) {{
    const pack = PACKS[id];
    if (!pack) return [];
    const q = String(query || '').toLowerCase().trim();
    if (!q) return pack.data.slice(0, LOOKUP_EMPTY);
    const hits = [];
    for (let i = 0; i < pack.data.length && hits.length < LOOKUP_LIMIT; i++) {{
      if (packHay(pack.data[i]).indexOf(q) !== -1) hits.push(pack.data[i]);
    }}
    return hits;
  }}

  global.AperturePacks = {{ listPacks, getEmbeddedPack, lookupPack, PACKS }};
}})(typeof self !== 'undefined' ? self : this);
"""


def main() -> int:
    print("Fetching MITRE ATT&CK enterprise STIX…", flush=True)
    attack = attack_rows(fetch_json(ATTACK_STIX))
    print(f"  {len(attack)} techniques", flush=True)

    print("Fetching LOLBAS index…", flush=True)
    lolbas = lolbas_rows(fetch_json(LOLBAS_API))
    print(f"  {len(lolbas)} binaries", flush=True)

    print("Fetching GTFOBins index…", flush=True)
    gtfobins = gtfobins_rows(fetch_json(GTFOBINS_API))
    print(f"  {len(gtfobins)} binaries", flush=True)

    if len(attack) < 200 or len(lolbas) < 50 or len(gtfobins) < 50:
        print("Refusing to write: a source returned too few rows.", file=sys.stderr)
        return 1

    text = render(attack, lolbas, gtfobins)
    OUT.write_text(text, encoding="utf-8")
    kb = OUT.stat().st_size / 1024
    print(f"Wrote {OUT.relative_to(ROOT)} ({kb:.1f} KiB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
