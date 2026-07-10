# WhatsApp Webhook Integration on Vercel

This guide walks you through setting up the WhatsApp Business Cloud API to send messages to your BRICS AI Vercel deployment.

## Architecture

- **Webhook Route**: `/api/webhooks/whatsapp` (GET for verification, POST for receiving messages)
- **State Storage**: Vercel KV (Redis) for conversation history and message deduplication
- **AI Engine**: Claude via Anthropic API
- **Public HTTPS URL**: `https://your-project.vercel.app/api/webhooks/whatsapp`

## Step 1: Get Meta Credentials

1. Go to [Meta Developers Console](https://developers.facebook.com)
2. Create or select your app
3. Navigate to **WhatsApp > Getting Started**
4. Complete "Claim a WhatsApp test number" (or use your own)
5. Copy and save:
   - **Phone Number ID** (e.g., `118494422803...`)
   - **Access Token** (e.g., `EAAVSaE6070YBR...`)

Note: Test numbers generate a new access token after 24 hours. For production, use a permanent token from business account settings.

## Step 2: Set Up Vercel KV

1. In your Vercel Project Settings, go to **Storage**
2. Click **Create Database** → **KV (Redis)**
3. Name it (e.g., "whatsapp-kv") and confirm
4. Copy the environment variables (they auto-populate when you redeploy)

Alternatively, if you already have KV:
- Your `KV_REST_API_URL` and `KV_REST_API_TOKEN` are automatically available in Vercel environment

## Step 3: Configure Environment Variables

In your Vercel Project Settings, go to **Settings > Environment Variables** and add:

```
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_TOKEN=your_meta_access_token_here
WHATSAPP_VERIFY_TOKEN=your_custom_token_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

The `KV_REST_API_URL` and `KV_REST_API_TOKEN` are automatically provided by Vercel KV.

For local development, copy the example file and fill in values:

```bash
cp .env.local.whatsapp.example .env.local
# Edit .env.local with your tokens
```

## Step 4: Deploy to Vercel

Push your code to GitHub and let Vercel auto-deploy, or:

```bash
vercel deploy
```

Your webhook is now live at: `https://your-project.vercel.app/api/webhooks/whatsapp`

## Step 5: Configure Meta Webhook

1. Go to [Meta Developers Console](https://developers.facebook.com)
2. Navigate to **WhatsApp > Configuration**
3. Under **Webhook URL**, paste: `https://your-project.vercel.app/api/webhooks/whatsapp`
4. Under **Verify Token**, enter the `WHATSAPP_VERIFY_TOKEN` you set in Vercel
5. Click **Verify and Save**

Meta will send a GET request to verify the webhook. If you see ✓ confirmation, you're connected.

## Step 6: Subscribe to Messages

In **Webhook Fields** (same configuration page):

1. Click **Manage** next to your webhook
2. Check the `messages` field
3. Click **Save**

Now your webhook receives inbound WhatsApp messages.

## Step 7: Test the Integration

1. Send a WhatsApp message from your test number to the business phone number
2. Watch your Vercel deployment logs:
   ```bash
   vercel logs
   ```
3. Claude should respond within seconds
4. Check Vercel KV for conversation history:
   - Key format: `history:{phone_number}`
   - Messages stored as JSON array

## Troubleshooting

### Webhook verification fails
- Double-check `WHATSAPP_VERIFY_TOKEN` matches exactly what you entered in Meta Console
- Check Vercel logs for the verification request: `vercel logs --follow`
- Ensure environment variables are deployed (Vercel redeploys after env var changes)

### Messages don't arrive
- Verify `messages` field is checked in Meta Webhook Fields
- Test with the Meta test number first
- Check Vercel logs for the inbound POST request

### Claude API errors
- Ensure `ANTHROPIC_API_KEY` is valid and has quota
- Check Vercel logs for API errors
- Fallback message is sent on error

### No conversation history
- Vercel KV must be provisioned (Storage > Create Database)
- Check `KV_REST_API_URL` and `KV_REST_API_TOKEN` are in environment
- History expires after 7 days of inactivity

## Key Features

✓ **Persistent Conversation History**: Last 20 messages per sender stored in Vercel KV
✓ **Message Deduplication**: Prevents duplicate responses via message ID tracking
✓ **Error Handling**: Automatic fallback message on Claude errors
✓ **Instant HTTPS**: No ngrok, no VPS — native Vercel deployment
✓ **Scalable**: Serverless functions auto-scale with traffic
✓ **Cost-Efficient**: Pay only for API calls and KV operations

## Production Checklist

- [ ] Upgrade from test number to production WhatsApp Business Account
- [ ] Replace test access token with production token from business settings
- [ ] Test with real phone numbers
- [ ] Monitor Vercel logs and KV quotas
- [ ] Set up alerts for failed messages (optional)
- [ ] Update the system prompt in `route.ts` with your company-specific context

## Next Steps

- Add message media support (images, files, location)
- Implement user onboarding flow in conversations
- Add admin dashboard to review conversations (in Vercel app)
- Set up Vercel Analytics to track webhook performance
