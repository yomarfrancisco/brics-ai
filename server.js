const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(cors());
app.use(express.json());

// Environment variables
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || 'your_verify_token_here';
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

// Initialize Anthropic client
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

// In-memory conversation history (per sender phone number)
// Structure: { [phoneNumber]: [{ role: 'user'|'assistant', content: '...' }, ...] }
const conversationHistory = {};
const MAX_HISTORY = 20;
const processedMessageIds = new Set();
const DEDUP_WINDOW = 300000; // 5 minutes

// System prompt for Claude
const SYSTEM_PROMPT = `You are a helpful WhatsApp assistant for BRICS AI. 
Be concise, friendly, and professional. Keep responses under 1000 characters.
If the user asks about BRICS AI services, you can provide general information about AI infrastructure development in Southern Africa.`;

/**
 * GET /webhook - Meta's verification handshake
 * Meta calls this with hub.verify_token and hub.challenge parameters
 */
app.get('/webhook', (req, res) => {
  const verifyToken = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (verifyToken === VERIFY_TOKEN) {
    console.log('[v0] Webhook verified successfully');
    res.status(200).send(challenge);
  } else {
    console.error('[v0] Webhook verification failed - invalid token');
    res.status(403).send('Verification token mismatch');
  }
});

/**
 * POST /webhook - Receive messages from WhatsApp
 */
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    console.log('[v0] Webhook received:', JSON.stringify(body, null, 2));

    // Meta requires immediate 200 response
    res.status(200).send('EVENT_RECEIVED');

    // Process asynchronously
    if (body.entry && body.entry[0].changes) {
      for (const change of body.entry[0].changes) {
        const value = change.value;

        // Handle status updates (delivery, read receipts)
        if (value.statuses) {
          console.log('[v0] Status update:', value.statuses);
          continue;
        }

        // Handle messages
        if (value.messages) {
          for (const message of value.messages) {
            // Deduplicate on message ID
            if (processedMessageIds.has(message.id)) {
              console.log('[v0] Duplicate message ID, skipping:', message.id);
              continue;
            }
            processedMessageIds.add(message.id);

            // Clean up old message IDs after window
            setTimeout(() => processedMessageIds.delete(message.id), DEDUP_WINDOW);

            const senderPhone = message.from;
            const messageId = message.id;
            const timestamp = message.timestamp;

            // Only handle text messages for now
            if (message.type === 'text') {
              const incomingText = message.text.body;
              console.log(`[v0] Message from ${senderPhone}: ${incomingText}`);

              // Process and respond asynchronously
              handleTextMessage(senderPhone, incomingText, messageId);
            } else {
              console.log(`[v0] Unsupported message type: ${message.type} (stub for later)`);
            }
          }
        }
      }
    }
  } catch (error) {
    console.error('[v0] Error processing webhook:', error.message);
  }
});

/**
 * Handle incoming text messages
 * Builds conversation history, calls Claude, sends response
 */
async function handleTextMessage(senderPhone, userText, messageId) {
  try {
    // Initialize conversation history for this sender if not exists
    if (!conversationHistory[senderPhone]) {
      conversationHistory[senderPhone] = [];
    }

    // Add user message to history
    conversationHistory[senderPhone].push({
      role: 'user',
      content: userText
    });

    // Keep history within limit
    if (conversationHistory[senderPhone].length > MAX_HISTORY * 2) {
      conversationHistory[senderPhone] = conversationHistory[senderPhone].slice(-MAX_HISTORY);
    }

    console.log(`[v0] Calling Claude for ${senderPhone}...`);

    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversationHistory[senderPhone]
    });

    const assistantText = response.content[0].type === 'text' ? response.content[0].text : '';

    // Add assistant response to history
    conversationHistory[senderPhone].push({
      role: 'assistant',
      content: assistantText
    });

    console.log(`[v0] Claude response: ${assistantText}`);

    // Send response back via WhatsApp API
    await sendWhatsAppMessage(senderPhone, assistantText);

  } catch (error) {
    console.error(`[v0] Error handling message from ${senderPhone}:`, error.message);

    // Send error message to user
    try {
      await sendWhatsAppMessage(senderPhone, 'Sorry, I encountered an error processing your message. Please try again.');
    } catch (sendError) {
      console.error('[v0] Failed to send error message:', sendError.message);
    }
  }
}

/**
 * Send a text message via WhatsApp Cloud API
 */
async function sendWhatsAppMessage(recipientPhone, messageText) {
  try {
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;

    const payload = {
      messaging_product: 'whatsapp',
      to: recipientPhone,
      type: 'text',
      text: {
        body: messageText
      }
    };

    const response = await axios.post(url, payload, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      }
    });

    console.log(`[v0] Message sent to ${recipientPhone}:`, response.data.messages[0].id);
  } catch (error) {
    console.error('[v0] Error sending WhatsApp message:', error.response?.data || error.message);
    throw error;
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[v0] WhatsApp webhook server running on port ${PORT}`);
  console.log(`[v0] GET /webhook - for Meta verification`);
  console.log(`[v0] POST /webhook - for receiving messages`);
  console.log(`[v0] GET /health - health check`);
  console.log(`[v0] Environment check:`, {
    VERIFY_TOKEN: VERIFY_TOKEN ? '***' : 'MISSING',
    WHATSAPP_TOKEN: WHATSAPP_TOKEN ? '***' : 'MISSING',
    PHONE_NUMBER_ID: PHONE_NUMBER_ID || 'MISSING',
    ANTHROPIC_API_KEY: ANTHROPIC_API_KEY ? '***' : 'MISSING'
  });
});
