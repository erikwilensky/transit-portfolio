// Report comments: word and character counts and the simple checks on a draft (pure; src/report-comments.js uses them).
export const wordCount = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;
export const charCount = (t) => [...String(t || '')].length;
export const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || '';
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const hasWord = (text, w, flags = 'u') => !!w && new RegExp(`(^|[^\\p{L}\\p{M}])${esc(w)}(?=$|[^\\p{L}\\p{M}])`, flags).test(text);
// → [{ key, level: 'ok' | 'warn' | 'problem', text }]. others: the other students of the class or advisory.
export function checkComment(text, student, others = [], limit = {}) {
  const t = String(text || ''), out = [];
  if (!t.trim()) return [{ key: 'empty', level: 'warn', text: 'Not written yet' }];
  const words = wordCount(t), chars = charCount(t), first = firstName(student?.name);
  if (limit.words && words > limit.words) out.push({ key: 'words', level: 'problem', text: `${words - limit.words} ${words - limit.words === 1 ? 'word' : 'words'} over the limit of ${limit.words}` });
  if (limit.chars && chars > limit.chars) out.push({ key: 'chars', level: 'problem', text: `${chars - limit.chars} characters over the limit of ${limit.chars}` });
  if (limit.words && words < Math.ceil(limit.words * 0.3)) out.push({ key: 'short', level: 'warn', text: `Short: ${words} of up to ${limit.words} words` });
  out.push(hasWord(t, first, 'iu') ? { key: 'first', level: 'ok', text: `Uses ${first}'s first name` } : { key: 'first', level: 'warn', text: `${first}'s first name is not used` });
  const own = new Set([String(student?.name || '').toLowerCase(), ...String(student?.name || '').toLowerCase().split(/\s+/)]);
  // Another student's name, written with its capital letter (a paste from the wrong row).
  const wrong = [...new Set(others.filter((s) => s && s.id !== student?.id).flatMap((s) => [s.name, firstName(s.name)]))]
    .filter((n) => n.length > 1 && !own.has(n.toLowerCase()) && hasWord(t, n));
  const shown = [...new Set(wrong.map(firstName))];
  if (shown.length) out.push({ key: 'wrong', level: 'problem', text: `Mentions ${shown.slice(0, 3).join(', ')}: is this the right student?` });
  return out;
}

