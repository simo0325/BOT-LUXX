const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getMagazzino, getCassa } = require('../database/db');

function formatEmoji(emojiIdOrChar, fallback) {
    if (!emojiIdOrChar) return fallback;
    if (emojiIdOrChar.length > 10) return `<:emoji:${emojiIdOrChar}>`;
    return emojiIdOrChar;
}

function createPanelPayload(emojisConfig = {}) {
    const items = getMagazzino();
    const cassa = getCassa();

    // Raggruppamento per categoria
    const cibi = items.filter(i => (i.categoria || '').toLowerCase() === 'cibo');
    const bibite = items.filter(i => (i.categoria || '').toLowerCase() === 'bevanda');
    const alcolici = items.filter(i => (i.categoria || '').toLowerCase() === 'alcol' || (i.categoria || '').toLowerCase() === 'alchol');
    const altri = items.filter(i => !['cibo', 'bevanda', 'alcol', 'alchol'].includes((i.categoria || '').toLowerCase()));

    const tipiTotali = items.length;
    const pezziTotali = items.reduce((acc, curr) => acc + (curr.quantita || 0), 0);

    const emojiCibo = formatEmoji(emojisConfig?.cibo, '🍔');
    const emojiBibita = formatEmoji(emojisConfig?.bibita, '🥤');
    const emojiAlcol = formatEmoji(emojisConfig?.alcol, '🍸');

    let sezioni = [];

    // Sezione Cibi
    let sezioneCibi = `**${emojiCibo} CIBI IN SCORTA:**\n`;
    if (cibi.length === 0) {
        sezioneCibi += '*- Nessun articolo registrato*\n';
    } else {
        sezioneCibi += cibi.map(i => `- **${i.nome}**: \`${i.quantita} pz\` - \`€${i.prezzo_acquisto.toLocaleString('it-IT')}\``).join('\n') + '\n';
    }
    sezioni.push(sezioneCibi);

    // Sezione Bibite
    let sezioneBibite = `**${emojiBibita} BIBITE IN SCORTA:**\n`;
    if (bibite.length === 0) {
        sezioneBibite += '*- Nessun articolo registrato*\n';
    } else {
        sezioneBibite += bibite.map(i => `- **${i.nome}**: \`${i.quantita} pz\` - \`€${i.prezzo_acquisto.toLocaleString('it-IT')}\``).join('\n') + '\n';
    }
    sezioni.push(sezioneBibite);

    // Sezione Alcolici
    let sezioneAlcol = `**${emojiAlcol} ALCOLICI IN SCORTA:**\n`;
    if (alcolici.length === 0) {
        sezioneAlcol += '*- Nessun articolo registrato*\n';
    } else {
        sezioneAlcol += alcolici.map(i => `- **${i.nome}**: \`${i.quantita} pz\` - \`€${i.prezzo_acquisto.toLocaleString('it-IT')}\``).join('\n') + '\n';
    }
    sezioni.push(sezioneAlcol);

    if (altri.length > 0) {
        let sezioneAltri = `**📦 ALTRI ARTICOLI:**\n` +
            altri.map(i => `- **${i.nome}**: \`${i.quantita} pz\` - \`€${i.prezzo_acquisto.toLocaleString('it-IT')}\``).join('\n') + '\n';
        sezioni.push(sezioneAltri);
    }

    const descrizione = sezioni.join('\n');

    const embed = new EmbedBuilder()
        .setTitle('🍸 Luxx Club — Gestione Magazzino & Scorte')
        .setDescription(descrizione)
        .addFields(
            { name: '💰 Fondo Cassa Attuale', value: `\`€${cassa.saldo_attuale.toLocaleString('it-IT')}\``, inline: true },
            { name: '🏷️ Tipi di Articoli', value: `\`${tipiTotali} tipi\``, inline: true },
            { name: '📦 Pezzi Totali a Magazzino', value: `\`${pezziTotali} pz\``, inline: true }
        )
        .setColor(0x9B59B6)
        .setFooter({ text: 'Developed By Rizzus' })
        .setTimestamp();

    // Tasti del pannello:
    // - Tasto verde: Rifornisci (+ verde)
    // - Tasto rosso: Preleva (- rosso)
    const btnRifornisci = new ButtonBuilder()
        .setCustomId('btn_rifornisci')
        .setLabel('Rifornisci')
        .setStyle(ButtonStyle.Success);

    if (emojisConfig?.plus) {
        btnRifornisci.setEmoji(emojisConfig.plus);
    } else {
        btnRifornisci.setEmoji('➕');
    }

    const btnPreleva = new ButtonBuilder()
        .setCustomId('btn_preleva')
        .setLabel('Preleva')
        .setStyle(ButtonStyle.Danger);

    if (emojisConfig?.minus) {
        btnPreleva.setEmoji(emojisConfig.minus);
    } else {
        btnPreleva.setEmoji('➖');
    }

    const row = new ActionRowBuilder().addComponents(btnRifornisci, btnPreleva);

    return { embeds: [embed], components: [row] };
}

module.exports = { createPanelPayload };
