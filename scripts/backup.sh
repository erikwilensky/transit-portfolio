#!/usr/bin/env bash
# Back up the Transit Portfolio data folders into timestamped .tar.gz files and keep the newest 30.
#
#   scripts/backup.sh                 back up ../transit-portfolio-data (and ../transit-pilot-data if it exists)
#   scripts/backup.sh /path/to/data   back up that folder instead
#
#   BACKUP_DIR  where the archives go (default ../transit-portfolio-backups, next to the repo)
#   KEEP        how many archives to keep per data folder (default 30)
#
# The server saves state.json by writing a new file and renaming it, so a backup taken while it runs
# always holds a whole record. Restore steps: docs/pilot-server.md, "Restore".
set -euo pipefail

cd "$(dirname "$0")/.."
BACKUP_DIR=${BACKUP_DIR:-../transit-portfolio-backups}
KEEP=${KEEP:-30}
case "$KEEP" in ''|*[!0-9]*) echo "KEEP must be a number" >&2; exit 2 ;; esac
[ "$KEEP" -ge 1 ] || { echo "KEEP must be at least 1" >&2; exit 2; }

# Data folders: arguments, else the ones in .env (or their defaults).
setting() {
  local v=""
  [ -f .env ] && v=$(grep -E "^[[:space:]]*$1=" .env | tail -n 1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//' || true)
  printf '%s' "${v:-$2}"
}
if [ "$#" -gt 0 ]; then
  dirs=("$@")
else
  dirs=("$(setting TP_DATA ../transit-portfolio-data)")
  pilot=$(setting TP_PILOT_DATA ../transit-pilot-data)
  [ -d "$pilot" ] && dirs+=("$pilot")
fi

mkdir -p "$BACKUP_DIR"
stamp=$(date +%Y%m%d-%H%M%S)
status=0
for dir in "${dirs[@]}"; do
  if [ ! -d "$dir" ]; then echo "Skipped $dir: no such folder" >&2; status=1; continue; fi
  abs=$(cd "$dir" && pwd)
  name=$(basename "$abs")
  out="$BACKUP_DIR/$name-$stamp.tar.gz"
  part="$BACKUP_DIR/.$name-$stamp.tar.gz.part"
  # COPYFILE_DISABLE keeps macOS from adding ._ resource files to the archive.
  if COPYFILE_DISABLE=1 tar -czf "$part" -C "$(dirname "$abs")" "$name"; then
    mv "$part" "$out"
    echo "$(date '+%Y-%m-%d %H:%M:%S') backed up $abs -> $out ($(du -h "$out" | cut -f1))"
  else
    rm -f "$part"; echo "Backup of $abs failed" >&2; status=1; continue
  fi
  # Keep the newest $KEEP archives of this folder. Names sort by time, so plain sort works.
  old=$(find "$BACKUP_DIR" -maxdepth 1 -type f -name "$name-[0-9]*-[0-9]*.tar.gz" | sort -r | tail -n +"$((KEEP + 1))")
  if [ -n "$old" ]; then
    while IFS= read -r f; do rm -f -- "$f" && echo "  removed old $(basename "$f")"; done <<< "$old"
  fi
done
exit "$status"
