#!/bin/sh
# Browser checks against a local preview: npm run build && npx vite preview --port 4173 --strictPort &
cd "$(dirname "$0")" && fail=0
for f in map-find parent-link learner-profile intensity uploads public imports print undo; do echo "== $f"; node $f.cjs || fail=1; done
echo "== auth (starts its own pilot and demo servers)"; node auth.cjs || fail=1
echo "== sync (starts its own server)"; node sync.cjs || fail=1
echo "== notifications (starts its own pilot server)"; node notifications.cjs || fail=1
echo "== scope (starts its own pilot server)"; node scope.cjs || fail=1
echo "== pdpa (starts its own pilot and demo servers)"; node pdpa.cjs || fail=1
echo "== roster (starts its own clean pilot server)"; node roster.cjs || fail=1
echo "== my-classes (starts its own clean pilot server on the real roster)"; node my-classes.cjs || fail=1
echo "== tours"; node tours.cjs | grep -E "end url|ERRS|soon|boom|empty|hs" ; exit $fail
