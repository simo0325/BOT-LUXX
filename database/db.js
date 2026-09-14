const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'luxx.db');
const db = new Database(dbPath);

// Abilita WAL mode e foreign keys
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ═══════════════════════════════════════════════════════════════
// CREAZIONE TABELLE
// ═══════════════════════════════════════════════════════════════

db.exec(`
    CREATE TABLE IF NOT EXISTS magazzino (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT UNIQUE NOT NULL,
        quantita INTEGER NOT NULL DEFAULT 0,
        prezzo_acquisto INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS cassa (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        saldo_attuale INTEGER NOT NULL DEFAULT 0,
        fondo_inizio_settimana INTEGER NOT NULL DEFAULT 0,
        totale_spese INTEGER NOT NULL DEFAULT 0,
        totale_incassi INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settimana_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        giorno_fine INTEGER,
        orario_fine TEXT,
        canale_id TEXT
    );

    CREATE TABLE IF NOT EXISTS pannello_config (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        channel_id TEXT,
        message_id TEXT
    );

    CREATE TABLE IF NOT EXISTS log_canali (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        canale_fondocassa TEXT
    );

    CREATE TABLE IF NOT EXISTS log_operazioni (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        dettaglio TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
`);

// Inizializza riga fissa per cassa
const cassaInit = db.prepare('SELECT id FROM cassa WHERE id = 1').get();
if (!cassaInit) {
    db.prepare(`
        INSERT INTO cassa (id, saldo_attuale, fondo_inizio_settimana, totale_spese, totale_incassi)
        VALUES (1, 0, 0, 0, 0)
    `).run();
}

// Inizializza riga fissa per settimana_config
const setInit = db.prepare('SELECT id FROM settimana_config WHERE id = 1').get();
if (!setInit) {
    db.prepare(`
        INSERT INTO settimana_config (id, giorno_fine, orario_fine, canale_id)
        VALUES (1, 0, '23:59', NULL)
    `).run();
}

// Migrazione automatica colonna categoria
const tableCols = db.prepare("PRAGMA table_info(magazzino)").all();
if (!tableCols.some(c => c.name === 'categoria')) {
    db.exec("ALTER TABLE magazzino ADD COLUMN categoria TEXT DEFAULT 'Alcol'");
}

// Migrazione automatica colonna inizio_settimana in cassa
const cassaCols = db.prepare("PRAGMA table_info(cassa)").all();
if (!cassaCols.some(c => c.name === 'inizio_settimana')) {
    db.exec("ALTER TABLE cassa ADD COLUMN inizio_settimana TEXT");
}

function getFormattedDateTime(date = new Date()) {
    return date.toLocaleString('it-IT', {
        timeZone: 'Europe/Rome',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', '');
}

// Inizializza inizio_settimana se non impostato
const cassaCurrent = db.prepare('SELECT inizio_settimana FROM cassa WHERE id = 1').get();
if (cassaCurrent && !cassaCurrent.inizio_settimana) {
    db.prepare('UPDATE cassa SET inizio_settimana = ? WHERE id = 1').run(getFormattedDateTime());
}

// ═══════════════════════════════════════════════════════════════
// FUNZIONI HELPER
// ═══════════════════════════════════════════════════════════════

function getMagazzino() {
    return db.prepare('SELECT * FROM magazzino ORDER BY categoria ASC, nome ASC').all();
}

function getItem(nome) {
    return db.prepare('SELECT * FROM magazzino WHERE LOWER(nome) = LOWER(?)').get(nome);
}

function setItem(nome, prezzo_acquisto, quantita = null, categoria = 'Alcol') {
    const existing = getItem(nome);
    if (existing) {
        if (quantita !== null && quantita !== undefined) {
            db.prepare('UPDATE magazzino SET prezzo_acquisto = ?, quantita = ?, categoria = ? WHERE id = ?')
                .run(prezzo_acquisto, quantita, categoria, existing.id);
        } else {
            db.prepare('UPDATE magazzino SET prezzo_acquisto = ?, categoria = ? WHERE id = ?')
                .run(prezzo_acquisto, categoria, existing.id);
        }
        return { created: false, item: getItem(nome) };
    } else {
        const qta = (quantita !== null && quantita !== undefined) ? quantita : 0;
        db.prepare('INSERT INTO magazzino (nome, quantita, prezzo_acquisto, categoria) VALUES (?, ?, ?, ?)')
            .run(nome, qta, prezzo_acquisto, categoria);
        return { created: true, item: getItem(nome) };
    }
}

function eliminaItem(nome) {
    const existing = getItem(nome);
    if (!existing) return { success: false, reason: 'Articolo non trovato a magazzino.' };
    db.prepare('DELETE FROM magazzino WHERE id = ?').run(existing.id);
    return { success: true, item: existing };
}

function upsertItem(nome, quantita, prezzo_acquisto) {
    const existing = getItem(nome);
    if (existing) {
        db.prepare('UPDATE magazzino SET quantita = quantita + ?, prezzo_acquisto = ? WHERE id = ?')
            .run(quantita, prezzo_acquisto !== undefined ? prezzo_acquisto : existing.prezzo_acquisto, existing.id);
    } else {
        db.prepare('INSERT INTO magazzino (nome, quantita, prezzo_acquisto) VALUES (?, ?, ?)')
            .run(nome, quantita, prezzo_acquisto || 0);
    }
}

function prelevaItem(nome, quantita) {
    const item = getItem(nome);
    if (!item) return { success: false, reason: 'Item non trovato in magazzino.' };
    if (item.quantita < quantita) {
        return { success: false, reason: `Scorte insufficienti! Disponibili: ${item.quantita}, richiesti: ${quantita}.` };
    }
    db.prepare('UPDATE magazzino SET quantita = quantita - ? WHERE id = ?').run(quantita, item.id);
    return { success: true, item: getItem(nome) };
}

function depositaItem(nome, quantita, prezzo = 0) {
    const existing = getItem(nome);
    if (existing) {
        db.prepare('UPDATE magazzino SET quantita = quantita + ? WHERE id = ?').run(quantita, existing.id);
        return { success: true, item: getItem(nome), created: false };
    } else {
        db.prepare('INSERT INTO magazzino (nome, quantita, prezzo_acquisto) VALUES (?, ?, ?)')
            .run(nome, quantita, prezzo);
        return { success: true, item: getItem(nome), created: true };
    }
}

function rifornisciItem(nome, quantita) {
    const item = getItem(nome);
    if (!item) return { success: false, reason: 'Item non trovato.' };
    const cassa = getCassa();
    const costoTotale = item.prezzo_acquisto * quantita;

    if (costoTotale > cassa.saldo_attuale) {
        return {
            success: false,
            reason: `Fondi insufficienti nel fondo cassa!\nCosto totale: **€${costoTotale.toLocaleString('it-IT')}**\nFondo cassa disponibile: **€${cassa.saldo_attuale.toLocaleString('it-IT')}**`
        };
    }

    const tx = db.transaction(() => {
        db.prepare('UPDATE cassa SET saldo_attuale = saldo_attuale - ?, totale_spese = totale_spese + ? WHERE id = 1')
            .run(costoTotale, costoTotale);
        db.prepare('UPDATE magazzino SET quantita = quantita + ? WHERE id = ?')
            .run(quantita, item.id);
    });
    tx();

    return {
        success: true,
        costoTotale,
        nuovoSaldo: getCassa().saldo_attuale,
        nuovaQuantita: getItem(nome).quantita
    };
}

function getCassa() {
    return db.prepare('SELECT * FROM cassa WHERE id = 1').get();
}

function modificaFondoCassa(azione, valore) {
    const cassa = getCassa();
    const vecchioSaldo = cassa.saldo_attuale;
    let nuovoSaldo = vecchioSaldo;

    if (azione === 'Aggiungi') {
        nuovoSaldo = vecchioSaldo + valore;
        db.prepare('UPDATE cassa SET saldo_attuale = ?, totale_incassi = totale_incassi + ? WHERE id = 1')
            .run(nuovoSaldo, valore);
    } else if (azione === 'Rimuovi') {
        if (valore > vecchioSaldo) {
            return { success: false, reason: `Impossibile rimuovere €${valore}. Il saldo attuale è solo €${vecchioSaldo}.` };
        }
        nuovoSaldo = vecchioSaldo - valore;
        db.prepare('UPDATE cassa SET saldo_attuale = ?, totale_spese = totale_spese + ? WHERE id = 1')
            .run(nuovoSaldo, valore);
    } else if (azione === 'Imposta') {
        nuovoSaldo = valore;
        db.prepare('UPDATE cassa SET saldo_attuale = ? WHERE id = 1').run(nuovoSaldo);
    }

    return { success: true, vecchioSaldo, nuovoSaldo };
}

function resetSettimanale() {
    const cassa = getCassa();
    const fondoIniziale = cassa.fondo_inizio_settimana;
    const saldoAttuale = cassa.saldo_attuale;
    const spese = cassa.totale_spese;
    const incassi = cassa.totale_incassi;
    const dataOraInizio = cassa.inizio_settimana || getFormattedDateTime(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
    const dataOraFine = getFormattedDateTime();

    // Fatturato lordo: totale incassi generati (senza considerare le spese)
    const fatturatoLordo = incassi;
    const tasse = Math.round(fatturatoLordo * 0.05);
    const utileNetto = fatturatoLordo - spese - tasse;

    // Messaggio testuale puro (NON embed) richiesto dall'utente
    const messaggioTestuale = `Il nostro fatturato dal ${dataOraInizio} a ${dataOraFine} e' di **€${fatturatoLordo.toLocaleString('it-IT')}**. Il 5% equivale a: **€${tasse.toLocaleString('it-IT')}**`;

    const report = {
        fondoIniziale,
        spese,
        incassi,
        saldoAttuale,
        fatturatoLordo,
        tasse,
        utileNetto,
        dataOraInizio,
        dataOraFine,
        messaggioTestuale
    };

    // Reset: fondo_inizio_settimana = saldo_attuale, totale_spese = 0, totale_incassi = 0, inizio_settimana = dataOraFine
    db.prepare(`
        UPDATE cassa 
        SET fondo_inizio_settimana = saldo_attuale,
            totale_spese = 0,
            totale_incassi = 0,
            inizio_settimana = ?
        WHERE id = 1
    `).run(dataOraFine);

    return report;
}

function getSettimanaConfig() {
    return db.prepare('SELECT * FROM settimana_config WHERE id = 1').get();
}

function setSettimanaConfig(giorno_fine, orario_fine, canale_id) {
    db.prepare(`
        UPDATE settimana_config 
        SET giorno_fine = ?, orario_fine = ?, canale_id = ?
        WHERE id = 1
    `).run(giorno_fine, orario_fine, canale_id);
}

function getPannelloConfig() {
    return db.prepare('SELECT * FROM pannello_config WHERE id = 1').get();
}

function setPannelloConfig(channel_id, message_id) {
    db.prepare(`
        INSERT INTO pannello_config (id, channel_id, message_id)
        VALUES (1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET channel_id = excluded.channel_id, message_id = excluded.message_id
    `).run(channel_id, message_id);
}

function setLogCanaleFondocassa(canale_id) {
    db.prepare(`
        INSERT INTO log_canali (id, canale_fondocassa)
        VALUES (1, ?)
        ON CONFLICT(id) DO UPDATE SET canale_fondocassa = excluded.canale_fondocassa
    `).run(canale_id);
}

function getLogCanaleFondocassa() {
    const row = db.prepare('SELECT canale_fondocassa FROM log_canali WHERE id = 1').get();
    return row ? row.canale_fondocassa : null;
}

function logOperazione(user_id, tipo, dettaglio) {
    db.prepare('INSERT INTO log_operazioni (user_id, tipo, dettaglio) VALUES (?, ?, ?)')
        .run(user_id, tipo, dettaglio);
}

module.exports = {
    db,
    getMagazzino,
    getItem,
    upsertItem,
    prelevaItem,
    depositaItem,
    rifornisciItem,
    getCassa,
    modificaFondoCassa,
    resetSettimanale,
    getSettimanaConfig,
    setSettimanaConfig,
    getPannelloConfig,
    setPannelloConfig,
    logOperazione,
    setItem,
    eliminaItem,
    getFormattedDateTime,
    setLogCanaleFondocassa,
    getLogCanaleFondocassa
};
