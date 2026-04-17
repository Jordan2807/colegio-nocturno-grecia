// js/admin.js
import { auth, db } from './firebase-init.js';
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  collection, getDocs, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { crearAdministrador } from './auth.js';

let usuarioActual = null;

async function init() {
  try {
    const { user, data } = await protegerPagina(['admin']);
    usuarioActual = user;
    setupPasswordToggles();
    setupEventListeners();
    await cargarUsuarios();
  } catch (e) {}
}

function setupEventListeners() {
  const btnNuevoAdmin = document.getElementById("btnNuevoAdmin");
  if (btnNuevoAdmin) {
    btnNuevoAdmin.addEventListener("click", () => {
      document.getElementById("panelNuevoAdmin")?.classList.toggle("oculto");
    });
  }
}

async function cargarUsuarios() {
  const contenedor = document.getElementById("usuarios");
  const solicitudes = document.getElementById("solicitudes");
  const contenedorAdmins = document.getElementById("admins");
  const tituloSolicitudes = document.getElementById("tituloSolicitudes");
  const tituloAdmins = document.getElementById("tituloAdmins");
  const tituloUsuarios = document.getElementById("tituloUsuarios");

  if (!contenedor) return;

  contenedor.innerHTML = "";
  solicitudes.innerHTML = "";
  contenedorAdmins.innerHTML = "";

  const querySnapshot = await getDocs(collection(db, "usuarios"));
  const inicioSesion = new Date(sessionStorage.getItem("inicioAdmin") || 0);
  
  let haySolicitudes = false, hayAdmins = false, hayProfesores = false;

  querySnapshot.forEach((docu) => {
    const data = docu.data();
    if (data.estado === "eliminado") return;

    const fecha = data.fecha ? new Date(data.fecha.seconds * 1000) : null;
    const esNueva = fecha && fecha > inicioSesion && data.estado === "pendiente";

    if (data.rol === "admin") {
      if (usuarioActual && usuarioActual.uid === docu.id) return;
      const tarjeta = crearTarjetaAdmin(docu.id, data);
      contenedorAdmins.innerHTML += tarjeta;
      hayAdmins = true;
    } else if (data.rol === "profesor") {
      const tarjeta = crearTarjetaProfesor(docu.id, data);
      if (esNueva) {
        solicitudes.innerHTML += tarjeta;
        haySolicitudes = true;
      } else {
        contenedor.innerHTML += tarjeta;
        hayProfesores = true;
      }
    }
  });

  tituloSolicitudes.style.display = haySolicitudes ? "block" : "none";
  solicitudes.style.display = haySolicitudes ? "block" : "none";
  tituloAdmins.style.display = hayAdmins ? "block" : "none";
  contenedorAdmins.style.display = hayAdmins ? "block" : "none";
  tituloUsuarios.style.display = hayProfesores ? "block" : "none";
  contenedor.style.display = hayProfesores ? "block" : "none";
}

function crearTarjetaAdmin(id, data) {
  return `
    <div class="usuario-card">
      <div class="usuario-datos admin">
        <div class="dato"><label>Nombre</label><span>${data.nombre || '—'}</span></div>
        <div class="dato"><label>Cédula</label><span>${data.cedula || '—'}</span></div>
        <div class="dato"><label>Correo</label><span>${data.correo}</span></div>
        <div class="dato"><label>Estado</label><span>${data.estado}</span></div>
      </div>
      <div class="usuario-botones">
        <button class="btn-admin btn-inactivar" data-id="${id}" data-accion="inactivar">Inactivar</button>
        <button class="btn-admin btn-eliminar" data-id="${id}" data-accion="eliminar">Eliminar</button>
        <button class="btn-admin btn-hacer-profesor" data-id="${id}" data-accion="hacerProfesor">Hacer Profesor</button>
      </div>
    </div>
  `;
}

function crearTarjetaProfesor(id, data) {
  return `
    <div class="usuario-card">
      <div class="usuario-datos">
        <div class="dato"><label>Nombre</label><span>${data.nombre}</span></div>
        <div class="dato"><label>Cédula</label><span>${data.cedula}</span></div>
        <div class="dato"><label>Correo</label><span>${data.correo}</span></div>
        <div class="dato"><label>Materia</label><span>${data.materia}</span></div>
        <div class="dato"><label>Estado</label><span>${data.estado}</span></div>
      </div>
      <div class="usuario-botones">
        <button class="btn-admin btn-activar" data-id="${id}" data-accion="activar">Activar</button>
        <button class="btn-admin btn-inactivar" data-id="${id}" data-accion="inactivar">Inactivar</button>
        <button class="btn-admin btn-eliminar" data-id="${id}" data-accion="eliminar">Eliminar</button>
        <button class="btn-admin btn-hacer-admin" data-id="${id}" data-accion="hacerAdmin">Hacer Admin</button>
      </div>
    </div>
  `;
}

// Función para cambiar el rol
async function cambiarRol(id, nuevoRol) {
  await updateDoc(doc(db, "usuarios", id), { rol: nuevoRol });
  await cargarUsuarios();
}

// Función para cambiar estado
async function cambiarEstado(id, nuevoEstado) {
  await updateDoc(doc(db, "usuarios", id), { estado: nuevoEstado });
  await cargarUsuarios();
}

// Delegación de eventos
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  
  if (accion === 'activar') {
    await cambiarEstado(id, 'activo');
    alert('Usuario activado');
  } else if (accion === 'inactivar') {
    await cambiarEstado(id, 'inactivo');
    alert('Usuario inactivado');
  } else if (accion === 'eliminar') {
    if (confirm('¿Eliminar usuario?')) {
      await cambiarEstado(id, 'eliminado');
      alert('Usuario eliminado');
    }
  } else if (accion === 'hacerAdmin') {
    if (confirm('¿Convertir este profesor en administrador?')) {
      await cambiarRol(id, 'admin');
      alert('Ahora es administrador');
    }
  } else if (accion === 'hacerProfesor') {
    if (confirm('¿Convertir este administrador en profesor?')) {
      await cambiarRol(id, 'profesor');
      alert('Ahora es profesor');
    }
  }
});

window.registrarAdmin = async function() {
  const correo = document.getElementById("correoAdmin")?.value.trim();
  const nombre = document.getElementById("nombreAdmin")?.value.trim();
  const cedula = document.getElementById("cedulaAdmin")?.value.trim();
  const password = document.getElementById("password")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;

  if (!correo || !nombre || !cedula || !password || !confirm) {
    return alert("Todos los campos son obligatorios");
  }
  if (password !== confirm) return alert("Las contraseñas no coinciden");
  if (password.length < 6) return alert("Contraseña muy débil");

  try {
    await crearAdministrador(correo, nombre, cedula, password);
    alert("Administrador creado correctamente");
    
    // Limpiar formulario
    document.getElementById("panelNuevoAdmin")?.classList.add("oculto");
    document.getElementById("correoAdmin").value = "";
    document.getElementById("nombreAdmin").value = "";
    document.getElementById("cedulaAdmin").value = "";
    document.getElementById("password").value = "";
    document.getElementById("confirmPassword").value = "";
    
    await cargarUsuarios();
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.cargarUsuarios = cargarUsuarios;

window.addEventListener('DOMContentLoaded', init);