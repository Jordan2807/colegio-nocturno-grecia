/*FIREBASE CONFIGURACIÓN*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import { 
getAuth, 
createUserWithEmailAndPassword, 
signInWithEmailAndPassword, 
onAuthStateChanged, 
updatePassword, 
sendPasswordResetEmail, 
signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import { 
getFirestore, 
doc, 
setDoc, 
getDoc, 
deleteDoc, 
collection, 
getDocs, 
updateDoc, 
query, 
where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


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
const password = document.getElementById("password")?.value;

if(!cedula || !password){
alert("Ingrese cédula y contraseña");
return;
}

try {

// buscar usuario por cedula
const q = query(
collection(db,"usuarios"),
where("cedula","==",cedula)
);

const querySnapshot = await getDocs(q);

if(querySnapshot.empty){
alert("Usuario no encontrado");
return;
}

const docUsuario = querySnapshot.docs[0];
const data = docUsuario.data();

const email = data.correo;

// login con correo real
const userCredential = await signInWithEmailAndPassword(auth, email, password);

const rol = data.rol;
const estado = data.estado;

if(estado !== "activo"){
alert("Tu cuenta está pendiente de aprobación");
return;
}

if (rol === "admin") {
window.location.href = "admin.html";
}
else if (rol === "profesor") {
window.location.href = "profesor.html";
}

}
catch(error){

alert("Cédula o contraseña incorrecta");

}

};

/*REGISTRO PROFESORES*/

window.registrar = async function() {

const nombre = document.getElementById("nombre")?.value;
const cedula = document.getElementById("cedula")?.value;
const materia = document.getElementById("materia")?.value;
const correo = document.getElementById("correo")?.value;
const password = document.getElementById("password")?.value;
const confirmPassword = document.getElementById("confirmPassword")?.value;

// evitar ejecutar en otras páginas
if(!nombre) return;

// campos obligatorios
if(!nombre || !cedula || !materia || !correo || !password || !confirmPassword){
alert("Todos los campos son obligatorios");
return;
}

// validar contraseñas
if(password !== confirmPassword){
alert("Las contraseñas no coinciden");
return;
}

if(password.length < 6){
alert("Contraseña muy débil, debe contener al menos 6 caracteres");
return;
}

try {

// primero revisar si ya existe correo real

const q = query(
collection(db,"usuarios"),
where("correo","==",correo)
);

const querySnapshot = await getDocs(q);

if(!querySnapshot.empty){

const docExistente = querySnapshot.docs[0];
const data = docExistente.data();

// enviar reset contraseña
await sendPasswordResetEmail(auth, data.correo);

// enviar solicitud admin
await updateDoc(doc(db,"usuarios",docExistente.id),{
estado: "pendiente"
});

alert("Ya existía un usuario con ese correo. Se reseteó la contraseña y se envió solicitud al administrador");
window.location.href = "aula.html";

return;

}

// crear usuario nuevo
const userCredential = await createUserWithEmailAndPassword(auth,correo,password);

const user = userCredential.user;

await setDoc(doc(db,"usuarios",user.uid),{

nombre: nombre,
cedula: cedula,
materia: materia,
correo: correo,
rol: "profesor",
estado: "pendiente",
resetPassword: "ninguno",
fecha: new Date()

});

alert("Solicitud enviada al administrador");

window.location.href = "aula.html";

}

catch(error){

let mensaje = "Error al registrar";

switch(error.code){

case "auth/weak-password":
mensaje = "Contraseña muy débil";
break;

case "auth/email-already-in-use":
mensaje = "Este usuario ya está registrado";
break;

default:
mensaje = "Ocurrió un error";
break;

}

alert(mensaje);

}

};

/* ADMIN - VER USUARIOS */

window.cargarUsuarios = async function(){

const querySnapshot = await getDocs(collection(db, "usuarios"));

const contenedor = document.getElementById("usuarios");
const solicitudes = document.getElementById("solicitudes");
const tituloSolicitudes = document.getElementById("tituloSolicitudes");

if(!contenedor) return;

contenedor.innerHTML = "";
solicitudes.innerHTML = "";

const inicioSesion = new Date(sessionStorage.getItem("inicioAdmin"));

let haySolicitudes = false;

querySnapshot.forEach((docu) => {

const data = docu.data();

if(data.estado === "eliminado") return;

// no mostrar admin
if(!data.nombre) return;

const fecha = data.fecha ? new Date(data.fecha.seconds * 1000) : null;

const esNueva = fecha && fecha > inicioSesion && data.estado === "pendiente";

const tarjeta = `
<div class="usuario-card">

<div class="usuario-datos">

<div class="dato">
<label>Nombre</label>
<span>${data.nombre}</span>
</div>

<div class="dato">
<label>Cédula</label>
<span>${data.cedula}</span>
</div>

<div class="dato">
<label>Materia</label>
<span>${data.materia}</span>
</div>

<div class="dato">
<label>Estado</label>
<span>${data.estado.charAt(0).toUpperCase() + data.estado.slice(1)}</span>
</div>

</div>

<div class="usuario-botones">

<button class="btn-admin btn-activar" onclick="aprobar('${docu.id}')">
Activar
</button>

<button class="btn-admin btn-inactivar" onclick="inactivar('${docu.id}')">
Inactivar
</button>

<button class="btn-admin btn-eliminar" onclick="eliminar('${docu.id}')">
Eliminar
</button>

</div>

</div>
`;

if(esNueva){
solicitudes.innerHTML += tarjeta;
haySolicitudes = true;
}else{
contenedor.innerHTML += tarjeta;
}

});

if(!haySolicitudes){
tituloSolicitudes.style.display = "none";
solicitudes.style.display = "none";
}

};

/*Admin - Cargar Usuarios*/
window.addEventListener("DOMContentLoaded", () => {

cargarUsuarios();
cargarReset();

});

/*Admin - Inactivar*/
window.inactivar = async function(id){

await updateDoc(doc(db,"usuarios",id),{
estado: "inactivo"
});

alert("Usuario inactivado");
cargarUsuarios();

};

/*Admin - Eliminar*/
window.eliminar = async function(id){

if(!confirm("¿Eliminar usuario?")) return;

await updateDoc(doc(db,"usuarios",id),{
estado: "eliminado"
});

alert("Usuario eliminado");

cargarUsuarios();

}

/*Admin - Activar usuario*/
window.aprobar = async function(id){

await updateDoc(doc(db,"usuarios",id),{

estado: "activo"

});

alert("Usuario activado");

cargarUsuarios();

};


/* SEGURIDAD DE PÁGINAS*/

window.protegerPagina = function(rolPermitido){

onAuthStateChanged(auth, async (user) => {

if(!user){
window.location.href = "aula.html";
return;
}

const docRef = doc(db, "usuarios", user.uid);
const docSnap = await getDoc(docRef);

if(docSnap.exists()){

const data = docSnap.data();

if(data.rol !== rolPermitido){
window.location.href = "aula.html";
return;
}

if(data.rol === "admin"){
sessionStorage.setItem("inicioAdmin", new Date());
}

document.body.style.display = "block";

}

});

};

/* DATOS PROFESOR */

window.cargarDatosProfesor = function(){

onAuthStateChanged(auth, async (user) => {

if(!user) return;

const docRef = doc(db, "usuarios", user.uid);
const docSnap = await getDoc(docRef);

if(docSnap.exists()){

const data = docSnap.data();

const nombre = document.getElementById("nombreProfesor");

if(nombre){
nombre.innerText = data.nombre;
}

}

});

};

/*Cerrar sesion*/

window.logout = function(){

signOut(auth).then(() => {
window.location.href = "aula.html";
});

};

/*Olvide contraseña*/

window.olvidePassword = async function(){

const cedula = document.getElementById("cedula")?.value;

if(!cedula){
alert("Ingrese su usuario");
return;
}


try{

await sendPasswordResetEmail(auth, correo);

alert("Se envió un correo para restablecer la contraseña");
window.location.href = "aula.html";
}
catch(error){

alert("Usuario no encontrado");

}

};