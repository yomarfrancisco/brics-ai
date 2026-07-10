import { NextRequest, NextResponse, after } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@vercel/kv'
import { createHmac, timingSafeEqual } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
const APP_SECRET = process.env.WHATSAPP_APP_SECRET

// Redis client for Upstash integration
let kv: ReturnType<typeof createClient> | null = null

function initKV() {
  if (kv) return kv

  const url = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN

  if (!url || !token) {
    throw new Error(
      'Upstash Redis not configured. Add UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN to .env.local'
    )
  }

  kv = createClient({ url, token })
  return kv
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY
})

const SYSTEM_PROMPT = `You are BRICS AI, a helpful assistant for the BRICS AI company. You help users with questions about AI infrastructure development in Southern Africa. Be concise, friendly, and professional. Keep responses under 300 words.`

function verifyHubSignature(rawBody: string, signatureHeader: string | null): boolean {
  if (!APP_SECRET) {
    console.error('[WhatsApp] WHATSAPP_APP_SECRET is not configured')
    return false
  }

  if (!signatureHeader?.startsWith('sha256=')) {
    console.error('[WhatsApp] Missing or invalid X-Hub-Signature-256 header')
    return false
  }

  const expected = `sha256=${createHmac('sha256', APP_SECRET).update(rawBody, 'utf8').digest('hex')}`

  try {
    const expectedBuf = Buffer.from(expected, 'utf8')
    const receivedBuf = Buffer.from(signatureHeader, 'utf8')
    if (expectedBuf.length !== receivedBuf.length) {
      console.error('[WhatsApp] Signature length mismatch')
      return false
    }
    return timingSafeEqual(expectedBuf, receivedBuf)
  } catch {
    return false
  }
}

// GET: Meta webhook verification
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[WhatsApp] Webhook verified')
    return new NextResponse(challenge, { status: 200 })
  }

  console.error('[WhatsApp] Verification failed')
  return new NextResponse('Forbidden', { status: 403 })
}

// POST: Receive messages
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-hub-signature-256')

    if (!verifyHubSignature(rawBody, signature)) {
      console.error('[WhatsApp] Invalid X-Hub-Signature-256')
      return new NextResponse('Forbidden', { status: 403 })
    }

    const body = JSON.parse(rawBody)

    after(async () => {
      try {
        await processWebhook(body)
      } catch (err) {
        console.error('[WhatsApp] Async error:', err)
      }
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[WhatsApp] POST error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function processWebhook(body: any) {
  const kv = initKV()

  // Extract message event
  const entry = body.entry?.[0]
  const change = entry?.changes?.[0]
  const message = change?.value?.messages?.[0]

  if (!message) {
    console.log('[WhatsApp] No message in payload (may be a status update)')
    return
  }

  const senderPhone = message.from
  const messageId = message.id
  const messageType = message.type
  const text = message.text?.body || ''

  console.log(`[WhatsApp] Message from ${senderPhone}: ${text}`)

  // Deduplication: check if we already processed this message
  const dedupeKey = `msg:${messageId}`
  const alreadyProcessed = await kv.exists(dedupeKey)
  if (alreadyProcessed) {
    console.log(`[WhatsApp] Duplicate message ${messageId}, skipping`)
    return
  }

  // Mark as processed (expire after 24 hours)
  await kv.setex(dedupeKey, 86400, '1')

  if (messageType !== 'text' || !text) {
    console.log(`[WhatsApp] Ignoring non-text message type: ${messageType}`)
    return
  }

  // Get conversation history from KV
  const historyKey = `history:${senderPhone}`
  const rawHistory = await kv.get(historyKey)
  let conversationHistory: any[] = []
  if (rawHistory) {
    conversationHistory = typeof rawHistory === 'string' ? JSON.parse(rawHistory) : rawHistory
  }

  // Limit to last 20 messages for context
  if (conversationHistory.length > 20) {
    conversationHistory = conversationHistory.slice(-20)
  }

  // Add user message
  conversationHistory.push({
    role: 'user',
    content: text
  })

  try {
    console.log(`[WhatsApp] Calling Claude for ${senderPhone}...`)
    // Call Claude
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: conversationHistory
    })

    const assistantMessage = response.content[0].type === 'text' ? response.content[0].text : ''

    // Add assistant response to history
    conversationHistory.push({
      role: 'assistant',
      content: assistantMessage
    })

    // Save updated history (expire after 7 days)
    await kv.setex(historyKey, 604800, JSON.stringify(conversationHistory))

    // Send reply via WhatsApp API
    await sendWhatsAppMessage(senderPhone, assistantMessage)
  } catch (error) {
    console.error('[WhatsApp] Claude error:', error)
    await sendWhatsAppMessage(senderPhone, 'Sorry, I encountered an error processing your message. Please try again.')
  }
}

async function sendWhatsAppMessage(phoneNumber: string, message: string) {
  try {
    const response = await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: {
          body: message
        }
      })
    })

    if (!response.ok) {
      const err = await response.text()
      console.error(`[WhatsApp] Send failed (${response.status}):`, err)
      return
    }

    const data = await response.json()
    console.log(`[WhatsApp] Message sent to ${phoneNumber}, ID: ${data.messages?.[0]?.id}`)
  } catch (error) {
    console.error('[WhatsApp] Send error:', error)
  }
}
