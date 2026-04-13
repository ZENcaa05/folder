import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-app.js";
import { getDatabase, ref, onValue, set } from "https://www.gstatic.com/firebasejs/12.12.0/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBYUCGcfOUUCLxU_nOn54fiPReZDXgn-0E",
    authDomain: "ujikom-3250b.firebaseapp.com",
    databaseURL: "https://ujikom-3250b-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "ujikom-3250b",
    storageBucket: "ujikom-3250b.firebasestorage.app",
    messagingSenderId: "213039342419",
    appId: "1:213039342419:web:c21b952cd16cb715e2f7a6"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);
window.firebaseDB = { database, ref, onValue, set };