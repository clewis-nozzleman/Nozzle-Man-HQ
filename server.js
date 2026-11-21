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
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', 'Referrer-Policy':'same-origin', 'Cache-Control':'no-store, no-cache, must-revalidate, proxy-revalidate', 'Pragma':'no-cache', 'Expires':'0', 'Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data:; base-uri 'self'; form-action 'self'; frame-ancestors 'none'", ...headers });
  res.end(body);
}
function redirect(res, location, headers={}) { res.writeHead(303, { Location: location, ...headers }); res.end(); }
function readBody(req) { return new Promise((resolve, reject) => { let data=''; req.on('data', c => { data += c; if(data.length > 10000) reject(new Error('too large')); }); req.on('end', () => resolve(new URLSearchParams(data))); req.on('error', reject); }); }
const loginPage = `<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nozzle Man HQ — Sign in</title><link rel="stylesheet" href="/style.css"></head><body class="login-bg"><main class="login-card"><div class="brand-mark">NM</div><p class="eyebrow">NOZZLE MAN EXTERIOR SERVICES</p><h1>Nozzle Man <span>HQ</span></h1><p class="muted">Your private business command center.</p><form method="post" action="/login"><label for="email">Owner email</label><input id="email" name="email" type="email" value="${OWNER_EMAIL.replace(/[&<>"']/g,'')}" required autocomplete="username"><label for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password"><button class="primary full" type="submit">Sign in <span>→</span></button><p class="login-note">Owner access only. Your session expires after 12 hours.</p></form></main></body></html>`;
const appPage = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nozzle Man HQ</title><link rel="stylesheet" href="/style.css"></head><body><div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">NM</div><div><b>NOZZLE MAN</b><small>EXTERIOR SERVICES</small></div></div><div class="workspace-label">WORKSPACE</div><nav id="nav"><button class="nav-item active" data-page="overview">▦ <span>Overview</span></button><button class="nav-item" data-page="employees">♙ <span>Employees</span></button><button class="nav-item" data-page="sales">↗ <span>Sales & leads</span></button><button class="nav-item" data-page="marketing">◎ <span>Marketing</span></button><button class="nav-item" data-page="approvals">◷ <span>Approval center</span><i class="dot"></i></button><button class="nav-item" data-page="operations">▤ <span>Operations</span></button><button class="nav-item" data-page="schedule">▦ <span>Scheduling</span></button><button class="nav-item" data-page="finance">＄ <span>Finance</span></button><button class="nav-item" data-page="reports">▥ <span>Reports</span></button></nav><div class="sidebar-bottom"><div class="status"><span class="status-dot"></span> HQ online</div><div class="owner"><div class="avatar">CL</div><div><b>Owner</b><small>Private workspace</small></div><form method="post" action="/logout"><button class="logout" title="Sign out">↗</button></form></div></div></aside><main class="main"><header class="topbar"><div><span class="crumb">WORKSPACE /</span> <b id="top-title">Overview</b></div><div class="top-right"><span class="live-pill"><i></i> SYSTEM READY</span><span class="date" id="today"></span></div></header><section class="content"><div class="welcome"><div><p class="eyebrow">OWNER DASHBOARD</p><h1 id="page-title">Good to have you back.</h1><p class="muted" id="page-subtitle">Here's the current pulse of Nozzle Man Exterior Services.</p></div><div class="welcome-actions"><button class="secondary" id="refresh">↻ Refresh</button><button class="primary" id="new-lead">＋ Add lead</button></div></div><div id="page-content"></div><footer>NOZZLE MAN HQ <span>•</span> PRIVATE OWNER WORKSPACE <span class="footer-right">Version 1.0 · Early access</span></footer></section></main></div><script src="/app.js"></script></body></html>`;
const server = http.createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res,200,JSON.stringify({ok:true,app:'nozzle-man-hq'}),'application/json');
  if (req.method === 'GET' && url.pathname === '/google/status') {
    if (!authenticated(req)) return redirect(res, '/login');
    const clientId = process.env.GOOGLE_CLIENT_ID || '';
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://nozzle-man-hq.onrender.com/google/callback';
    const safeId = clientId.replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
    return send(res, 200, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google setup check</title></head><body style="font:16px system-ui;max-width:700px;margin:40px auto;padding:0 20px"><h2>Nozzle Man HQ — Google setup check</h2><p><b>Client ID currently loaded by HQ:</b></p><textarea readonly style="width:100%;min-height:75px;box-sizing:border-box;padding:10px">${safeId || 'MISSING'}</textarea><p><b>Client secret:</b> ${process.env.GOOGLE_CLIENT_SECRET ? 'Present (hidden)' : 'MISSING'}</p><p><b>Redirect URI:</b> ${redirectUri}</p><p>Compare the Client ID above with the Client ID shown in Google Cloud for the Nozzle Man HQ project. Do not share your client secret.</p><p><a href="/">Back to HQ</a></p></body></html>`);
  }
  if (req.method === 'GET' && url.pathname === '/google/connect') {
    if (!authenticated(req)) return redirect(res, '/login');
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://nozzle-man-hq.onrender.com/google/callback';
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET) return send(res, 503, '<!doctype html><meta name="viewport" content="width=device-width"><h2>Google connection is not configured yet</h2><p>Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Render environment settings, then try again.</p><p><a href="/">Back to HQ</a></p>');
    const state = crypto.randomBytes(32).toString('hex');
    const stateSig = sign('google:'+state);
    const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    auth.search = new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',scope:'https://www.googleapis.com/auth/gmail.send',access_type:'offline',prompt:'consent',include_granted_scopes:'true',state}).toString();
    return redirect(res, auth.toString(), {'Set-Cookie':`nm_google_state=${state}.${stateSig}; HttpOnly; Secure; SameSite=Lax; Path=/google; Max-Age=600`});
  }
  if (req.method === 'GET' && url.pathname === '/google/callback') {
    if (!authenticated(req)) return redirect(res, '/login');
    const stateCookie = cookieValue(req, 'nm_google_state');
    const [savedState, savedSig] = stateCookie.split('.');
    const incomingState = url.searchParams.get('state') || '';
    const clearState = 'nm_google_state=; HttpOnly; Secure; SameSite=Lax; Path=/google; Max-Age=0';
    if (!savedState || !savedSig || !safeEqual(savedState, incomingState) || !safeEqual(savedSig, sign('google:'+savedState))) return send(res, 400, '<h2>Authorization check failed</h2><p>Return to HQ and start the connection again.</p>', 'text/html; charset=utf-8', {'Set-Cookie':clearState});
    if (url.searchParams.get('error')) return send(res, 400, '<h2>Google authorization was not completed</h2><p>You can close this page and try again from HQ.</p>', 'text/html; charset=utf-8', {'Set-Cookie':clearState});
    const code = url.searchParams.get('code');
    if (!code) return send(res, 400, 'Missing authorization code', 'text/plain', {'Set-Cookie':clearState});
    try {
      const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'https://nozzle-man-hq.onrender.com/google/callback';
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code,client_id:process.env.GOOGLE_CLIENT_ID,client_secret:process.env.GOOGLE_CLIENT_SECRET,redirect_uri:redirectUri,grant_type:'authorization_code'})});
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || tokens.error || 'Google token exchange failed');
      if (!tokens.refresh_token) return send(res, 502, '<h2>Google did not return a refresh token</h2><p>Try again after removing the app access from your Google Account permissions, then reconnect.</p><p><a href="/google/connect">Try again</a></p>', 'text/html; charset=utf-8', {'Set-Cookie':clearState});
      const token = String(tokens.refresh_token).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
      return send(res, 200, `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Finish Gmail connection</title></head><body style="font:16px system-ui;max-width:680px;margin:48px auto;padding:0 20px"><h1>Google authorization successful</h1><p>One final secure setup step: copy this refresh token into your Render environment variable named <b>GOOGLE_REFRESH_TOKEN</b>. Do not email it or share it in chat. Then redeploy HQ.</p><textarea readonly style="width:100%;min-height:110px;box-sizing:border-box;padding:12px">${token}</textarea><p><button onclick="navigator.clipboard.writeText(document.querySelector('textarea').value)">Copy refresh token</button></p><p>After saving it in Render, delete this browser page from your history if this is a shared device.</p><p><a href="/">Return to Nozzle Man HQ</a></p></body></html>`, 'text/html; charset=utf-8', {'Set-Cookie':clearState,'Referrer-Policy':'no-referrer'});
    } catch (err) {
      return send(res, 502, '<h2>Could not finish Google authorization</h2><p>Check the OAuth client settings and try again from HQ.</p>', 'text/html; charset=utf-8', {'Set-Cookie':clearState});
    }
  }
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
