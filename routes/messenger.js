const express = require('express');
const router = express.Router();
const { handleIncomingMessage } = require('../controllers/messengerController');

const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

// =====================
// VERIFY WEBHOOK
// =====================
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log('✅ Facebook webhook verified!');
        return res.status(200).send(challenge);
    }

    console.log('❌ Verification failed.');
    res.sendStatus(403);
});

// =====================
// HANDLE INCOMING MESSAGES & POSTBACKS
// =====================
// HANDLE MESSAGES
router.post('/webhook', async (req, res) => {
    res.sendStatus(200);

    console.log("📥 Webhook body:", JSON.stringify(req.body, null, 2));

    if (req.body.object !== 'page') return;

    for (const entry of req.body.entry) {

        //
        // 1️⃣ REAL MESSENGER MESSAGES
        //
        if (entry.messaging) {
            for (const event of entry.messaging) {
                await handleIncomingMessage(event);
            }
        }

        //
        // 2️⃣ TEST MESSAGE (v24.0)
        //
        if (entry.changes) {
            for (const change of entry.changes) {
                if (change.field === 'messages' && change.value?.message) {

                    // Convert Meta test message into a "messaging" format
                    const event = {
                        sender: change.value.sender,
                        recipient: change.value.recipient,
                        timestamp: change.value.timestamp,
                        message: change.value.message
                    };

                    console.log("🧪 Received TEST MESSAGE event:", event);

                    await handleIncomingMessage(event);
                }
            }
        }
    }
});

module.exports = router;
