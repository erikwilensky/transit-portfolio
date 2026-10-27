#!/bin/sh
# Browser checks against a local preview: npm run build && npx vite preview --port 4173 --strictPort &
cd "$(dirname "$0")" && fail=0
for f in map-find parent-link learner-profile intensity public; do echo "== $f"; node $f.cjs || fail=1; done
echo "== tours"; node tours.cjs | grep -E "end url|ERRS|soon|boom|empty|hs" ; exit $fail
