/** Pantalla de login: HTML autocontenido (sin JS ni assets, que están detrás del login). */

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const LOGO = `<svg width="40" height="40" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8B6DFF"/><stop offset="1" stop-color="#5B3FD9"/></linearGradient></defs><rect width="32" height="32" rx="9" fill="url(#g)"/><path d="M16 26.5s-7.6-6.3-7.6-12.4a7.6 7.6 0 0 1 15.2 0c0 6.1-7.6 12.4-7.6 12.4z" fill="#fff"/><path d="M16 9.9l1.15 2.95 2.95 1.15-2.95 1.15L16 18.1l-1.15-2.95L11.9 14l2.95-1.15z" fill="#6E4BF2"/></svg>`;

export function loginPage(opts: { next: string; error?: string }): string {
  return `<!doctype html>
<html lang="es-AR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="robots" content="noindex, nofollow" />
<meta name="theme-color" content="#F6F5FA" />
<title>Entrar · Aparece back office</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<style>
  :root { --bg:#f6f5fa; --ink:#0d0d11; --ink-2:#26252d; --muted:#5d5b6a; --line:rgba(38,37,45,.12);
    --v-100:#ece6ff; --v-600:#6e4bf2; --v-700:#5b3fd9; --danger:#c2334d;
    --font: "Geist Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  * { box-sizing: border-box; }
  html, body { height: 100%; }
  body { margin: 0; font-family: var(--font); color: var(--ink-2); background: var(--bg);
    background-image: radial-gradient(60rem 30rem at 85% -10%, rgba(139,109,255,.18), transparent 60%),
      radial-gradient(40rem 26rem at -10% 110%, rgba(91,63,217,.12), transparent 60%);
    display: grid; place-items: center; padding: 24px 16px; -webkit-font-smoothing: antialiased; }
  .card { width: 100%; max-width: 400px; background: #fff; border: 1px solid var(--line); border-radius: 24px;
    padding: 32px 28px 28px; box-shadow: 0 2px 4px rgba(13,13,17,.04), 0 24px 60px -18px rgba(45,30,110,.28); }
  .brand { display: flex; align-items: center; gap: 12px; margin-bottom: 26px; }
  .brand b { display: block; font-size: 1.15rem; color: var(--ink); letter-spacing: -.03em; }
  .brand span { font-size: .85rem; color: var(--muted); }
  h1 { margin: 0 0 6px; font-size: 1.45rem; letter-spacing: -.025em; color: var(--ink); font-weight: 600; }
  p { margin: 0 0 22px; color: var(--muted); font-size: .95rem; line-height: 1.5; }
  label { display: block; font-size: .85rem; font-weight: 600; color: var(--ink); margin-bottom: 8px; }
  input { width: 100%; height: 48px; border-radius: 14px; border: 1px solid rgba(38,37,45,.18); padding: 0 14px;
    font: inherit; font-size: 1rem; background: #fbfaff; color: var(--ink); outline: none; transition: border-color .2s, box-shadow .2s; }
  input:focus { border-color: var(--v-600); box-shadow: 0 0 0 4px var(--v-100); background: #fff; }
  button { margin-top: 18px; width: 100%; height: 48px; border: 0; border-radius: 999px; background: var(--ink); color: #fff;
    font: inherit; font-weight: 600; font-size: 1rem; cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255,255,255,.14), 0 8px 22px -8px rgba(91,63,217,.55); transition: transform .2s; }
  button:hover { transform: translateY(-1px); background: #1c1b24; }
  .error { margin: 0 0 16px; padding: 10px 14px; border-radius: 12px; background: #fdecef; color: var(--danger); font-size: .9rem; }
  .foot { margin-top: 18px; text-align: center; font-size: .8rem; color: #8c8a99; }
</style>
</head>
<body>
<main class="card">
  <div class="brand">${LOGO}<div><b>Aparece</b><span>Back office</span></div></div>
  <h1>Hola de nuevo</h1>
  <p>Entrá con la contraseña compartida para ver los clientes potenciales.</p>
  ${opts.error ? `<div class="error" role="alert">${esc(opts.error)}</div>` : ""}
  <form method="post" action="/login">
    <input type="hidden" name="next" value="${esc(opts.next)}" />
    <label for="pw">Contraseña</label>
    <input id="pw" name="password" type="password" autocomplete="current-password" required autofocus />
    <button type="submit">Entrar</button>
  </form>
  <div class="foot">Uso interno de Kanel y Gonzalo</div>
</main>
</body>
</html>`;
}
