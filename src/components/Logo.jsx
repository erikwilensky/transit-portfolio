import svg from '../assets/nist-logo.svg?raw';
// The NIST International School logo, used as supplied (colour comes from currentColor).
export default function Logo({ className = '' }) {
  return <span className={`nist-logo ${className}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}
