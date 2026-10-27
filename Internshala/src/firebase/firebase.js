// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDzH_SOQor9cF-BxjN1d_ihHJgsG6Zx8RQ",
  authDomain: "internarea-22400.firebaseapp.com",
  projectId: "internarea-22400",
  storageBucket: "internarea-22400.firebasestorage.app",
  messagingSenderId: "752686882517",
  appId: "1:752686882517:web:3a84e042a7503c4aac4c5c",
  measurementId: "G-PXP8PBHDZX"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

export { auth, googleProvider };