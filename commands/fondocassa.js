const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { modificaFondoCassa, logOperazione, getPannelloConfig, getLogCanaleFondocassa } = require('../database/db');
const { createPanelPayload } = require('../utils/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fondocassa')
        .setDescription('Gestisce le finanze del fondo cassa del Luxx Club')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(option =>
            option.setName('azione')
                .setDescription('Azione da compiere sul fondo cassa')
                .setRequired(true)
                .addChoices(
                    { name: '➕ Aggiungi', value: 'Aggiungi' },
                    { name: '➖ Rimuovi', value: 'Rimuovi' },
                    { name: '⚙️ Imposta', value: 'Imposta' }
                )
        )
        .addIntegerOption(option =>
            option.setName('valore')
                .setDescription('Importo in euro')
                .setRequired(true)
                .setMinValue(1)
        )
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo o giustificativo obbligatorio dell\'operazione')
                .setRequired(true)
        ),

    async execute(interaction) {
        const azione = interaction.options.getString('azione');
        const valore = interaction.options.getInteger('valore');
        const motivo = interaction.options.getString('motivo').trim();

        const result = modificaFondoCassa(azione, valore);
        if (!result.success) {
            return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
        }

        logOperazione(interaction.user.id, `FONDO_CASSA_${azione.toUpperCase()}`, `Valore: €${valore} | Motivo: ${motivo} | Saldo: €${result.vecchioSaldo} -> €${result.nuovoSaldo}`);

        const embed = new EmbedBuilder()
            .setTitle('💼 Aggiornamento Fondo Cassa')
            .setDescription(`Operazione sul fondo cassa registrata con successo.`)
            .addFields(
                { name: '⚡ Azione', value: `\`${azione}\``, inline: true },
                { name: '💵 Importo', value: `\`€${valore.toLocaleString('it-IT')}\``, inline: true },
                { name: '👤 Operatore', value: `<@${interaction.user.id}>`, inline: true },
                { name: '📉 Saldo Precedente', value: `\`€${result.vecchioSaldo.toLocaleString('it-IT')}\``, inline: true },
                { name: '📈 Nuovo Saldo', value: `\`€${result.nuovoSaldo.toLocaleString('it-IT')}\``, inline: true },
                { name: '📝 Motivo', value: motivo, inline: false }
            )
            .setColor(azione === 'Rimuovi' ? 0xE74C3C : 0x2ECC71)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        // 1. Risposta personale ed effimera per l'utente (non visibile a tutti nel canale)
        await interaction.reply({ embeds: [embed], ephemeral: true });

        // 2. Invio automatico nella chat dedicata ai log configurata con /setlog-fondocassa
        const logChannelId = getLogCanaleFondocassa();
        if (logChannelId) {
            try {
                const logChannel = await interaction.client.channels.fetch(logChannelId);
                if (logChannel) {
                    await logChannel.send({ embeds: [embed] });
                }
            } catch (err) {
                console.error('Errore durante l\'invio al canale log del fondo cassa:', err);
            }
        }

        // 3. Aggiorna il pannello persistente se configurato
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
