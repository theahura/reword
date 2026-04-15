import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyBQy2PhLD4_SnKpZO2GWeyrlRrI_3VnfM4",
  authDomain: "games-reword.firebaseapp.com",
  projectId: "games-reword",
  storageBucket: "games-reword.firebasestorage.app",
  messagingSenderId: "202231125250",
  appId: "1:202231125250:web:58cdfbb61417803e3fde1b",
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
