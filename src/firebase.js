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
  apiKey: "AIzaSyDvJ943I4BljkTQKggNkW_5_to7rDFpufQ",
  authDomain: "tram-81-pos.firebaseapp.com",
  databaseURL: "https://tram-81-pos-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "tram-81-pos",
  storageBucket: "tram-81-pos.firebasestorage.app",
  messagingSenderId: "112403107186",
  appId: "1:112403107186:web:09b2b85fcc06b9becde1eb",
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
