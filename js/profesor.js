// js/profesor.js
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { auth, db, storage } from './firebase-init.js';
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  doc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updatePassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

  if (!nombre || !cedula || !materia) {
    alert("Nombre, cédula y materia son obligatorios");
    return;
  }

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
    await updateDoc(doc(db, "usuarios", currentUser.uid), {
      nombre,
      cedula,
      materia
    });

    if (password) {
      await updatePassword(currentUser, password);
    }

    alert("Perfil actualizado correctamente");
    passwordInput.value = "";
    confirmInput.value = "";
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

  // Verificar que el profesor tenga materia registrada
  try {
    const userDoc = await getDoc(doc(db, "usuarios", currentUser.uid));
    if (!userDoc.exists()) {
      alert("No se encontró el perfil del profesor");
      return;
    }
    
    const profesorData = userDoc.data();
    const materia = profesorData.materia?.trim();
    
    if (!materia) {
      alert("Debe completar el campo 'Materia' en su perfil antes de crear secciones. Vaya a 'Editar Perfil' para agregarlo.");
      return;
    }
  } catch (error) {
    console.error("Error al verificar materia:", error);
    alert("No se pudo verificar el perfil. Intente de nuevo.");
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
  if (!confirm(`¿Eliminar la sección "${nombre}" y TODOS sus archivos? Esta acción no se puede deshacer.`)) return;

  const functions = getFunctions();
  const eliminarDeCloudinary = httpsCallable(functions, 'eliminarArchivoCloudinary');

  try {
    // 1. Obtener todos los archivos de esta sección
    const archivosQuery = query(collection(db, "archivos"), where("seccion", "==", id));
    const archivosSnapshot = await getDocs(archivosQuery);
    
    // 2. Eliminar cada archivo de Cloudinary y Firestore
    const errores = [];
    
    for (const archivoDoc of archivosSnapshot.docs) {
      const archivoData = archivoDoc.data();
      const publicId = archivoData.publicId;
      
      if (!publicId) {
        console.warn("Archivo sin publicId, se omite:", archivoData.nombre);
        continue;
      }
      
      try {
        // Intentar eliminar de Cloudinary
        await eliminarDeCloudinary({ publicId });
        // Si tiene éxito, eliminar de Firestore
        await deleteDoc(doc(db, "archivos", archivoDoc.id));
      } catch (error) {
        console.error(`Error al eliminar archivo ${archivoData.nombre}:`, error);
        errores.push(archivoData.nombre);
      }
    }
    
    // 3. Si hubo errores, NO eliminar la sección y notificar
    if (errores.length > 0) {
      alert(`No se pudo eliminar la sección porque falló la eliminación de los siguientes archivos:\n- ${errores.join('\n- ')}\n\nIntenta de nuevo más tarde.`);
      return;
    }
    
    // 4. Si todos los archivos se eliminaron correctamente, borrar la sección
    await deleteDoc(doc(db, "secciones", id));
    
    alert("Sección y archivos eliminados correctamente");
    await cargarSecciones();
    
    // Ocultar vista de archivos si estábamos dentro de la sección eliminada
    if (seccionActualId === id) {
      document.getElementById("archivos")?.classList.add("oculto");
      document.getElementById("secciones")?.classList.remove("oculto");
      seccionActualId = null;
    }
  } catch (error) {
    console.error("Error al procesar la eliminación de la sección:", error);
    alert("Error inesperado al eliminar la sección. Intenta de nuevo.");
  }
}
// ---------- ARCHIVOS ----------
window.seleccionarYSubirArchivo = function() {
    if (!seccionActualId) {
        alert("No hay sección seleccionada");
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
            alert("Error al subir el archivo: " + (error.statusText || ''));
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
        alert("Archivo subido correctamente");
    } catch (error) {
        alert("El archivo se subió, pero hubo un error al guardarlo en la base de datos.");
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
  if (!confirm(`¿Eliminar el archivo "${nombreArchivo}"?`)) return;

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
    
    alert("Archivo eliminado correctamente");
    await cargarArchivos();
  } catch (error) {
    alert("No se pudo eliminar el archivo.");
  }
}
window.cargarArchivos = cargarArchivos;

window.addEventListener('DOMContentLoaded', init);

window.volverASecciones = function() {
    document.getElementById("archivos")?.classList.add("oculto");
    document.getElementById("secciones")?.classList.remove("oculto");
    seccionActualId = null;
};