#!/usr/bin/env python3
"""Import Terraria equipment and its recursive recipe graph from Terraria Wiki Cargo.

The importer is intentionally idempotent and publishes immutable catalog batches:
the app keeps reading the last published batch until the next batch is complete.
"""

from __future__ import annotations

import hashlib
import html
from html.parser import HTMLParser
import json
import os
import re
import sys
import time
import unicodedata
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import quote

import requests


WIKI_API = "https://terraria.wiki.gg/api.php"
WIKI_ROOT = "https://terraria.wiki.gg/wiki/"
USER_AGENT = (
    "TerrariaProgressTracker/0.1 "
    "(https://github.com/kujilit/terraria-progress-tracker; catalog data import)"
)
PAGE_SIZE = 400
UPLOAD_BATCH_SIZE = 250
CLASSES = ("Melee", "Ranger", "Mage", "Summoner")
CLASS_FIELDS = {
    "melee": "Melee",
    "ranged": "Ranger",
    "magic": "Mage",
    "summon": "Summoner",
    "sentry": "Summoner",
}
ICONS = {
    "weapon": "⚔️",
    "armor": "🛡️",
    "accessory": "💍",
    "ammo": "🏹",
    "material": "◆",
}
API = requests.Session()
API.headers.update({"User-Agent": USER_AGENT, "Accept": "application/json"})

ARMOR_SET_DATA_PATH = Path(__file__).resolve().parents[1] / "data" / "armor-sets.json"


def item_lookup_key(value: Any) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or "")).casefold()
    normalized = normalized.replace("’", "'").replace("‘", "'")
    return re.sub(r"[^a-z0-9]+", "", normalized)


def load_armor_set_index() -> tuple[dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    payload = json.loads(ARMOR_SET_DATA_PATH.read_text(encoding="utf-8"))
    by_piece: dict[str, dict[str, Any]] = {}
    by_set: dict[str, dict[str, Any]] = {}
    for armor_set in payload.get("sets", []):
        set_id = str(armor_set["id"])
        by_set[set_id] = armor_set
        for piece in armor_set.get("pieces", []):
            key = item_lookup_key(piece["name"])
            existing = by_piece.get(key)
            if existing:
                existing["classes"] = [
                    class_name for class_name in CLASSES
                    if class_name in set(existing["classes"]) | set(armor_set["classes"])
                ]
                if not existing.get("piece_effect") and piece.get("effect"):
                    existing["piece_effect"] = piece["effect"]
                # A common chest/leg piece can be reused by multiple class
                # variants (e.g. Cobalt, Adamantite and Titanium armor).
                existing.setdefault("set_ids", []).append(set_id)
                continue
            by_piece[key] = {
                "set_id": set_id,
                "set_ids": [set_id],
                "set_name": armor_set["name"],
                "classes": armor_set["classes"],
                "stage": armor_set.get("stage"),
                "set_bonus": armor_set.get("setBonus", ""),
                "bonuses": armor_set.get("bonuses", []),
                "piece_effect": piece.get("effect", ""),
                "buff_name": armor_set.get("buffName", ""),
                "buff_duration": armor_set.get("buffDuration", ""),
            }
    return by_piece, by_set


ARMOR_PIECE_INDEX, ARMOR_SET_INDEX = load_armor_set_index()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def log(message: str) -> None:
    print(message, flush=True)


def api_get(params: dict[str, Any], retries: int = 7) -> dict[str, Any]:
    for attempt in range(retries):
        try:
            response = API.get(WIKI_API, params=params, timeout=60)
            if response.status_code == 429 or response.status_code >= 500:
                delay = min(60, 2 ** attempt)
                log(f"Wiki API HTTP {response.status_code}; retrying in {delay}s")
                time.sleep(delay)
                continue
            response.raise_for_status()
            payload = response.json()
            if "error" in payload:
                error = payload["error"]
                raise RuntimeError(
                    f"Terraria Wiki API error {error.get('code')}: "
                    f"{error.get('info') or error}"
                )
            return payload
        except (requests.RequestException, ValueError) as exc:
            if attempt + 1 >= retries:
                raise RuntimeError(f"Could not query Terraria Wiki: {exc}") from exc
            delay = min(60, 2 ** attempt)
            log(f"Wiki API request failed ({exc}); retrying in {delay}s")
            time.sleep(delay)
    raise RuntimeError("Terraria Wiki API retries exhausted")


def cargo_fields(table: str) -> list[str]:
    payload = api_get({
        "action": "cargofields",
        "table": table,
        "format": "json",
        "formatversion": 2,
    })
    raw = payload.get("cargofields")
    if not isinstance(raw, dict):
        raise RuntimeError(
            f"Cargo did not return a field map for {table}; response keys: "
            f"{list(payload.keys())}"
        )
    return list(raw.keys())


def find_field(fields: list[str], *candidates: str) -> str | None:
    by_lower = {field.casefold(): field for field in fields}
    for candidate in candidates:
        found = by_lower.get(candidate.casefold())
        if found:
            return found
    return None


def fetch_cargo_table(table: str, wanted_fields: list[str] | None = None, order_by: str = '_pageName') -> tuple[list[dict[str, str]], list[str]]:
    available = cargo_fields(table)
    if wanted_fields is None:
        selected = available
    else:
        selected = []
        for wanted in wanted_fields:
            actual = find_field(available, wanted)
            if actual and actual not in selected:
                selected.append(actual)

    # _pageName is a Cargo virtual field and is not included in every schema reply.
    query_fields = ["_pageName=page_title"] + selected
    rows: list[dict[str, str]] = []
    offset = 0
    while True:
        payload = api_get({
            "action": "cargoquery",
            "tables": table,
            "fields": ",".join(query_fields),
            "order_by": order_by,
            "limit": PAGE_SIZE,
            "offset": offset,
            "format": "json",
            "formatversion": 2,
        })
        result = payload.get("cargoquery") or []
        if not isinstance(result, list):
            raise RuntimeError(f"Unexpected Cargo response for {table}: {type(result).__name__}")
        page_rows = []
        for entry in result:
            title = entry.get("title", {}) if isinstance(entry, dict) else {}
            if isinstance(title, dict):
                page_rows.append({str(k): "" if v is None else str(v) for k, v in title.items()})
        rows.extend(page_rows)
        log(f"{table}: fetched {len(rows)} rows")
        if len(result) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
        time.sleep(0.15)
    return rows, available


def api_post(params: dict[str, Any], retries: int = 7) -> dict[str, Any]:
    """POST a MediaWiki API query (used for batched titles, to avoid huge URLs)."""
    for attempt in range(retries):
        try:
            response = API.post(WIKI_API, data=params, timeout=60)
            if response.status_code == 429 or response.status_code >= 500:
                delay = min(60, 2 ** attempt)
                log(f"Wiki API HTTP {response.status_code}; retrying in {delay}s")
                time.sleep(delay)
                continue
            response.raise_for_status()
            payload = response.json()
            if "error" in payload:
                error = payload["error"]
                raise RuntimeError(
                    f"Terraria Wiki API error {error.get('code')}: "
                    f"{error.get('info') or error}"
                )
            return payload
        except (requests.RequestException, ValueError) as exc:
            if attempt + 1 >= retries:
                raise RuntimeError(f"Could not query Terraria Wiki image API: {exc}") from exc
            delay = min(60, 2 ** attempt)
            log(f"Wiki image API request failed ({exc}); retrying in {delay}s")
            time.sleep(delay)
    raise RuntimeError("Terraria Wiki image API retries exhausted")


def normalize_image_file(value: Any) -> str | None:
    filename = str(value or "").strip()
    if not filename or filename.casefold() in {"none", "null", "n/a", "0"}:
        return None
    filename = re.sub(r"^File\s*:\s*", "", filename, flags=re.IGNORECASE).strip()
    filename = filename.replace("_", " ")
    return filename or None


def image_urls_from_payload(payload: dict[str, Any]) -> dict[str, dict[str, str]]:
    """Map filename to a resolved thumbnail URL and original file URL."""
    pages = payload.get("query", {}).get("pages", [])
    if isinstance(pages, dict):
        pages = list(pages.values())
    result: dict[str, dict[str, str]] = {}
    for page in pages if isinstance(pages, list) else []:
        title = str(page.get("title") or "")
        filename = re.sub(r"^File\s*:\s*", "", title, flags=re.IGNORECASE).strip()
        imageinfo = page.get("imageinfo") or []
        if not filename or not imageinfo:
            continue
        info = imageinfo[0]
        thumb = info.get("thumburl") or info.get("url")
        original = info.get("url") or thumb
        if thumb:
            result[normalize_text(filename)] = {
                "image_url": str(thumb),
                "image_original_url": str(original) if original else str(thumb),
                "image_page_url": WIKI_ROOT + "File:" + quote(filename.replace(" ", "_"), safe="()'!,:-._"),
            }
    return result


def resolve_image_urls(items: list[dict[str, Any]]) -> None:
    """Resolve Cargo image filenames to stable, direct MediaWiki thumbnail URLs.

    Image resolution is an enrichment step: if a specific file has no imageinfo
    record, the item remains in the catalog with its original icon fallback.
    """
    files = sorted({
        filename
        for item in items
        if (filename := normalize_image_file(item.get("image_file")))
    })
    if not files:
        log("No Cargo imagefile values found; retaining icon fallback.")
        return

    log(f"Resolving Terraria Wiki item images: {len(files)} unique files")
    resolved: dict[str, dict[str, str]] = {}
    batch_size = 40
    for start in range(0, len(files), batch_size):
        batch = files[start:start + batch_size]
        titles = "|".join("File:" + filename for filename in batch)
        payload = api_post({
            "action": "query",
            "titles": titles,
            "prop": "imageinfo",
            "iiprop": "url",
            "iiurlwidth": 72,
            "format": "json",
            "formatversion": 2,
        })
        resolved.update(image_urls_from_payload(payload))
        log(f"Wiki image API: resolved {len(resolved)}/{len(files)} files")
        time.sleep(0.12)

    for item in items:
        filename = normalize_image_file(item.get("image_file"))
        if not filename:
            continue
        info = resolved.get(normalize_text(filename))
        if info:
            item["image_url"] = info["image_url"]
            item["image_original_url"] = info["image_original_url"]
            item["image_page_url"] = info["image_page_url"]

    count = sum(1 for item in items if item.get("image_url"))
    log(f"Item image URLs resolved: {count}/{len(items)} catalog rows")


class _WikiTextParser(HTMLParser):
    """Extract safe plain text from HTML fragments returned by Cargo."""

    BREAK_TAGS = {"br", "div", "p", "li", "ul", "ol", "tr"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.casefold() in self.BREAK_TAGS:
            self.parts.append(" ")

    def handle_endtag(self, tag: str) -> None:
        if tag.casefold() in self.BREAK_TAGS:
            self.parts.append(" ")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def clean_wiki_text(value: Any) -> str:
    """Convert raw or HTML-escaped Wiki tooltip markup to readable plain text."""
    raw = html.unescape(str(value or "")).strip()
    if not raw:
        return ""
    parser = _WikiTextParser()
    parser.feed(raw)
    parser.close()
    return re.sub(r"\\s+", " ", " ".join(parser.parts)).strip()


def norm_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.casefold())


def normalize_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", str(value or "")).casefold()
    text = text.replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", text).strip()


def slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_text).strip("-")
    return slug[:100] or hashlib.sha1(value.encode("utf-8")).hexdigest()[:12]


def get(row: dict[str, Any], *names: str, default: Any = "") -> Any:
    by_norm = {norm_key(str(k)): v for k, v in row.items()}
    for name in names:
        key = norm_key(name)
        if key in by_norm:
            return by_norm[key]
    return default


def parse_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().casefold() in {"1", "true", "yes", "y", "on", "да"}


def parse_number(value: Any, integer: bool = True) -> int | float | None:
    raw = str(value or "").strip().replace(",", "")
    if not raw:
        return None
    match = re.search(r"-?\d+(?:\.\d+)?", raw)
    if not match:
        return None
    number = float(match.group(0))
    if integer and number.is_integer():
        return int(number)
    return int(number) if integer else number


def item_key(item_id: Any, internal_name: str, name: str, page: str) -> str:
    numeric = parse_number(item_id)
    if numeric is not None and numeric > 0:
        return f"terraria_{numeric}"
    stable_name = internal_name or name or page
    return f"wiki_{slugify(stable_name)}"


def wiki_url(page_title: str) -> str:
    return WIKI_ROOT + quote(page_title.replace(" ", "_"), safe="()'!,:-._")


def extract_class_tags(row: dict[str, Any], categories: list[str]) -> tuple[list[str], str]:
    tags = {
        class_name
        for field, class_name in CLASS_FIELDS.items()
        if parse_bool(get(row, field))
    }

    damage_type = str(get(row, "damageType", "damage_type", "class", default="")).casefold()
    for field, class_name in CLASS_FIELDS.items():
        if re.search(rf"\b{field}\b", damage_type):
            tags.add(class_name)

    if "ammo" in categories:
        tags.add("Ranger")
        return [name for name in CLASSES if name in tags], "wiki-ammo-field"

    if "weapon" in categories and tags:
        return [name for name in CLASSES if name in tags], "wiki-damage-flags"

    # Cargo's item infobox may store class bonuses in the set/bonus fields.
    bonus_values = []
    for key, value in row.items():
        normalized = norm_key(key)
        if any(token in normalized for token in ("bonus", "set", "tooltip", "classdamage")):
            if value:
                bonus_values.append(str(value))
    bonus_text = " ".join(bonus_values).casefold()
    for keyword, class_name in (
        ("melee", "Melee"),
        ("ranged", "Ranger"),
        ("magic", "Mage"),
        ("summon", "Summoner"),
        ("minion", "Summoner"),
        ("sentry", "Summoner"),
    ):
        if re.search(rf"\b{keyword}\b", bonus_text):
            tags.add(class_name)

    if tags:
        return [name for name in CLASSES if name in tags], "wiki-set-bonus-text"

    # Do not guess that an untagged weapon or armor piece belongs to all
    # classes. Generic accessories are handled as shared equipment below.
    return [], "unclassified"


def classify_item(row: dict[str, Any]) -> dict[str, Any] | None:
    item_id = get(row, "itemid", "itemId", "id")
    internal_name = str(get(row, "internalname", "internalName"))
    name = str(get(row, "name", "itemname", default="")).strip()
    page = str(get(row, "page_title", "_pageName", default="")).strip()
    if not name:
        name = page.split("/")[-1].replace("_", " ").strip()
    if not name:
        return None

    damage = parse_number(get(row, "damage"), integer=False)
    defense = parse_number(get(row, "defense"))
    item_type = str(get(row, "type", "type2", default="") or "").casefold()
    head_slot = parse_number(get(row, "headSlot", "headslot"))
    body_slot = parse_number(get(row, "bodySlot", "bodyslot"))
    leg_slot = parse_number(get(row, "legSlot", "legslot"))
    accessory = parse_bool(get(row, "accessory", "acc"))
    not_ammo = parse_bool(get(row, "notAmmo", "notammo"))
    vanity = parse_bool(get(row, "vanity"))

    categories: list[str] = []
    damage_flags = any(parse_bool(get(row, field)) for field in CLASS_FIELDS)
    damage_type = str(get(row, "damagetype", "damage_type", default="") or "").strip()
    typed_weapon = bool(re.search(r"\bweapon\b", item_type))
    if typed_weapon or (damage is not None and damage > 0 and (damage_flags or damage_type)):
        categories.append("weapon")

    armor_slot_values = {
        "head": get(row, "headSlot", "headslot"),
        "body": get(row, "bodySlot", "bodyslot"),
        "legs": get(row, "legSlot", "legslot"),
    }

    def is_assigned_slot(value: Any) -> bool:
        raw = str(value or "").strip().casefold()
        if not raw or raw in {"-1", "0", "none", "false", "no", "n/a"}:
            return False
        number = parse_number(raw)
        if number is not None:
            return number > 0
        # Cargo stores Iteminfo slot values as human-readable text on some
        # rows, e.g. "Helmet", "Shirt", "Pants", "social shirt".
        return True

    has_armor_slot = any(is_assigned_slot(value) for value in armor_slot_values.values())
    typed_armor = bool(re.search(r"\barmor\b|\barmour\b", item_type))
    if (typed_armor or has_armor_slot) and (not vanity or (defense is not None and defense > 0)):
        categories.append("armor")

    typed_accessory = bool(re.search(r"\baccessory\b|\baccessories\b", item_type))
    if accessory or typed_accessory:
        categories.append("accessory")

    # The Cargo "ammo" field on weapons is often the ammo ID they consume.
    # Actual ammunition is identified by the item infobox type/category instead.
    if ("ammunition" in item_type or re.search(r"\bammo\b", item_type)) and not not_ammo:
        categories.append("ammo")

    if not categories:
        return None

    classes, assignment = extract_class_tags(row, categories)
    armor_meta = ARMOR_PIECE_INDEX.get(item_lookup_key(name)) if "armor" in categories else None
    if armor_meta:
        classes = list(armor_meta["classes"])
        assignment = "curated-armor-set"
    elif not classes:
        if "weapon" in categories:
            # A weapon without an explicit damage class is not silently assigned
            # to every class. Keep it out of class equipment until it is reviewed.
            assignment = "unclassified-weapon"
        elif "armor" in categories:
            assignment = "unclassified-armor"
        else:
            classes = list(CLASSES)
            assignment = "shared-equipment-default"

    # Normalize item categories and keep the most useful one for the current card layout.
    priority = ("weapon", "armor", "accessory", "ammo")
    primary_category = next(category for category in priority if category in categories)
    hardmode_value = get(row, "hardmode")
    hardmode = None if str(hardmode_value).strip() == "" else parse_bool(hardmode_value)
    stage = (armor_meta.get("stage") if armor_meta else None) or (
        "Hardmode" if hardmode else "Pre-Hardmode" if hardmode is False else "Not specified"
    )
    class_damage = [name for name in CLASSES if name in classes]

    slots = {key: val for key, val in armor_slot_values.items() if is_assigned_slot(val)}
    return {
        "item_key": item_key(item_id, internal_name, name, page),
        "terraria_id": parse_number(item_id),
        "internal_name": internal_name or None,
        "name": name,
        "name_ru": None,
        "page_title": page or name,
        "wiki_url": wiki_url(page or name),
        "image_file": normalize_image_file(get(row, "imagefile", "image_file")),
        "image_url": None,
        "image_original_url": None,
        "image_page_url": None,
        "primary_category": primary_category,
        "categories": sorted(set(categories)),
        "classes": class_damage,
        "class_assignment": assignment,
        "stage": stage,
        "icon": ICONS[primary_category],
        "description": clean_wiki_text(get(row, "description", "tooltip", "ToolTip", default="")),
        "source_note": f"Terraria Wiki · {page or name}",
        "damage": damage,
        "damage_type": ", ".join(class_damage) if primary_category == "weapon" else None,
        "defense": defense,
        "equipment_effect": (
            (armor_meta or {}).get("piece_effect")
            or clean_wiki_text(get(row, "bonus", "effect", "tooltip", "ToolTip", "description", default=""))
        ),
        "armor_set_id": armor_meta.get("set_id") if armor_meta else None,
        "armor_set_name": armor_meta.get("set_name") if armor_meta else None,
        "armor_set_bonus": armor_meta.get("set_bonus") if armor_meta else None,
        "buff_name": (
            armor_meta.get("buff_name")
            if armor_meta and armor_meta.get("buff_name")
            else str(get(row, "buffName", "buffname", "buff_name", "buff", default="") or "")
        ),
        "buff_duration": (
            armor_meta.get("buff_duration")
            if armor_meta and armor_meta.get("buff_duration")
            else str(get(row, "buffDuration", "buffduration", "buffTime", "bufftime", default="") or "")
        ),
        "ammo_type": parse_number(get(row, "ammo")),
        "max_stack": parse_number(get(row, "maxStack", "maxstack")),
        "rarity": parse_number(get(row, "rare", "rarity")),
        "hardmode": hardmode,
        "is_shared": assignment == "shared-equipment-default",
        "slot_metadata": slots,
        "raw_cargo": row,
    }


def choose_best(existing: dict[str, Any], candidate: dict[str, Any]) -> dict[str, Any]:
    def score(record: dict[str, Any]) -> int:
        return (
            int(bool(record.get("terraria_id")))
            + int(bool(record.get("internal_name")))
            + int(bool(record.get("page_title")))
            + int(bool(record.get("wiki_url")))
            + int(bool(record.get("raw_cargo")))
        )

    primary = candidate if score(candidate) > score(existing) else existing
    merged = dict(primary)
    merged["categories"] = sorted(set(existing["categories"]) | set(candidate["categories"]))
    merged["classes"] = [name for name in CLASSES if name in set(existing["classes"]) | set(candidate["classes"])]
    merged["is_shared"] = existing["is_shared"] or candidate["is_shared"]
    # If this item was discovered as both a weapon and an accessory, preserve all categories.
    priority = ("weapon", "armor", "accessory", "ammo", "material")
    merged["primary_category"] = next(x for x in priority if x in merged["categories"])
    return merged


def build_item_indexes(items: dict[str, dict[str, Any]]) -> tuple[dict[int, str], dict[str, str]]:
    by_id: dict[int, str] = {}
    by_name: dict[str, str] = {}
    for key, item in items.items():
        numeric = item.get("terraria_id")
        if numeric is not None:
            by_id[int(numeric)] = key
        by_name[normalize_text(item.get("name", ""))] = key
        if item.get("internal_name"):
            by_name[normalize_text(item["internal_name"])] = key
    return by_id, by_name


def parse_alternatives(value: str) -> list[str]:
    value = re.sub(r"#.*$", "", value or "").strip()
    if not value:
        return []
    if "¦" in value:
        return [piece.strip() for piece in value.split("¦") if piece.strip()]
    if "/" not in value:
        return [value]
    pieces = [piece.strip() for piece in value.split("/") if piece.strip()]
    if len(pieces) == 2:
        left, right = pieces
        # Wiki shorthand such as "Iron/Lead Bar" means "Iron Bar" or "Lead Bar".
        suffix = re.search(r"\s+(.+)$", right)
        if suffix and " " not in left:
            return [f"{left} {suffix.group(1)}", right]
    return pieces


def parse_recipe_ingredients(row: dict[str, Any]) -> list[dict[str, Any]]:
    structured = str(get(row, "ings", default="") or "")
    args = str(get(row, "args", default="") or "")
    result: list[dict[str, Any]] = []

    if structured:
        for segment in structured.split("^"):
            parts = segment.split("¦")
            quantity = parse_number(parts[-1]) if parts else None
            raw_names = [part.strip() for part in parts[1:-1] if part.strip()]
            names = [alternative for raw_name in raw_names for alternative in parse_alternatives(raw_name)]
            if not names:
                # Some rows omit the leading/trailing Cargo delimiter.
                cleaned = [part.strip() for part in parts if part.strip()]
                if len(cleaned) >= 2 and parse_number(cleaned[-1]) is not None:
                    names = [alternative for raw_name in cleaned[:-1] for alternative in parse_alternatives(raw_name)]
                    quantity = parse_number(cleaned[-1])
                elif cleaned:
                    names, quantity = [alternative for raw_name in cleaned for alternative in parse_alternatives(raw_name)], 1
            if names:
                result.append({
                    "names": names,
                    "name": " / ".join(names),
                    "quantity": max(1, int(quantity or 1)),
                })

    if result:
        return result

    # Fallback for old/partially populated Cargo rows: args is itemname¦amount^...
    for segment in args.split("^"):
        if "¦" not in segment:
            continue
        raw_name, raw_quantity = segment.rsplit("¦", 1)
        names = parse_alternatives(raw_name)
        if names:
            result.append({
                "names": names,
                "name": " / ".join(names),
                "quantity": max(1, int(parse_number(raw_quantity) or 1)),
            })
    return result


def stable_recipe_key(row: dict[str, Any]) -> str:
    material = "|".join(str(get(row, field, default="") or "") for field in (
        "resultid", "result", "amount", "version", "station", "args", "ings"
    ))
    return "wiki:" + hashlib.sha256(material.encode("utf-8")).hexdigest()[:32]


def make_material_stub(name: str, classes: set[str]) -> dict[str, Any]:
    key = "name_" + slugify(name)
    return {
        "item_key": key,
        "terraria_id": None,
        "internal_name": None,
        "name": name,
        "name_ru": None,
        "page_title": name,
        "wiki_url": wiki_url(name),
        "image_file": None,
        "image_url": None,
        "image_original_url": None,
        "image_page_url": None,
        "primary_category": "material",
        "categories": ["material"],
        "classes": [c for c in CLASSES if c in classes] or list(CLASSES),
        "class_assignment": "recipe-dependency",
        "stage": "Not specified",
        "icon": ICONS["material"],
        "description": "",
        "source_note": "Terraria Wiki · recipe ingredient",
        "damage": None,
        "damage_type": None,
        "defense": None,
        "equipment_effect": "",
        "armor_set_id": None,
        "armor_set_name": None,
        "armor_set_bonus": None,
        "buff_name": None,
        "buff_duration": None,
        "ammo_type": None,
        "max_stack": None,
        "rarity": None,
        "hardmode": None,
        "is_shared": len(classes) > 1,
        "slot_metadata": {},
        "raw_cargo": {},
    }



def make_source_material(source: dict[str, Any], classes: set[str]) -> dict[str, Any]:
    stub = make_material_stub(source["name"], classes)
    stub.update({
        "item_key": source["item_key"],
        "terraria_id": source.get("terraria_id"),
        "internal_name": source.get("internal_name"),
        "page_title": source.get("page_title") or source["name"],
        "wiki_url": wiki_url(source.get("page_title") or source["name"]),
        "image_file": source.get("image_file"),
        "image_url": None,
        "image_original_url": None,
        "image_page_url": None,
        "source_note": f"Terraria Wiki · {source.get('page_title') or source['name']}",
        "raw_cargo": source.get("raw_cargo") or {},
    })
    return stub

def build_catalog(item_rows: list[dict[str, str]], recipe_rows: list[dict[str, str]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    # Keep a lightweight index of ALL Cargo Items, not just gear. This matters
    # because a material can itself be craftable and therefore have a recipe.
    all_items: dict[str, dict[str, Any]] = {}
    source_items: dict[str, dict[str, Any]] = {}
    source_id_index: dict[int, str] = {}
    source_name_index: dict[str, str] = {}

    for row in item_rows:
        item_id = get(row, "itemid", "itemId", "id")
        internal_name = str(get(row, "internalname", "internalName"))
        name = str(get(row, "name", "itemname", default="")).strip()
        page = str(get(row, "page_title", "_pageName", default="")).strip()
        if not name:
            name = page.split("/")[-1].replace("_", " ").strip()
        if not name:
            continue

        key = item_key(item_id, internal_name, name, page)
        source = {
            "item_key": key,
            "terraria_id": parse_number(item_id),
            "internal_name": internal_name or None,
            "name": name,
            "page_title": page or name,
            "image_file": normalize_image_file(get(row, "imagefile", "image_file")),
            "raw_cargo": row,
        }
        if key not in source_items or (
            source.get("internal_name") and not source_items[key].get("internal_name")
        ):
            source_items[key] = source
        numeric_id = parse_number(item_id)
        if numeric_id is not None and numeric_id > 0:
            source_id_index[int(numeric_id)] = key
        source_name_index[normalize_text(name)] = key
        if internal_name:
            source_name_index[normalize_text(internal_name)] = key

        item = classify_item(row)
        if item:
            all_items[key] = choose_best(all_items[key], item) if key in all_items else item

    if not all_items:
        raise RuntimeError("No gear items were detected in Cargo Items. Refusing to publish.")

    # Build a recipe graph for every Cargo item, including raw materials and craftable
    # intermediate ingredients. Only the recursive dependency graph of the equipment
    # is eventually stored.
    recipes_by_result: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in recipe_rows:
        if str(get(row, "legacy", default="")).casefold() in {"1", "yes", "true"}:
            continue
        result_id = parse_number(get(row, "resultid"))
        result_key = source_id_index.get(int(result_id)) if result_id is not None else None
        if result_key is None:
            result_key = source_name_index.get(normalize_text(get(row, "result")))
        if result_key:
            recipes_by_result[result_key].append(row)

    gear_keys = {
        key for key, item in all_items.items()
        if any(category in item["categories"] for category in ("weapon", "armor", "accessory", "ammo"))
    }
    needed_keys = set(gear_keys)
    included_recipe_rows: dict[str, tuple[str, dict[str, str]]] = {}
    queue = deque(sorted(gear_keys))
    processed: set[str] = set()

    while queue:
        current_key = queue.popleft()
        if current_key in processed:
            continue
        processed.add(current_key)
        for row in recipes_by_result.get(current_key, []):
            recipe_key = stable_recipe_key(row)
            included_recipe_rows[recipe_key] = (current_key, row)
            current_classes = set(all_items[current_key]["classes"])
            for ingredient in parse_recipe_ingredients(row):
                for ingredient_name in ingredient["names"]:
                    normalized = normalize_text(ingredient_name)
                    linked_key = source_name_index.get(normalized)
                    if linked_key is None:
                        linked_key = next(
                            (source_name_index.get(normalize_text(alias))
                             for alias in parse_alternatives(ingredient_name)
                             if source_name_index.get(normalize_text(alias))),
                            None,
                        )
                    if linked_key is None:
                        linked_key = "name_" + slugify(ingredient_name)
                        all_items[linked_key] = make_material_stub(ingredient_name, current_classes)
                    elif linked_key not in all_items:
                        source = source_items[linked_key]
                        all_items[linked_key] = make_source_material(source, current_classes)
                    else:
                        existing = all_items[linked_key]
                        existing["classes"] = [
                            c for c in CLASSES
                            if c in set(existing["classes"]) | current_classes
                        ]
                    needed_keys.add(linked_key)
                    if linked_key not in processed and recipes_by_result.get(linked_key):
                        queue.append(linked_key)

    # Add every recipe ingredient material to the selected class context, while preserving
    # any class-specific tags already inferred from the Wiki.
    for key in needed_keys:
        item = all_items[key]
        if key not in gear_keys and "material" not in item["categories"]:
            item["categories"] = sorted(set(item["categories"]) | {"material"})
            item["primary_category"] = "material"
            item["icon"] = ICONS["material"]

    name_index = {
        normalize_text(item["name"]): key
        for key, item in all_items.items()
    }
    for key, item in all_items.items():
        if item.get("internal_name"):
            name_index[normalize_text(item["internal_name"])] = key

    catalog_recipes: list[dict[str, Any]] = []
    catalog_ingredients: list[dict[str, Any]] = []
    for recipe_key, (result_key, row) in sorted(included_recipe_rows.items()):
        result_id = parse_number(get(row, "resultid"))
        result_name = str(get(row, "result", default=all_items[result_key]["name"]))
        source_page = str(get(row, "page_title", default=""))
        args = str(get(row, "args", default="") or "")
        raw_recipe = {key: value for key, value in row.items() if key != "page_title"}
        catalog_recipes.append({
            "recipe_key": recipe_key,
            "result_item_key": result_key,
            "result_terraria_id": int(result_id) if result_id is not None else None,
            "result_name": result_name,
            "result_quantity": max(1, int(parse_number(get(row, "amount")) or 1)),
            "crafting_station": str(get(row, "station", default="") or "") or None,
            "version": str(get(row, "version", default="") or "") or None,
            "note": str(get(row, "resulttext", default="") or "") or None,
            "source_page": source_page or None,
            "source_url": wiki_url(source_page) if source_page else None,
            "raw_args": args,
            "raw_cargo": raw_recipe,
        })

        result_classes = set(all_items[result_key]["classes"])
        for index, ingredient in enumerate(parse_recipe_ingredients(row), start=1):
            alternative_keys: list[str] = []
            for ingredient_name in ingredient["names"]:
                normalized = normalize_text(ingredient_name)
                linked = name_index.get(normalized) or source_name_index.get(normalized)
                if linked is None:
                    linked = "name_" + slugify(ingredient_name)
                    if linked not in all_items:
                        all_items[linked] = make_material_stub(ingredient_name, result_classes)
                        needed_keys.add(linked)
                elif linked not in all_items:
                    all_items[linked] = make_source_material(source_items[linked], result_classes)
                    needed_keys.add(linked)
                else:
                    all_items[linked]["classes"] = [
                        c for c in CLASSES
                        if c in set(all_items[linked]["classes"]) | result_classes
                    ]
                alternative_keys.append(linked)
                name_index[normalized] = linked

            catalog_ingredients.append({
                "recipe_key": recipe_key,
                "ingredient_order": index,
                "ingredient_name": ingredient["name"],
                "quantity": ingredient["quantity"],
                "linked_item_key": alternative_keys[0] if alternative_keys else None,
                "alternative_names": [
                    {"name": name, "item_key": key}
                    for name, key in zip(ingredient["names"], alternative_keys)
                ] if len(alternative_keys) > 1 else [],
            })

    catalog_items = [all_items[key] for key in sorted(needed_keys)]
    return catalog_items, catalog_recipes, catalog_ingredients

def supabase_headers(key: str, extra: dict[str, str] | None = None) -> dict[str, str]:
    headers = dict(extra or {})
    headers.update({
        "apikey": key,
        "Content-Type": "application/json",
    })
    # New sb_secret_* API keys are opaque keys, not JWTs: send them only as
    # apikey. Legacy service_role keys are JWTs and still need Bearer auth.
    if key.startswith("eyJ"):
        headers["Authorization"] = f"Bearer {key}"
    else:
        headers.pop("Authorization", None)
    return headers


def supabase_request(method: str, url: str, key: str, **kwargs: Any) -> requests.Response:
    headers = supabase_headers(key, kwargs.pop("headers", {}))
    response = requests.request(method, url, headers=headers, timeout=90, **kwargs)
    if response.status_code >= 400:
        raise RuntimeError(
            f"Supabase {method} {url} failed ({response.status_code}): "
            f"{response.text[:2000]}"
        )
    return response


def upload_rows(
    supabase_url: str,
    key: str,
    table: str,
    rows: list[dict[str, Any]],
    conflict: str,
) -> None:
    if not rows:
        return
    endpoint = f"{supabase_url.rstrip('/')}/rest/v1/{table}"
    for start in range(0, len(rows), UPLOAD_BATCH_SIZE):
        batch = rows[start:start + UPLOAD_BATCH_SIZE]
        supabase_request(
            "POST",
            endpoint,
            key,
            params={"on_conflict": conflict},
            headers={"Prefer": "resolution=merge-duplicates,return=minimal"},
            json=batch,
        )
        log(f"Supabase {table}: uploaded {min(start + len(batch), len(rows))}/{len(rows)}")


def publish_catalog(
    items: list[dict[str, Any]],
    recipes: list[dict[str, Any]],
    ingredients: list[dict[str, Any]],
    source_revision: str,
    dry_run: bool,
) -> dict[str, Any]:
    report = {
        "source": "terraria.wiki.gg",
        "source_revision": source_revision,
        "items": len(items),
        "recipes": len(recipes),
        "recipe_ingredients": len(ingredients),
        "images": sum(1 for item in items if item.get("image_url")),
        "image_files": sum(1 for item in items if item.get("image_file")),
        "categories": {},
        "classes": {},
        "generated_at": utc_now(),
    }
    for item in items:
        for category in item["categories"]:
            report["categories"][category] = report["categories"].get(category, 0) + 1
        for class_name in item["classes"]:
            report["classes"][class_name] = report["classes"].get(class_name, 0) + 1

    log(json.dumps(report, ensure_ascii=False, indent=2))
    if dry_run:
        log("Dry run: nothing was written to Supabase.")
        return report

    supabase_url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    service_key = (
        os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    )
    if not supabase_url or not service_key:
        raise RuntimeError(
            "Set SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SECRET_KEY "
            "as GitHub Actions environment values. Use a server-side Secret key, never a publishable key."
        )

    batch_id = str(uuid.uuid4())
    base = supabase_url.rstrip("/")
    supabase_request(
        "POST",
        f"{base}/rest/v1/tracker_catalog_imports",
        service_key,
        headers={"Prefer": "return=minimal"},
        json={
            "batch_id": batch_id,
            "source": "terraria.wiki.gg",
            "source_revision": source_revision,
            "status": "loading",
            "items_count": len(items),
            "recipes_count": len(recipes),
            "ingredients_count": len(ingredients),
            "metadata": report,
        },
    )

    try:
        item_rows = [{"batch_id": batch_id, **item} for item in items]
        recipe_rows = [{"batch_id": batch_id, **recipe} for recipe in recipes]
        ingredient_rows = [{"batch_id": batch_id, **ingredient} for ingredient in ingredients]

        upload_rows(base, service_key, "tracker_catalog_items", item_rows, "batch_id,item_key")
        upload_rows(base, service_key, "tracker_catalog_recipes", recipe_rows, "batch_id,recipe_key")
        upload_rows(
            base,
            service_key,
            "tracker_catalog_recipe_ingredients",
            ingredient_rows,
            "batch_id,recipe_key,ingredient_order",
        )

        supabase_request(
            "PATCH",
            f"{base}/rest/v1/tracker_catalog_imports",
            service_key,
            params={"batch_id": f"eq.{batch_id}"},
            headers={"Prefer": "return=minimal"},
            json={"status": "published", "published_at": utc_now()},
        )
    except Exception:
        try:
            supabase_request(
                "PATCH",
                f"{base}/rest/v1/tracker_catalog_imports",
                service_key,
                params={"batch_id": f"eq.{batch_id}"},
                headers={"Prefer": "return=minimal"},
                json={"status": "failed"},
            )
        except Exception as mark_error:
            log(f"Warning: could not mark failed import batch: {mark_error}")
        raise

    report["batch_id"] = batch_id
    log(f"Published catalog batch {batch_id}")
    return report


def main() -> int:
    dry_run = "--dry-run" in sys.argv
    log("Discovering Cargo schemas...")
    item_fields = cargo_fields("Items")
    recipe_fields = cargo_fields("Recipes")
    log(f"Items fields discovered: {len(item_fields)}")
    log(f"Recipes fields discovered: {len(recipe_fields)}")

    item_rows, _ = fetch_cargo_table("Items", order_by="itemid")
    recipe_wanted = [
        "result", "resultid", "resultimage", "resulttext", "amount",
        "version", "station", "ingredients", "ings", "args", "legacy",
    ]
    recipe_rows, _ = fetch_cargo_table("Recipes", recipe_wanted, order_by="resultid,version,station,amount")

    log(f"Building equipment dependency graph from {len(item_rows)} items and {len(recipe_rows)} recipes...")
    items, recipes, ingredients = build_catalog(item_rows, recipe_rows)
    if find_field(item_fields, "imagefile") is None:
        log("Warning: Cargo Items schema has no imagefile field; item cards will use icon fallbacks.")
    else:
        try:
            resolve_image_urls(items)
        except Exception as exc:
            # Recipe/equipment import should still be publishable if the Wiki image API
            # is temporarily unavailable. The image URLs can be enriched on next run.
            log(f"Warning: image URL enrichment failed; retaining fallback icons: {exc}")
    if not items:
        raise RuntimeError("Import produced no catalog items; refusing to publish.")
    if not any(item["primary_category"] == "weapon" for item in items):
        raise RuntimeError("No class weapons detected; refusing to publish a bad catalog snapshot.")

    revision = f"cargo-items:{len(item_rows)}-recipes:{len(recipe_rows)}-{datetime.now(timezone.utc):%Y%m%d}"
    publish_catalog(items, recipes, ingredients, revision, dry_run)
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        log(f"IMPORT FAILED: {exc}")
        raise
