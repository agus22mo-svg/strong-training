import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBUB9ajAqZuQWGCtX7KfUWDGiU6gVWyIXo",
  authDomain: "strong-training.firebaseapp.com",
  projectId: "strong-training",
  storageBucket: "strong-training.firebasestorage.app",
  messagingSenderId: "795995844247",
  appId: "1:795995844247:web:ab75caaa996d2acd2243d2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
