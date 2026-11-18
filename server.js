'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'owner@nozzlemanexteriors.com';
if (!OWNER_PASSWORD || OWNER_PASSWORD.length < 14 || !SESSION_SECRET || SESSION_SECRET.length < 32) {
  console.error('Set OWNER_PASSWORD (14+ characters) and SESSION_SECRET (32+ characters) environment variables.');
  process.exit(1);
}

const publicDir = path.join(__dirname, 'public');
const safeEqual = (a, b) => {
  const aa = Buffer.from(String(a)); const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
};
const sign = value => crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
function cookieValue(req, name) {
  const raw = req.headers.cookie || '';
  const part = raw.split(';').map(x => x.trim()).find(x => x.startsWith(name + '='));
  return part ? decodeURIComponent(part.slice(name.length + 1)) : '';
}
function authenticated(req) {
  const token = cookieValue(req, 'nm_session');
  if (!token) return false;
  const [expires, sig] = token.split('.');
  if (!expires || !sig || Number(expires) < Date.now()) return false;
  return safeEqual(sign(expires), sig);
}
function send(res, status, body, type='text/html; charset=utf-8', headers={}) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'same-origin', 'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'", ...headers });
  res.end(body);
}
function redirect(res, location, headers={}) { res.writeHead(303, { Location: location, ...headers }); res.end(); }
function readBody(req) { return new Promise((resolve, reject) => { let data=''; req.on('data', c => { data += c; if(data.length > 10000) reject(new Error('too large')); }); req.on('end', () => resolve(new URLSearchParams(data))); req.on('error', reject); }); }
const loginPage = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nozzle Man HQ — Sign in</title><link rel="stylesheet" href="/style.css"></head><body class="login-bg"><main class="login-card"><div class="brand-mark">NM</div><p class="eyebrow">NOZZLE MAN EXTERIOR SERVICES</p><h1>Nozzle Man <span>HQ</span></h1><p class="muted">Your private business command center.</p><form method="post" action="/login"><label for="email">Owner email</label><input id="email" name="email" type="email" value="${OWNER_EMAIL.replace(/[&<>"']/g,'')}" required autocomplete="username"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password"><button class="primary full" type="submit">Sign in <span>→</span></button><p class="login-note">Owner access only. Your session expires after 12 hours.</p></form></main></body></html>`;
const appPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nozzle Man HQ</title><link rel="stylesheet" href="/style.css"></head><body><div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">NM</div><div><b>NOZZLE MAN</b><small>EXTERIOR SERVICES</small></div></div><div class="workspace-label">WORKSPACE</div><nav id="nav"><button class="nav-item active" data-page="overview">▦ <span>Overview</span></button><button class="nav-item" data-page="sales">↗ <span>Sales & leads</span></button><button class="nav-item" data-page="marketing">◎ <span>Marketing</span></button><button class="nav-item" data-page="approvals">◷ <span>Approval center</span><i class="dot"></i></button><button class="nav-item" data-page="operations">▤ <span>Operations</span></button><button class="nav-item" data-page="schedule">▦ <span>Scheduling</span></button><button class="nav-item" data-page="finance">＄ <span>Finance</span></button><button class="nav-item" data-page="reports">▥ <span>Reports</span></button></nav><div class="sidebar-bottom"><div class="status"><span class="status-dot"></span> HQ online</div><div class="owner"><div class="avatar">CL</div><div><b>Owner</b><small>Private workspace</small></div><form method="post" action="/logout"><button class="logout" title="Sign out">↗</button></form></div></div></aside><main class="main"><header class="topbar"><div><span class="crumb">WORKSPACE /</span> <b id="top-title">Overview</b></div><div class="top-right"><span class="live-pill"><i></i> SYSTEM READY</span><span class="date" id="today"></span></div></header><section class="content"><div class="welcome"><div><p class="eyebrow">OWNER DASHBOARD</p><h1 id="page-title">Good to have you back.</h1><p class="muted" id="page-subtitle">Here's the current pulse of Nozzle Man Exterior Services.</p></div><div class="welcome-actions"><button class="secondary" id="refresh">↻ Refresh</button><button class="primary" id="new-lead">＋ Add lead</button></div></div><div id="page-content"></div><footer>NOZZLE MAN HQ <span>•</span> PRIVATE OWNER WORKSPACE <span class="footer-right">Version 1.0 · Early access</span></footer></section></main></div><script src="/app.js"></script></body></html>`;
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res,200,JSON.stringify({ok:true,app:'nozzle-man-hq'}),'application/json');
  if (req.method === 'GET' && url.pathname === '/login') return send(res,200,loginPage);
  if (req.method === 'POST' && url.pathname === '/login') {
    try { const body = await readBody(req); const okEmail = safeEqual((body.get('email')||'').trim().toLowerCase(), OWNER_EMAIL.toLowerCase()); const okPass = safeEqual(body.get('password')||'', OWNER_PASSWORD); if (!okEmail || !okPass) return send(res,401,loginPage.replace('<form method="post"', '<p class="error">Email or password is incorrect.</p><form method="post"')); const exp = String(Date.now()+12*60*60*1000); const token = exp+'.'+sign(exp); return redirect(res,'/',{'Set-Cookie':`nm_session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=43200`}); } catch { return send(res,400,'Bad request'); }
  }
  if (req.method === 'POST' && url.pathname === '/logout') return redirect(res,'/login',{'Set-Cookie':'nm_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
  if (!authenticated(req)) return redirect(res,'/login');
  if (req.method === 'GET' && url.pathname === '/') return send(res,200,appPage);
  if (req.method === 'GET' && url.pathname.startsWith('/')) {
    const name = url.pathname === '/app.js' ? 'app.js' : url.pathname === '/style.css' ? 'style.css' : null;
    if (name) { const file=path.join(publicDir,name); return send(res,200,fs.readFileSync(file),name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8'); }
  }
  return send(res,404,'Not found','text/plain');
});
server.listen(PORT,'0.0.0.0',()=>console.log(`Nozzle Man HQ listening on ${PORT}`));
