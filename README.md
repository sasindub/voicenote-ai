# VoiceNote AI 🎙️ → 📝

A WhatsApp bot that turns **voice notes into clean text + summaries**.
Send a voice note to the bot and it replies with a tidy transcript, the
general idea, a summary, and bullet-point key/action items — in the **same
language you spoke** (English, Sinhala සිංහල, Tamil தமிழ், or a mix).

**How it works (the pipeline):**

```
WhatsApp voice note
      │  (Twilio webhook)
      ▼
 Express server  ──► download audio (Twilio)
      │
      ├─► OpenAI Whisper  → transcript (auto language detection)
      │
      ├─► OpenAI chat     → strict JSON: cleaned text, idea, summary, key points
      │
      └─► Twilio REST     → nicely formatted WhatsApp reply
```

> **Note on the AI provider:** the original plan mentioned Claude for the
> analysis step. This build uses **OpenAI** for *both* transcription and
> analysis, because that's the API key provided. If you later want Claude,
> you only need to swap out `src/services/analyze.js`.

---

## 0. What you'll need

- A computer with internet.
- A phone with WhatsApp.
- A free [Twilio](https://www.twilio.com/try-twilio) account.
- An [OpenAI](https://platform.openai.com) account with billing enabled
  (Whisper + chat are pay-as-you-go; costs are tiny — fractions of a cent
  per short note).

---

## 1. Install Node.js and the project dependencies

### Install Node.js (v18 or newer)

1. Go to <https://nodejs.org> and download the **LTS** version.
2. Install it (just click through the installer).
3. Verify it worked — open a terminal and run:
   ```bash
   node -v
   npm -v
   ```
   You should see version numbers (e.g. `v20.x.x`).

### Install this project's dependencies

In a terminal, go into the project folder and run:

```bash
npm install
```

This reads `package.json` and downloads everything (Express, Twilio,
OpenAI, better-sqlite3, axios, dotenv) into a `node_modules/` folder.

> If `better-sqlite3` fails to build, make sure you're on Node 18+ and try
> again. On Mac you may need Xcode command-line tools: `xcode-select --install`.

---

## 2. Get your API keys

### 2a. OpenAI key (for Whisper + analysis)

1. Go to <https://platform.openai.com/api-keys>.
2. Click **Create new secret key**, copy it (starts with `sk-...`).
3. Make sure billing is set up under **Settings → Billing** (Whisper won't
   run without a payment method on file).

### 2b. Twilio Account SID + Auth Token

1. Log in to the [Twilio Console](https://console.twilio.com).
2. On the main dashboard you'll see **Account SID** and **Auth Token**.
   - **Account SID** looks like `ACxxxxxxxx...`
   - **Auth Token** is hidden — click **Show** / the eye icon to reveal it.
3. Copy both.

### 2c. (Optional) Anthropic key

Not used in this build. Leave `ANTHROPIC_API_KEY` blank.

---

## 3. Configure your `.env` file

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

Then open `.env` and set:

```
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   # leave as-is for the sandbox
OPENAI_API_KEY=sk-...                        # already filled if provided
OPENAI_ANALYSIS_MODEL=gpt-4o-mini
FREE_MONTHLY_LIMIT=10
VALIDATE_TWILIO_SIGNATURE=false              # keep false for local testing
PORT=3000
```

> **Keep `.env` secret.** It's already in `.gitignore` so it won't be
> committed to git. If a key ever leaks, rotate it in the provider console.

---

## 4. Set up the Twilio WhatsApp **Sandbox**

The sandbox lets you test WhatsApp for free without a branded number.

1. In the Twilio Console go to:
   **Messaging → Try it out → Send a WhatsApp message**
   (URL: <https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn>).
2. You'll see a **sandbox number** (`+1 415 523 8886`) and a **join code**
   like `join orange-tiger`.
3. On your phone, open WhatsApp and send that exact join code (e.g.
   `join orange-tiger`) to **+1 415 523 8886**.
4. Twilio replies confirming you've joined the sandbox. Your phone can now
   message the bot.

You'll set the webhook URL in step 6.

---

## 5. Run the server locally

```bash
npm start
```

You should see:

```
🚀 VoiceNote AI listening on http://localhost:3000
   Webhook path: POST /webhook/whatsapp
```

Leave this running. Open a new terminal for the next step.

---

## 6. Expose your local server with ngrok (for testing)

Twilio lives on the internet and can't reach `localhost`. **ngrok** gives
your local server a temporary public HTTPS URL.

1. Install ngrok from <https://ngrok.com/download> (and sign up for the free
   authtoken it asks for).
2. Run:
   ```bash
   ngrok http 3000
   ```
3. ngrok prints a public URL like:
   ```
   Forwarding  https://abcd-1234.ngrok-free.app -> http://localhost:3000
   ```
   Copy the `https://...ngrok-free.app` URL.

### Paste the webhook URL into Twilio

1. Back in the Twilio sandbox page (step 4), find the
   **"When a message comes in"** field (under *Sandbox settings*).
2. Paste your full webhook URL into it:
   ```
   https://abcd-1234.ngrok-free.app/webhook/whatsapp
   ```
   (Don't forget the `/webhook/whatsapp` path!)
3. Make sure the method is **HTTP POST**.
4. Click **Save**.

### Test it 🎉

From your phone (the one that joined the sandbox), send a **voice note** to
+1 415 523 8886. Within a few seconds you should get back a formatted reply
with transcript, idea, summary, and key points.

> Every time you restart ngrok you get a NEW URL — re-paste it into Twilio.

---

## 7. Deploy for a permanent URL (Railway or Render)

ngrok URLs are temporary. For something always-on, deploy to a host.

### Option A — Render (simple)

1. Push this project to a GitHub repo.
2. Go to <https://render.com> → **New → Web Service** → connect your repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Add your environment variables (same as `.env`) under **Environment**.
   - Set `VALIDATE_TWILIO_SIGNATURE=true` in production for security.
5. Deploy. Render gives you a URL like `https://voicenote-ai.onrender.com`.
6. In Twilio, update **"When a message comes in"** to:
   ```
   https://voicenote-ai.onrender.com/webhook/whatsapp
   ```

### Option B — Railway

1. Go to <https://railway.app> → **New Project → Deploy from GitHub repo**.
2. Railway auto-detects Node and runs `npm install` + `npm start`.
3. Add the same environment variables under **Variables**.
4. Under **Settings → Networking**, generate a public domain.
5. Update the Twilio webhook to `https://your-app.up.railway.app/webhook/whatsapp`.

> **Persistence note:** the SQLite file lives in `data/usage.sqlite`. On some
> hosts the filesystem is ephemeral (resets on redeploy). For a hobby project
> that's fine; for real usage, attach a persistent volume or move to a hosted DB.

---

## 8. Going from sandbox → a real branded WhatsApp number

The sandbox is for testing only (users must "join" it first, and it shows a
Twilio number). To message customers from **your own branded WhatsApp
number**, you must apply for **WhatsApp Business API access through Twilio**:

- In Twilio: **Messaging → Senders → WhatsApp senders → Request access**.
- This involves a **form + approval process** (business verification, a
  Facebook/Meta Business account, and approved message templates).
- It's done later, once your bot works in the sandbox. Approval can take a
  few days. Until then, the sandbox is perfect for development and demos.

---

## 9. Troubleshooting

**Webhook not firing / no reply at all**
- Is `npm start` still running? Is ngrok still running with the *current* URL?
- Did you paste the full path `…/webhook/whatsapp` into Twilio (not just the
  base URL)? Is the method **POST**?
- Check the Twilio Console → **Monitor → Logs → Errors** for delivery errors.
- Watch your server terminal — every message logs `[IN] message from …`.

**Media download fails with 401 Unauthorized**
- The media URL needs Basic Auth with your **Account SID + Auth Token**.
  Double-check those two values in `.env` are correct and have no extra
  spaces. (This project already sends them via `axios` `auth`.)

**Whisper / language issues**
- We intentionally let Whisper **auto-detect** the language — don't hard-set
  one. If Sinhala/Tamil comes out wrong, the audio may be too noisy or too
  short; ask the user to record again in a quieter place.
- "Empty transcript" replies usually mean silence or a corrupted clip.

**"Incorrect API key" / 401 from OpenAI**
- Re-copy `OPENAI_API_KEY` and confirm billing is enabled on the OpenAI
  platform.

**`better-sqlite3` install error**
- Use Node 18+. On Mac run `xcode-select --install`, then `npm install` again.

**Signature validation rejects requests (in production)**
- When `VALIDATE_TWILIO_SIGNATURE=true`, the public URL Twilio calls must
  EXACTLY match the webhook URL you saved in Twilio (https, no trailing
  differences). If you're behind a proxy, ensure the host header is correct.

---

## Project structure

```
voicenote-ai/
├── src/
│   ├── server.js            # Express app + webhook route (the orchestrator)
│   ├── services/
│   │   ├── twilio.js        # download media + send WhatsApp reply
│   │   ├── transcribe.js    # OpenAI Whisper call
│   │   └── analyze.js       # OpenAI analysis + safe JSON parsing
│   ├── db/
│   │   └── usage.js         # SQLite setup + quota functions
│   └── utils/
│       └── formatReply.js   # builds the WhatsApp message text
├── data/                    # auto-created; holds usage.sqlite
├── .env.example
├── .env                     # your secrets (git-ignored)
├── package.json
└── README.md
```

---

## Exact run order (TL;DR)

```bash
# 1. Install Node 18+ (from nodejs.org), then:
npm install

# 2. Create your env file and fill it in:
cp .env.example .env       # then edit .env with your keys

# 3. Start the server:
npm start

# 4. In a SECOND terminal, expose it publicly:
ngrok http 3000

# 5. Copy the https ngrok URL and paste it into Twilio's
#    "When a message comes in" field, adding /webhook/whatsapp at the end.

# 6. From your phone, join the sandbox (send "join <code>" to +14155238886),
#    then send a VOICE NOTE to that number. Get your summary back. 🎉
```
