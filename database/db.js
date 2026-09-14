const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dataFilePath = path.join(dataDir, 'luxx_data.json');

// Dati predefiniti
const defaultData = {
    magazzino: [],
    cassa: {
        saldo_attuale: 0,
        fondo_inizio_settimana: 0,
        totale_spese: 0,
        totale_incassi: 0,
        inizio_settimana: null
    },
    settimana_config: {
        giorno_fine: 0,
        orario_fine: '23:59',
        canale_id: null
    },
    pannello_config: {
        channel_id: null,
        message_id: null
    },
    log_canali: {
        canale_fondocassa: null
    },
    log_operazioni: []
};

function loadData() {
    try {
        if (fs.existsSync(dataFilePath)) {
            const raw = fs.readFileSync(dataFilePath, 'utf8');
            const parsed = JSON.parse(raw);
            return {
                ...defaultData,
                ...parsed,
                cassa: { ...defaultData.cassa, ...(parsed.cassa || {}) },
                settimana_config: { ...defaultData.settimana_config, ...(parsed.settimana_config || {}) },
                pannello_config: { ...defaultData.pannello_config, ...(parsed.pannello_config || {}) },
                log_canali: { ...defaultData.log_canali, ...(parsed.log_canali || {}) },
                magazzino: parsed.magazzino || [],
                log_operazioni: parsed.log_operazioni || []
            };
        }
    } catch (err) {
        console.error('Errore lettura JSON, fallback default:', err);
    }
    return JSON.parse(JSON.stringify(defaultData));
}

let store = loadData();

function saveData() {
    try {
        fs.writeFileSync(dataFilePath, JSON.stringify(store, null, 2), 'utf8');
    } catch (err) {
        console.error('Errore salvataggio dati:', err);
    }
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

if (!store.cassa.inizio_settimana) {
    store.cassa.inizio_settimana = getFormattedDateTime();
    saveData();
}

// ═══════════════════════════════════════════════════════════════
// FUNZIONI HELPER
// ═══════════════════════════════════════════════════════════════

function getMagazzino() {
    return [...store.magazzino].sort((a, b) => {
        if ((a.categoria || 'Alcol') === (b.categoria || 'Alcol')) {
            return (a.nome || '').localeCompare(b.nome || '');
        }
        return (a.categoria || 'Alcol').localeCompare(b.categoria || 'Alcol');
    });
}

function getItem(nome) {
    if (!nome) return null;
    return store.magazzino.find(i => i.nome.toLowerCase() === nome.toLowerCase()) || null;
}

function setItem(nome, prezzo_acquisto, quantita = null, categoria = 'Alcol') {
    const existing = getItem(nome);
    if (existing) {
        existing.prezzo_acquisto = prezzo_acquisto;
        existing.categoria = categoria;
        if (quantita !== null && quantita !== undefined) {
            existing.quantita = quantita;
        }
        saveData();
        return { created: false, item: existing };
    } else {
        const newItem = {
            id: Date.now(),
            nome,
            quantita: (quantita !== null && quantita !== undefined) ? quantita : 0,
            prezzo_acquisto,
            categoria
        };
        store.magazzino.push(newItem);
        saveData();
        return { created: true, item: newItem };
    }
}

function eliminaItem(nome) {
    const idx = store.magazzino.findIndex(i => i.nome.toLowerCase() === (nome || '').toLowerCase());
    if (idx === -1) return { success: false, reason: 'Articolo non trovato a magazzino.' };
    const removed = store.magazzino.splice(idx, 1)[0];
    saveData();
    return { success: true, item: removed };
}

function upsertItem(nome, quantita, prezzo_acquisto) {
    const existing = getItem(nome);
    if (existing) {
        existing.quantita += quantita;
        if (prezzo_acquisto !== undefined) existing.prezzo_acquisto = prezzo_acquisto;
    } else {
        store.magazzino.push({
            id: Date.now(),
            nome,
            quantita,
            prezzo_acquisto: prezzo_acquisto || 0,
            categoria: 'Alcol'
        });
    }
    saveData();
}

function prelevaItem(nome, quantita) {
    const item = getItem(nome);
    if (!item) return { success: false, reason: 'Item non trovato in magazzino.' };
    if (item.quantita < quantita) {
        return { success: false, reason: `Scorte insufficienti! Disponibili: ${item.quantita}, richiesti: ${quantita}.` };
    }
    item.quantita -= quantita;
    saveData();
    return { success: true, item };
}

function depositaItem(nome, quantita, prezzo = 0) {
    const existing = getItem(nome);
    if (existing) {
        existing.quantita += quantita;
        saveData();
        return { success: true, item: existing, created: false };
    } else {
        const newItem = {
            id: Date.now(),
            nome,
            quantita,
            prezzo_acquisto: prezzo,
            categoria: 'Alcol'
        };
        store.magazzino.push(newItem);
        saveData();
        return { success: true, item: newItem, created: true };
    }
}

function rifornisciItem(nome, quantita) {
    const item = getItem(nome);
    if (!item) return { success: false, reason: 'Item non trovato.' };
    const cassa = store.cassa;
    const costoTotale = item.prezzo_acquisto * quantita;

    if (costoTotale > cassa.saldo_attuale) {
        return {
            success: false,
            reason: `Fondi insufficienti nel fondo cassa!\nCosto totale: **€${costoTotale.toLocaleString('it-IT')}**\nFondo cassa disponibile: **€${cassa.saldo_attuale.toLocaleString('it-IT')}**`
        };
    }

    cassa.saldo_attuale -= costoTotale;
    cassa.totale_spese += costoTotale;
    item.quantita += quantita;
    saveData();

    return {
        success: true,
        costoTotale,
        nuovoSaldo: cassa.saldo_attuale,
        nuovaQuantita: item.quantita
    };
}

function getCassa() {
    return { ...store.cassa };
}

function modificaFondoCassa(azione, valore) {
    const cassa = store.cassa;
    const vecchioSaldo = cassa.saldo_attuale;
    let nuovoSaldo = vecchioSaldo;

    if (azione === 'Aggiungi') {
        nuovoSaldo = vecchioSaldo + valore;
        cassa.saldo_attuale = nuovoSaldo;
        cassa.totale_incassi += valore;
    } else if (azione === 'Rimuovi') {
        if (valore > vecchioSaldo) {
            return { success: false, reason: `Impossibile rimuovere €${valore}. Il saldo attuale è solo €${vecchioSaldo}.` };
        }
        nuovoSaldo = vecchioSaldo - valore;
        cassa.saldo_attuale = nuovoSaldo;
        cassa.totale_spese += valore;
    } else if (azione === 'Imposta') {
        nuovoSaldo = valore;
        cassa.saldo_attuale = nuovoSaldo;
    }

    saveData();
    return { success: true, vecchioSaldo, nuovoSaldo };
}

function resetSettimanale() {
    const cassa = store.cassa;
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
    cassa.fondo_inizio_settimana = cassa.saldo_attuale;
    cassa.totale_spese = 0;
    cassa.totale_incassi = 0;
    cassa.inizio_settimana = dataOraFine;
    saveData();

    return report;
}

function getSettimanaConfig() {
    return { ...store.settimana_config };
}

function setSettimanaConfig(giorno_fine, orario_fine, canale_id) {
    store.settimana_config.giorno_fine = giorno_fine;
    store.settimana_config.orario_fine = orario_fine;
    store.settimana_config.canale_id = canale_id;
    saveData();
}

function getPannelloConfig() {
    return { ...store.pannello_config };
}

function setPannelloConfig(channel_id, message_id) {
    store.pannello_config.channel_id = channel_id;
    store.pannello_config.message_id = message_id;
    saveData();
}

function setLogCanaleFondocassa(canale_id) {
    store.log_canali.canale_fondocassa = canale_id;
    saveData();
}

function getLogCanaleFondocassa() {
    return store.log_canali.canale_fondocassa || null;
}

function logOperazione(user_id, tipo, dettaglio) {
    store.log_operazioni.push({
        id: Date.now(),
        user_id,
        tipo,
        dettaglio,
        timestamp: new Date().toISOString()
    });
    if (store.log_operazioni.length > 500) {
        store.log_operazioni = store.log_operazioni.slice(-500);
    }
    saveData();
}

module.exports = {
    db: null,
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
