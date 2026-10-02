#!/usr/bin/env python3
"""
Bot admin Kelas XII PEMESINAN 1 (berjalan di GitHub Actions cron).

Cara kerja:
- Cek pesan Telegram lewat getUpdates (tanpa webhook, tanpa server).
- Kalau admin kirim PDF/foto + caption "mapel | judul" -> upload jadi tugas.
- Kalau admin kirim /pengumuman judul | isi -> tambah pengumuman.
- Commit ke repo pakai BOT_PAT (GITHUB_TOKEN tidak memicu workflow lain),
  lalu deploy GitHub Pages di run yang sama.

Format pesan:
  [kirim file]  Matematika | Limit Fungsi Bab 2
  /pengumuman   Judul | Isi pengumuman
"""

import base64
import datetime
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

# ============================================================
# KONFIGURASI
# ============================================================
TG_TOKEN = os.environ.get("TG_BOT_TOKEN", "")
GH_PAT = os.environ.get("BOT_PAT", "") or os.environ.get("GITHUB_TOKEN", "")
REPO = os.environ.get("REPO", "hrihq/kelas-xii-pemesinan-1")
ADMIN_IDS = [s.strip() for s in os.environ.get("ADMIN_IDS", "").split(",") if s.strip()]
MAX_FILE_MB = 10

TG_API = f"https://api.telegram.org/bot{TG_TOKEN}"
GH_API = "https://api.github.com"


# ============================================================
# HTTP helpers
# ============================================================
def http_get_json(url, headers=None, timeout=30):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def http_post_json(url, payload, headers=None, timeout=60):
    data = json.dumps(payload).encode("utf-8")
    h = {"content-type": "application/json"}
    h.update(headers or {})
    req = urllib.request.Request(url, data=data, headers=h, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        try:
            return json.loads(e.read().decode("utf-8"))
        except Exception:
            return {"ok": False, "error": str(e)}


def http_get_bytes(url, timeout=60):
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def gh_request(method, path, payload=None):
    """Request ke GitHub API dengan PAT."""
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    h = {
        "authorization": f"token {GH_PAT}",
        "accept": "application/vnd.github+json",
        "content-type": "application/json",
    }
    url = f"{GH_API}/repos/{REPO}/{path}"
    req = urllib.request.Request(url, data=data, headers=h, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read().decode("utf-8")
            return r.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", "replace")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"message": body[:300]}


# ============================================================
# Telegram helpers
# ============================================================
def tg_send(chat_id, text, parse_mode=None):
    payload = {"chat_id": chat_id, "text": text}
    if parse_mode:
        payload["parse_mode"] = parse_mode
    return http_post_json(f"{TG_API}/sendMessage", payload)


def tg_download(file_id):
    """Download file Telegram. Return (filename, bytes)."""
    j = http_get_json(f"{TG_API}/getFile?file_id={file_id}")
    if not j.get("ok"):
        raise RuntimeError("getFile gagal: " + str(j.get("description")))
    path = j["result"]["file_path"]
    name = path.split("/")[-1]
    data = http_get_bytes(f"https://api.telegram.org/file/bot{TG_TOKEN}/{path}")
    return name, data


# ============================================================
# util
# ============================================================
def esc(s):
    if s is None:
        return ""
    return (
        str(s)
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def slugify(text):
    s = text.lower()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    s = s.strip("-")
    return s[:60] or "tugas"


def gh_file_exists(path, ref="master"):
    code, _ = gh_request("GET", f"contents/{path}?ref={ref}")
    return code == 200


def gh_put_file(path, content_bytes, message):
    b64 = base64.b64encode(content_bytes).decode("ascii")
    code, body = gh_request("PUT", f"contents/{path}", {
        "message": message,
        "content": b64,
        "branch": "master",
    })
    if code not in (200, 201):
        raise RuntimeError(f"commit {path} gagal: {body.get('message', code)}")
    return body


def put_tugas(env, slug, judul, mapel, doc_name, deadline, extra_body=""):
    fm = (
        "---\n"
        f'title: "{judul}"\n'
        f'mapel: "{mapel}"\n'
        'teacher: ""\n'
        f"deadline: {deadline}\n"
        'status: "Aktif"\n'
        'excerpt: "Dikirim lewat bot Telegram"\n'
        f'document: "/docs/{doc_name}"\n'
        "---\n"
        f"{extra_body}\n"
    )
    gh_put_file(
        f"content/tugas/{slug}.md",
        fm.encode("utf-8"),
        f"Bot: tambah tugas \"{judul}\"",
    )


def put_pengumuman(slug, judul, isi, date):
    fm = (
        "---\n"
        f'title: "{judul}"\n'
        f"date: {date}\n"
        'status: "Aktif"\n'
        'author: "Admin"\n'
        f'excerpt: "{isi[:80]}"\n'
        "---\n"
        f"{isi}\n"
    )
    gh_put_file(
        f"content/pengumuman/{slug}.md",
        fm.encode("utf-8"),
        f"Bot: tambah pengumuman \"{judul}\"",
    )


# ============================================================
# handler
# ============================================================
def handle_message(msg):
    chat_id = msg["chat"]["id"]
    if str(chat_id) not in ADMIN_IDS:
        tg_send(chat_id, "Maaf, bot ini hanya untuk admin Kelas XII PEMESINAN 1.")
        return

    text = msg.get("text") or msg.get("caption") or ""

    # /start atau /mulai
    if text.startswith(("/start", "/mulai")):
        tg_send(
            chat_id,
            "<b>Bot Admin Kelas XII PEMESINAN 1</b>\n\n"
            "Kirim <b>file PDF/foto</b> dengan caption:\n"
            "<code>mapel | judul tugas</code>\n"
            "Contoh: <code>Matematika | Limit Fungsi Bab 2</code>\n\n"
            "Pengumuman:\n"
            "<code>/pengumuman judul | isi</code>\n\n"
            "Web akan update otomatis dalam 1-2 menit.",
            "HTML",
        )
        return

    # /pengumuman
    if text.startswith("/pengumuman"):
        raw = text[len("/pengumuman"):].strip()
        if "|" in raw:
            judul, isi = [p.strip() for p in raw.split("|", 1)]
        else:
            judul, isi = "Pengumuman", raw
        if not isi:
            tg_send(chat_id, "Format: /pengumuman judul | isi pengumuman")
            return
        slug = slugify(judul)
        date = datetime.date.today().isoformat()
        if gh_file_exists(f"content/pengumuman/{slug}.md"):
            tg_send(chat_id, f"Pengumuman \"{judul}\" sudah ada.")
            return
        put_pengumuman(slug, judul, isi, date)
        tg_send(
            chat_id,
            f"<b>Berhasil.</b> Pengumuman \"{esc(judul)}\" sudah masuk ke web.",
            "HTML",
        )
        return

    # Dokumen / foto -> tugas
    if msg.get("document") or msg.get("photo"):
        caption = msg.get("caption") or ""
        if "|" in caption:
            mapel, judul = [p.strip() for p in caption.split("|", 1)]
        else:
            mapel, judul = "Umum", caption.strip()
        if not judul:
            tg_send(chat_id, "Caption kurang lengkap. Format: <code>mapel | judul</code>", "HTML")
            return
        judul = judul or "Tugas Baru"
        mapel = mapel or "Umum"

        tg_send(chat_id, "Mengunggah file... tunggu sebentar.")

        file_id = None
        if msg.get("document"):
            file_id = msg["document"]["file_id"]
            hint = msg["document"].get("file_name") or "file"
        else:
            file_id = msg["photo"][-1]["file_id"]
            hint = "foto.jpg"

        try:
            name, data = tg_download(file_id)
        except Exception as e:
            tg_send(chat_id, "Gagal download file: " + esc(str(e)))
            return

        if len(data) > MAX_FILE_MB * 1024 * 1024:
            tg_send(chat_id, f"File terlalu besar. Maksimal {MAX_FILE_MB} MB.")
            return

        safe = re.sub(r"[^a-z0-9._-]+", "-", hint.lower())
        slug = slugify(judul)
        deadline = (datetime.date.today() + datetime.timedelta(days=7)).isoformat()

        try:
            gh_put_file(f"docs/{safe}", data, f'Bot: upload dokumen "{safe}"')
            put_tugas(None, slug, judul, mapel, safe, deadline, extra_body=judul)
        except Exception as e:
            tg_send(chat_id, "Gagal upload: " + esc(str(e)))
            return

        tg_send(
            chat_id,
            "<b>Berhasil.</b> Tugas sudah masuk ke web.\n\n"
            f"Mapel: <b>{esc(mapel)}</b>\n"
            f"Judul: <b>{esc(judul)}</b>\n"
            f"File: <code>{esc(safe)}</code>\n"
            f"Tenggat: <code>{deadline}</code>\n\n"
            "Web akan update dalam 1-2 menit.",
            "HTML",
        )
        return

    # fallback
    tg_send(
        chat_id,
        "Kirim <b>file PDF/foto</b> dengan caption <code>mapel | judul</code>,\n"
        "atau <code>/pengumuman judul | isi</code>.",
        "HTML",
    )


# ============================================================
# main: poll getUpdates
# ============================================================
def main():
    if not TG_TOKEN:
        print("TG_BOT_TOKEN kosong, skip.")
        return 0

    # Hapus webhook lama (worker mati) supaya getUpdates jalan
    http_post_json(f"{TG_API}/deleteWebhook", {"drop_pending_updates": False})

    j = http_get_json(f"{TG_API}/getUpdates?timeout=0")
    if not j.get("ok"):
        print("getUpdates gagal:", j)
        return 1

    updates = j.get("result") or []
    print(f"[bot] {len(updates)} update diterima")
    processed = 0

    for u in updates:
        msg = u.get("message")
        if not msg:
            continue
        try:
            handle_message(msg)
            processed += 1
        except Exception as e:
            print("[bot] error:", e)

    # konfirmasi semua update supaya tidak diproses ulang
    if updates:
        last = updates[-1]["update_id"] + 1
        http_get_json(f"{TG_API}/getUpdates?offset={last}&timeout=0")

    print(f"[bot] selesai, {processed} pesan diproses")
    # exit code 3 = ada perubahan (untuk langkah deploy)
    return 0


if __name__ == "__main__":
    sys.exit(main())
