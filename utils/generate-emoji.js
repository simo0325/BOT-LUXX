const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function createPng(width, height, pixelFn) {
    function crc32(buf) {
        let table = [];
        for (let i = 0; i < 256; i++) {
            let c = i;
            for (let k = 0; k < 8; k++) c = ((c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
            table[i] = c;
        }
        let crc = 0 ^ (-1);
        for (let i = 0; i < buf.length; i++) {
            crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xFF];
        }
        return (crc ^ (-1)) >>> 0;
    }

    function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const t = Buffer.from(type, 'ascii');
        const body = Buffer.concat([t, data]);
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE(crc32(body), 0);
        return Buffer.concat([len, body, crc]);
    }

    const header = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 6; // RGBA
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;
    const ihdr = makeChunk('IHDR', ihdrData);

    const scanlines = [];
    for (let y = 0; y < height; y++) {
        scanlines.push(0); // filter type 0
        for (let x = 0; x < width; x++) {
            const [r, g, b, a] = pixelFn(x, y);
            scanlines.push(r, g, b, a);
        }
    }
    const idatData = zlib.deflateSync(Buffer.from(scanlines));
    const idat = makeChunk('IDAT', idatData);
    const iend = makeChunk('IEND', Buffer.alloc(0));

    return Buffer.concat([header, ihdr, idat, iend]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir, { recursive: true });

// 1. Plus verde scuro stilizzato
const plusBuf = createPng(128, 128, (x, y) => {
    // Cerchio di sfondo opzionale o croce pura spessa con angoli arrotondati
    const inH = (x >= 24 && x <= 104 && y >= 48 && y <= 80);
    const inV = (x >= 48 && x <= 80 && y >= 24 && y <= 104);
    if (inH || inV) {
        return [20, 100, 45, 255]; // Verde scuro #14642D
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'plus_green.png'), plusBuf);

// 2. Meno rosso scuro stilizzato
const minusBuf = createPng(128, 128, (x, y) => {
    // Barra orizzontale spessa
    if (x >= 24 && x <= 104 && y >= 48 && y <= 80) {
        return [140, 25, 30, 255]; // Rosso scuro #8C191E
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'minus_red.png'), minusBuf);

console.log('✅ Emoji PNG generate in assets/: plus_green.png, minus_red.png');
