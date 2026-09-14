const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('developer')
        .setDescription('Mostra i crediti e le informazioni dello sviluppatore'),

    async execute(interaction) {
        let devInfo = {
            name: process.env.DEV_NAME || 'Developer',
            discord_tag: process.env.DEV_TAG || 'N/A',
            discord_id: process.env.DEV_ID || '',
            website_or_link: process.env.DEV_LINK || 'N/A',
            notes: 'Bot per la gestione del magazzino e finanze del Luxx Club.'
        };

        const configPath = path.join(__dirname, '..', 'config.json');
        if (fs.existsSync(configPath)) {
            try {
                const raw = fs.readFileSync(configPath, 'utf-8');
                const parsed = JSON.parse(raw);
                devInfo = { ...devInfo, ...parsed };
            } catch (err) {
                console.error('Errore nella lettura di config.json:', err);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle('💻 Crediti Sviluppatore')
            .setDescription(`Informazioni sullo sviluppo e manutenzione del bot Luxx Club.`)
            .addFields(
                { name: '👤 Autore / Team', value: `\`${devInfo.name}\``, inline: true },
                { name: '🏷️ Discord Tag', value: `\`${devInfo.discord_tag}\``, inline: true },
                { name: '🔗 Riferimenti / Link', value: devInfo.website_or_link ? `[Clicca Qui](${devInfo.website_or_link})` : 'N/A', inline: true },
                { name: '📜 Informazioni', value: devInfo.notes || 'N/A', inline: false }
            )
            .setColor(0x5865F2)
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
