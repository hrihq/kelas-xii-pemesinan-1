#!/usr/bin/env python3
"""
Build script — baca data markdown + frontmatter dari folder content/
lalu generate data/*.json yang dibaca oleh halaman web.

Dijalankan secara otomatis oleh .github/workflows/deploy.yml setiap
kali admin menambah/mengubah konten lewat Decap CMS di /admin.

Format file content/ (frontmatter YAML + body markdown):

content/pengumuman/selamat-datang.md
-----------------------------------
---
title: "Selamat Datang"
date: 2026-09-01
status: "Aktif"
author: "Admin"
excerpt: "Pengumuman singkat..."
document: "docs/selamat-datang.pdf"   # opsional
---
Isi pengumuman lengkap di sini...

content/tugas/mtk-bab-1.md
--------------------------
---
title: "Matematika - Bab 1: Limit"
mapel: "Matematika"
teacher: "Bpk. Budi"
deadline: 2026-09-30
status: "Aktif"
document: "docs/limit-soal.pdf"       # opsional
---
Detail tugas...

content/profil.md
-----------------
---
info:
  Nama Kelas: "XII PEMESINAN 1"
  Wali Kelas: "Bpk. ..."
  Jurusan: "Teknik Pemesinan"
struktur:
  - jabatan: "Ketua Kelas"
    nama: "..."
  - jabatan: "Wakil Ketua"
    nama: "..."
kontak:
  - jabatan: "Wali Kelas"
    nama: "..."
    telepon: "0812..."
    email: "..."
---
"""

import json
import os
import re
import sys
import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONTENT_DIR = os.path.join(BASE, "content")
DATA_DIR = os.path.join(BASE, "data")

try:
    import yaml
except ImportError:  # fallback parser minimal jika PyYAML tidak ada
    yaml = None

# Pisahkan frontmatter (--- ... ---) dari body markdown.
# Catatan: gunakan [ \t]* sebelum newline, JANGAN \s* — \s sudah
# memakan newline sehingga garis "---" penutup tidak terdeteksi.
FM_RE = re.compile(r"\A---[ \t]*\r?\n(.*?)\r?\n---[ \t]*(?:\r?\n|\Z)", re.DOTALL)


def parse_frontmatter(text):
    """Return (frontmatter_dict, body_text)."""
    m = FM_RE.match(text)
    if not m:
        return {}, text.strip()
    raw, body = m.group(1), text[m.end():].strip()
    if yaml is not None:
        try:
            data = yaml.safe_load(raw)
            if not isinstance(data, dict):
                data = {}
        except Exception as exc:  # YAML rusak -> beri pesan jelas, bukan crash diam-diam
            raise SystemExit(f"[build] Error YAML frontmatter: {exc}\n---\n{raw[:400]}")
    else:
        data = _mini_yaml(raw)
    return data, body


def _mini_yaml(raw):
    """Parser YAML sangat sederhana: scalar, object 2 level, dan list."""
    out, stack = {}, [(-1, {})]
    for line in raw.split("\n"):
        if not line.strip() or line.strip().startswith("#"):
            continue
        indent = len(line) - len(line.lstrip(" "))
        s = line.strip()
        while len(stack) > 1 and indent <= stack[-1][0]:
            stack.pop()
        parent = stack[-1][1]
        if s.startswith("- "):
            item = s[2:].strip()
            if not isinstance(parent.get("_list"), list):
                parent["_list"] = []
            parent["_list"].append(item.split(": ", 1)[1] if ": " in item else item)
        elif ": " in s or s.endswith(":"):
            k, _, v = s.partition(":")
            k, v = k.strip(), v.strip().strip('"\'')
            if v:
                parent[k] = v
            else:
                child = {}
                parent[k] = child
                stack.append((indent, child))
    # rapikan: _list_keyed -> keyed dict-of-lists
    for k, v in out.items():
        if isinstance(v, dict) and "_list" in v:
            out[k] = v["_list"]
    return out


# ---------- slug ----------
def slugify(filename):
    return os.path.splitext(os.path.basename(filename))[0].lower()


# ---------- koleksi ----------
def collect(kind, required_fields):
    folder = os.path.join(CONTENT_DIR, kind)
    if not os.path.isdir(folder):
        return []
    out = []
    for fname in sorted(os.listdir(folder)):
        if not fname.lower().endswith((".md", ".markdown")):
            continue
        path = os.path.join(folder, fname)
        with open(path, "r", encoding="utf-8") as f:
            text = f.read()
        fm, body = parse_frontmatter(text)
        item = {"slug": slugify(fname)}
        for field in required_fields:
            item[field] = _str(fm.get(field, ""))
        item["body"] = body
        out.append(item)
    return out


def _str(v):
    """PyYAML mem-parse tanggal menjadi objek date; pastikan semua
    nilai menjadi string (format ISO untuk tanggal)."""
    if v is None:
        return ""
    if isinstance(v, (datetime.date, datetime.datetime)):
        return v.isoformat()
    return str(v)


def build():
    os.makedirs(DATA_DIR, exist_ok=True)

    tugas = collect(
        "tugas",
        ["title", "mapel", "teacher", "deadline", "status", "document", "excerpt"],
    )
    pengumuman = collect(
        "pengumuman",
        ["title", "date", "status", "author", "document", "excerpt"],
    )

    with open(os.path.join(DATA_DIR, "tugas.json"), "w", encoding="utf-8") as f:
        json.dump(tugas, f, ensure_ascii=False, indent=2)

    with open(os.path.join(DATA_DIR, "pengumuman.json"), "w", encoding="utf-8") as f:
        json.dump(pengumuman, f, ensure_ascii=False, indent=2)

    # profil.json (single file)
    profil = {}
    pfile = os.path.join(CONTENT_DIR, "profil.md")
    if os.path.isfile(pfile):
        with open(pfile, "r", encoding="utf-8") as f:
            fm, _body = parse_frontmatter(f.read())
        profil = {
            "info": fm.get("info", {}),
            "struktur": fm.get("struktur", []),
            "kontak": fm.get("kontak", []),
        }
    with open(os.path.join(DATA_DIR, "profil.json"), "w", encoding="utf-8") as f:
        json.dump(profil, f, ensure_ascii=False, indent=2)

    print(f"[build] tugas: {len(tugas)} item")
    print(f"[build] pengumuman: {len(pengumuman)} item")
    print(f"[build] profil: {'ok' if profil else 'kosong'}")
    return True


if __name__ == "__main__":
    if not build():
        sys.exit(1)
    print("[build] selesai -> data/*.json")
