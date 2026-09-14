const { SlashCommandBuilder, ChannelType, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { setLogCanaleFondocassa, logOperazione } = require('../database/db');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setlog-fondocassa')
        .setDescription('Imposta il canale dove inviare i log delle operazioni sul fondo cassa')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addChannelOption(opt =>
            opt.setName('canale')
                .setDescription('Canale testuale per i log del fondo cassa')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
        ),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Solo gli amministratori possono configurare il canale di log.',
                ephemeral: true
            });
        }

        const canale = interaction.options.getChannel('canale');
        setLogCanaleFondocassa(canale.id);
        logOperazione(interaction.user.id, 'CONFIG_LOG_FONDOCASSA', `Canale log fondo cassa impostato su ${canale.id}`);

        const embed = new EmbedBuilder()
            .setTitle('⚙️ Canale Log Fondo Cassa Impostato')
            .setDescription(`Tutte le modifiche future effettuate con \`/fondocassa\` verranno registrate nel canale ${canale}.`)
            .setColor(0x2ECC71)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
