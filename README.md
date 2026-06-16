# 🛍️ WhatsApp Order Automation System

Customers place orders over **WhatsApp** — by **text or voice note**, in
**English / Sinhala / Tamil** — and a conversational AI bot collects the
details, asks for anything missing, confirms or cancels the order, and a
**seller dashboard** shows everything live (Inquiries / Confirmed / Cancelled).

```
 Customer (WhatsApp)
        │  text or 🎙️ voice
        ▼
 Twilio  ──►  POST /webhook/whatsapp  (Express backend)
                     │
        voice? ──► OpenAI Whisper → text
                     │
                OpenAI (extract fields, detect intent, write reply, summarize)
                     │
                MongoDB (orders + full chat history)
                     │
        ┌────────────┴───────────────┐
   reply to customer            Next.js dashboard (polls API)
   (same language)              Inquiries / Confirmed / Cancelled
```

> **Status:** Backend + dashboard are complete and tested. You only need to
> plug in a MongoDB Atlas connection string and (for live WhatsApp) your Twilio
> credentials. See setup below.

---

## Monorepo layout

```
project/
├── backend/      # Node + Express API, Twilio webhook, OpenAI, MongoDB
│   └── src/
│       ├── controllers/   # webhook + dashboard request handlers
│       ├── routes/        # /webhook/whatsapp and /api/orders
│       ├── services/      # orderService — the conversation logic
│       ├── models/        # Order Mongoose schema (with embedded messages)
│       ├── middleware/    # Twilio signature, error handling
│       ├── ai/            # transcribe (Whisper) + orderExtractor (GPT)
│       ├── whatsapp/      # Twilio client, send, download media
│       ├── database/      # MongoDB connection
│       └── utils/         # logger
├── frontend/     # Next.js + TypeScript + Tailwind + shadcn dashboard
│   └── src/
│       ├── app/dashboard/{inquiries,confirmed,cancelled}/
│       ├── components/    # tables, cards, order detail dialog, shadcn ui
│       ├── services/      # api client
│       ├── hooks/         # polling hooks (live updates)
│       └── types/
└── docs/         # architecture notes
```

---

## Order lifecycle (only 3 statuses)

`INQUIRY` → (customer replies **CONFIRM**) → `CONFIRMED`
`INQUIRY`/`CONFIRMED` → (customer replies **CANCEL**) → `CANCELLED`

The AI extracts: **product, size, color, quantity, customer name, address**.
While any required field is missing, the bot keeps asking. When complete, it
asks the customer to reply **CONFIRM** or **CANCEL**.

---

## 1. Prerequisites

- **Node.js 22** (LTS). Check with `node -v`.
- A free **MongoDB Atlas** account → a connection string.
- An **OpenAI** API key (Whisper + GPT).
- A **Twilio** account with the WhatsApp Sandbox (for live messaging).

---

## 2. Get a MongoDB Atlas connection string (free)

1. Go to <https://www.mongodb.com/cloud/atlas/register> and sign up.
2. Create a **free (M0) cluster**.
3. **Database Access** → add a database user (username + password).
4. **Network Access** → Add IP `0.0.0.0/0` (allow from anywhere — fine for dev).
5. **Database → Connect → Drivers** → copy the connection string. It looks like:
   ```
   mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/whatsapp_orders
   ```
   Replace `USER`/`PASSWORD`, and add a db name (`/whatsapp_orders`) before the `?`.

---

## 3. Run the backend

```bash
cd backend
cp .env.example .env        # then edit .env (see keys below)
npm install
npm start
```

Fill in `backend/.env`:

| Variable | What it is |
|---|---|
| `MONGODB_URI` | your Atlas connection string (step 2) |
| `OPENAI_API_KEY` | from <https://platform.openai.com/api-keys> |
| `OPENAI_MODEL` | `gpt-4o-mini` (default; cheap + multilingual) |
| `TWILIO_ACCOUNT_SID` | `AC...` Account SID, **or** an `SK...` API Key SID |
| `TWILIO_AUTH_TOKEN` | Auth Token (or API Key Secret) |
| `TWILIO_ACCOUNT_SID_AC` | only if using an `SK...` key: your `AC...` SID |
| `TWILIO_WHATSAPP_FROM` | `whatsapp:+14155238886` (sandbox) |

You should see `MongoDB connected ✅` and `🚀 Server listening on :3000`.

> Test Twilio alone (optional): `npm run test:send whatsapp:+9477XXXXXXX`

---

## 4. Run the dashboard

```bash
cd frontend
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:3000
npm install
npm run dev
```

Open <http://localhost:3000>… wait — the **backend** uses port 3000, so Next.js
will pick **3001**. Open the URL it prints (usually <http://localhost:3001>).
You'll be redirected to **/dashboard/inquiries**.

> Tip: to avoid the clash, you can run the backend on another port
> (`PORT=4000` in `backend/.env`) and set
> `NEXT_PUBLIC_API_URL=http://localhost:4000` in `frontend/.env.local`.

---

## 5. Connect WhatsApp (Twilio Sandbox + ngrok)

1. Start the backend (step 3).
2. Expose it publicly: `ngrok http 3000` → copy the `https://...ngrok-free.app` URL.
3. Twilio Console → **Messaging → Try it out → WhatsApp sandbox settings**.
4. In **"When a message comes in"**, paste:
   `https://YOUR-NGROK.ngrok-free.app/webhook/whatsapp` (method **POST**), Save.
5. From your phone, join the sandbox (`join <code>` to +1 415 523 8886), then
   send a text or voice note like *"Hi I need size 40 deck shoes"*.

Watch the order appear in the dashboard and the bot reply on WhatsApp. 🎉

---

## 6. Deploy

- **Backend → Render / Railway** (always-on Node server; **not Vercel** — the
  webhook does background work that serverless kills). Build `npm install`,
  start `npm start`, set all the `.env` vars, set `VALIDATE_TWILIO_SIGNATURE=true`.
  Update the Twilio webhook to the deployed URL.
- **Frontend → Vercel** (Next.js is perfect there). Set `NEXT_PUBLIC_API_URL` to
  the deployed backend URL.

---

## API reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/webhook/whatsapp` | Twilio incoming messages |
| GET | `/api/orders` | all orders |
| GET | `/api/orders/inquiries` | INQUIRY orders |
| GET | `/api/orders/confirmed` | CONFIRMED orders |
| GET | `/api/orders/cancelled` | CANCELLED orders |
| GET | `/api/orders/stats` | counts for dashboard cards |
| GET | `/api/orders/:id` | single order + full chat |

---

## Notes & limits

- **AI scope:** extracts details, detects intent, writes replies, summarizes.
  It does **not** handle payments, inventory, or delivery (per the PRD).
- **Sinhala transcription:** Whisper auto-detects; if it mis-detects Sinhala as
  another Indic language we re-run forcing Sinhala (see `ai/transcribe.js`).
- **Dashboard auth:** currently open (dev). Add a login before real customer data.
- **Bot replies are text only** for now (voice replies can be added later).
