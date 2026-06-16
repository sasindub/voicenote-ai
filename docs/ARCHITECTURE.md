# Architecture

## Components

1. **Twilio WhatsApp** — receives customer messages (text/voice) and delivers
   the bot's replies.
2. **Backend (Express)** — webhook + REST API + the conversation engine.
3. **OpenAI** — Whisper (speech→text) and GPT (extract fields, intent, reply,
   summary).
4. **MongoDB Atlas** — stores each order with its embedded chat history.
5. **Frontend (Next.js)** — the seller dashboard, polling the REST API.

## Request flow (incoming message)

```
POST /webhook/whatsapp
  └─ webhookController.handleIncoming
       ├─ respond 200 <Response></Response>  (ack Twilio immediately)
       └─ processInBackground (async, after response)
            ├─ if voice: downloadMedia → ai/transcribe (Whisper, +Sinhala fix)
            ├─ services/orderService.processIncomingMessage
            │    ├─ findOrCreateActiveOrder (per phone number)
            │    ├─ push inbound message
            │    ├─ ai/orderExtractor.extractOrder  (fields, missing, intent, reply, summary)
            │    ├─ merge fields, set summary
            │    ├─ decide status:
            │    │     CANCEL                → CANCELLED
            │    │     CONFIRM & none missing → CONFIRMED
            │    │     else                  → INQUIRY
            │    └─ push bot reply, save
            └─ whatsapp/sendMessage (Twilio REST) → customer
```

**Why ack-then-process:** Twilio expects a webhook response within ~10–15s,
but Whisper + GPT can take longer. We reply instantly and push the real answer
via the REST API afterward.

**Why status is decided in code, not by the AI:** the AI extracts data and
writes text, but the business rule (when an order becomes CONFIRMED/CANCELLED)
lives in `orderService.js` so it's deterministic and testable.

## Data model

One `Order` document per order/inquiry. The full conversation is an embedded
`messages` array (see `backend/src/models/Order.js`). Statuses: `INQUIRY`,
`CONFIRMED`, `CANCELLED`.

## Dashboard

Three pages (`/dashboard/inquiries|confirmed|cancelled`), each polling its
status endpoint every 5s, plus a stats endpoint for the top cards. Clicking a
row opens a dialog with customer details + the complete chat history.

## Deployment

- Backend → Render/Railway (persistent Node process; not serverless).
- Frontend → Vercel (Next.js).
- DB → MongoDB Atlas (managed).
