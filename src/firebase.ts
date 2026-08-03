import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Your web app's Firebase configuration
export const firebaseConfig = {
  apiKey: "AIzaSyDTM0TNTC6Y9CcXK9fnMm6yvIUEbCQ0-vw",
  authDomain: "planning-tool-fibre.firebaseapp.com",
  projectId: "planning-tool-fibre",
  storageBucket: "planning-tool-fibre.firebasestorage.app",
  messagingSenderId: "943960490761",
  appId: "1:943960490761:web:3e7ce01a34a1770e7489d8",
  measurementId: "G-QKY1WT0M85"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export const isLocalhost = typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' || 
  window.location.hostname.startsWith('192.168.') || 
  window.location.hostname.startsWith('10.') || 
  window.location.hostname.endsWith('.local')
);

if (isLocalhost) {
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
  
  if (isLocalhost) {
    const host = window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname;
    if (!(secondaryAuth as any)._emulatorConfig) {
      connectAuthEmulator(secondaryAuth, `http://${host}:9099`, { disableWarnings: true });
    }
  }

  const credential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  await signOut(secondaryAuth);
  return credential.user;
};

export { app, auth, db };
