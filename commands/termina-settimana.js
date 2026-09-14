const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { resetSettimanale, logOperazione, getSettimanaConfig, getPannelloConfig } = require('../database/db');
const { createPanelPayload } = require('../utils/panel');
const { sendExternalWeeklyNotification } = require('../utils/externalNotifier');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('termina-settimana')
        .setDescription('Esegue manualmente la chiusura contabile settimanale e azzera il ciclo')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addBooleanOption(opt =>
            opt.setName('invia_nel_canale_configurato')
                .setDescription('Invia il report anche nel canale ufficiale impostato (se configurato)')
                .setRequired(false)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Solo gli amministratori possono eseguire manualmente la chiusura contabile della settimana.',
                ephemeral: true
            });
        }

        const inviaCanaleUfficiale = interaction.options.getBoolean('invia_nel_canale_configurato') ?? true;

        // Esegue il reset e calcolo fiscale
        const report = resetSettimanale();

        logOperazione(
            interaction.user.id,
            'CHIUSURA_MANUALE_SETTIMANA',
            `Chiusura manuale eseguita da ${interaction.user.tag}: Incassi €${report.incassi}, Spese €${report.spese}, Tasse €${report.tasse}, Guadagno Finale €${report.utileNetto}`
        );

        const embed = new EmbedBuilder()
            .setTitle('🏛️ Luxx Club — Chiusura Fiscale & Contabile Settimanale')
            .setDescription(`Chiusura contabile della settimana eseguita manualmente da <@${interaction.user.id}>.\nIl ciclo contabile è stato archiviato e azzerato.`)
            .addFields(
                { name: '🏦 Fondo Iniziale', value: `\`€${report.fondoIniziale.toLocaleString('it-IT')}\``, inline: true },
                { name: '📉 Spese Totali Periodo', value: `\`€${report.spese.toLocaleString('it-IT')}\``, inline: true },
                { name: '📈 Incassi Totali Periodo', value: `\`€${report.incassi.toLocaleString('it-IT')}\``, inline: true },
                { name: '📊 Fatturato Lordo', value: `\`€${report.fatturatoLordo.toLocaleString('it-IT')}\``, inline: true },
                { name: '🏛️ Tasse Dovute (5%)', value: `\`€${report.tasse.toLocaleString('it-IT')}\``, inline: true },
                { name: '✨ Guadagno Finale', value: `\`€${report.utileNetto.toLocaleString('it-IT')}\``, inline: true },
                { name: '💰 Nuovo Fondo Inizio Settimana', value: `\`€${report.saldoAttuale.toLocaleString('it-IT')}\``, inline: false }
            )
            .setColor(0xF1C40F)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        // Invia notifica testuale (non embed) alla chat/bot esterno
        await sendExternalWeeklyNotification(interaction.client, report.messaggioTestuale);

        // Invia anche nel canale di log/settimana configurato se diverso dal canale corrente
        if (inviaCanaleUfficiale) {
            const config = getSettimanaConfig();
            if (config && config.canale_id && config.canale_id !== interaction.channelId) {
                try {
                    const officialChannel = await interaction.client.channels.fetch(config.canale_id);
                    if (officialChannel) {
                        await officialChannel.send({ embeds: [embed] });
                    }
                } catch (err) {
                    console.error('Errore invio copia nel canale configurato:', err);
                }
            }
        }

        // Aggiorna il pannello persistente in tempo reale
        const pCfg = getPannelloConfig();
        if (pCfg && pCfg.channel_id && pCfg.message_id) {
            try {
                const ch = await interaction.client.channels.fetch(pCfg.channel_id);
                if (ch) {
                    const msg = await ch.messages.fetch(pCfg.message_id);
                    if (msg) await msg.edit(createPanelPayload(interaction.client.emojisConfig));
                }
            } catch (err) {
                // Ignore silent update errors
            }
        }
    }
};
