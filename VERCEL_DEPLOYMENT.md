# Deploying SpendWise AI to Vercel (Full-Stack)

SpendWise AI is architected for seamless **Full-Stack Vercel Deployment**. The Vue 3 client and Express Node.js backend are unified into a single deployment using Vercel Serverless Functions and static routing rewrites.

---

## 🏗️ Deployment Architecture

- **Frontend**: Vue 3 + Vite Single Page Application, compiled to `client/dist/` with HTML5 History mode routing.
- **Backend**: Express API serverless function (`api/index.js`) managing `/api/chat`, `/api/finance/summary`, and `/health`.
- **Same-Origin Benefits**: No CORS misconfigurations; the frontend communicates directly with the backend via relative paths (`/api/chat`, `/health`).

---

## 🚀 Step-by-Step Deployment Guide

### Step 1: Import Repository into Vercel
1. Log in to [Vercel](https://vercel.com/) (sign in with your GitHub account).
2. Click **Add New...** > **Project**.
3. Select your GitHub repository: **`SpendWise-AI`** (or `medhamhegde2006/SpendWise-AI`).
4. Click **Import**.

---

### Step 2: Configure Project Settings
In the **Configure Project** screen:

| Setting | Value | Notes |
| :--- | :--- | :--- |
| **Project Name** | `spendwise-ai` | Or your custom name |
| **Framework Preset** | **Other** | Pre-configured in `vercel.json` |
| **Root Directory** | `./` | Root of the repository (default) |
| **Build Command** | `npm run build` | Handled automatically by `vercel.json` |
| **Output Directory** | `dist` | Handled automatically by `vercel.json` |

---

### Step 3: Add Environment Variables
Under the **Environment Variables** section in Vercel, add the following:

#### 1. Backend AI Engine (Required for Live AI Advisor)
| Key | Example Value | Description |
| :--- | :--- | :--- |
| `GROQ_API_KEY` | `gsk_...` | Your GroqCloud API Key |
| `GROQ_MODEL` | `openai/gpt-oss-120b` | High-speed LLM model |
| `NODE_ENV` | `production` | Production mode |

#### 2. Firebase Persistence & Auth (Optional - for Cloud Mode)
*If omitted, SpendWise AI automatically operates in Local Vault Mode.*

| Key | Description |
| :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | `<your-project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | `<your-project-id>` |
| `VITE_FIREBASE_STORAGE_BUCKET` | `<your-project-id>.firebasestorage.app` |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Firebase Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | Firebase Web App ID |
| `VITE_FIREBASE_MEASUREMENT_ID` | Google Analytics Measurement ID |

> [!NOTE]
> Do **NOT** set `VITE_API_BASE_URL`. Leaving it blank instructs the Vue frontend to make same-origin calls (`/api/chat`, `/health`), which Vercel routes seamlessly.

---

### Step 4: Click Deploy
1. Click the **Deploy** button.
2. Vercel will install dependencies, compile the Vue 3 frontend, bundle the Express API serverless function, and assign you a live production URL (e.g., `https://spendwise-ai.vercel.app`).

---

### Step 5: Authorize Your Vercel Domain in Firebase (Crucial)
If you are using Firebase Authentication (Email/Password or Google Sign-In):

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. In the left sidebar, navigate to **Build** > **Authentication**.
4. Open the **Settings** tab and scroll to **Authorized domains**.
5. Click **Add domain**.
6. Enter your Vercel deployment domain (e.g. `spendwise-ai.vercel.app` and any custom domain).
7. Click **Add**.

---

## 🔍 Post-Deployment Verification

1. **Verify Backend Health**:
   Visit `https://your-domain.vercel.app/health` in your browser. You should receive:
   ```json
   {
     "status": "healthy",
     "service": "SpendWise AI API",
     "provider": "groq",
     "groqConfigured": true,
     "configuredModel": "openai/gpt-oss-120b"
   }
   ```
2. **Verify Frontend & Chatbot**:
   - Open `https://your-domain.vercel.app`.
   - The badge in the top right will display **Connected** with GroqCloud status.
   - Open the chatbot drawer and test a prompt: *"Where did my money go?"*
3. **Verify Routing**:
   - Navigate to `/login` or `/signup` and refresh the page (verifies HTML5 History rewrite).
