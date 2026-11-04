# BusinessReply AI

**A local, business-configurable customer support assistant** for WhatsApp private text messages and Gmail replies. This is an independent project; it is not affiliated with any particular company or brand.

## Premium Dashboard UI

The bundled local dashboard now includes an original **BusinessReply AI Control Room** design with Overview, Channels, AI Playground, Business Profile and Activity pages. The pages use the **same real backend endpoints** as the original project; there is no second demo app. The source is in `public/index.html`, `public/style.css`, and `public/app.js`.

- **Business Profile tab:** directly edit/save the existing `business.txt` on your local PC. No manual copying required. Saving turns both channel auto-replies OFF until you intentionally re-enable them.
- **Overview:** connection state, configured AI provider and real recent events (no invented statistics).
- **Channels:** WhatsApp QR status, Gmail Google sign-in and the existing channel toggles, which are OFF at startup.
- **AI Playground:** calls the currently configured live provider and displays real error messages if not configured.
- **Activity:** real event history and WhatsApp message processing counters.

*Screenshots in the ZIP are illustrative UI previews, not proof of live WhatsApp/Gmail integration.*

## Customize in one text file

Edit `business.txt` using the **Business Profile** page or a text editor:

```text
ACTIVE=YES
BUSINESS_NAME=Sunrise Photo Studio
BUSINESS_WEBSITE=https://your-actual-website.example

ABOUT:
We make photo albums and print photographs.

PRODUCTS_AND_SERVICES:
- Photo printing: enter the actual published price for your own business.

OPENING_HOURS:
Monday–Saturday 10:00 to 18:00.

CONTACT:
Public business email: info@example.com
```

This is an **illustrative example only**. Replace it with *real, published* facts for your business. The shipped `business.txt` begins with `ACTIVE=NO`; live automatic replies cannot be enabled until you set `ACTIVE=YES`, supply a real business name, and replace placeholders with facts. Changes are read automatically for each new reply (no server restart). When business.txt is inactive, the AI test and automatic replies are blocked. The business profile never needs customer passwords, API keys, or WhatsApp session data.

The AI is instructed to use the business profile for factual questions, **not invent website URLs, prices, policies, human escalation or payment verification**, and reply in the customer's language when possible. Language/model accuracy can vary; review before relying on it with real customers.

For beginner-friendly Gujarati + English setup instructions, open **[HOW_TO_RUN.txt](HOW_TO_RUN.txt)**. Keep `business.txt` inside the extracted project folder (alongside `START_WINDOWS.bat`). Business owners can include **both general business information and `FAQ:` question-and-answer pairs** there.

## Windows setup

1. Install a current compatible Node.js (22+), npm and Git for Windows. (Baileys dependency installation may require Git on PATH.)
2. Extract the project and double-click `START_WINDOWS.bat` (or run `npm install` then `npm start` in PowerShell).
3. Rename `.env.example` to `.env`; choose **one** AI provider and set your own key/model:

```ini
# Gemini
AI_PROVIDER=gemini
GEMINI_API_KEY=YOUR_KEY
AI_MODEL=gemini-3.1-flash-lite
```

```ini
# OpenAI (separately billed)
AI_PROVIDER=openai
OPENAI_API_KEY=YOUR_KEY
AI_MODEL=gpt-4.1-mini
```

```ini
# Local OpenAI-compatible endpoint, e.g. Ollama (with model installed)
AI_PROVIDER=openai-compatible
AI_BASE_URL=http://127.0.0.1:11434/v1
AI_MODEL=llama3.2
AI_API_KEY=
```

4. Configure `business.txt` for **your** business. Set `ACTIVE=YES` only after verifying content.
5. Restart `START_WINDOWS.bat` after changing `.env`. Open the **local launch URL printed in the terminal**. Keep the admin login link and token private.
6. Test **Send real AI request**. Use a second dedicated test account for the first inbound message.
7. Connect WhatsApp with its linked-device QR (unofficial integration) and/or Gmail via the **Google Cloud Desktop OAuth** `credentials.json` file. Gmail OAuth requires enabling the Gmail API and configuring test users/consent. Gmail uses sign-in, not QR.
8. Only enable each **Auto-reply** toggle after verifying your profile and model. Both toggles reset **OFF** on every restart. WhatsApp and Gmail replies are real messages when connected and enabled.

## Safety / limitations

- **WhatsApp:** The Baileys linked-device connection is **not official WhatsApp Business Cloud API**, may break at any time and can risk account restrictions. For a public commercial product, consider replacing it with **Meta's official WhatsApp Business Cloud API** before a public release.
- **Gmail:** When auto-reply is enabled, this project can send real messages to new eligible Inbox emails. It does not require messages to remain unread, but ignores old mail received before enable time. Use a separate business mailbox and start with your own test emails. Gmail API authorization may require policy checks or app verification if distributed publicly.
- **Security:** This app is local-only (`127.0.0.1`). Never expose its dashboard or admin launch link to the public internet. The project includes no preconfigured API keys and no account sessions.
- **Privacy:** Customer text is sent to the chosen AI provider when auto-reply is enabled. Ask permission where required and inform customers that an AI replies. Don't enter private customer records into `business.txt`.
- **No fake guarantees:** The code has automated logic tests, but connecting your own accounts and delivering messages must be tested in your environment. Third-party APIs may require billing, quotas and approvals.
- **No payment handling or order lookup:** The AI can only answer based on owner-supplied business information; it cannot truthfully claim to verify payments, refunds, stock levels, or orders without separate verified integrations.

## GitHub publishing

1. **Never upload** `.env`, `credentials.json`, `.gmail_token.json`, `.local_admin_token`, `.local_state.json`, `.baileys_auth/`, `node_modules/`, or logs. The included `.gitignore` excludes these.
2. Create a new repository named `businessreply-ai` (or your own name) in your GitHub account.
3. Upload **only the clean source files** in this ZIP. README and `.gitignore` are included.
4. After publishing, people can use their **own** `business.txt`, API key, Gmail account and WhatsApp number.

## Test

```sh
node --test tests/*.test.mjs
```

This project is a starting point for self-hosted support, not a fully vetted production multi-tenant service.

## GitHub upload (Windows)

Run `UPLOAD_TO_GITHUB.bat` from this extracted folder. It checks for common secret files and pushes to the official project repository without force. GitHub sign-in may be required through Git Credential Manager.
