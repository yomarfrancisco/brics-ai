# WhatsApp Cloud API Webhook Setup Guide

This guide walks you through setting up the WhatsApp Business Cloud API webhook integration with your server.

## Prerequisites

- Meta Business Account with WhatsApp Business Account
- Phone Number ID and Access Token from Meta
- Anthropic API key (for Claude integration)
- ngrok or similar tunnel for exposing localhost to Meta

## Step 1: Get Your Meta Credentials

1. Go to [Meta Developers Console](https://developers.facebook.com/)
2. Navigate to **My Apps** → Select your app
3. In the left sidebar, go to **Whatsapp Business** → **API Setup**
4. You'll see:
   - **Phone Number ID** - copy this
   - **Access Token** - copy this (or generate new one if needed)

## Step 2: Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.whatsapp.example .env.whatsapp
   ```

2. Fill in your credentials:
   ```
   WHATSAPP_TOKEN=EAAxxxxxxxxxxxxxx  # From Meta
   PHONE_NUMBER_ID=1234567890        # From Meta
   VERIFY_TOKEN=my_secure_token_123  # Choose your own (any string)
   ANTHROPIC_API_KEY=sk-ant-xxxx     # From Anthropic
   PORT=3001
   ```

3. Keep `.env.whatsapp` secure and never commit it.

## Step 3: Start the Webhook Server

```bash
node server.js
```

You should see:
```
[v0] WhatsApp webhook server running on port 3001
[v0] GET /webhook - for Meta verification
[v0] POST /webhook - for receiving messages
[v0] GET /health - health check
```

## Step 4: Expose Localhost with ngrok

In a new terminal, start ngrok:

```bash
ngrok http 3001
```

ngrok will output something like:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:3001
```

Copy the HTTPS URL (`https://abc123.ngrok.io`).

## Step 5: Configure Webhook in Meta Console

1. Go to **Meta Developers** → Your App → **WhatsApp Business** → **Configuration**
2. Under **Webhook Setup**, click **Edit**
3. Enter your webhook URL:
   - **Callback URL**: `https://abc123.ngrok.io/webhook` (your ngrok URL + `/webhook`)
   - **Verify Token**: `my_secure_token_123` (the token you set in `.env.whatsapp`)
4. Click **Verify and Save**

Meta will send a GET request to verify the URL. If successful, you'll see the confirmation.

## Step 6: Subscribe to Webhook Events

1. Still in **Configuration**, find **Webhook fields** 
2. Click **Select fields to subscribe to**
3. Check:
   - ✅ **messages** (for inbound user messages)
   - ✅ **message_status** (for delivery receipts - optional)
   - ✅ **message_template_status_update** (optional)
4. Click **Save**

The webhook will now start receiving messages.

## Step 7: Test the Integration

1. **Via WhatsApp**: Send a message from your test number to your Business Account number
2. **Via curl** (local testing):
   ```bash
   curl -X POST http://localhost:3001/webhook \
     -H "Content-Type: application/json" \
     -d '{
       "object":"whatsapp_business_account",
       "entry":[{
         "changes":[{
           "value":{
             "messages":[{
               "from":"1234567890",
               "id":"wamid.xxx",
               "timestamp":"1234567890",
               "type":"text",
               "text":{"body":"Hello"}
             }]
           }
         }]
       }]
     }'
   ```

3. **Check logs**: The server console will show:
   ```
   [v0] Message from 1234567890: Hello
   [v0] Calling Claude for 1234567890...
   [v0] Claude response: Hi! How can I help?
   [v0] Message sent to 1234567890: wamid.yyy
   ```

## How It Works

1. **Inbound Message** → WhatsApp Cloud API sends POST to `/webhook`
2. **Server Responds** → Returns `200 EVENT_RECEIVED` immediately
3. **Process Async** → Builds conversation history, calls Claude
4. **Send Reply** → Sends Claude's response back via WhatsApp API
5. **Deduplication** → Handles duplicate webhooks via message ID tracking
6. **Conversation History** → Keeps last 20 messages per sender in memory

## Troubleshooting

### Webhook Verification Failed
- Check that `VERIFY_TOKEN` in `.env.whatsapp` matches the token in Meta Console
- Ensure ngrok is running and the URL is correct
- Check server logs for error messages

### Messages Not Being Received
- Confirm webhook is subscribed to `messages` field in Meta Console
- Check that the test number is in the Business Account's test list
- Verify ngrok URL is publicly accessible
- Check firewall/network settings

### Claude Not Responding
- Verify `ANTHROPIC_API_KEY` is correct
- Check Anthropic account has available quota
- Review server logs for API errors

### Messages Not Being Sent Back
- Verify `WHATSAPP_TOKEN` is still valid (tokens can expire)
- Check `PHONE_NUMBER_ID` is correct
- Ensure recipient phone number is valid and in the correct format

## Production Deployment

When moving to production:

1. **Replace ngrok with a public domain** (e.g., `https://your-domain.com/webhook`)
2. **Use environment-based secrets** (Vercel Env Vars, AWS Secrets Manager, etc.)
3. **Add database** for persistent conversation history (ngrok only keeps memory)
4. **Add logging** to a service like Sentry or CloudWatch
5. **Scale horizontally** if high message volume expected
6. **Add rate limiting** to prevent abuse
7. **Handle message types** beyond text (image, document, audio, video)

## API Reference

### GET /webhook
```
Query Parameters:
  hub.mode=subscribe
  hub.challenge=<challenge_string>
  hub.verify_token=<your_verify_token>

Response: Plain text challenge string (200 OK)
```

### POST /webhook
```
Body: Meta webhook payload
Response: { "status": "ok" } (200 OK) - always returns immediately

Payload Structure:
{
  "object": "whatsapp_business_account",
  "entry": [{
    "changes": [{
      "value": {
        "messages": [{
          "from": "1234567890",        // Sender's phone number
          "id": "wamid.xxx",           // Unique message ID
          "timestamp": "1234567890",   // Unix timestamp
          "type": "text|image|etc",    // Message type
          "text": { "body": "..." }    // For type=text only
        }],
        "metadata": {
          "display_phone_number": "1234567890",
          "phone_number_id": "123456789",
          "business_account_id": "123456789"
        }
      }
    }]
  }]
}
```

### Message Response Format
```
POST https://graph.facebook.com/v21.0/{PHONE_NUMBER_ID}/messages

Body:
{
  "messaging_product": "whatsapp",
  "to": "1234567890",        // Recipient phone number
  "type": "text",
  "text": { "body": "Hello!" }
}

Headers:
  Authorization: Bearer {WHATSAPP_TOKEN}
  Content-Type: application/json
```

## Support & Resources

- [Meta WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Anthropic API Reference](https://docs.anthropic.com/)
- [ngrok Documentation](https://ngrok.com/docs/)
