const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('📖 Mostra la guida dettagliata di tutti i comandi disponibili del Luxx Club'),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🍸 Luxx Club — Guida & Lista Comandi')
            .setDescription('Ecco l\'elenco completo di tutti i comandi slash disponibili per la gestione del magazzino e delle finanze del locale.')
            .addFields(
                {
                    name: '📦 Gestione Magazzino & Catalogo',
                    value: 
                        '• `/setup-pannello`\n' +
                        '┗ *Invia il pannello interattivo in tempo reale con le giacenze (Cibi, Bibite, Alcolici) e i bottoni: Rifornisci e Preleva.*\n\n' +
                        '• `/imposta-articolo [nome] [categoria] [prezzo] (quantita)`\n' +
                        '┗ *Aggiunge o modifica un articolo a catalogo selezionando la categoria (Cibo, Bevanda, Alcol), il costo d\'acquisto e la scorta.*\n\n' +
                        '• `/elimina-articolo [nome]`\n' +
                        '┗ *Elimina definitivamente un prodotto dal magazzino e dal catalogo.*'
                },
                {
                    name: '💰 Gestione Cassa',
                    value: 
                        '• `/fondocassa [azione] [valore] [motivo]`\n' +
                        '┗ *Permette di Aggiungere, Rimuovere o Impostare il saldo del fondo cassa con motivo obbligatorio. Mostra un messaggio personale e invia il log nel canale dedicato.*\n\n' +
                        '• `/setlog-fondocassa [canale]`\n' +
                        '┗ *Imposta il canale dove inviare i log dettagliati di tutte le operazioni del fondo cassa (solo Admin).*'
                },
                {
                    name: '📊 Contabilità & Fiscale',
                    value: 
                        '• `/fatturato`\n' +
                        '┗ *Visualizza il rendiconto settimanale: fondo iniziale, incassi, spese, fatturato lordo della settimana, 5% tasse, Guadagno Finale e saldo totale in cassa.*\n\n' +
                        '• `/fatturato-settimanale [giorno] [orario] [canale]`\n' +
                        '┗ *Imposta la chiusura e il reset contabile automatico ogni settimana.*\n\n' +
                        '• `/termina-settimana (invia_nel_canale_configurato)`\n' +
                        '┗ *Chiude manualmente la settimana in qualsiasi momento, genera il report fiscale, invia la notifica all\'altro bot e azzera il ciclo.*'
                },
                {
                    name: '⚙️ Sistema & Crediti',
                    value: 
                        '• `/help`\n' +
                        '┗ *Mostra questa guida informativa con tutti i comandi.*\n\n' +
                        '• `/developer`\n' +
                        '┗ *Mostra i crediti e le informazioni dello sviluppatore.*\n\n' +
                        '• `/restart`\n' +
                        '┗ *Riavvia automaticamente il bot da Discord in pochi secondi (solo Admin).*'
                }
            )
            .setColor(0x9B59B6)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
