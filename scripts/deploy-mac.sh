#!/usr/bin/env bash
# Deploy (or redeploy) NIST Transit Portfolio on the Mac with Docker. Safe to run again at any time.
#
#   scripts/deploy-mac.sh            git pull, build, (re)start, wait until healthy, print status
#   scripts/deploy-mac.sh --no-pull  the same without git pull (deploy what is checked out)
#
# The first run also replaces the old nginx container called transit-portfolio (the static demo)
# with the Node server on the same host port 8080, so the Cloudflare tunnel needs no change.
set -euo pipefail

cd "$(dirname "$0")/.."
NAME=transit-portfolio
PULL=1
for arg in "$@"; do
  case "$arg" in
    --no-pull) PULL=0 ;;
    -h|--help) sed -n '2,8p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg (try --help)" >&2; exit 2 ;;
  esac
done

say() { printf '\n==> %s\n' "$*"; }
die() { printf '\nError: %s\n' "$*" >&2; exit 1; }

command -v docker >/dev/null 2>&1 || die "docker not found. Install Docker Desktop."
docker info >/dev/null 2>&1 || die "Docker is not running. Open Docker Desktop, wait for it to start, run this again."
docker compose version >/dev/null 2>&1 || die "docker compose not found. Update Docker Desktop."

# Read one setting from .env (last one wins), else the default.
setting() {
  local v=""
  [ -f .env ] && v=$(grep -E "^[[:space:]]*$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)
  printf '%s' "${v:-$2}"
}

# ── 1. Code ──
if [ "$PULL" = 1 ]; then
  say "git pull"
  git pull --ff-only || die "git pull failed (local changes or a diverged branch). Fix it, or run with --no-pull."
fi
echo "Commit: $(git log -1 --format='%h %s' 2>/dev/null || echo unknown)"

# ── 2. Settings and data folders ──
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Created .env from .env.example (TP_MODE=demo)."
fi
DATA=$(setting TP_DATA ../transit-portfolio-data)
mkdir -p "$DATA"
echo "Data: $(cd "$DATA" && pwd)"
PILOT=0
case ",$(setting COMPOSE_PROFILES ""),${COMPOSE_PROFILES:-}," in *,pilot,*) PILOT=1 ;; esac
if [ "$PILOT" = 1 ]; then
  PDATA=$(setting TP_PILOT_DATA ../transit-pilot-data)
  mkdir -p "$PDATA"
  echo "Pilot data: $(cd "$PDATA" && pwd)"
fi

# ── 3. Build first, so the site stays up while the image builds ──
say "Building the image"
docker compose build

# ── 4. Retire the old static nginx container, only if that is what it is ──
if docker container inspect "$NAME" >/dev/null 2>&1; then
  image=$(docker container inspect -f '{{.Config.Image}}' "$NAME")
  project=$(docker container inspect -f '{{index .Config.Labels "com.docker.compose.project"}}' "$NAME")
  if [ -z "$project" ]; then
    case "$image" in
      nginx|nginx:*|*/nginx|*/nginx:*)
        say "Removing the old nginx container $NAME ($image)"
        docker stop "$NAME" >/dev/null
        docker rm "$NAME" >/dev/null
        ;;
      *) die "A container named $NAME exists ($image) that compose did not create and is not nginx. Remove it yourself (docker rm -f $NAME) and run this again." ;;
    esac
  fi
fi

# ── 5. Start (recreates containers only when the image or settings changed) ──
say "Starting"
docker compose up -d --build --remove-orphans

# ── 6. Wait until healthy ──
wait_health() { # name port
  local _
  for _ in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:$2/api/health" >/dev/null 2>&1; then echo "$1 is up on :$2"; return 0; fi
    sleep 1
  done
  echo "$1 did not answer on :$2 within 60 s. Last log lines:" >&2
  docker compose logs --tail=40 "$1" >&2 || true
  return 1
}
say "Waiting for /api/health"
main_ok=1; pilot_ok=1
wait_health transit-portfolio 8080 || main_ok=0
if [ "$PILOT" = 1 ]; then wait_health transit-pilot 8081 || pilot_ok=0; fi

# ── 7. Status ──
say "Status"
docker compose ps
echo
curl -fsS http://127.0.0.1:8080/api/health 2>/dev/null && echo
echo "Logs: docker compose logs -f    Backup: scripts/backup.sh"
if [ "$main_ok" != 1 ]; then
  cat >&2 <<'EOF'

Deploy finished but the server on :8080 is not healthy. To put the old static site back meanwhile
(it serves the dist/ folder from the last nginx-era build, if that is still there):
  docker compose down
  docker run -d --name transit-portfolio --restart unless-stopped -p 8080:80 \
    -v "$PWD/dist":/usr/share/nginx/html:ro nginx:alpine
EOF
  exit 1
fi
if [ "$pilot_ok" != 1 ]; then
  echo "The demo is up, but the pilot on :8081 is not healthy: docker compose logs transit-pilot" >&2
  exit 1
fi
echo "Done: https://transit.wilenskycs.online"
