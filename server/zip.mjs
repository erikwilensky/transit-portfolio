// A minimal ZIP writer: stored entries (no compression), UTF-8 names. Enough for a data copy
// any computer opens (Finder, Explorer, unzip). zip([{ name, data }]) → Buffer.
import zlib from 'node:zlib';

// zlib.crc32 is in Node 22.2+ and 20.15+; a table version for older Node.
let TABLE;
const crc32 = zlib.crc32 || ((buf) => {
  TABLE ||= Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  let c = 0xffffffff;
  for (const b of buf) c = TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
});
const dosTime = (d) => [((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)) & 0xffff, (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()) & 0xffff];

export function zip(entries, when = new Date()) {
  const [time, date] = dosTime(when);
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    const body = Buffer.isBuffer(data) ? data : Buffer.from(String(data));
    const fname = Buffer.from(name);
    const crc = crc32(body);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(0, 8);
    h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14);
    h.writeUInt32LE(body.length, 18); h.writeUInt32LE(body.length, 22); h.writeUInt16LE(fname.length, 26); h.writeUInt16LE(0, 28);
    local.push(h, fname, body);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(0, 10);
    c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(body.length, 20); c.writeUInt32LE(body.length, 24); c.writeUInt16LE(fname.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, fname);
    offset += 30 + fname.length + body.length;
  }
  const cd = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, cd, end]);
}

// Reads a stored-only ZIP back (for tests): [{ name, data }].
export function unzip(buf) {
  const out = [];
  for (let i = 0; buf.readUInt32LE(i) === 0x04034b50;) {
    const size = buf.readUInt32LE(i + 18), n = buf.readUInt16LE(i + 26), x = buf.readUInt16LE(i + 28);
    const name = buf.subarray(i + 30, i + 30 + n).toString();
    const data = buf.subarray(i + 30 + n + x, i + 30 + n + x + size);
    if (crc32(data) !== buf.readUInt32LE(i + 14)) throw new Error(`Bad CRC for ${name}`);
    out.push({ name, data }); i += 30 + n + x + size;
  }
  return out;
}
