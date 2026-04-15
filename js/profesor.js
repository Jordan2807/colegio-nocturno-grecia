// js/profesor.js
import { auth, db, storage } from './firebase-init.js';
import { protegerPagina } from './auth.js';
import { setupPasswordToggles } from './common.js';
import {
  doc, updateDoc, addDoc, collection, query, where, getDocs, deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  ref, uploadBytes, getDownloadURL, deleteObject
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
  if (!confirm(`¿Eliminar la sección "${nombre}"?\n\nSe borrarán también todos los archivos contenidos en ella. Esta acción no se puede deshacer.`)) {
    return;
  }
  
  try {
    // 1. Obtener todos los archivos de esta sección
    const archivosQuery = query(collection(db, "archivos"), where("seccion", "==", id));
    const archivosSnapshot = await getDocs(archivosQuery);
    
    // 2. Eliminar cada archivo de Storage y Firestore
    const deletePromises = [];
    archivosSnapshot.forEach((archivoDoc) => {
      const archivoData = archivoDoc.data();
      
      // Eliminar documento en Firestore
      deletePromises.push(deleteDoc(doc(db, "archivos", archivoDoc.id)));
      
      // Eliminar objeto en Storage
      // Construimos la referencia basada en la URL o reconstruyendo la ruta
      // Opción recomendada: usar la misma estructura que al subir
      const storageRef = ref(storage, `secciones/${id}/${archivoData.nombre}`);
      deletePromises.push(deleteObject(storageRef).catch(err => {
        // Si el archivo no existe en Storage, ignoramos el error
        if (err.code !== 'storage/object-not-found') {
          console.warn("No se pudo eliminar archivo de Storage:", archivoData.nombre, err);
        }
      }));
    });
    
    // Esperar a que se eliminen todos los archivos
    await Promise.all(deletePromises);
    
    // 3. Eliminar la sección
    await deleteDoc(doc(db, "secciones", id));
    
    alert("Sección y sus archivos eliminados correctamente");
    
    // 4. Refrescar la lista de secciones
    await cargarSecciones();
    
    // 5. Si estábamos dentro de la sección eliminada, volver a la lista de secciones
    const archivosDiv = document.getElementById("archivos");
    const seccionesDiv = document.getElementById("secciones");
    if (archivosDiv && !archivosDiv.classList.contains("oculto") && seccionActualId === id) {
      archivosDiv.classList.add("oculto");
      seccionesDiv?.classList.remove("oculto");
      seccionActualId = null;
    }
    
  } catch (error) {
    console.error("Error al eliminar sección:", error);
    alert("Error al eliminar. Intenta de nuevo.");
  }
}

// ---------- ARCHIVOS ----------
window.seleccionarYSubirArchivo = function() {
    if (!seccionActualId) {
        alert("No hay sección seleccionada");
        return;
    }

    const widget = window.cloudinary.createUploadWidget({
        cloudName: 'dfsikzvkn',        // <-- Reemplaza con tu Cloud Name real
        uploadPreset: 'preset_profesores', // <-- Reemplaza con tu Upload Preset real
        sources: ['local', 'url'],
        folder: `secciones/${seccionActualId}`,
        clientAllowedFormats: ['pdf', 'doc', 'docx', 'jpg', 'png', 'jpeg'],
        maxFileSize: 15000000,
    }, async (error, result) => {
        if (error) {
            console.error("Error en la subida:", error);
            alert("Error al subir el archivo.");
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

// NUEVA FUNCIÓN AUXILIAR
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
        console.error("Error al guardar en Firestore:", error);
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
  if (!confirm(`¿Eliminar el archivo "${nombreArchivo}" de la lista?\n\nNota: Por ahora solo se borra el registro. La eliminación definitiva se configurará en el siguiente paso.`)) return;

  try {
    // Elimina el documento de Firestore
    await deleteDoc(doc(db, "archivos", idFirestore));
    alert("Registro eliminado. El archivo permanece en Cloudinary temporalmente.");
    await cargarArchivos();
  } catch (error) {
    console.error("Error al eliminar archivo:", error);
    alert("No se pudo eliminar el registro.");
  }
}

window.cargarArchivos = cargarArchivos;

window.addEventListener('DOMContentLoaded', init);