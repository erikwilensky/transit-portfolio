import { addReflection, addStation, completeOnboarding, endorse, getRequests, getSignals, getStore, getStudent } from './api.js';

// The role tour's story: Maya answers a prompt, adds the hackathon, Ms Nair endorses it.
// Each stop can run on its own, so a presenter who skips ahead still sees a consistent record.
export const TOUR_STATION = {
  title: 'Bangkok Smart City hackathon: 1st place', date: '2026-10-25', type: 'competition', lineIds: ['computing', 'service'],
  summary: 'Our team built a bus-crowding predictor for the school routes in 36 hours.', image: 'evidence/hackathon-1st.svg', imageCaption: 'Results board',
  reflection: 'This time I led the team. Splitting the work early mattered more than any clever code.', visibility: 'publishable',
  cas: { strand: 'C', outcomes: [2, 5] }, requestFrom: 't-01', requestNote: 'Could you endorse this? The code is on GitHub.',
};
export const TOUR_REFLECTION = 'Under pressure I tried to do everything myself, and we nearly missed the deadline. Next time I will split the work in the first hour and trust my teammates.';

export const tourEvent = () => getStore().events.find((e) => e.studentId === 'st-01' && e.title === TOUR_STATION.title);

export function ensureMayaStory() {
  const g = getSignals('st-01').find((x) => x.kind === 'prompt' && x.open);
  if (g) addReflection({ studentId: 'st-01', eventId: g.eventId, prompt: g.prompt, text: TOUR_REFLECTION, visibility: 'advisor', signal: g });
  if (!tourEvent()) addStation('st-01', TOUR_STATION);
}
export function ensureEndorsed() {
  ensureMayaStory();
  const e = tourEvent();
  const r = getRequests('t-01').find((x) => x.eventId === e.id);
  if (r) endorse([r.id], 't-01', 'Strong collaboration. Real-world impact.');
}

// Pim (Year 7) has picked three interests, so the Simple interface has a few stations to show.
export function ensurePimStarted() {
  if (getStudent('st-09').onboarding) completeOnboarding('st-09', ['science', 'art', 'sport'], 'starter');
}
