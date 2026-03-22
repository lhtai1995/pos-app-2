import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// ──────────────────────────────────────────────────────────────
// HƯỚNG DẪN SETUP FIREBASE (1 lần duy nhất):
//
// 1. Vào https://console.firebase.google.com
// 2. "Add project" → Đặt tên → Tắt Google Analytics → Create
// 3. Build → Realtime Database → Create database
//    → Chọn "Singapore" (asia-southeast1)
//    → Chọn "Start in test mode" → Enable
// 4. Project Settings (⚙️) → General → Your apps
//    → "</>" (Web) → Register app → Copy config bên dưới
// 5. Realtime Database → Rules → Paste rules này → Publish:
//    {
//      "rules": {
//        ".read": true,
//        ".write": true
//      }
//    }
// ──────────────────────────────────────────────────────────────

const firebaseConfig = {
  apiKey: "",
  authDomain: "",
  databaseURL: "", // ← QUAN TRỌNG: phải có cái này (Realtime DB URL)
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: "",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
