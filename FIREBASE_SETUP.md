# Firebase Setup Guide for SpendWise AI

SpendWise AI is equipped with full-fledged **Firebase Authentication** (Email/Password & Google Sign-In) and **Cloud Firestore** for secure, user-isolated cloud persistence.

---

## Step 1: Firebase Project & Web App
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project: **`your-project-id`** (or create a new project).
3. Under **Project Settings** (gear icon) > **General**, scroll down to **Your apps**.
4. If your web app is registered, view your `firebaseConfig` keys.
5. In your local `client/.env` file, ensure these variables are set:
   ```env
   VITE_FIREBASE_API_KEY=your_firebase_api_key_here
   VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your_project_id
   VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
   VITE_FIREBASE_MESSAGING_SENDER_ID=your_messaging_sender_id
   VITE_FIREBASE_APP_ID=your_app_id
   VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
   ```

---

## Step 2: Enable Authentication Providers

### A. Email/Password Provider
1. In the Firebase console sidebar, navigate to **Build** > **Authentication**.
2. Click **Get Started** (if not already enabled).
3. Under the **Sign-in method** tab, click **Email/Password**.
4. Turn on the **Email/Password** switch (leave Email link / passwordless off).
5. Click **Save**.

### B. Google Sign-In Provider
1. Under **Authentication** > **Sign-in method**, click **Add new provider** and select **Google**.
2. Turn on the **Enable** toggle.
3. Select your **Project support email** from the dropdown.
4. Click **Save**.

### C. Authorized Domains
1. Under **Authentication** > **Settings** tab > **Authorized domains**:
2. Ensure the following domains are listed:
   - `localhost`
   - `127.0.0.1`
   - `your-project-id.firebaseapp.com`
3. If deploying to production (Vercel/Netlify/Firebase Hosting), add your production custom domain here as well.

---

## Step 3: Configure Cloud Firestore Database
1. In the sidebar, click **Build** > **Firestore Database**.
2. Click **Create database**.
3. Choose a location closest to you (e.g. `asia-south1` or `us-central1`).
4. Select **Start in production mode** and click **Create**.

---

## Step 4: Publish Firestore Security Rules
1. In Firestore Database, open the **Rules** tab.
2. Replace any default rules with the project's [`firestore.rules`](./firestore.rules):
   ```javascript
   rules_version = '2';

   service cloud.firestore {
     match /databases/{database}/documents {
       
       // Root user profile (profile data, opening balance, custom categories)
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;

         // Subcollections isolated per user UID
         match /transactions/{transactionId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /budgets/{budgetId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /savingsGoals/{goalId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /categories/{categoryId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }

         match /chatHistory/{messageId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }

       // Deny all other access by default
       match /{document=**} {
         allow read, write: false;
       }
     }
   }
   ```
3. Click **Publish**.

---

## Step 5: Password Reset Email Customization (Optional)
1. In **Authentication** > **Templates** tab:
2. Select **Password reset**.
3. You can review the email subject, sender name, and action URL.
4. When users click **Forgot Password?** on the SpendWise AI login screen, Firebase will automatically dispatch an official password-reset email.

---

## Step 6: Verifying Real-Time Persistence
1. Start the client: `cd client && npm run dev`.
2. Visit `http://localhost:5173`.
3. If signed out, you will be redirected directly to `/login`.
4. Sign up with an email or click **Continue with Google**.
5. Add a transaction (e.g. `Food - ₹350`).
6. Open **Firebase Console** > **Firestore Database** > **Data**:
   - Inspect `users/{your-uid}/transactions/{tx-id}` to see the verified document stored in the cloud.
7. Refresh the page: your records remain intact and synchronized.
