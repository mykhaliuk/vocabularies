// Self-contained offline page returned by the service worker's catch handler.
// Inlined (not precached) so there is no precache-URL mismatch, and not a Nuxt
// page so the SPA router can't re-route it. No external CSS/JS/fonts — works
// with zero network. Mirrors the design of pages/offline.vue.
export const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Offline · Vocabu</title>
<meta name="robots" content="noindex" />
<style>
:root{--bg:#fbfeff;--sunk:#f1f4f6;--text:#1b1d1e;--muted:#61676c;--faint:#969ba1;--border:#dadee1}
@media(prefers-color-scheme:dark){:root{--bg:#0e1417;--sunk:#0a1012;--text:#eaf1f2;--muted:#9aa7ab;--faint:#6a757a;--border:#313d41}}
*{box-sizing:border-box}html,body{margin:0;height:100%}
body{min-height:100dvh;display:flex;align-items:center;justify-content:center;text-align:center;padding:0 36px;background:var(--bg);color:var(--text);font-family:'Rubik',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:320px}
.icon{width:88px;height:88px;border-radius:50%;margin:0 auto 24px;background:var(--sunk);color:var(--faint);display:flex;align-items:center;justify-content:center}
h1{margin:0;font-size:25px;font-weight:700;letter-spacing:-0.01em}
p{margin:12px 0 0;font-size:16px;line-height:1.5;color:var(--muted)}
button{margin-top:24px;font:inherit;font-size:16px;font-weight:600;color:var(--text);background:var(--bg);border:1.5px solid var(--border);border-radius:12px;min-height:48px;padding:0 22px;cursor:pointer}
button:active{transform:scale(0.97)}
.note{margin-top:16px;font-size:14px;color:var(--faint);min-height:1.3em}
</style>
</head>
<body>
<main class="wrap">
<div class="icon" aria-hidden="true">
<svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m2 2 20 20"/><path d="M5.8 11.3A5 5 0 0 0 7 21h10a5 5 0 0 0 1.7-.3"/><path d="M9.5 5.5A7 7 0 0 1 19 11a4.5 4.5 0 0 1 1.9.6"/></svg>
</div>
<h1>You're offline</h1>
<p>Your words are safe — kept right here. We'll sync the moment you're back.</p>
<button type="button" id="retry">Try again</button>
<p class="note" id="note" role="status" aria-live="polite"></p>
</main>
<script>
(function(){var b=document.getElementById('retry'),n=document.getElementById('note');
b.addEventListener('click',function(){if(navigator.onLine===false){n.textContent="Still no signal. We'll be here when you're back.";return}n.textContent='';location.reload()});
window.addEventListener('online',function(){n.textContent='Back online — reloading…';location.reload()});})();
</script>
</body>
</html>`;
