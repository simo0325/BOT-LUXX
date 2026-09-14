const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { eliminaItem, logOperazione, getPannelloConfig } = require('../database/db');
const { createPanelPayload } = require('../utils/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elimina-articolo')
        .setDescription('Rimuove definitivamente un articolo dal catalogo e dal magazzino')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt =>
            opt.setName('nome')
                .setDescription('Nome esatto dell\'articolo da rimuovere')
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Non hai i permessi necessari per eliminare articoli dal magazzino.',
                ephemeral: true
            });
        }

        const nome = interaction.options.getString('nome').trim();
        const result = eliminaItem(nome);

        if (!result.success) {
            return interaction.reply({
                content: `❌ ${result.reason}`,
                ephemeral: true
            });
        }

        logOperazione(interaction.user.id, 'ELIMINA_ARTICOLO', `Rimosso articolo: ${result.item.nome} (Scorte: ${result.item.quantita} pz)`);

        const embed = new EmbedBuilder()
            .setTitle('🗑️ Articolo Rimosso')
            .setDescription(`L'articolo **${result.item.nome}** è stato eliminato definitivamente dal catalogo del Luxx Club.`)
            .setColor(0xE74C3C)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Aggiorna pannello persistente se presente
        const pCfg = getPannelloConfig();
        if (pCfg && pCfg.channel_id && pCfg.message_id) {
            try {
                const ch = await interaction.client.channels.fetch(pCfg.channel_id);
                if (ch) {
                    const msg = await ch.messages.fetch(pCfg.message_id);
                    if (msg) await msg.edit(createPanelPayload(interaction.client.emojisConfig));
                }
            } catch (e) {
                // Ignore silent update errors
            }
        }
    }
};
