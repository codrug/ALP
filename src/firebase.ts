// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDa18rDaP_f_LkCY-RTvM6hY29sPhSne5Y",
  authDomain: "adaptive-learning-e5f1f.firebaseapp.com",
  projectId: "adaptive-learning-e5f1f",
  storageBucket: "adaptive-learning-e5f1f.firebasestorage.app",
  messagingSenderId: "899563247305",
  appId: "1:899563247305:web:69c0ebd313608159fa1f18",
  measurementId: "G-2X0T31JYKM"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();