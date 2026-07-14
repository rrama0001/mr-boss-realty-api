const axios = require('axios');

const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_TOKEN;
const API_URL = process.env.API_URL; // your AI endpoint

// Handle incoming messages or postbacks
async function handleIncomingMessage(event) {
    const senderId = event.sender && event.sender.id;

    // ----- POSTBACK (buttons / quick replies) -----
    if (event.postback) {
        const payload = event.postback.payload;
        console.log(`📦 Postback from user (${senderId}): ${payload}`);

        // Optional: send a reply
        await sendTextMessage(senderId, `You clicked a button: ${payload}`);
        return;
    }

    // ----- TEXT MESSAGE -----
    if (event.message && event.message.text) {
        const userMessage = event.message.text;
        console.log(`💬 Message from user (${senderId}): ${userMessage}`);

        try {
            // Step 1: Show "typing..." indicator
            await axios.post(
                `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
                { recipient: { id: senderId }, sender_action: 'typing_on' }
            );

            // Step 2: Call AI reply endpoint
            const aiResponse = await axios.post(`${API_URL}/ai/reply`, {
                message: userMessage,
                source: 'messenger',
            });

            const replyText = aiResponse.data.reply || "I'm here, how can I help you?";

            // Optional delay to simulate typing
            await new Promise(resolve => setTimeout(resolve, 1200));

            // Step 3: Send reply back to Messenger
            await sendTextMessage(senderId, replyText);

            console.log(`✅ Sent reply to Messenger: ${replyText}`);
        } catch (err) {
            console.error('❌ Messenger webhook error:', err.response?.data || err.message);
        }

        return;
    }

    // ----- UNHANDLED EVENTS -----
    console.log('⚠️ Unhandled event:', JSON.stringify(event, null, 2));
}

// Helper function to send a text message
async function sendTextMessage(recipientId, text) {
    await axios.post(
        `https://graph.facebook.com/v17.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
        { recipient: { id: recipientId }, message: { text } }
    );
}

module.exports = { handleIncomingMessage };
