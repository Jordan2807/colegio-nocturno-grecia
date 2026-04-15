// js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyBXHvRtn0tIxKGNYS9drwYhB9OXY8xYkV4",
  authDomain: "aula-virtual-colegio-f3290.firebaseapp.com",
  projectId: "aula-virtual-colegio-f3290",
  storageBucket: "aula-virtual-colegio-f3290.firebasestorage.app",
  messagingSenderId: "686411550211",
  appId: "1:686411550211:web:f9ec664b4a8d1e1067c836"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);