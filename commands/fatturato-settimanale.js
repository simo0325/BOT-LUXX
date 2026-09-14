const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setSettimanaConfig, getSettimanaConfig, logOperazione } = require('../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fatturato-settimanale')
        .setDescription('Configura il giorno, orario e canale del resoconto fiscale e reset settimanale')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addIntegerOption(option =>
            option.setName('giorno')
                .setDescription('Giorno della settimana per la chiusura')
                .setRequired(true)
                .addChoices(
                    { name: 'Domenica', value: 0 },
                    { name: 'Lunedì', value: 1 },
                    { name: 'Martedì', value: 2 },
                    { name: 'Mercoledì', value: 3 },
                    { name: 'Giovedì', value: 4 },
                    { name: 'Venerdì', value: 5 },
                    { name: 'Sabato', value: 6 }
                )
        )
        .addStringOption(option =>
            option.setName('orario')
                .setDescription('Orario di chiusura nel formato HH:MM (es. 23:59)')
                .setRequired(true)
        )
        .addChannelOption(option =>
            option.setName('canale')
                .setDescription('Canale dove inviare il resoconto fiscale')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        const giorno = interaction.options.getInteger('giorno');
        const orario = interaction.options.getString('orario').trim();
        const canale = interaction.options.getChannel('canale');

        // Validazione orario HH:MM
        const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!timeRegex.test(orario)) {
            return interaction.reply({
                content: '❌ Formato orario non valido! Usa il formato 24h `HH:MM` (es: `23:59`, `20:00`, `00:30`).',
                ephemeral: true
            });
        }

        const giorniNomi = ['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'];

        setSettimanaConfig(giorno, orario, canale.id);
        logOperazione(interaction.user.id, 'CONFIG_SETTIMANA', `Impostato reset ogni ${giorniNomi[giorno]} alle ${orario} nel canale ${canale.id}`);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Configurazione Reset Settimanale Salvata')
            .setDescription('La chiusura contabile programmata è stata aggiornata.')
            .addFields(
                { name: '📅 Giorno di Chiusura', value: `\`${giorniNomi[giorno]}\``, inline: true },
                { name: '⏰ Orario', value: `\`${orario}\``, inline: true },
                { name: '📢 Canale Notifica', value: `${canale}`, inline: true }
            )
            .setColor(0x3498DB)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
