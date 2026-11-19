#!/usr/bin/env bash
# Arranca (o reinicia) el back office de leads y su túnel público de Cloudflare.
#
#   scripts/start.sh             build si falta + server (nohup) + quick tunnel; imprime la URL
#   scripts/start.sh --build     fuerza el build antes de arrancar
#   scripts/start.sh restart     para todo y vuelve a arrancar (la URL del túnel CAMBIA)
#   scripts/start.sh server      reinicia solo el server (el túnel y su URL siguen igual)
#   scripts/start.sh stop        para server y túnel
#   scripts/start.sh status      qué está corriendo y la URL actual
#
# Config: un .env FUERA del repo (ver .env.example) con PORT, LEADS_DB y BACKOFFICE_PASSWORD.
# Se busca en $BACKOFFICE_ENV, si no en $AGENT_DIR/data/backoffice/.env, si no en
# <carpeta data del agente>/backoffice/.env (este proyecto vive en data/proyectos/agencia/backoffice).
# Ahí mismo quedan los logs (server.log, tunnel.log) y los PID.
#
# Ojo: el quick tunnel (trycloudflare.com) da una URL nueva cada vez que arranca, y todo corre en
# esta máquina: si se apaga o duerme, el back office no responde.
set -euo pipefail

APP="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if [[ -n "${BACKOFFICE_ENV:-}" ]]; then
  ENV_FILE="$BACKOFFICE_ENV"
elif [[ -n "${AGENT_DIR:-}" ]]; then
  ENV_FILE="$AGENT_DIR/data/backoffice/.env"
else
  ENV_FILE="$(cd "$APP/../../.." && pwd)/backoffice/.env"
fi
[[ -f "$ENV_FILE" ]] || { echo "No encuentro el .env ($ENV_FILE). Ver .env.example." >&2; exit 1; }
STATE="$(dirname "$ENV_FILE")"
PORT="$(grep -E '^PORT=' "$ENV_FILE" | cut -d= -f2 | tr -d '"' || true)"
PORT="${PORT:-4460}"
CLOUDFLARED="${CLOUDFLARED:-/opt/homebrew/bin/cloudflared}"

# Node de nvm si no hay uno en el PATH.
if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.nvm/versions/node" ]]; then
  NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin | sort -V | tail -1)"
  export PATH="$NODE_BIN:$PATH"
fi

alive() { [[ -f "$1" ]] && kill -0 "$(cat "$1")" 2>/dev/null; }

stop_pid() {
  local f="$STATE/$1.pid"
  if alive "$f"; then
    kill "$(cat "$f")" 2>/dev/null || true
    for _ in 1 2 3 4 5 6 7 8 9 10; do alive "$f" || break; sleep 0.5; done
  fi
  rm -f "$f"
}

tunnel_url() { { grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$STATE/tunnel.log" 2>/dev/null || true; } | tail -1; }

start_server() {
  if [[ "${FORCE_BUILD:-}" == 1 || ! -f "$APP/dist/server/index.js" || ! -f "$APP/dist/web/index.html" ]]; then
    (cd "$APP" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund; } && npm run build)
  fi
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "El puerto $PORT ya está en uso: no arranco otro server." >&2
    exit 1
  fi
  (cd "$APP" && DOTENV_CONFIG_PATH="$ENV_FILE" DOTENV_CONFIG_QUIET=true nohup node dist/server/index.js >>"$STATE/server.log" 2>&1 &
    echo $! >"$STATE/server.pid")
  for _ in $(seq 1 20); do
    curl -fsS -o /dev/null "http://127.0.0.1:$PORT/login" 2>/dev/null && { echo "Server ok en http://localhost:$PORT"; return; }
    sleep 0.5
  done
  echo "El server no respondió: mirá $STATE/server.log" >&2
  exit 1
}

start_tunnel() {
  : >"$STATE/tunnel.log"
  nohup "$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:$PORT" >>"$STATE/tunnel.log" 2>&1 &
  echo $! >"$STATE/tunnel.pid"
  for _ in $(seq 1 40); do
    local u
    u="$(tunnel_url)"
    if [[ -n "$u" ]]; then echo "Túnel: $u"; return; fi
    sleep 0.5
  done
  echo "No apareció la URL del túnel: mirá $STATE/tunnel.log" >&2
  exit 1
}

status() {
  if alive "$STATE/server.pid"; then echo "server: corriendo (pid $(cat "$STATE/server.pid"), puerto $PORT)"; else echo "server: parado"; fi
  if alive "$STATE/tunnel.pid"; then echo "túnel:  corriendo (pid $(cat "$STATE/tunnel.pid")) → $(tunnel_url)"; else echo "túnel:  parado"; fi
}

cmd="${1:-start}"
if [[ "$cmd" == "--build" ]]; then FORCE_BUILD=1; cmd=start; fi
case "$cmd" in
  start)
    alive "$STATE/server.pid" && echo "Server ya corriendo (pid $(cat "$STATE/server.pid"))" || start_server
    alive "$STATE/tunnel.pid" && echo "Túnel ya corriendo: $(tunnel_url)" || start_tunnel
    ;;
  server)
    stop_pid server
    FORCE_BUILD=1 start_server
    ;;
  restart)
    stop_pid tunnel
    stop_pid server
    FORCE_BUILD=1 start_server
    start_tunnel
    ;;
  stop)
    stop_pid tunnel
    stop_pid server
    echo "Parado."
    ;;
  status) status ;;
  *)
    echo "Uso: $0 [start|--build|restart|server|stop|status]" >&2
    exit 2
    ;;
esac
