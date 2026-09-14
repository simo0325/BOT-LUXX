const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { setItem, logOperazione, getPannelloConfig } = require('../database/db');
const { createPanelPayload } = require('../utils/panel');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('imposta-articolo')
        .setDescription('Aggiunge o modifica un articolo a catalogo con prezzo e categoria')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(opt =>
            opt.setName('nome')
                .setDescription('Nome dell\'articolo (es. Hamburger Deluxe, RedBull, Vodka Belvedere)')
                .setRequired(true)
        )
        .addStringOption(opt =>
            opt.setName('categoria')
                .setDescription('Categoria di appartenenza dell\'articolo')
                .setRequired(true)
                .addChoices(
                    { name: '🍔 Cibo', value: 'Cibo' },
                    { name: '🥤 Bevanda', value: 'Bevanda' },
                    { name: '🍸 Alcol', value: 'Alcol' }
                )
        )
        .addIntegerOption(opt =>
            opt.setName('prezzo')
                .setDescription('Prezzo unitario di acquisto in euro')
                .setRequired(true)
                .setMinValue(0)
        )
        .addIntegerOption(opt =>
            opt.setName('quantita')
                .setDescription('Scorta iniziale / impostata (opzionale)')
                .setRequired(false)
                .setMinValue(0)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.ManageGuild) && !interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Non hai i permessi necessari per gestire gli articoli del magazzino.',
                ephemeral: true
            });
        }

        const nome = interaction.options.getString('nome').trim();
        const categoria = interaction.options.getString('categoria');
        const prezzo = interaction.options.getInteger('prezzo');
        const quantita = interaction.options.getInteger('quantita');

        const result = setItem(nome, prezzo, quantita, categoria);
        logOperazione(
            interaction.user.id,
            result.created ? 'CREA_ARTICOLO' : 'MODIFICA_ARTICOLO',
            `Articolo: ${nome} | Categoria: ${categoria} | Prezzo: €${prezzo}${quantita !== null ? ` | Scorta: ${quantita} pz` : ''}`
        );

        const categoryIcons = {
            'Cibo': '🍔',
            'Bevanda': '🥤',
            'Alcol': '🍸'
        };

        const embed = new EmbedBuilder()
            .setTitle(result.created ? '✨ Nuovo Articolo Registrato' : '⚙️ Articolo Aggiornato')
            .setDescription(`L'articolo **${result.item.nome}** è stato salvato con successo nel catalogo.`)
            .addFields(
                { name: '📦 Nome Articolo', value: `\`${result.item.nome}\``, inline: true },
                { name: '📂 Categoria', value: `${categoryIcons[categoria] || '🏷️'} \`${categoria}\``, inline: true },
                { name: '🏷️ Prezzo Unitario', value: `\`€${result.item.prezzo_acquisto.toLocaleString('it-IT')}\``, inline: true },
                { name: '📊 Giacenza Attuale', value: `\`${result.item.quantita} pz\``, inline: true }
            )
            .setColor(0x2ECC71)
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
