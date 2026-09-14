const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { spawn } = require('child_process');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('restart')
        .setDescription('🔄 Riavvia il bot del Luxx Club')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({
                content: '❌ Solo gli amministratori possono riavviare il bot.',
                ephemeral: true
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('🔄 Riavvio in Corso...')
            .setDescription('Il bot si sta riavviando in automatico. Sarà nuovamente operativo tra pochi secondi!')
            .setFooter({ text: 'Developed By Rizzus' })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });

        setTimeout(() => {
            const rootDir = path.resolve(__dirname, '..');
            const scriptPath = path.join(rootDir, 'index.js');

            // Avvia la nuova istanza del bot completamente distaccata dal processo attuale
            const child = spawn(process.execPath, [scriptPath], {
                cwd: rootDir,
                detached: true,
                stdio: 'ignore',
                windowsHide: false
            });
            child.unref();

            // Termina l'istanza corrente
            process.exit(0);
        }, 1200);
    }
};
