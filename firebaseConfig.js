/**
 * Firebase Configuration
 * Shared configuration for Firebase services
 */

import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBaA-wkSsMnDz5hDpeIj9B1bFJEEiM3UOA",
  authDomain: "drone-rescue-system.firebaseapp.com",
  databaseURL: "https://drone-rescue-system-default-rtdb.firebaseio.com",
  projectId: "drone-rescue-system",
  storageBucket: "drone-rescue-system.firebasestorage.app",
  messagingSenderId: "891859396445",
  appId: "1:891859396445:web:10351b69776babb7f9eab4",
  measurementId: "G-GVMMX89N5V"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export { app, database, firebaseConfig };
