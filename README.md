# Website Kelas XII PEMESINAN 1

Website kelas untuk informasi tugas, pengumuman, dan dokumen - di-host gratis di **GitHub Pages**, dengan panel admin **Decap CMS**.

## Struktur

```
.
├── index.html # Beranda
├── tugas.html # Daftar tugas
├── pengumuman.html # Pengumuman
├── profil.html # Profil kelas
├── css/style.css # Stylesheet
├── js/app.js # Logika frontend
├── data/*.json # Hasil build (auto-generated, jangan edit manual)
├── content/ # Sumber konten (markdown)
│ ├── tugas/ # Satu file .md = satu tugas
│ ├── pengumuman/ # Satu file .md = satu pengumuman
│ └── profil.md # Profil kelas
├── docs/ # Dokumen yang di-upload admin (PDF/foto)
├── scripts/build.py # Generator data/*.json
├── admin/ # Panel admin Decap CMS
└── .github/workflows/deploy.yml # Auto-deploy
```

## Setup (sekali saja)

### 1. Buat repository & push

```bash
git init
git add .
git commit -m "Website Kelas XII PEMESINAN 1"
git branch -M main
git remote add origin https://github.com/USERNAME/kelas-xii-pemesinan-1.git
git push -u origin main
```

### 2. Aktifkan GitHub Pages

Buka repo di GitHub > **Settings** > **Pages** > **Build and deployment**:
- Source: **GitHub Actions** (bukan "Deploy from a branch")

Workflow `.github/workflows/deploy.yml` akan otomatis jalan setiap ada push ke `main`. Hasilnya: `https://USERNAME.github.io/kelas-xii-pemesinan-1/`

### 3. Buat GitHub OAuth App

Buka **https://github.com/settings/developers** > **OAuth Apps** > **New OAuth App**:

| Field | Isi |
| --- | --- |
| Application name | `Kelas XII Pemesinan 1 CMS` |
| Homepage URL | `https://USERNAME.github.io/kelas-xii-pemesinan-1/` |
| Authorization callback URL | `https://USERNAME.github.io/kelas-xii-pemesinan-1/admin/` |

Catat **Client ID** dan **Client Secret**.

### 4. Deploy OAuth proxy (Cloudflare Worker) - gratis

GitHub tidak mengizinkan login OAuth langsung dari halaman web statis, jadi butuh proxy kecil. Cloudflare Workers gratis (100.000 request/hari, tanpa kartu kredit).

1. Daftar / login di **https://dash.cloudflare.com** > **Workers & Pages** > **Create**
2. Buat Worker baru, beri nama (misal: `kelas-oauth`), deploy.
3. Buka **Settings > Variables and Secrets**, tambahkan:

 | Variable name | Value |
 | --- | --- |
 | `GITHUB_CLIENT_ID` | Client ID dari langkah 3 |
 | `GITHUB_CLIENT_SECRET` | Client Secret dari langkah 3 |

4. Edit kode Worker, replace semua dengan `worker/oauth-worker.js` dari repo ini, **Save and Deploy**.

 URL Worker: `https://kelas-oauth.workers.dev`

### 5. Update konfigurasi admin

Edit `admin/config.yml`, ganti 2 baris ini:

```yaml
backend:
 name: github
 repo: USERNAME/kelas-xii-pemesinan-1 # username & repo kamu
 base_url: https://kelas-oauth.workers.dev # URL Worker dari langkah 4
```

### 6. Login admin

Buka `https://USERNAME.github.io/kelas-xii-pemesinan-1/admin/` > **Login with GitHub**.

Selesai. Setiap admin menambah/mengubah konten, Decap CMS commit ke repo, GitHub Actions rebuild, dan GitHub Pages update otomatis dalam 1-2 menit.

## Cara admin menambah tugas / pengumuman

1. Buka `https://USERNAME.github.io/kelas-xii-pemesinan-1/admin/`
2. Login dengan akun GitHub
3. Pilih **Tugas** > **New Tugas** > isi form > **Publish**
4. Upload dokumen PDF lewat field **Dokumen Pendukung** - tersimpan di folder `docs/`
5. Tunggu 1-2 menit, halaman user ikut ter-update

## Development lokal

```bash
# Generate data JSON dari content/
python scripts/build.py

# Jalankan server lokal
python -m http.server 8000

# Buka http://localhost:8000
```

## Catatan

- `data/*.json` hasil build - **jangan edit manual**, akan ditimpa. Edit lewat `/admin` atau langsung file di `content/`.
- Dokumen upload tersimpan di `docs/` - untuk file besar (>50MB) pertimbangkan Google Drive dan taruh link saja di body.
- Folder `content/` bisa juga diedit manual di GitHub.com kalau admin lebih suka teks editor.
