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
        scanlines.push(0);
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

// 1. Panino / Burger (Cibo)
const burgerBuf = createPng(128, 128, (x, y) => {
    // Pane superiore: cupola da y: 24 a 56, x: da 20 a 108
    const dx = (x - 64) / 44;
    const dy = (y - 56) / 32;
    if (y >= 24 && y <= 56 && (dx * dx + dy * dy <= 1)) {
        // Semi di sesamo
        if ((x === 50 && y === 36) || (x === 70 && y === 34) || (x === 82 && y === 42) || (x === 58 && y === 44)) {
            return [255, 255, 230, 255];
        }
        return [225, 155, 60, 255]; // Pane sopra dorato
    }
    // Lattuga: y da 56 a 64
    if (y >= 56 && y <= 64 && x >= 16 && x <= 112) {
        return [60, 185, 60, 255]; // Verde lattuga
    }
    // Formaggio: triangoli / linea y da 64 a 70
    if (y >= 64 && y <= 70 && x >= 18 && x <= 110) {
        return [255, 205, 30, 255]; // Giallo formaggio
    }
    // Carne: y da 70 a 84, x da 18 a 110
    if (y >= 70 && y <= 84 && x >= 18 && x <= 110) {
        return [115, 55, 25, 255]; // Marrone carne
    }
    // Pane inferiore: y da 84 a 100, x da 22 a 106 arrotondato
    if (y >= 84 && y <= 100 && x >= 22 && x <= 106) {
        return [220, 150, 55, 255]; // Pane sotto
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'cibo_burger.png'), burgerBuf);

// 2. Bibita con Cannuccia (Bevanda)
const drinkBuf = createPng(128, 128, (x, y) => {
    // Cannuccia: inclinata da (76, 12) a (60, 48)
    const strawLine = Math.abs((y - 12) - (x - 76) * -2.2);
    if (y >= 14 && y <= 48 && x >= 56 && x <= 80 && strawLine < 8) {
        return [230, 50, 50, 255]; // Rosso cannuccia
    }
    // Coperchio: y da 44 a 52, x da 36 a 92
    if (y >= 44 && y <= 52 && x >= 36 && x <= 92) {
        return [240, 240, 245, 255]; // Bianco coperchio
    }
    // Bicchiere trapezoidale: da y=52 (x: 40 a 88) a y=116 (x: 46 a 82)
    if (y >= 52 && y <= 116) {
        const progress = (y - 52) / 64;
        const leftX = 40 + progress * 6;
        const rightX = 88 - progress * 6;
        if (x >= leftX && x <= rightX) {
            // Banda bibita al centro
            if (y >= 72 && y <= 94) {
                return [230, 40, 60, 255]; // Rosso bibita
            }
            return [52, 152, 219, 255]; // Blu bicchiere
        }
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'bibita_drink.png'), drinkBuf);

// 3. Cocktail Martini (Alcol)
const cocktailBuf = createPng(128, 128, (x, y) => {
    // Oliva / decorazione stecchino in alto: (74, 28)
    const distOliva = (x - 76) * (x - 76) + (y - 28) * (y - 28);
    if (distOliva <= 55) {
        return [46, 204, 113, 255]; // Verde oliva
    }
    // Calice a V: y da 36 a 80
    if (y >= 36 && y <= 80) {
        const halfWidth = (80 - y) * 1.0;
        const leftX = 64 - halfWidth;
        const rightX = 64 + halfWidth;
        // Bordo o liquido interno
        if (x >= leftX && x <= rightX) {
            if (x <= leftX + 4 || x >= rightX - 4 || y >= 76) {
                return [220, 235, 245, 255]; // Vetro calice
            }
            // Liquido cocktail ambra / magenta
            if (y >= 44) {
                return [155, 89, 182, 240]; // Viola/Magenta Luxx Club
            }
        }
    }
    // Stelo: da y=80 a y=112, x da 62 a 66
    if (y >= 80 && y <= 112 && x >= 62 && x <= 66) {
        return [220, 235, 245, 255]; // Vetro stelo
    }
    // Base circolare calice: y da 112 a 118, x da 40 a 88
    if (y >= 112 && y <= 118 && x >= 40 && x <= 88) {
        return [220, 235, 245, 255]; // Base vetro
    }
    return [0, 0, 0, 0];
});
fs.writeFileSync(path.join(assetsDir, 'alcol_cocktail.png'), cocktailBuf);

console.log('✅ Emoji generate con successo per Cibo, Bevanda e Alcol!');
