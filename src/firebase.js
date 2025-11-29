import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAVNsYGMPHIOBERe-AivF0pp-Wd6p75xX0",
  authDomain: "nails-by-april.firebaseapp.com",
  projectId: "nails-by-april",
  storageBucket: "nails-by-april.firebasestorage.app",
  messagingSenderId: "603415023424",
  appId: "1:603415023424:web:0c1c713b88e3324d3734a5",
  measurementId: "G-2N7FC57N7G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };