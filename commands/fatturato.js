const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getCassa } = require('../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fatturato')
        .setDescription('Mostra il riepilogo contabile e fiscale settimanale del Luxx Club'),

    async execute(interaction) {
        const cassa = getCassa();

        const fondoIniziale = cassa.fondo_inizio_settimana;
        const speseSettimana = cassa.totale_spese;
        const incassiSettimana = cassa.totale_incassi;
        const saldoAttualeCassa = cassa.saldo_attuale;

        // Fatturato della settimana (totale incassi registrati nel periodo)
        const fatturatoSettimanale = incassiSettimana;
        // Tasse calcolate al 5% del fatturato settimanale
        const tasse = Math.round(fatturatoSettimanale * 0.05);
        // Guadagno finale della settimana: Incassi Settimana - Spese Settimana - Tasse
        const guadagnoFinale = fatturatoSettimanale - speseSettimana - tasse;

        const embed = new EmbedBuilder()
            .setTitle('📊 Luxx Club — Rendiconto Contabile Settimanale')
            .setDescription('Riepilogo fiscale e contabile relativo esclusivamente alla settimana corrente.')
            .addFields(
                { name: '💰 Saldo Attuale in Cassa (Totale)', value: `\`€${saldoAttualeCassa.toLocaleString('it-IT')}\``, inline: false },
                { name: '🏦 Fondo Inizio Settimana', value: `\`€${fondoIniziale.toLocaleString('it-IT')}\``, inline: true },
                { name: '📈 Incassi della Settimana', value: `\`€${incassiSettimana.toLocaleString('it-IT')}\``, inline: true },
                { name: '📉 Spese della Settimana', value: `\`€${speseSettimana.toLocaleString('it-IT')}\``, inline: true },
                { name: '📊 Fatturato Settimanale Lordo', value: `\`€${fatturatoSettimanale.toLocaleString('it-IT')}\``, inline: true },
                { name: '🏛️ Tasse da Pagare (5%)', value: `\`€${tasse.toLocaleString('it-IT')}\``, inline: true },
                { name: '✨ Guadagno Finale', value: `\`€${guadagnoFinale.toLocaleString('it-IT')}\``, inline: true }
            )
            .setColor(guadagnoFinale >= 0 ? 0x2ECC71 : 0xE74C3C)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
