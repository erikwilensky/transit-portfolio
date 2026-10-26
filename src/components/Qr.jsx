import qrcode from 'qrcode-generator';
export default function Qr({ text, size = 140, className = '' }) {
  const qr = qrcode(0, 'M');
  qr.addData(text); qr.make();
  const svg = qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true });
  return <span className={`qr ${className}`} style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code for ${text}`} role="img" />;
}
