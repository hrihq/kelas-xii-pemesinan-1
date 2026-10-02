// ============================================================
// Web Kelas XII PEMESINAN 1 - logika frontend (static site)
// Data di-fetch dari data/*.json yang di-generate otomatis
// oleh scripts/build.py (dijalankan GitHub Actions).
// ============================================================

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];

// Ambil data JSON
async function fetchJSON(path) {
 const res = await fetch(path, { cache: "no-store" });
 if (!res.ok) throw new Error(`Gagal memuat ${path} (${res.status})`);
 return res.json();
}

// Parse tanggal "YYYY-MM-DD" -> { day, month, iso, obj }
function parseDate(iso) {
 if (!iso) return null;
 const d = new Date(iso + "T00:00:00");
 if (isNaN(d)) return null;
 return {
 day: String(d.getDate()).padStart(2, "0"),
 month: MONTHS[d.getMonth()],
 iso,
 obj: d,
 };
}

function esc(s) {
 if (s === null || s === undefined) return "";
 return String(s)
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;")
 .replace(/"/g, "&quot;")
 .replace(/'/g, "&#039;");
}

// Icon dokumen (SVG, tanpa emoji)
const DOC_ICON = `<svg class="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>`;

// Icon download
const DOWNLOAD_ICON = `<svg class="doc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`;

// Cek apakah lampiran adalah gambar (untuk preview)
function isImage(path) {
 if (!path) return false;
 return /\.(jpg|jpeg|png|webp|gif|bmp|svg)$/i.test(path);
}

// Deadline pill untuk tugas
function deadlinePill(deadline) {
 if (!deadline) return "";
 const d = parseDate(deadline);
 if (!d) return "";
 const today = new Date();
 today.setHours(0, 0, 0, 0);
 const diff = Math.round((d.obj - today) / 86400000);

 if (diff < 0) return `<span class="pill pill-bad"><span class="pdot"></span>Lewat ${diff * -1} hari</span>`;
 if (diff === 0) return `<span class="pill pill-bad"><span class="pdot"></span>Jatuh tempo hari ini</span>`;
 if (diff <= 3) return `<span class="pill pill-warn"><span class="pdot"></span>${diff} hari lagi</span>`;
 return `<span class="pill pill-ok"><span class="pdot"></span>${diff} hari lagi</span>`;
}

// Status pill
function statusPill(status) {
 const s = (status || "").toLowerCase();
 if (s === "selesai") return `<span class="pill pill-ok"><span class="pdot"></span>Selesai</span>`;
 if (s === "ditunda") return `<span class="pill pill-warn"><span class="pdot"></span>Ditunda</span>`;
 if (s === "aktif" || s === "berlangsung") return `<span class="pill pill-caramel"><span class="pdot"></span>Aktif</span>`;
 return `<span class="pill pill-caramel"><span class="pdot"></span>${esc(status || "Aktif")}</span>`;
}

// Nama file saja dari path
function baseName(path) {
 if (!path) return "";
 return path.split("/").pop();
}

// Skeleton loading (lebih bagus dari spinner)
function showSkeleton(el, count = 3) {
 el.innerHTML = Array.from({ length: count })
 .map(
 () => `<div class="skel">
 <div class="sk" style="width:62px;height:62px;flex-shrink:0;border-radius:12px"></div>
 <div style="flex:1;display:flex;flex-direction:column;gap:9px">
 <div class="sk" style="width:38%;height:13px"></div>
 <div class="sk" style="width:72%;height:19px"></div>
 <div class="sk" style="width:90%;height:13px"></div>
 </div>
 </div>`
 )
 .join("");
}

// Tampilkan empty state
function showEmpty(el, title, msg) {
 el.innerHTML = `<div class="empty-state"><div class="glyph">Kosong</div><h3>${esc(
 title
 )}</h3><p>${esc(msg)}</p></div>`;
}

// Tampilkan error
function showError(el, msg) {
 el.innerHTML = `<div class="empty-state"><div class="glyph">Gagal</div><h3>Tidak dapat memuat data</h3><p>${esc(
 msg
 )}</p><p style="margin-top:10px;font-size:0.85rem">Coba muat ulang halaman, atau hubungi admin kelas.</p></div>`;
}

// ============================================================
// RENDER PENGUMUMAN
// ============================================================
function renderPengumumanList(el, items, limit = 0) {
 if (!items || items.length === 0) {
 showEmpty(el, "Belum ada pengumuman", "Pengumuman akan muncul di sini setelah admin mempostingnya.");
 return;
 }

 let list = [...items].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
 if (limit > 0) list = list.slice(0, limit);

 el.innerHTML = list
 .map((item) => {
 const d = parseDate(item.date);
 return `
 <article class="list-item hoverable reveal" data-type="pengumuman" data-slug="${esc(item.slug)}" style="cursor:pointer">
 <div class="date-box">
 <span class="day">${d ? d.day : "--"}</span>
 <span class="month">${d ? d.month : ""}</span>
 </div>
 <div class="content">
 <div class="meta-row">
 ${statusPill(item.status)}
 <span class="sep">&middot;</span>
 <span>${esc(item.author || "Admin")}</span>
 </div>
 <h3>${esc(item.title)}</h3>
 <p class="desc">${esc(item.excerpt || "")}</p>
 <div class="meta-row">
 <span>${d ? formatLongDate(d.iso) : "-"}</span>
 ${
 item.document
 ? `<a class="doc-link" href="${esc(item.document)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
 ${DOC_ICON}
 ${esc(baseName(item.document))}
 </a>`
 : ""
 }
 </div>
 </div>
 </article>`;
 })
 .join("");
}

// ============================================================
// RENDER TUGAS
// ============================================================
function renderTugasList(el, items, limit = 0, filterMapel = "") {
 if (!items || items.length === 0) {
 showEmpty(el, "Belum ada tugas", "Daftar tugas akan muncul di sini setelah admin menambahkannya.");
 return;
 }

 let list = [...items];
 if (filterMapel && filterMapel !== "semua") {
 list = list.filter((t) => (t.mapel || "").toLowerCase() === filterMapel.toLowerCase());
 }
 list.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999"));
 if (limit > 0) list = list.slice(0, limit);

 if (list.length === 0) {
 showEmpty(el, "Tidak ada tugas untuk mapel ini", "Pilih mata pelajaran lain pada filter di atas.");
 return;
 }

 el.innerHTML = list
 .map((item) => {
 const d = parseDate(item.deadline);
 return `
 <article class="list-item hoverable reveal" data-type="tugas" data-slug="${esc(item.slug)}" style="cursor:pointer">
 <div class="date-box">
 <span class="day">${d ? d.day : "--"}</span>
 <span class="month">${d ? d.month : ""}</span>
 </div>
 <div class="content">
 <div class="meta-row">
 <span class="pill pill-sage"><span class="pdot"></span>${esc(item.mapel || "Umum")}</span>
 ${deadlinePill(item.deadline)}
 </div>
 <h3>${esc(item.title)}</h3>
 <p class="desc">${esc(item.excerpt || "")}</p>
 <div class="meta-row">
 <span>Dikumpulkan: <strong>${d ? formatLongDate(d.iso) : "Belum ditentukan"}</strong></span>
 <span class="sep">&middot;</span>
 <span>${esc(item.teacher || "-")}</span>
 ${
 item.document
 ? `<a class="doc-link" href="${esc(item.document)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
 ${DOC_ICON}
 ${esc(baseName(item.document))}
 </a>`
 : ""
 }
 </div>
 </div>
 </article>`;
 })
 .join("");
}

// ============================================================
// MARKDOWN -> HTML (subset aman, untuk body tugas/pengumuman)
// ============================================================
function renderMarkdown(md) {
 if (!md) return "";
 let s = String(md);

 // Escape dulu agar tidak ada HTML mentah yang lolos
 s = s
 .replace(/&/g, "&amp;")
 .replace(/</g, "&lt;")
 .replace(/>/g, "&gt;");

 // Tabel (sederhana: header | pemisah | baris)
 s = s.replace(
 /^(\|.+\|)\n(\|[ :|-]+\|)\n((?:\|.+\|\n?)+)/gm,
 (match, headerRow, _sep, bodyRows) => {
 const ths = splitRow(headerRow).map((c) => `<th>${c.trim()}</th>`).join("");
 const trs = bodyRows
 .trim()
 .split("\n")
 .map((row) => {
 const tds = splitRow(row).map((c) => `<td>${c.trim()}</td>`).join("");
 return `<tr>${tds}</tr>`;
 })
 .join("");
 return `<div style="overflow-x:auto"><table>\n<thead><tr>${ths}</tr></thead>\n<tbody>${trs}</tbody>\n</table></div>`;
 }
 );

 // Heading
 s = s.replace(/^###\s+(.+)$/gm, "<h5>$1</h5>");
 s = s.replace(/^##\s+(.+)$/gm, "<h4>$1</h4>");

 // Horizontal rule
 s = s.replace(/^---+$/gm, "<hr>");

 // Bold & italic
 s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
 s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

 // List tidak berurut
 s = s.replace(/^(?:- |\* )(.+)$/gm, (m, txt) => `<li>${txt}</li>`);
 s = s.replace(/(?:^|\n)((?:<li>.+<\/li>\n?)+)/g, (m, lis) => `\n<ul>${lis}</ul>\n`);

 // List berurut - gunakan placeholder unik agar tidak bentrok dengan <li>
 s = s.replace(/^\d+\.\s+(.+)$/gm, (m, txt) => `\x00OLI\x00${txt}\x00/OLI\x00`);
 s = s.replace(/(?:^|\n)(\x00OLI\x00[^\x00]+\x00\/OLI\x00(?:\n|$))+/g, (m) => {
 const items = m
 .trim()
 .split("\n")
 .map((row) => row.replace(/\x00OLI\x00/g, "<li>").replace(/\x00\/OLI\x00/g, "</li>"))
 .join("");
 return `\n<ol>${items}</ol>\n`;
 });

 // Paragraf: baris kosong = pemisah
 return s
 .split(/\n{2,}/)
 .map((block) =>
 /^\s*<(h\d|ul|ol|hr|table|div)/.test(block) ? block : `<p>${block.trim()}</p>`
 )
 .join("\n");
}

function splitRow(row) {
 return row.replace(/^\||\|$/g, "").split("|");
}

// ============================================================
// FORMAT TANGGAL PANJANG (Indonesia)
// ============================================================
function formatLongDate(iso) {
 if (!iso) return "-";
 const d = new Date(iso + "T00:00:00");
 if (isNaN(d)) return iso;
 const namaHari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
 return `${namaHari[d.getDay()]}, ${d.getDate()} ${[
 "Januari", "Februari", "Maret", "April", "Mei", "Juni",
 "Juli", "Agustus", "September", "Oktober", "November", "Desember",
 ][d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================================
// MODAL DETAIL
// ============================================================
function openDetail(item, type) {
 const overlay = document.getElementById("modalOverlay");
 if (!overlay) return;

 const isTugas = type === "tugas";
 const d = parseDate(isTugas ? item.deadline : item.date);

 overlay.innerHTML = `
 <div class="modal">
 <div class="modal-header">
 <div>
 <div class="meta-row" style="margin-bottom:8px">
 ${isTugas ? `<span class="pill pill-sage"><span class="pdot"></span>${esc(item.mapel || "Umum")}</span>` : statusPill(item.status)}
 ${isTugas ? deadlinePill(item.deadline) : ""}
 </div>
 <h2>${esc(item.title)}</h2>
 </div>
 <button class="modal-close" onclick="closeModal()" aria-label="Tutup">&times;</button>
 </div>
 <div class="modal-body">
 <p class="desc">${esc(item.excerpt || "")}</p>
 <h4>${isTugas ? "Detail Tugas" : "Isi Pengumuman"}</h4>
 <div class="body-text">${renderMarkdown(item.body || item.excerpt || "")}</div>

 <h4>Informasi</h4>
 <p class="body-text">
 ${isTugas ? `Mata Pelajaran: <strong>${esc(item.mapel || "-")}</strong><br>` : ""}
 ${isTugas ? `Guru Pengampu: <strong>${esc(item.teacher || "-")}</strong><br>` : ""}
 ${isTugas ? "Tenggat: " : "Tanggal: "} <strong>${d ? formatLongDate(d.iso) : "-"}</strong><br>
 Diposting oleh: <strong>${esc(item.author || "Admin")}</strong>
 </p>

 ${
 isImage(item.document)
 ? `<h4>Preview Gambar</h4>
 <div class="doc-preview">
 <img src="${esc(item.document)}" alt="Lampiran ${esc(baseName(item.document))}" loading="lazy" onclick="window.open('${esc(item.document)}','_blank')" />
 </div>
 <a class="doc-link" href="${esc(item.document)}" download style="font-size:0.92rem;padding:9px 16px">
 ${DOWNLOAD_ICON} ${esc(baseName(item.document))} &middot; Download
 </a>`
 : item.document
 ? `<h4>Lampiran Dokumen</h4>
 <a class="doc-link" href="${esc(item.document)}" target="_blank" rel="noopener" download style="font-size:0.92rem;padding:9px 16px">
 ${DOWNLOAD_ICON} ${esc(baseName(item.document))} &middot; Download / Buka
 </a>`
 : ""}
 }
 </div>
 </div>`;

 overlay.classList.add("open");
 document.body.style.overflow = "hidden";
}

function closeModal() {
 const overlay = document.getElementById("modalOverlay");
 if (overlay) {
 overlay.classList.remove("open");
 overlay.innerHTML = "";
 document.body.style.overflow = "";
 }
}

// ============================================================
// SCROLL REVEAL (staggered)
// ============================================================
function revealAll() {
 const els = document.querySelectorAll(".reveal:not(.in)");
 els.forEach((el, i) => {
 setTimeout(() => el.classList.add("in"), 60 * i);
 });
 // elemen yang belum masuk viewport akan di-fade-in saat scroll
 if (!window.__REVEAL_IO__) {
 window.__REVEAL_IO__ = new IntersectionObserver(
 (entries) => {
 entries.forEach((e) => {
 if (e.isIntersecting) {
 e.target.classList.add("in");
 window.__REVEAL_IO__.unobserve(e.target);
 }
 });
 },
 { threshold: 0.08, rootMargin: "0px 0px -40px 0px" }
 );
 }
 els.forEach((el) => window.__REVEAL_IO__.observe(el));
}

// ============================================================
// SCROLL PROGRESS BAR (navbar)
// ============================================================
function setupScrollProgress() {
 const bar = document.getElementById("navProgress");
 if (!bar) return;
 const onScroll = () => {
 const h = document.documentElement;
 const scrolled = h.scrollTop;
 const total = h.scrollHeight - h.clientHeight;
 bar.style.width = total > 0 ? `${(scrolled / total) * 100}%` : "0%";
 };
 window.addEventListener("scroll", onScroll, { passive: true });
 onScroll();
}

// ============================================================
// NAV TOGGLE (mobile)
// ============================================================
function setupNav() {
 const toggle = document.querySelector(".nav-toggle");
 const links = document.querySelector(".nav-links");
 if (toggle && links) {
 toggle.addEventListener("click", () => links.classList.toggle("open"));
 links.querySelectorAll("a").forEach((a) =>
 a.addEventListener("click", () => links.classList.remove("open"))
 );
 }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
 setupNav();
 setupScrollProgress();

 // Tutup modal saat klik backdrop atau tekan Escape
 const overlay = document.getElementById("modalOverlay");
 if (overlay) {
 overlay.addEventListener("click", (e) => {
 if (e.target === overlay) closeModal();
 });
 }
 document.addEventListener("keydown", (e) => {
 if (e.key === "Escape") closeModal();
 });

 // Delegasi klik untuk list-item
 document.body.addEventListener("click", (e) => {
 const item = e.target.closest(".list-item[data-slug]");
 if (!item) return;
 const type = item.dataset.type;
 const slug = item.dataset.slug;
 const store = window.__DATA__ && window.__DATA__[type];
 if (store) {
 const found = store.find((x) => x.slug === slug);
 if (found) openDetail(found, type);
 }
 });
});
