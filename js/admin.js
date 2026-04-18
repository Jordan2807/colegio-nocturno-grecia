// js/admin.js
import { auth, db } from './firebase-init.js';
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  collection, getDocs, doc, updateDoc, query, where, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { crearAdministrador } from './auth.js';
import { mostrarAlerta, mostrarConfirmacion } from './utils.js';
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let usuarioActual = null;

// ---------- INICIALIZACIÓN ----------
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

// ---------- CARGAR LISTA DE USUARIOS ----------
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
  const estado = data.estado || 'activo';
  const estadoFormateado = estado.charAt(0).toUpperCase() + estado.slice(1);
  const botones = [];
  if (estado !== 'activo') {
    botones.push(`<button class="btn-admin btn-activar" data-id="${id}" data-accion="activar">Activar</button>`);
  }
  if (estado !== 'inactivo') {
    botones.push(`<button class="btn-admin btn-inactivar" data-id="${id}" data-accion="inactivar">Inactivar</button>`);
  }
  botones.push(`<button class="btn-admin btn-eliminar" data-id="${id}" data-accion="eliminar">Eliminar</button>`);
  botones.push(`<button class="btn-admin btn-hacer-profesor" data-id="${id}" data-accion="hacerProfesor">Hacer Profesor</button>`);

  return `
    <div class="usuario-card">
      <div class="usuario-datos admin">
        <div class="dato"><label>Nombre</label><span>${data.nombre || '—'}</span></div>
        <div class="dato"><label>Cédula</label><span>${data.cedula || '—'}</span></div>
        <div class="dato"><label>Correo</label><span>${data.correo}</span></div>
        <div class="dato"><label>Estado</label><span>${estadoFormateado}</span></div>
      </div>
      <div class="usuario-botones">
        ${botones.join('')}
      </div>
    </div>
  `;
}

function crearTarjetaProfesor(id, data) {
  const estado = data.estado;
  const estadoFormateado = estado.charAt(0).toUpperCase() + estado.slice(1);
  
  const mostrarActivar = estado === 'pendiente' || estado === 'inactivo';
  const mostrarInactivar = estado === 'pendiente' || estado === 'activo';
  
  return `
    <div class="usuario-card">
      <div class="usuario-datos">
        <div class="dato"><label>Nombre</label><span>${data.nombre}</span></div>
        <div class="dato"><label>Cédula</label><span>${data.cedula}</span></div>
        <div class="dato"><label>Correo</label><span>${data.correo}</span></div>
        <div class="dato"><label>Materia</label><span>${data.materia || '—'}</span></div>
        <div class="dato"><label>Estado</label><span>${estadoFormateado}</span></div>
      </div>
      <div class="usuario-botones">
        ${mostrarActivar ? `<button class="btn-admin btn-activar" data-id="${id}" data-accion="activar">Activar</button>` : ''}
        ${mostrarInactivar ? `<button class="btn-admin btn-inactivar" data-id="${id}" data-accion="inactivar">Inactivar</button>` : ''}
        <button class="btn-admin btn-eliminar" data-id="${id}" data-accion="eliminar">Eliminar</button>
        <button class="btn-admin btn-hacer-admin" data-id="${id}" data-accion="hacerAdmin">Hacer Admin</button>
      </div>
    </div>
  `;
}

// ---------- FUNCIONES AUXILIARES ----------
async function cambiarRol(id, nuevoRol) {
  await updateDoc(doc(db, "usuarios", id), { rol: nuevoRol });
  await cargarUsuarios();
}

async function cambiarEstado(id, nuevoEstado) {
  await updateDoc(doc(db, "usuarios", id), { estado: nuevoEstado });
  await cargarUsuarios();
}

// ---------- ELIMINACIÓN DE SECCIÓN----------
async function eliminarSeccion(id, nombre) {
  const confirmado = await mostrarConfirmacion(`¿Eliminar la sección "${nombre}" y TODOS sus archivos? Esta acción no se puede deshacer.`, 'Confirmar eliminación');
  if (!confirmado) return;

  try {
    const archivosQuery = query(collection(db, "archivos"), where("seccion", "==", id));
    const archivosSnapshot = await getDocs(archivosQuery);
    
    const archivos = archivosSnapshot.docs;
    let eliminados = 0;
    
    for (const archivoDoc of archivos) {
      const archivoData = archivoDoc.data();
      const nombreArchivo = archivoData.nombre;
      const publicId = archivoData.publicId;
      
      if (!publicId) {
        await deleteDoc(doc(db, "archivos", archivoDoc.id));
        eliminados++;
        continue;
      }
      
      try {
        await eliminarArchivoSilencioso(archivoDoc.id, nombreArchivo, publicId);
        eliminados++;
      } catch (error) {
        console.error(`Error al eliminar "${nombreArchivo}":`, error);
        await mostrarAlerta(`No se pudo eliminar el archivo "${nombreArchivo}".\nSe detuvo la eliminación de la sección.\nSe eliminaron ${eliminados} archivos antes del error.`, "error");
        return;
      }
    }
    
    await deleteDoc(doc(db, "secciones", id));
    
    await mostrarAlerta(`Sección "${nombre}" y ${eliminados} archivo(s) eliminados correctamente.`, "success");
    await cargarSecciones();
    
    if (seccionActualId === id) {
      document.getElementById("archivos")?.classList.add("oculto");
      document.getElementById("secciones")?.classList.remove("oculto");
      seccionActualId = null;
    }
  } catch (error) {
    console.error("Error general al eliminar sección:", error);
    await mostrarAlerta("Error inesperado. Intenta de nuevo.", "error");
  }
}

async function eliminarArchivoSilencioso(idFirestore, nombreArchivo, publicId) {
  const idToken = await auth.currentUser.getIdToken();
  
  const response = await fetch(
    'https://us-central1-aula-virtual-colegio-f3290.cloudfunctions.net/eliminarArchivoCloudinary',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({ publicId })
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || 'Error al eliminar de Cloudinary');
  }

  await deleteDoc(doc(db, "archivos", idFirestore));
}

// ---------- DELEGACIÓN DE EVENTOS ----------
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('[data-accion]');
  if (!btn) return;
  const accion = btn.dataset.accion;
  const id = btn.dataset.id;
  
  if (accion === 'activar') {
    await cambiarEstado(id, 'activo');
    await mostrarAlerta('Usuario activado', 'success');
  } else if (accion === 'inactivar') {
    await cambiarEstado(id, 'inactivo');
    await mostrarAlerta('Usuario inactivado', 'warning');
  } else if (accion === 'eliminar') {
    const confirmado = await mostrarConfirmacion(
      '¿Eliminar permanentemente al usuario? Se borrarán todas sus secciones, archivos y la cuenta de acceso. Esta acción no se puede deshacer.'
    );
    if (!confirmado) return;

    try {
      const usuarioDoc = await getDoc(doc(db, "usuarios", id));
      if (!usuarioDoc.exists()) {
        await mostrarAlerta('El usuario ya no existe.', 'info');
        await cargarUsuarios();
        return;
      }
      const usuarioData = usuarioDoc.data();
      const uid = id;

      // 1. Eliminar todas las secciones que pertenezcan al usuario (sin importar su rol)
      const seccionesQuery = query(collection(db, "secciones"), where("profesor", "==", uid));
      const seccionesSnapshot = await getDocs(seccionesQuery);
      
      for (const seccionDoc of seccionesSnapshot.docs) {
        try {
          await eeliminarSeccion(seccionDoc.id);
        } catch (error) {
          await mostrarAlerta(`Error al eliminar la sección "${seccionDoc.data().nombre}": ${error.message}`, 'error');
          return;
        }
      }

      // 2. Eliminar documento de Firestore
      await deleteDoc(doc(db, "usuarios", uid));

      // 3. Eliminar de Authentication mediante Cloud Function
      const functions = getFunctions();
      const eliminarDeAuth = httpsCallable(functions, 'eliminarUsuarioAuth');
      await eliminarDeAuth({ uid });

      await mostrarAlerta('Usuario eliminado permanentemente junto con todos sus datos.', 'success');
      await cargarUsuarios();
    } catch (error) {
      console.error('Error en eliminación completa:', error);
      await mostrarAlerta('Error al eliminar usuario: ' + error.message, 'error');
    }
  } else if (accion === 'hacerAdmin') {
    if (await mostrarConfirmacion('¿Convertir este profesor en administrador?', 'Confirmar')) {
      await cambiarRol(id, 'admin');
      await mostrarAlerta('Ahora es administrador', 'success');
    }
  } else if (accion === 'hacerProfesor') {
    if (await mostrarConfirmacion('¿Convertir este administrador en profesor?', 'Confirmar')) {
      await cambiarRol(id, 'profesor');
      await mostrarAlerta('Ahora es profesor', 'success');
    }
  }
});

// ---------- REGISTRAR NUEVO ADMINISTRADOR----------
window.registrarAdmin = async function() {
  const correo = document.getElementById("correoAdmin")?.value.trim();
  const nombre = document.getElementById("nombreAdmin")?.value.trim();
  const cedula = document.getElementById("cedulaAdmin")?.value.trim();
  const password = document.getElementById("password")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;

  if (!correo || !nombre || !cedula || !password || !confirm) {
    return await mostrarAlerta("Todos los campos son obligatorios", "error");
  }
  if (password !== confirm) return await mostrarAlerta("Las contraseñas no coinciden", "error");
  if (password.length < 6) return await mostrarAlerta("Contraseña muy débil", "error");

  try {
    // Verificar cédula única
    const cedulaQuery = query(collection(db, "usuarios"), where("cedula", "==", cedula));
    const cedulaSnapshot = await getDocs(cedulaQuery);
    if (!cedulaSnapshot.empty) {
      await mostrarAlerta("La cédula ingresada ya está registrada en el sistema.", "error");
      return;
    }

    // Verificar correo único
    const correoQuery = query(collection(db, "usuarios"), where("correo", "==", correo));
    const correoSnapshot = await getDocs(correoQuery);
    if (!correoSnapshot.empty) {
      await mostrarAlerta("El correo electrónico ya está en uso por otra cuenta.", "error");
      return;
    }

    // Crear nuevo administrador
    await crearAdministrador(correo, nombre, cedula, password);
    await mostrarAlerta("Administrador creado correctamente", "success");
    document.getElementById("panelNuevoAdmin")?.classList.add("oculto");
    limpiarFormularioAdmin();
    await cargarUsuarios();
  } catch (e) {
    await mostrarAlerta("Error: " + e.message, "error");
  }
};

function limpiarFormularioAdmin() {
  document.getElementById("correoAdmin").value = "";
  document.getElementById("nombreAdmin").value = "";
  document.getElementById("cedulaAdmin").value = "";
  document.getElementById("password").value = "";
  document.getElementById("confirmPassword").value = "";
}

window.cargarUsuarios = cargarUsuarios;
window.addEventListener('DOMContentLoaded', init);