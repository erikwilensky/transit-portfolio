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
echo "== simple-flow"; node simple-flow.cjs || fail=1
echo "== signin-cards"; node signin-cards.cjs || fail=1
echo "== family-letters (starts its own clean pilot server on the real roster)"; node family-letters.cjs || fail=1
echo "== class-prompts"; node class-prompts.cjs || fail=1
echo "== class-answers (starts its own clean pilot server on the real roster)"; node class-answers.cjs || fail=1
echo "== phone-app (starts its own demo and pilot servers)"; node phone-app.cjs || fail=1
echo "== feedback-nudges"; node feedback-nudges.cjs || fail=1
echo "== signup-progress (starts its own clean pilot server on the real roster)"; node signup-progress.cjs || fail=1
echo "== see-as (starts its own clean pilot server on the real roster)"; node see-as.cjs || fail=1
echo "== moment-comments"; node moment-comments.cjs || fail=1
echo "== conference-sheets (starts its own clean pilot server on the real roster)"; node conference-sheets.cjs || fail=1
echo "== simple-goals (starts its own clean pilot server on the real roster)"; node simple-goals.cjs || fail=1
echo "== thai-families (starts its own clean pilot server on the real roster)"; node thai-families.cjs || fail=1
echo "== safeguarding (starts its own clean pilot server on the real roster)"; node safeguarding.cjs || fail=1
echo "== school-overview (starts its own clean pilot server on the real roster)"; node school-overview.cjs || fail=1
echo "== spotted-moments (starts its own clean pilot server on the real roster)"; node spotted-moments.cjs || fail=1
echo "== year-handover (starts its own clean pilot server on the real roster)"; node year-handover.cjs || fail=1
echo "== protected-files (starts its own clean pilot server on the real roster)"; node protected-files.cjs || fail=1
echo "== weekly-summary (starts its own clean pilot server on the real roster)"; node weekly-summary.cjs || fail=1
echo "== activity-log (starts its own clean pilot server on the real roster)"; node activity-log.cjs || fail=1
echo "== term-reflection (starts its own clean pilot server on the real roster)"; node term-reflection.cjs || fail=1
echo "== offline-capture (starts its own clean pilot server on the real roster)"; node offline-capture.cjs || fail=1
echo "== voice (starts its own clean pilot server on the real roster, fake microphone)"; node voice.cjs || fail=1
echo "== peer-feedback (starts its own clean pilot server on the real roster)"; node peer-feedback.cjs || fail=1
echo "== polish (starts its own pilot and demo servers)"; node polish.cjs || fail=1
echo "== milestones (starts its own clean pilot server on the real roster)"; node milestones.cjs || fail=1
echo "== sis-sync (starts its own clean pilot server and a mock SIS serving the real roster)"; node sis-sync.cjs || fail=1
echo "== exhibition (starts its own clean pilot server on the real roster)"; node exhibition.cjs || fail=1
echo "== goal-checkins (starts its own clean pilot server on the real roster)"; node goal-checkins.cjs || fail=1
echo "== accessibility (starts its own demo server and a clean pilot server on the real roster)"; node accessibility.cjs || fail=1
echo "== class-tasks (starts its own clean pilot server on the real roster, twice: today and two days later)"; node class-tasks.cjs || fail=1
echo "== conference-booking (starts its own clean pilot server on the real roster)"; node conference-booking.cjs || fail=1
echo "== subject-prompts (starts its own clean pilot server on the real roster)"; node subject-prompts.cjs || fail=1
echo "== leaver-portfolio (starts its own clean pilot server on the real roster)"; node leaver-portfolio.cjs || fail=1
echo "== cas-hours (starts its own clean pilot server on the real roster)"; node cas-hours.cjs || fail=1
echo "== system-health (starts its own clean pilot server with a temporary backups folder)"; node system-health.cjs || fail=1
echo "== leaver-archive (starts its own clean pilot server on the real roster)"; node leaver-archive.cjs || fail=1
echo "== notification-settings (starts its own clean pilot server on the real roster)"; node notification-settings.cjs || fail=1
echo "== search (starts its own clean pilot server on the real roster)"; node search.cjs || fail=1
echo "== thai-students (starts its own clean pilot server on the real roster)"; node thai-students.cjs || fail=1
echo "== comment-bank (starts its own clean pilot server on the real roster)"; node comment-bank.cjs || fail=1
echo "== report-comments (starts its own clean pilot server on the real roster)"; node report-comments.cjs || fail=1
echo "== family-notes (starts its own clean pilot server on the real roster)"; node family-notes.cjs || fail=1
echo "== school-events (starts its own clean pilot server on the real roster)"; node school-events.cjs || fail=1
echo "== student-led (starts its own clean pilot server on the real roster)"; node student-led.cjs || fail=1
echo "== photo-drop (starts its own clean pilot server on the real roster)"; node photo-drop.cjs || fail=1
echo "== year-signoff (starts its own clean pilot server on the real roster)"; node year-signoff.cjs || fail=1
echo "== tours";node tours.cjs | grep -E "end url|ERRS|soon|boom|empty|hs" ; exit $fail
