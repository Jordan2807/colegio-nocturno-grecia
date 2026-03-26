/*FIREBASE CONFIGURACIÓN*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
apiKey: "AIzaSyBXHvRtn0tIxKGNYS9drwYhB9OXY8xYkV4",
authDomain: "aula-virtual-colegio-f3290.firebaseapp.com",
projectId: "aula-virtual-colegio-f3290",
storageBucket: "aula-virtual-colegio-f3290.firebasestorage.app",
messagingSenderId: "686411550211",
appId: "1:686411550211:web:f9ec664b4a8d1e1067c836"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);


/* SLIDER IMAGENES HOME*/

window.addEventListener('load', () => {

const imagenes = document.querySelectorAll('.hero-img');

if(imagenes.length === 0) return; // evita error en otras páginas

let index = 0;

setInterval(() => {

imagenes[index].classList.remove('active');
index = (index + 1) % imagenes.length;
imagenes[index].classList.add('active');

}, 4000); // cambia cada 4 segundos

});


/*VER / OCULTAR CONTRASEÑAS*/

window.addEventListener("DOMContentLoaded", () => {

const togglePasswords = document.querySelectorAll(".togglePassword");

togglePasswords.forEach(icon => {

icon.addEventListener("click", function () {

const input = this.previousElementSibling;

const type = input.getAttribute("type") === "password" ? "text" : "password";

input.setAttribute("type", type);

this.classList.toggle("fa-eye-slash");

});

});

});

/*LOGIN USUARIOS*/

window.login = async function () {

const cedula = document.getElementById("email")?.value;
const email = cedula + "@colegio.com";
const password = document.getElementById("password")?.value;

if(!cedula) return;

try {

const userCredential = await signInWithEmailAndPassword(auth, email, password);

const user = userCredential.user;
const docRef = doc(db, "usuarios", user.uid);
const docSnap = await getDoc(docRef);

if (docSnap.exists()) {

const rol = docSnap.data().rol;

if (rol === "admin") {

window.location.href = "admin.html";

}
else if (rol === "profesor") {

window.location.href = "profesor.html";

}
else {

alert("Usuario sin rol válido");

}

}
else {

alert("Usuario no registrado en base de datos");

}

}
catch (error) {

let mensaje = "Error al iniciar sesión";

switch(error.code){

case "auth/user-not-found":
mensaje = "Usuario no existe";
break;

case "auth/wrong-password":
mensaje = "Contraseña incorrecta";
break;

case "auth/invalid-credential":
mensaje = "Cédula o contraseña incorrecta";
break;

case "auth/too-many-requests":
mensaje = "Demasiados intentos. Intente más tarde";
break;

}

alert(mensaje);

}

};

/*REGISTRO PROFESORES*/

window.registrar = async function() {

const nombre = document.getElementById("nombre")?.value;
const cedula = document.getElementById("cedula")?.value;
const materia = document.getElementById("materia")?.value;
const password = document.getElementById("password")?.value;
const confirmPassword = document.getElementById("confirmPassword")?.value;

// evitar ejecutar en otras páginas
if(!nombre) return;

// validar contraseñas
if(password !== confirmPassword){
alert("Las contraseñas no coinciden");
return;
}

// crear email con cedula
const email = cedula + "@colegio.com";

try {

const userCredential = await createUserWithEmailAndPassword(auth,email,password);

const user = userCredential.user;

await setDoc(doc(db,"usuarios",user.uid),{

nombre: nombre,
cedula: cedula,
materia: materia,
rol: "profesor",
estado: "pendiente"

});

alert("Solicitud enviada al administrador");

window.location.href = "aula.html";

}

// crear email con cedula
const email = cedula + "@colegio.com";

try {

const userCredential = await createUserWithEmailAndPassword(auth,email,password);

const user = userCredential.user;

await setDoc(doc(db,"usuarios",user.uid),{

nombre: nombre,
cedula: cedula,
materia: materia,
rol: "profesor",
estado: "pendiente"

});

alert("Solicitud enviada al administrador");

window.location.href = "aula.html";

}

catch(error){

let mensaje = "Error al registrar";

switch(error.code){

case "auth/weak-password":
mensaje = "Contraseña muy débil, debe contener al menos 6 caracteres";
break;

case "auth/email-already-in-use":
mensaje = "Este usuario ya está registrado";
break;

case "auth/invalid-email":
mensaje = "Cédula inválida";
break;

}

alert(mensaje);

}

};