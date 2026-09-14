# 🍸 Luxx Club — Discord Bot

Bot Discord completo e modulare per la gestione del magazzino, rifornimenti, cassa e rendiconto fiscale/settimanale per l'attività **Luxx Club** su GTA RP.

---

## 📋 Funzionalità Principali

- **📦 Pannello Magazzino Interattivo (`/setup-pannello`)**:
  - Embed in tempo reale con giacenze suddivise per **🍔 CIBI**, **🥤 BIBITE** e **🍸 ALCOLICI**.
  - Tasti interattivi con emoji dedicate:
    - 🟩 **Rifornisci (`➕`)**: Menù a tendina con prezzo d'acquisto, fondo cassa disponibile e modal per ordinare scorte.
    - 🟥 **Preleva (`➖`)**: Menù a tendina per prelevare merci senza errori di battitura.
- **💰 Gestione Cassa (`/fondocassa` & `/setlog-fondocassa`)**:
  - Aggiungi, Rimuovi o Imposta fondi con motivo obbligatorio.
  - Risposta personale (effimera) all'operatore e invio automatico dei log dettagliati nella chat designata.
- **📊 Contabilità & Fiscale (`/fatturato`)**:
  - Fondo Inizio Settimana, Spese Settimanali, Incassi Settimanali, Fatturato Lordo, Tasse al 5% e **Guadagno Finale**.
  - **Saldo Attuale in Cassa (Totale)** sempre visibile e separato dal periodo.
- **📅 Reset Settimanale Automatico & Manuale**:
  - `/fatturato-settimanale`: Pianificazione giorno, orario (es. 23:59) e canale per il resoconto automatico.
  - `/termina-settimana`: Chiusura manuale in qualsiasi momento con azzeramento del ciclo contabile.
  - **Notifica Esterna**: Invio automatico del messaggio di testo puro (non embed) tramite Webhook verso un altro bot o canale esterno.
- **⚙️ Utility & Manutenzione**:
  - `/imposta-articolo`: Aggiunta o modifica articoli a catalogo con categoria e prezzo unitario.
  - `/elimina-articolo`: Rimozione definitiva di un articolo.
  - `/restart`: Riavvio automatico del processo del bot direttamente da Discord.
  - `/help`: Guida completa interattiva di tutti i comandi.
  - `/developer`: Crediti dello sviluppatore (**Developed By Rizzus**).

---

## 🚀 Installazione & Avvio

1. **Clona la repository**:
   ```bash
   git clone https://github.com/simo0325/BOT-LUXX.git
   cd BOT-LUXX
   ```

2. **Installa le dipendenze**:
   ```bash
   npm install
   ```

3. **Configura le variabili d'ambiente**:
   Copia il file `.env.example` in `.env`:
   ```bash
   copy .env.example .env
   ```
   Compila i valori richiesti:
   ```env
   DISCORD_TOKEN=IL_TUO_TOKEN_BOT
   CLIENT_ID=IL_TUO_CLIENT_ID
   GUILD_ID=ID_DEL_SERVER_DISCORD
   ROLE_RIFORNIMENTO=ID_RUOLO_AUTORIZZATO_AI_RIFORNIMENTI
   
   # Opzionale: Webhook per inviare il resoconto testuale ad un altro bot/chat
   WEBHOOK_FATTURATO_ESTERNO=https://discord.com/api/webhooks/...
   ```

4. **Avvia il bot**:
   ```bash
   node index.js
   ```
   *oppure su Windows con auto-restart continuo:*
   ```bash
   .\avvia.bat
   ```

---

## 💻 Sviluppo
*Developed by **Rizzus***
