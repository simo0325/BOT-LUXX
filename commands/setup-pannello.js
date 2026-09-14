const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createPanelPayload } = require('../utils/panel');
const { setPannelloConfig, logOperazione } = require('../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-pannello')
        .setDescription('Invia il pannello interattivo del magazzino e della cassa del Luxx Club')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Non hai i permessi necessari per eseguire questo comando (Richiesto: Gestore o Admin).',
                ephemeral: true
            });
        }

        await interaction.deferReply({ ephemeral: true });

        const payload = createPanelPayload(interaction.client.emojisConfig);
        const msg = await interaction.channel.send(payload);

        setPannelloConfig(interaction.channelId, msg.id);
        logOperazione(interaction.user.id, 'SETUP_PANNELLO', `Pannello configurato nel canale ${interaction.channelId}`);

        return interaction.editReply({
            content: `✅ **Pannello creato con successo!** [Vai al messaggio](${msg.url})`
        });
    }
};
