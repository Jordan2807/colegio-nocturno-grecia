import { db } from './firebase-init.js';
import {
    collection,
    query,
    where,
    getDocs,
    orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Estado de navegación
let estadoActual = 'profesores'; // 'profesores', 'secciones', 'archivos'
let profesorActual = null;
let seccionActual = null;

const dynamicContent = document.getElementById('dynamicContent');

// Iniciar cargando profesores
window.addEventListener('DOMContentLoaded', () => {
    mostrarProfesores();
});

// ========== VISTA: PROFESORES ==========
async function mostrarProfesores() {
    estadoActual = 'profesores';
    profesorActual = null;
    seccionActual = null;
    
    dynamicContent.innerHTML = `
        <h2 class="titulo-seccion">Nuestros Profesores</h2>
        <div id="profesoresGrid" class="tarjetas-grid">
            <p class="mensaje-vacio">Cargando profesores...</p>
        </div>
    `;
    
    await cargarProfesoresConSecciones();
}

async function cargarProfesoresConSecciones() {
    try {
        // 1. Obtener todos los profesores activos
        const profesoresQuery = query(
            collection(db, "usuarios"),
            where("rol", "==", "profesor"),
            where("estado", "==", "activo")
        );
        const profesoresSnapshot = await getDocs(profesoresQuery);
        
        if (profesoresSnapshot.empty) {
            document.getElementById('profesoresGrid').innerHTML = 
                '<p class="mensaje-vacio">No hay profesores disponibles en este momento.</p>';
            return;
        }
        
        // 2. Para cada profesor, verificar si tiene al menos una sección
        const profesoresConSecciones = [];
        
        for (const profDoc of profesoresSnapshot.docs) {
            const seccionesQuery = query(
                collection(db, "secciones"),
                where("profesor", "==", profDoc.id)
            );
            const seccionesSnapshot = await getDocs(seccionesQuery);
            
            if (!seccionesSnapshot.empty) {
                const data = profDoc.data();
                profesoresConSecciones.push({
                    id: profDoc.id,
                    nombre: data.nombre,
                    materia: data.materia || 'Materia no especificada'
                });
            }
        }
        
        const grid = document.getElementById('profesoresGrid');
        if (profesoresConSecciones.length === 0) {
            grid.innerHTML = '<p class="mensaje-vacio">No hay profesores con materiales disponibles.</p>';
            return;
        }
        
        let html = '';
        profesoresConSecciones.forEach(prof => {
            html += `
                <div class="tarjeta" data-profesor-id="${prof.id}" data-profesor-nombre="${prof.nombre}" data-profesor-materia="${prof.materia}">
                    <i class="fa-solid fa-chalkboard-user"></i>
                    <h3>${prof.nombre}</h3>
                    <p class="materia">${prof.materia}</p>
                </div>
            `;
        });
        grid.innerHTML = html;
        
        // Agregar event listeners
        document.querySelectorAll('.tarjeta').forEach(tarjeta => {
            tarjeta.addEventListener('click', () => {
                const id = tarjeta.dataset.profesorId;
                const nombre = tarjeta.dataset.profesorNombre;
                const materia = tarjeta.dataset.profesorMateria;
                mostrarSeccionesProfesor(id, nombre, materia);
            });
        });
        
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('profesoresGrid').innerHTML = 
            '<p class="mensaje-vacio">Error al cargar los profesores.</p>';
    }
}

// ========== VISTA: SECCIONES ==========
async function mostrarSeccionesProfesor(profesorId, nombre, materia) {
    estadoActual = 'secciones';
    profesorActual = { id: profesorId, nombre, materia };
    
    dynamicContent.innerHTML = `
        <div class="navegacion">
            <button class="btn-volver" onclick="window.volverAProfesores()">
                <i class="fa-solid fa-arrow-left"></i> Volver a profesores
            </button>
        </div>
        <h2 class="titulo-seccion">${nombre} - ${materia}</h2>
        <div id="seccionesGrid" class="tarjetas-grid">
            <p class="mensaje-vacio">Cargando secciones...</p>
        </div>
    `;
    
    await cargarSecciones(profesorId);
}

async function cargarSecciones(profesorId) {
    try {
        const q = query(
            collection(db, "secciones"),
            where("profesor", "==", profesorId),
            orderBy("fecha", "desc")
        );
        const snapshot = await getDocs(q);
        const grid = document.getElementById('seccionesGrid');
        
        if (snapshot.empty) {
            grid.innerHTML = '<p class="mensaje-vacio">Este profesor no tiene secciones.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                <div class="tarjeta" data-seccion-id="${doc.id}" data-seccion-nombre="${data.nombre}">
                    <i class="fa-regular fa-folder-open"></i>
                    <h3>${data.nombre}</h3>
                </div>
            `;
        });
        grid.innerHTML = html;
        
        document.querySelectorAll('.tarjeta').forEach(tarjeta => {
            tarjeta.addEventListener('click', () => {
                const id = tarjeta.dataset.seccionId;
                const nombreSeccion = tarjeta.dataset.seccionNombre;
                mostrarArchivosSeccion(id, nombreSeccion);
            });
        });
        
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('seccionesGrid').innerHTML = 
            '<p class="mensaje-vacio">Error al cargar las secciones.</p>';
    }
}

// Función global para volver a profesores (llamada desde onclick)
window.volverAProfesores = function() {
    mostrarProfesores();
};

// ========== VISTA: ARCHIVOS ==========
async function mostrarArchivosSeccion(seccionId, nombreSeccion) {
    estadoActual = 'archivos';
    seccionActual = { id: seccionId, nombre: nombreSeccion };
    
    dynamicContent.innerHTML = `
        <div class="navegacion">
            <button class="btn-volver" onclick="window.volverASecciones()">
                <i class="fa-solid fa-arrow-left"></i> Volver a secciones
            </button>
        </div>
        <h2 class="titulo-seccion">${nombreSeccion}</h2>
        <div id="archivosLista" class="archivos-lista">
            <p class="mensaje-vacio">Cargando archivos...</p>
        </div>
    `;
    
    await cargarArchivos(seccionId);
}

async function cargarArchivos(seccionId) {
    try {
        const q = query(
            collection(db, "archivos"),
            where("seccion", "==", seccionId)
        );
        const snapshot = await getDocs(q);
        const lista = document.getElementById('archivosLista');
        
        if (snapshot.empty) {
            lista.innerHTML = '<p class="mensaje-vacio">Esta sección no tiene archivos.</p>';
            return;
        }
        
        let html = '';
        snapshot.forEach(doc => {
            const data = doc.data();
            // Determinar icono según extensión
            let icono = 'fa-file';
            const nombre = data.nombre.toLowerCase();
            if (nombre.endsWith('.pdf')) icono = 'fa-file-pdf';
            else if (nombre.endsWith('.doc') || nombre.endsWith('.docx')) icono = 'fa-file-word';
            else if (nombre.endsWith('.jpg') || nombre.endsWith('.png') || nombre.endsWith('.jpeg')) icono = 'fa-file-image';
            
            html += `
                <div class="archivo-item">
                    <i class="fa-regular ${icono}"></i>
                    <a href="${data.url}" target="_blank" download>${data.nombre}</a>
                </div>
            `;
        });
        lista.innerHTML = html;
        
    } catch (error) {
        console.error("Error:", error);
        document.getElementById('archivosLista').innerHTML = 
            '<p class="mensaje-vacio">Error al cargar los archivos.</p>';
    }
}

// Función global para volver a secciones (desde archivos)
window.volverASecciones = function() {
    if (profesorActual) {
        mostrarSeccionesProfesor(
            profesorActual.id,
            profesorActual.nombre,
            profesorActual.materia
        );
    } else {
        mostrarProfesores();
    }
};