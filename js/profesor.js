// js/profesor.js
import { auth, db, storage } from './firebase-init.js';
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  doc, updateDoc, addDoc, collection, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let seccionActualId = null;

// ---------- INICIALIZACIÓN ----------
async function init() {
  try {
    const { user, data } = await protegerPagina(['admin', 'profesor']);
    currentUser = user;
    
    setupPasswordToggles();
    await cargarDatosProfesor(data);
    await cargarSecciones();
  } catch (e) {}
}

async function cargarDatosProfesor(data) {
  const nombreSpan = document.getElementById("nombreProfesor");
  if (nombreSpan) nombreSpan.innerText = data.nombre;
  
  // Rellenar formulario de edición si existe
  const nombreInput = document.getElementById("nombre");
  const cedulaInput = document.getElementById("cedula");
  const materiaInput = document.getElementById("materia");
  if (nombreInput) nombreInput.value = data.nombre || '';
  if (cedulaInput) cedulaInput.value = data.cedula || '';
  if (materiaInput) materiaInput.value = data.materia || '';
}

// ---------- MENÚ LATERAL ----------
window.toggleMenu = function() {
  document.getElementById("sidebar")?.classList.toggle("active");
};

window.mostrarPerfil = function() {
  document.getElementById("perfil")?.classList.remove("oculto");
  document.getElementById("secciones")?.classList.add("oculto");
  document.getElementById("archivos")?.classList.add("oculto");
};

window.mostrarSecciones = function() {
  document.getElementById("perfil")?.classList.add("oculto");
  document.getElementById("secciones")?.classList.remove("oculto");
  document.getElementById("archivos")?.classList.add("oculto");
};

// ---------- PERFIL (con confirmación de contraseña) ----------
window.guardarPerfil = async function() {
  const nombreInput = document.getElementById("nombre");
  const cedulaInput = document.getElementById("cedula");
  const materiaInput = document.getElementById("materia");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");

  if (!currentUser) {
    alert("No hay sesión activa");
    return;
  }

  const nombre = nombreInput?.value.trim();
  const cedula = cedulaInput?.value.trim();
  const materia = materiaInput?.value.trim();
  const password = passwordInput?.value;
  const confirm = confirmInput?.value;

  // Validar campos obligatorios
  if (!nombre || !cedula || !materia) {
    alert("Nombre, cédula y materia son obligatorios");
    return;
  }

  // Si se intenta cambiar la contraseña
  if (password || confirm) {
    if (password !== confirm) {
      alert("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      alert("La contraseña debe tener al menos 6 caracteres");
      return;
    }
  }

  try {
    // Actualizar datos en Firestore
    await updateDoc(doc(db, "usuarios", currentUser.uid), {
      nombre,
      cedula,
      materia
    });

    // Actualizar contraseña en Auth si se proporcionó
    if (password) {
      await updatePassword(currentUser, password);
    }

    alert("Perfil actualizado correctamente");

    // Limpiar campos de contraseña por seguridad
    if (passwordInput) passwordInput.value = "";
    if (confirmInput) confirmInput.value = "";

  } catch (error) {
    console.error("Error al guardar perfil:", error);
    let mensaje = "Error al guardar los cambios";
    if (error.code === "auth/requires-recent-login") {
      mensaje = "Por seguridad, vuelve a iniciar sesión para cambiar la contraseña";
    } else if (error.message) {
      mensaje = error.message;
    }
    alert(mensaje);
  }
};

// ---------- SECCIONES ----------
window.crearSeccion = async function() {
  const nombreSeccion = document.getElementById("nombreSeccion")?.value;
  if (!nombreSeccion) return alert("Ingrese el nombre de la sección");

  await addDoc(collection(db, "secciones"), {
    nombre: nombreSeccion,
    profesor: currentUser.uid,
    fecha: new Date()
  });

  document.getElementById("nombreSeccion").value = "";
  await cargarSecciones();
};

async function cargarSecciones() {
  const lista = document.getElementById("listaSecciones");
  if (!lista) return;

  const q = query(collection(db, "secciones"), where("profesor", "==", currentUser.uid));
  const snapshot = await getDocs(q);

  lista.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.className = "tarjeta";
    div.textContent = data.nombre;
    div.addEventListener("click", () => abrirSeccion(doc.id, data.nombre));
    lista.appendChild(div);
  });
}
window.cargarSecciones = cargarSecciones;

window.abrirSeccion = function(id, nombre) {
  seccionActualId = id;
  document.getElementById("secciones")?.classList.add("oculto");
  document.getElementById("archivos")?.classList.remove("oculto");
  const titulo = document.getElementById("tituloSeccion");
  if (titulo) titulo.innerText = nombre;
  cargarArchivos();
};

// ---------- ARCHIVOS ----------
window.subirArchivo = async function() {
  const fileInput = document.getElementById("archivo");
  const file = fileInput?.files[0];
  if (!file) return alert("Seleccione un archivo");
  if (!seccionActualId) return alert("No hay sección seleccionada");

  const storageRef = ref(storage, `archivos/${file.name}`);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  await addDoc(collection(db, "archivos"), {
    nombre: file.name,
    url,
    seccion: seccionActualId
  });

  fileInput.value = "";
  await cargarArchivos();
};

async function cargarArchivos() {
  const lista = document.getElementById("listaArchivos");
  if (!lista || !seccionActualId) return;

  const q = query(collection(db, "archivos"), where("seccion", "==", seccionActualId));
  const snapshot = await getDocs(q);

  lista.innerHTML = "";
  snapshot.forEach(doc => {
    const data = doc.data();
    const div = document.createElement("div");
    div.innerHTML = `<a href="${data.url}" target="_blank">${data.nombre}</a>`;
    lista.appendChild(div);
  });
}
window.cargarArchivos = cargarArchivos;

window.addEventListener('DOMContentLoaded', init);