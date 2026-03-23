import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';

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
//
// ── BẢO MẬT (khuyến nghị) ──
// 5. Authentication → Sign-in method → Anonymous → Enable
// 6. Realtime Database → Rules → Paste và Publish:
//    {
//      "rules": {
//        ".read": "auth != null",
//        ".write": "auth != null"
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
export const auth = getAuth(app);

// Auto sign-in ẩn danh — không cần login UI nhưng có auth token
// Giúp bảo vệ DB khi rules được set "auth != null"
signInAnonymously(auth).catch(e => console.warn('Anonymous auth failed:', e));

export const waitForAuth = () => new Promise(resolve => {
  const unsub = onAuthStateChanged(auth, user => { unsub(); resolve(user); });
});

