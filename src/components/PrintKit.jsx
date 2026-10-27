import Logo from './Logo.jsx';
import Qr from './Qr.jsx';
import { appUrl } from '../format.js';
import { printDate, printDocument, usePrintTitle } from '../print.js';

// Pieces every printed document shares: the button, a letterhead and a footer.

export function PrintButton({ title, label = 'Download PDF', className = 'ghost' }) {
  usePrintTitle(title);
  return (
    <button type="button" className={`${className} print-btn`} onClick={() => printDocument(title)} title="Opens the print dialog. Choose “Save as PDF” to keep a copy.">
      <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M3 13h10" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
      {label}
    </button>
  );
}

// A thin NIST letterhead that only appears on paper.
export function PrintHead({ kicker }) {
  return (
    <div className="print-head" aria-hidden="true">
      <Logo className="ph-logo" />
      <span className="ph-name">NIST International School<small>Transit Portfolio</small></span>
      {kicker && <span className="ph-kicker">{kicker}</span>}
    </div>
  );
}

const cssString = (s) => `"${String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\A ')}"`;
const bare = (url) => url.replace(/^https?:\/\//, '');

// Sets A4 portrait for the screen it sits on, puts a running footer in the page margin
// (student, NIST Transit Portfolio, date, page numbers) and ends the document with a
// block that tells a reader how to check it. With a share link, that block carries its QR code.
export function PrintFooter({ name, verifyUrl, margin = '15mm 15mm 19mm' }) {
  const date = printDate();
  const left = `${name} · NIST Transit Portfolio · Printed ${date}`;
  const right = verifyUrl ? `Check it at ${bare(verifyUrl)}` : '';
  const box = 'font-family: Switzer, Arial, sans-serif; font-size: 7.5pt; color: #56627a; vertical-align: top; padding-top: 5mm;';
  const css = `@media print {
  @page {
    size: A4 portrait; margin: ${margin};
    @bottom-left { content: ${cssString(left)}; ${box} }
    @bottom-right { content: ${right ? `${cssString(right + '   ')} ` : ''}"Page " counter(page) " of " counter(pages); text-align: right; ${box} }
  }
}`;
  const verifyPage = appUrl('v');
  return (
    <>
      <style data-print-page="">{css}</style>
      <footer className="print-colophon" aria-hidden="true">
        {verifyUrl && <Qr text={verifyUrl} size={72} />}
        <div>
          <b>{name} · NIST Transit Portfolio</b>
          {verifyUrl
            ? <span>Printed {date} from a share link. Scan the code or go to <span className="pc-url">{bare(verifyUrl)}</span> to read the live portfolio while the link is open.</span>
            : <span>Printed {date}.</span>}
          <span>Each verified item carries a code starting NIST-. Anyone can check a code at <span className="pc-url">{bare(verifyPage)}</span>. The school confirms what came from its systems or was endorsed by a teacher.</span>
        </div>
      </footer>
    </>
  );
}
