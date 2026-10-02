/**
 * OAuth Proxy untuk Decap CMS - Cloudflare Worker
 *
 * Diperlukan karena GitHub tidak mengizinkan OAuth login langsung
 * dari halaman web statis (GitHub Pages). Worker ini hanya bertugas
 * mengarahkan ke GitHub dan menukar kode menjadi access token.
 *
 * PROTOKOL: Decap CMS membuka popup ke /auth, lalu popup ini
 * mengirim token kembali via window.postMessage dengan format:
 * "authorization:github:success:{json}"
 *
 * SETUP:
 * 1. Buat Worker di https://dash.cloudflare.com > Workers & Pages
 * 2. Settings > Variables and Secrets, tambahkan:
 * GITHUB_CLIENT_ID = Client ID OAuth App kamu
 * GITHUB_CLIENT_SECRET = Client Secret OAuth App kamu
 * 3. Replace kode Worker dengan file ini, Save and Deploy
 *
 * Di OAuth App GitHub (https://github.com/settings/developers),
 * Authorization callback URL = URL Worker ini + "/callback"
 * contoh: https://kelas-oauth.workers.dev/callback
 *
 * Di admin/config.yml:
 * backend:
 * name: github
 * repo: USERNAME/kelas-xii-pemesinan-1
 * base_url: https://kelas-oauth.workers.dev # URL Worker ini
 * auth_endpoint: auth
 */

const ALLOWED_ORIGINS = [
 "https://USERNAME.github.io", // GANTI: domain GitHub Pages kamu
 "http://localhost:8000", // untuk development lokal
];

export default {
 async fetch(request, env) {
 const url = new URL(request.url);

 if (url.pathname === "/auth") return handleAuth(url, request, env);
 if (url.pathname === "/callback") return handleCallback(url, request, env);

 return new Response(JSON.stringify({ ok: true, service: "decap-oauth-proxy" }), {
 headers: { "Content-Type": "application/json" },
 });
 },
};

// ---------------- /auth ----------------
async function handleAuth(url, request, env) {
 const provider = url.searchParams.get("provider");
 if (provider !== "github") {
 return new Response("Provider tidak didukung", { status: 400 });
 }

 const scope = url.searchParams.get("scope") || "repo";
 // redirect_uri harus absolut & terdaftar di OAuth App GitHub.
 // Default: callback di Worker ini sendiri.
 const host = request.headers.get("host") || url.host;
 const redirectUri = `https://${host}/callback`;

 const gh = new URL("https://github.com/login/oauth/authorize");
 gh.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
 gh.searchParams.set("redirect_uri", redirectUri);
 gh.searchParams.set("scope", scope);
 gh.searchParams.set("state", randomState());

 return Response.redirect(gh.toString(), 302);
}

// ---------------- /callback ----------------
async function handleCallback(url, request, env) {
 const code = url.searchParams.get("code");
 if (!code) {
 return popupResponse("error", { message: "Kode otorisasi tidak ditemukan." });
 }

 const host = request.headers.get("host") || url.host;
 const redirectUri = `https://${host}/callback`;

 const res = await fetch("https://github.com/login/oauth/access_token", {
 method: "POST",
 headers: {
 Accept: "application/json",
 "Content-Type": "application/json",
 },
 body: JSON.stringify({
 client_id: env.GITHUB_CLIENT_ID,
 client_secret: env.GITHUB_CLIENT_SECRET,
 code,
 redirect_uri: redirectUri,
 }),
 });

 const data = await res.json();

 if (data.error) {
 return popupResponse("error", { message: data.error_description || data.error });
 }

 return popupResponse("success", {
 token: data.access_token,
 provider: "github",
 });
}

// ---------------- helpers ----------------

// Halaman popup yang mengirim token ke window pembuka (Decap CMS)
// lewat postMessage, sesuai protokol NetlifyAuthenticator.
function popupResponse(status, payload) {
 const json = JSON.stringify(payload).replace(/</g, "\\u003c");
 const msg = `authorization:github:${status}:${json}`;
 const color = status === "success" ? "#1e8e3e" : "#d93025";

 const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Menutup...</title></head>
<body style="font-family:system-ui,Arial,sans-serif;text-align:center;padding:40px 20px;color:#202124">
 <p style="font-size:1.1rem;font-weight:600;color:${color}">
 ${status === "success" ? " Berhasil masuk" : " Gagal masuk"}
 </p>
 <p style="color:#5f6368;font-size:0.9rem">Jendela ini akan tertutup otomatis...</p>
 <script>
 const msg = ${JSON.stringify(msg)};
 try {
 window.opener.postMessage(msg, "*");
 window.opener.postMessage("authorizing:github", "*");
 } catch (e) {}
 setTimeout(function () { window.close(); }, 1500);
 </script>
</body>
</html>`;

 return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

function randomState() {
 const buf = new Uint8Array(8);
 crypto.getRandomValues(buf);
 return Array.from(buf)
 .map((b) => b.toString(16).padStart(2, "0"))
 .join("");
}
