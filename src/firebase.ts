import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

// Production Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDX3sk7ehqN8M1LXIvsfd-uIZt_JpiOfDk",
  authDomain: "rileys-production-dashboard.firebaseapp.com",
  projectId: "rileys-production-dashboard",
  storageBucket: "rileys-production-dashboard.firebasestorage.app",
  messagingSenderId: "723872207956",
  appId: "1:723872207956:web:20626283cc18053ec609c1",
  measurementId: "G-1HNXKP9JCM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, "rileys-production-dashboard");

// Analytics initialization (supported in browser)
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(() => {});
}

// Optional emulator connection only if explicitly requested via environment variable
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';
export const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1'
);

if (useEmulator && isLocalhost) {
  const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
  console.log(`Connecting to local Firebase Emulators at ${host}...`);
  connectAuthEmulator(auth, `http://${host}:9099`, { disableWarnings: true });
  connectFirestoreEmulator(db, host, 8080);
}

export const registerSecondaryUser = async (email: string, password: string) => {
  const secondaryAppName = 'SecondaryApp';
  const secondaryApp = getApps().find(app => app.name === secondaryAppName) 
    || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  if (useEmulator && isLocalhost) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    if (!(secondaryAuth as any)._emulatorConfig) {
      connectAuthEmulator(secondaryAuth, `http://${host}:9099`, { disableWarnings: true });
    }
  }

  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await signOut(secondaryAuth);
  return credential.user;
};

export { app, auth, db, analytics };

