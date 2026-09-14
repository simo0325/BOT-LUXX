require('dotenv').config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const {
    Client,
    GatewayIntentBits,
    Collection,
    Events,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder,
    REST,
    Routes
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const {
    db,
    getMagazzino,
    getItem,
    prelevaItem,
    rifornisciItem,
    getCassa,
    resetSettimanale,
    getSettimanaConfig,
    getPannelloConfig,
    logOperazione
} = require('./database/db');
const { createPanelPayload } = require('./utils/panel');
const { sendExternalWeeklyNotification } = require('./utils/externalNotifier');

// ═══════════════════════════════════════════════════════════════
// INIZIALIZZAZIONE CLIENT
// ═══════════════════════════════════════════════════════════════

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ],
});

client.emojisConfig = {
    box: null,
    plus: null,
    minus: null,
    cibo: null,
    bibita: null,
    alcol: null
};

// ═══════════════════════════════════════════════════════════════
// CARICAMENTO COMANDI SLASH
// ═══════════════════════════════════════════════════════════════

client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        commands.push(command.data.toJSON());
        console.log(`📋 Comando caricato: /${command.data.name}`);
    }
}

// ═══════════════════════════════════════════════════════════════
// SETUP EMOJI PERSONALIZZATE
// ═══════════════════════════════════════════════════════════════

async function setupCustomEmojis() {
    try {
        const guildId = process.env.GUILD_ID;
        const guild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
        if (!guild) return;

        const emojiDefinitions = [
            { key: 'box', name: 'luxx_box', file: 'box.png' },
            { key: 'plus', name: 'luxx_plus', file: 'plus_green.png' },
            { key: 'minus', name: 'luxx_minus', file: 'minus_red.png' },
            { key: 'cibo', name: 'luxx_cibo', file: 'cibo_burger.png' },
            { key: 'bibita', name: 'luxx_bibita', file: 'bibita_drink.png' },
            { key: 'alcol', name: 'luxx_alcol', file: 'alcol_cocktail.png' }
        ];

        for (const def of emojiDefinitions) {
            let emoji = guild.emojis.cache.find(e => e.name === def.name);
            if (!emoji) {
                const filePath = path.join(__dirname, 'assets', def.file);
                if (fs.existsSync(filePath)) {
                    try {
                        emoji = await guild.emojis.create({
                            attachment: filePath,
                            name: def.name
                        });
                        console.log(`✨ Emoji caricata: :${def.name}: (${emoji.id})`);
                    } catch (e) {
                        console.log(`⚠️ Impossibile creare emoji ${def.name}: ${e.message}`);
                    }
                }
            }
            if (emoji) {
                client.emojisConfig[def.key] = emoji.id;
            }
        }
    } catch (err) {
        console.error('Errore setup emoji:', err.message);
    }
}

// ═══════════════════════════════════════════════════════════════
// EVENTO READY & REGISTRAZIONE COMANDI
// ═══════════════════════════════════════════════════════════════

client.once(Events.ClientReady, async (c) => {
    console.log('');
    console.log('═══════════════════════════════════════════════');
    console.log(`🍸 Bot online come: ${c.user.tag}`);
    console.log(`📊 Server collegati: ${c.guilds.cache.size}`);
    console.log(`📋 Comandi registrati: ${client.commands.size}`);
    console.log(`🕐 ${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })}`);
    console.log('═══════════════════════════════════════════════');
    console.log('');

    await setupCustomEmojis();

    // Registrazione rapida comandi Slash
    if (process.env.CLIENT_ID && process.env.DISCORD_TOKEN) {
        try {
            const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
            if (process.env.GUILD_ID) {
                await rest.put(
                    Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                    { body: commands }
                );
                console.log(`✅ Comandi slash aggiornati sul server ${process.env.GUILD_ID}!`);
            } else {
                await rest.put(
                    Routes.applicationCommands(process.env.CLIENT_ID),
                    { body: commands }
                );
                console.log(`✅ Comandi slash registrati globalmente!`);
            }
        } catch (err) {
            console.error('⚠️ Errore registrazione automatica comandi:', err.message);
        }
    }

    // Controllo reset settimanale programmato ogni 60 secondi
    setInterval(() => {
        checkAutoReset();
    }, 60000);
});

// ═══════════════════════════════════════════════════════════════
// FUNZIONE AGGIORNAMENTO PANNELLO PERSISTENTE
// ═══════════════════════════════════════════════════════════════

async function updatePersistentPanel() {
    try {
        const pCfg = getPannelloConfig();
        if (!pCfg || !pCfg.channel_id || !pCfg.message_id) return;

        const channel = await client.channels.fetch(pCfg.channel_id).catch(() => null);
        if (!channel) return;

        const message = await channel.messages.fetch(pCfg.message_id).catch(() => null);
        if (!message) return;

        await message.edit(createPanelPayload(client.emojisConfig));
    } catch (err) {
        console.error('Errore durante l\'aggiornamento del pannello:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// GESTIONE INTERAZIONI (SLASH, BOTTONI, SELECT, MODAL)
// ═══════════════════════════════════════════════════════════════

client.on(Events.InteractionCreate, async (interaction) => {
    try {
        // ── 1. GESTIONE COMANDI SLASH ──
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;
            return await command.execute(interaction);
        }

        // ── 2. GESTIONE BOTTONI ──
        if (interaction.isButton()) {

            // A) VEDI INVENTARIO
            if (interaction.customId === 'btn_vedi_inventario') {
                const items = getMagazzino();
                const cassa = getCassa();
                const tipiTotali = items.length;
                const pezziTotali = items.reduce((acc, curr) => acc + (curr.quantita || 0), 0);
                const valoreTotaleMagazzino = items.reduce((acc, curr) => acc + (curr.quantita * curr.prezzo_acquisto), 0);

                if (items.length === 0) {
                    return interaction.reply({
                        content: '📦 **L\'inventario del Luxx Club è attualmente vuoto.**\nUsa `/imposta-articolo` o premi **Rifornisci** per aggiungere articoli.',
                        ephemeral: true
                    });
                }

                // Raggruppamento per categoria
                const cibi = items.filter(i => (i.categoria || '').toLowerCase() === 'cibo');
                const bibite = items.filter(i => (i.categoria || '').toLowerCase() === 'bevanda');
                const alcolici = items.filter(i => (i.categoria || '').toLowerCase() === 'alcol' || (i.categoria || '').toLowerCase() === 'alchol');
                const altri = items.filter(i => !['cibo', 'bevanda', 'alcol', 'alchol'].includes((i.categoria || '').toLowerCase()));

                let lines = [];
                if (cibi.length > 0) {
                    lines.push('**🍔 CIBI:**');
                    cibi.forEach(i => lines.push(`• **${i.nome}**: \`${i.quantita} pz\` • Prezzo acq: \`€${i.prezzo_acquisto}\` • Tot: \`€${i.quantita * i.prezzo_acquisto}\``));
                    lines.push('');
                }
                if (bibite.length > 0) {
                    lines.push('**🥤 BIBITE:**');
                    bibite.forEach(i => lines.push(`• **${i.nome}**: \`${i.quantita} pz\` • Prezzo acq: \`€${i.prezzo_acquisto}\` • Tot: \`€${i.quantita * i.prezzo_acquisto}\``));
                    lines.push('');
                }
                if (alcolici.length > 0) {
                    lines.push('**🍸 ALCOLICI:**');
                    alcolici.forEach(i => lines.push(`• **${i.nome}**: \`${i.quantita} pz\` • Prezzo acq: \`€${i.prezzo_acquisto}\` • Tot: \`€${i.quantita * i.prezzo_acquisto}\``));
                    lines.push('');
                }
                if (altri.length > 0) {
                    lines.push('**📦 ALTRI ARTICOLI:**');
                    altri.forEach(i => lines.push(`• **${i.nome}**: \`${i.quantita} pz\` • Prezzo acq: \`€${i.prezzo_acquisto}\` • Tot: \`€${i.quantita * i.prezzo_acquisto}\``));
                    lines.push('');
                }

                const embed = new EmbedBuilder()
                    .setTitle('📦 Luxx Club — Inventario Completo')
                    .setDescription(lines.join('\n'))
                    .addFields(
                        { name: '🏷️ Tipi di Articoli', value: `\`${tipiTotali} varietà\``, inline: true },
                        { name: '📊 Pezzi Complessivi', value: `\`${pezziTotali} pz\``, inline: true },
                        { name: '💎 Valore Merce a Magazzino', value: `\`€${valoreTotaleMagazzino.toLocaleString('it-IT')}\``, inline: true },
                        { name: '💰 Fondo Cassa Attuale', value: `\`€${cassa.saldo_attuale.toLocaleString('it-IT')}\``, inline: true }
                    )
                    .setColor(0x3498DB)
                    .setFooter({ text: 'Developed By Rizzus' })
                    .setTimestamp();

                return await interaction.reply({
                    embeds: [embed],
                    ephemeral: true
                });
            }

            // B) RIFORNISCI (Menù a tendina con categoria, nome e prezzo)
            if (interaction.customId === 'btn_rifornisci') {
                const roleId = process.env.ROLE_RIFORNIMENTO;
                const memberRoles = interaction.member?.roles;
                const hasRole = roleId && memberRoles?.cache?.has(roleId);
                const isAdmin = interaction.memberPermissions?.has('Administrator') || interaction.memberPermissions?.has('ManageGuild');

                if (!hasRole && !isAdmin) {
                    return interaction.reply({
                        content: '🚫 **Accesso Negato:** Non possiedi il ruolo autorizzato per effettuare rifornimenti.',
                        ephemeral: true
                    });
                }

                const items = getMagazzino();
                const cassa = getCassa();

                if (items.length === 0) {
                    return interaction.reply({
                        content: '📦 **Nessun articolo a catalogo.**\nUsa prima il comando `/imposta-articolo` per registrare gli articoli con nome, categoria e prezzo.',
                        ephemeral: true
                    });
                }

                // Opzioni menù a tendina
                const selectOptions = items.slice(0, 25).map(item => {
                    const cat = (item.categoria || 'Alcol').toLowerCase();
                    const emojiCat = cat === 'cibo' ? '🍔' : cat === 'bevanda' ? '🥤' : '🍸';
                    return {
                        label: `${item.nome}`,
                        description: `[${item.categoria || 'Alcol'}] Prezzo: €${item.prezzo_acquisto.toLocaleString('it-IT')} | Giacenza: ${item.quantita} pz`,
                        value: String(item.id),
                        emoji: emojiCat
                    };
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_rifornisci')
                    .setPlaceholder('Scegli l\'articolo da rifornire...')
                    .addOptions(selectOptions);

                const embed = new EmbedBuilder()
                    .setTitle('🟧 Rifornimento Merci — Luxx Club')
                    .setDescription('Seleziona l\'articolo dal menù a tendina sottostante.\nSubito dopo si aprirà il modulo per inserire la quantità, e il costo verrà scalato dal fondo cassa.')
                    .addFields(
                        { name: '💰 Fondo Cassa Disponibile', value: `\`€${cassa.saldo_attuale.toLocaleString('it-IT')}\``, inline: true },
                        { name: '📦 Articoli a Catalogo', value: `\`${items.length}\``, inline: true }
                    )
                    .setColor(0x27AE60)
                    .setFooter({ text: 'Developed By Rizzus' });

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }

            // C) PRELEVA (Menù a tendina)
            if (interaction.customId === 'btn_preleva') {
                const items = getMagazzino();
                if (items.length === 0) {
                    return interaction.reply({
                        content: '📦 **Il magazzino è vuoto.** Non ci sono articoli disponibili da prelevare.',
                        ephemeral: true
                    });
                }

                const selectOptions = items.slice(0, 25).map(item => {
                    const cat = (item.categoria || 'Alcol').toLowerCase();
                    const emojiCat = cat === 'cibo' ? '🍔' : cat === 'bevanda' ? '🥤' : '🍸';
                    return {
                        label: `${item.nome}`,
                        description: `[${item.categoria || 'Alcol'}] Scorte disponibili: ${item.quantita} pz`,
                        value: String(item.id),
                        emoji: emojiCat
                    };
                });

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('select_preleva')
                    .setPlaceholder('Scegli l\'articolo da prelevare...')
                    .addOptions(selectOptions);

                const embed = new EmbedBuilder()
                    .setTitle('✖️ Prelievo Merci — Luxx Club')
                    .setDescription('Seleziona dal menù a tendina l\'articolo da prelevare dal magazzino.')
                    .setColor(0xE74C3C)
                    .setFooter({ text: 'Developed By Rizzus' });

                const row = new ActionRowBuilder().addComponents(selectMenu);

                return await interaction.reply({
                    embeds: [embed],
                    components: [row],
                    ephemeral: true
                });
            }
        }

        // ── 3. GESTIONE SELECT MENU ──
        if (interaction.isStringSelectMenu()) {

            // Selezione articolo da RIFORNIRE
            if (interaction.customId === 'select_rifornisci') {
                const itemId = interaction.values[0];
                const item = db.prepare('SELECT * FROM magazzino WHERE id = ?').get(itemId);

                if (!item) {
                    return interaction.reply({ content: '❌ Articolo non trovato.', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_rifornisci_${item.id}`)
                    .setTitle(`Rifornisci: ${item.nome.slice(0, 30)}`);

                const quantitaInput = new TextInputBuilder()
                    .setCustomId('item_quantita')
                    .setLabel(`Quantità (Prezzo unitario: €${item.prezzo_acquisto})`)
                    .setPlaceholder('Es: 10, 25, 50...')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(quantitaInput));
                return await interaction.showModal(modal);
            }

            // Selezione articolo da PRELEVARE
            if (interaction.customId === 'select_preleva') {
                const itemId = interaction.values[0];
                const item = db.prepare('SELECT * FROM magazzino WHERE id = ?').get(itemId);

                if (!item) {
                    return interaction.reply({ content: '❌ Articolo non trovato.', ephemeral: true });
                }

                const modal = new ModalBuilder()
                    .setCustomId(`modal_preleva_${item.id}`)
                    .setTitle(`Preleva: ${item.nome.slice(0, 30)}`);

                const quantitaInput = new TextInputBuilder()
                    .setCustomId('item_quantita')
                    .setLabel(`Quantità da prelevare (Disp: ${item.quantita} pz)`)
                    .setPlaceholder('Es: 2')
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true);

                modal.addComponents(new ActionRowBuilder().addComponents(quantitaInput));
                return await interaction.showModal(modal);
            }
        }

        // ── 4. GESTIONE MODAL SUBMIT ──
        if (interaction.isModalSubmit()) {

            // SUBMIT PRELEVA
            if (interaction.customId.startsWith('modal_preleva_')) {
                const itemId = interaction.customId.replace('modal_preleva_', '');
                const item = db.prepare('SELECT * FROM magazzino WHERE id = ?').get(itemId);

                if (!item) {
                    return interaction.reply({ content: '❌ Articolo non trovato.', ephemeral: true });
                }

                const quantitaStr = interaction.fields.getTextInputValue('item_quantita').trim();
                const quantita = parseInt(quantitaStr, 10);

                if (isNaN(quantita) || quantita <= 0) {
                    return interaction.reply({ content: '❌ Inserisci una quantità numerica valida maggiore di zero.', ephemeral: true });
                }

                const result = prelevaItem(item.nome, quantita);
                if (!result.success) {
                    return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
                }

                logOperazione(interaction.user.id, 'PRELIEVO', `Prelevati ${quantita}x ${item.nome}`);
                await updatePersistentPanel();

                const embed = new EmbedBuilder()
                    .setTitle('✖️ Prelievo Effettuato')
                    .setDescription(`Hai prelevato con successo la merce dal magazzino.`)
                    .addFields(
                        { name: '📦 Articolo', value: `\`${item.nome}\``, inline: true },
                        { name: '📂 Categoria', value: `\`${item.categoria || 'Alcol'}\``, inline: true },
                        { name: '➖ Quantità Prelevata', value: `\`${quantita} pz\``, inline: true },
                        { name: '📊 Nuova Scorta', value: `\`${result.item.quantita} pz\``, inline: true }
                    )
                    .setColor(0xE74C3C)
                    .setFooter({ text: 'Developed By Rizzus' })
                    .setTimestamp();

                return interaction.reply({ embeds: [embed], ephemeral: true });
            }

            // SUBMIT RIFORNISCI
            if (interaction.customId.startsWith('modal_rifornisci_')) {
                const itemId = interaction.customId.replace('modal_rifornisci_', '');
                const item = db.prepare('SELECT * FROM magazzino WHERE id = ?').get(itemId);

                if (!item) {
                    return interaction.reply({ content: '❌ Articolo non trovato.', ephemeral: true });
                }

                const quantitaStr = interaction.fields.getTextInputValue('item_quantita').trim();
                const quantita = parseInt(quantitaStr, 10);
                if (isNaN(quantita) || quantita <= 0) {
                    return interaction.reply({ content: '❌ Inserisci una quantità valida maggiore di zero.', ephemeral: true });
                }

                const result = rifornisciItem(item.nome, quantita);
                if (!result.success) {
                    return interaction.reply({ content: `❌ ${result.reason}`, ephemeral: true });
                }

                logOperazione(interaction.user.id, 'RIFORNIMENTO', `Riforniti ${quantita}x ${item.nome} per un totale di €${result.costoTotale}`);
                await updatePersistentPanel();

                const ricevutaEmbed = new EmbedBuilder()
                    .setTitle('➕ Ricevuta Rifornimento — Luxx Club')
                    .setDescription(`Rifornimento completato con successo! La spesa è stata scalata dal fondo cassa.`)
                    .addFields(
                        { name: '📦 Articolo Acquistato', value: `\`${item.nome}\``, inline: true },
                        { name: '📂 Categoria', value: `\`${item.categoria || 'Alcol'}\``, inline: true },
                        { name: '➕ Quantità Rifornita', value: `\`+${quantita} pz\``, inline: true },
                        { name: '💵 Spesa Totale', value: `\`€${result.costoTotale.toLocaleString('it-IT')}\``, inline: true },
                        { name: '📊 Nuova Scorta', value: `\`${result.nuovaQuantita} pz\``, inline: true },
                        { name: '💰 Nuovo Saldo Cassa', value: `\`€${result.nuovoSaldo.toLocaleString('it-IT')}\``, inline: true }
                    )
                    .setColor(0x27AE60)
                    .setFooter({ text: 'Developed By Rizzus' })
                    .setTimestamp();

                return interaction.reply({ embeds: [ricevutaEmbed], ephemeral: true });
            }
        }
    } catch (err) {
        console.error('Errore durante l\'interazione:', err);
        const errorMsg = { content: '❌ Si è verificato un errore durante l\'operazione. Riprova.', ephemeral: true };
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMsg).catch(() => null);
        } else {
            await interaction.reply(errorMsg).catch(() => null);
        }
    }
});

// ═══════════════════════════════════════════════════════════════
// CONTROLLO RESET SETTIMANALE PROGRAMMATO
// ═══════════════════════════════════════════════════════════════

let lastResetCheckedMinute = null;

async function checkAutoReset() {
    try {
        const config = getSettimanaConfig();
        if (!config || config.giorno_fine === null || !config.orario_fine || !config.canale_id) {
            return;
        }

        const now = new Date();
        const currentDay = now.getDay();
        const currentHours = String(now.getHours()).padStart(2, '0');
        const currentMinutes = String(now.getMinutes()).padStart(2, '0');
        const currentTime = `${currentHours}:${currentMinutes}`;

        const currentKey = `${currentDay}_${currentTime}`;
        if (lastResetCheckedMinute === currentKey) return;

        if (config.giorno_fine === currentDay && config.orario_fine === currentTime) {
            lastResetCheckedMinute = currentKey;
            console.log(`🔄 Avvio chiusura contabile settimanale programmata...`);

            const report = resetSettimanale();
            logOperazione('SYSTEM', 'RESET_SETTIMANALE', `Chiusura settimanale: Incassi €${report.incassi}, Spese €${report.spese}, Tasse €${report.tasse}, Utile €${report.utileNetto}`);

            const channel = await client.channels.fetch(config.canale_id).catch(() => null);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setTitle('🏛️ Luxx Club — Chiusura Fiscale & Contabile Settimanale')
                    .setDescription('Resoconto contabile ufficiale della settimana trascorsa. Il ciclo contabile è stato archiviato e azzerato.')
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

                await channel.send({ embeds: [embed] });
            }

            await updatePersistentPanel();

            // Invia notifica testuale alla chat/bot esterno
            await sendExternalWeeklyNotification(client, report.messaggioTestuale);
        }
    } catch (err) {
        console.error('Errore durante il controllo del reset settimanale:', err);
    }
}

// ═══════════════════════════════════════════════════════════════
// AVVIO BOT
// ═══════════════════════════════════════════════════════════════

if (!process.env.DISCORD_TOKEN) {
    console.error('❌ DISCORD_TOKEN non trovato nel file .env!');
    process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
