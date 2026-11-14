import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  PhoneAuthProvider,
  RecaptchaVerifier,
  signInWithCredential,
  signInWithPhoneNumber,
  PhoneAuthCredential,
  User,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

let app: FirebaseApp | undefined;
let auth: Auth | undefined;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    if (getApps().length === 0) {
      if (!firebaseConfig.apiKey) {
        throw new Error("Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
      }
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
  }
  return app;
}

export function getFirebaseAuth(): Auth {
  if (!auth) {
    auth = getAuth(getFirebaseApp());
  }
  return auth;
}

export function createRecaptchaVerifier(containerId: string): RecaptchaVerifier {
  const auth = getFirebaseAuth();
  const verifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible",
  });
  return verifier;
}

export async function sendFirebaseOtp(phoneNumber: string): Promise<any> {
  const auth = getFirebaseAuth();
  const verifier = createRecaptchaVerifier("recaptcha-container");
  const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
  return confirmationResult;
}

export async function verifyFirebaseOtp(confirmationResult: any, otp: string): Promise<User> {
  const credential = PhoneAuthProvider.credential(confirmationResult.verificationId, otp);
  const auth = getFirebaseAuth();
  const userCredential = await signInWithCredential(auth, credential);
  return userCredential.user;
}

export async function getFirebaseIdToken(): Promise<string> {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) throw new Error("No authenticated Firebase user");
  return user.getIdToken();
}
