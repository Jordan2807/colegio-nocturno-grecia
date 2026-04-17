//js/utils.js
import { mostrarAlerta, mostrarConfirmacion } from './utils.js';

// js/profesor.js
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { auth, db, storage } from './firebase-init.js';
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  doc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updatePassword, updateEmail, sendEmailVerification } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

let currentUser = null;
let seccionActualId = null;

// ---------- INICIALIZACIÓN ----------
async function init() {
  try {
    const { user, data } = await protegerPagina(['admin', 'profesor']);
    currentUser = user;
    
    // Mostrar botón de admin si corresponde
    if (data.rol === 'admin') {
        const btnAdmin = document.getElementById('btnAdminPanel');
        if (btnAdmin) btnAdmin.style.display = 'block';
    }
    
    setupPasswordToggles();
    await cargarDatosProfesor(data);
    await cargarSecciones();
  } catch (e) {}
}

// Función global para redirigir al panel admin
window.irAAdmin = function() {
    window.location.href = 'admin.html';
};

async function cargarDatosProfesor(data) {
  const nombreSpan = document.getElementById("nombreProfesor");
  if (nombreSpan) nombreSpan.innerText = data.nombre;
  
  // Rellenar formulario de edición si existe
  const nombreInput = document.getElementById("nombre");
  const cedulaInput = document.getElementById("cedula");
  const materiaInput = document.getElementById("materia");
  const correoInput = document.getElementById("correo");
  if (nombreInput) nombreInput.value = data.nombre || '';
  if (cedulaInput) cedulaInput.value = data.cedula || '';
  if (materiaInput) materiaInput.value = data.materia || '';
  if (correoInput) correoInput.value = data.correo || '';
}

// ---------- MENÚ LATERAL ----------
window.toggleMenu = function() {
  document.getElementById("sidebar")?.classList.toggle("active");
};

window.mostrarPerfil = function() {
  document.getElementById("perfil")?.classList.remove("oculto");
  document.getElementById("secciones")?.classList.add("oculto");
  document.getElementById("archivos")?.classList.add("oculto");
  document.getElementById("sidebar")?.classList.remove("active");
};

window.mostrarSecciones = function() {
  document.getElementById("perfil")?.classList.add("oculto");
  document.getElementById("secciones")?.classList.remove("oculto");
  document.getElementById("archivos")?.classList.add("oculto");
  document.getElementById("sidebar")?.classList.remove("active");
};

// ---------- PERFIL (con confirmación de contraseña) ----------
window.guardarPerfil = async function() {
  const nombreInput = document.getElementById("nombre");
  const cedulaInput = document.getElementById("cedula");
  const materiaInput = document.getElementById("materia");
  const correoInput = document.getElementById("correo");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");

  if (!currentUser) {
    await mostrarAlerta("No hay sesión activa", "error");
    return;
  }

  const nombre = nombreInput?.value.trim();
  const cedula = cedulaInput?.value.trim();
  const materia = materiaInput?.value.trim();
  const nuevoCorreo = correoInput?.value.trim();
  const password = passwordInput?.value;
  const confirm = confirmInput?.value;

  if (!nombre || !cedula || !materia || !nuevoCorreo) {
    await mostrarAlerta("Nombre, cédula, materia y correo son obligatorios", "error");
    return;
  }

  // Validar contraseña si se intenta cambiar
  if (password || confirm) {
    if (password !== confirm) {
      aawait mostrarAlerta("Las contraseñas no coinciden", "error");
      return;
    }
    if (password.length < 6) {
      await mostrarAlerta("La contraseña debe tener al menos 6 caracteres", "error");
      return;
    }
  }

  try {
    // Obtener datos actuales para comparar el correo
    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
    if (!userDoc.exists()) throw new Error("Perfil no encontrado");
    const currentData = userDoc.data();
    const correoActual = currentData.correo;

    // Si el correo cambió, verificar que no esté en uso y actualizar en Auth
    if (nuevoCorreo !== correoActual) {
      // Verificar si el nuevo correo ya existe en otro usuario
      const correoQuery = query(collection(db, "usuarios"), where("correo", "==", nuevoCorreo));
      const correoSnapshot = await getDocs(correoQuery);
      if (!correoSnapshot.empty) {
        const otroDoc = correoSnapshot.docs[0];
        if (otroDoc.id !== currentUser.uid) {
          await mostrarAlerta("El correo ingresado ya está en uso por otra cuenta.", "error");
          return;
        }
      }

      // Actualizar email en Firebase Auth
      await updateEmail(currentUser, nuevoCorreo);
      // Enviar verificación al nuevo correo (opcional pero recomendado)
      await sendEmailVerification(currentUser);
    }

    // Actualizar datos en Firestore
    await updateDoc(doc(db, "usuarios", currentUser.uid), {
      nombre,
      cedula,
      materia,
      correo: nuevoCorreo
    });

    // Actualizar contraseña si se proporcionó
    if (password) {
      await updatePassword(currentUser, password);
    }

    await mostrarAlerta("Perfil actualizado correctamente" + (nuevoCorreo !== correoActual ? " - Se ha enviado un correo de verificación a la nueva dirección." : ""), "succes");
    
    // Limpiar campos de contraseña
    if (passwordInput) passwordInput.value = "";
    if (confirmInput) confirmInput.value = "";

  } catch (error) {
    console.error("Error al guardar perfil:", error);
    let mensaje = "Error al guardar los cambios";
    if (error.code === "auth/requires-recent-login") {
      mensaje = "Por seguridad, debes volver a iniciar sesión antes de cambiar el correo o la contraseña.";
    } else if (error.code === "auth/email-already-in-use") {
      mensaje = "El correo electrónico ya está en uso por otra cuenta.";
    } else if (error.code === "auth/invalid-email") {
      mensaje = "El formato del correo no es válido.";
    } else if (error.message) {
      mensaje = error.message;
    }
    await mostrarAlerta(mensaje, "error");
  }
};

// ---------- SECCIONES ----------
window.crearSeccion = async function() {
  const nombreSeccion = document.getElementById("nombreSeccion")?.value;
  if (!nombreSeccion) return await mostrarAlerta("Ingrese el nombre de la sección", "error");

  // Verificar que el profesor tenga materia registrada
  try {
    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
    if (!userDoc.exists()) {
      await mostrarAlerta("No se encontró el perfil del profesor", "error");
      return;
    }
    
    const profesorData = userDoc.data();
    const materia = profesorData.materia?.trim();
    
    if (!materia) {
      aawait mostrarAlerta("Debe completar el campo 'Materia' en su perfil antes de crear secciones. Vaya a 'Editar Perfil' para agregarlo.", "error");
      return;
    }
  } catch (error) {
    console.error("Error al verificar materia:", error);
    await mostrarAlerta("No se pudo verificar el perfil. Intente de nuevo.", "error");
    return;
  }

  // Crear la sección
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
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta tarjeta-seccion";
    tarjeta.innerHTML = `
      <span class="nombre-seccion">${data.nombre}</span>
      <button class="btn-eliminar-seccion" data-id="${doc.id}" title="Eliminar sección">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;
    
    // Click en el nombre abre la sección
    tarjeta.querySelector('.nombre-seccion').addEventListener('click', () => {
      abrirSeccion(doc.id, data.nombre);
    });
    
    // Click en el botón elimina (detiene propagación)
    tarjeta.querySelector('.btn-eliminar-seccion').addEventListener('click', (e) => {
      e.stopPropagation();
      eliminarSeccion(doc.id, data.nombre);
    });
    
    lista.appendChild(tarjeta);
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

//----------ELIMINAR SECCION-----
async function eliminarSeccion(id, nombre) {
  const confirmado = await mostrarConfirmacion(`¿Eliminar la sección "${nombre}" y TODOS sus archivos? Esta acción no se puede deshacer.`, 'Confirmar eliminación');
  if (!confirmado) return;

  try {
    // 1. Obtener todos los archivos de esta sección
    const archivosQuery = query(collection(db, "archivos"), where("seccion", "==", id));
    const archivosSnapshot = await getDocs(archivosQuery);
    
    const archivos = archivosSnapshot.docs;
    let eliminados = 0;
    
    // 2. Recorrer cada archivo y eliminarlo con la función probada
    for (const archivoDoc of archivos) {
      const archivoData = archivoDoc.data();
      const nombreArchivo = archivoData.nombre;
      const publicId = archivoData.publicId;
      
      if (!publicId) {
        // Si no tiene publicId, al menos lo borramos de Firestore
        await deleteDoc(doc(db, "archivos", archivoDoc.id));
        eliminados++;
        continue;
      }
      
      try {
        // Llamar a una versión sin alertas de eliminarArchivo
        await eliminarArchivoSilencioso(archivoDoc.id, nombreArchivo, publicId);
        eliminados++;
      } catch (error) {
        // Si falla, detener todo y mostrar error
        console.error(`Error al eliminar "${nombreArchivo}":`, error);
        await mostrarAlerta(`No se pudo eliminar el archivo "${nombreArchivo}".\nSe detuvo la eliminación de la sección.\nSe eliminaron ${eliminados} archivos antes del error.`, "error");
        return; // ← Detiene la ejecución, la sección NO se borra
      }
    }
    
    // 3. Si todos los archivos se eliminaron, borrar la sección
    await deleteDoc(doc(db, "secciones", id));
    
    await mostrarAlerta(`Sección "${nombre}" y ${eliminados} archivo(s) eliminados correctamente.`, "error");
    await cargarSecciones();
    
    // Ocultar vista de archivos si estábamos dentro de la sección eliminada
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

// ----------------------------------------------
// Función auxiliar: igual que eliminarArchivo pero sin alert/confirm
// ----------------------------------------------
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

  // Eliminar de Firestore
  await deleteDoc(doc(db, "archivos", idFirestore));
  // No muestra alertas
}
// ---------- ARCHIVOS ----------
window.seleccionarYSubirArchivo = function() {
    if (!seccionActualId) {
        await mostrarAlerta("No hay sección seleccionada", "error");
        return;
    }

    const widget = window.cloudinary.createUploadWidget({
        cloudName: 'dfsikzvkn',
        uploadPreset: 'preset_profesores',
        sources: ['local', 'url'],
        folder: `secciones/${seccionActualId}`,
        clientAllowedFormats: ['pdf', 'doc', 'docx', 'jpg', 'png', 'jpeg'],
        maxFileSize: 15000000,
        resourceType: 'auto',           // Detecta automáticamente imagen/raw
        type: 'upload',                 // Fuerza que el recurso sea público
        // No incluyas overwrite, publicId, use_filename ni signing
    }, async (error, result) => {
        if (error) {
            console.error("Error en la subida:", error);
            await mostrarAlerta("Error al subir el archivo: " + (error.statusText || ''), "error");
            return;
        }
        
        if (result && result.event === "success") {
            console.log("Subida exitosa:", result.info);
            await guardarArchivoEnFirestore(
                result.info.original_filename,
                result.info.secure_url,
                result.info.public_id
            );
        }
    });

    widget.open();
};

// GUARDAR METADATOS EN FIRESTORE
async function guardarArchivoEnFirestore(nombreArchivo, urlArchivo, publicId) {
    try {
        await addDoc(collection(db, "archivos"), {
            nombre: nombreArchivo,
            url: urlArchivo,
            seccion: seccionActualId,
            fecha: new Date(),
            publicId: publicId      // <-- Indispensable para eliminar después
        });
        await cargarArchivos();
        await mostrarAlerta("Archivo subido correctamente", "success");
    } catch (error) {
        await mostrarAlerta("El archivo se subió, pero hubo un error al guardarlo en la base de datos.", "error");
    }
}

async function cargarArchivos() {
    const lista = document.getElementById("listaArchivos");
    if (!lista || !seccionActualId) return;

    const q = query(collection(db, "archivos"), where("seccion", "==", seccionActualId));
    const snapshot = await getDocs(q);

    lista.innerHTML = "";
    snapshot.forEach(doc => {
        const data = doc.data();
        const div = document.createElement("div");
        div.className = "archivo-item";
        div.innerHTML = `
          <a href="${data.url}" target="_blank">${data.nombre}</a>
          <button class="btn-eliminar-archivo" data-id="${doc.id}" data-public-id="${data.publicId}" title="Eliminar archivo">
            <i class="fa-solid fa-trash"></i>
          </button>
        `;
        
        div.querySelector('.btn-eliminar-archivo').addEventListener('click', (e) => {
          e.preventDefault();
          const publicId = e.currentTarget.dataset.publicId;
          eliminarArchivo(doc.id, data.nombre, publicId);
        });
        
        lista.appendChild(div);
    });
}

//Eliminar archivos
async function eliminarArchivo(idFirestore, nombreArchivo, publicId) {
  const confirmado = await mostrarConfirmacion(`¿Eliminar el archivo "${nombreArchivo}"?`, 'Confirmar eliminación');
  if (!confirmado) return;

  try {
    // Obtener token de autenticación actual
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
      throw new Error(errorData.error || 'Error al eliminar');
    }

    // Eliminar de Firestore
    await deleteDoc(doc(db, "archivos", idFirestore));
    
    await mostrarAlerta("Archivo eliminado correctamente", "success");
    await cargarArchivos();
  } catch (error) {
    await mostrarAlerta("No se pudo eliminar el archivo.", "error");
  }
}
window.cargarArchivos = cargarArchivos;

window.addEventListener('DOMContentLoaded', init);

window.volverASecciones = function() {
    document.getElementById("archivos")?.classList.add("oculto");
    document.getElementById("secciones")?.classList.remove("oculto");
    seccionActualId = null;
};