const { WebhookClient } = require('discord.js');

async function sendExternalWeeklyNotification(client, textMessage) {
    if (!textMessage) return;

    // 1. Metodo Webhook Discord (universale per qualsiasi server o chat di un altro bot)
    const webhookUrl = process.env.WEBHOOK_FATTURATO_ESTERNO;
    if (webhookUrl && webhookUrl.startsWith('http')) {
        try {
            const webhookClient = new WebhookClient({ url: webhookUrl });
            await webhookClient.send({
                content: textMessage
            });
            console.log('📢 Notifica testuale settimanale inviata con successo al Webhook!');
        } catch (err) {
            console.error('❌ Errore durante l\'invio al Webhook esterno:', err.message);
        }
    }

    // 2. Metodo Canale ID Discord (se il bot si trova già in quel server)
    const channelId = process.env.CANALE_FATTURATO_ESTERNO;
    if (channelId && client) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
                await channel.send(textMessage);
                console.log(`📢 Notifica testuale inviata al canale ${channelId}!`);
            }
        } catch (err) {
            console.error('❌ Errore durante l\'invio al canale esterno:', err.message);
        }
    }
}

module.exports = { sendExternalWeeklyNotification };
