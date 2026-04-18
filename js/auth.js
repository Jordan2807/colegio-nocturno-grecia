// js/auth.js
import { auth, db, firebaseConfig } from './firebase-init.js';
import { mostrarLoader, ocultarLoader, mostrarAlerta } from './utils.js';

// Importaciones de App (para crear instancia secundaria)
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

// Importaciones de Auth
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  getAuth,
  updatePassword
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Importaciones de Firestore
import {
  doc, setDoc, getDoc, collection, query, where, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


// ---------- PROTECCIÓN DE PÁGINAS ----------
export async function protegerPagina(rolesPermitidos) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.href = "aula.html";
        return reject('No autenticado');
      }
      const docSnap = await getDoc(doc(db, "usuarios", user.uid));
      if (!docSnap.exists()) {
        window.location.href = "aula.html";
        return reject('Usuario no encontrado');
      }
      const data = docSnap.data();
      if (!rolesPermitidos.includes(data.rol)) {
        window.location.href = "aula.html";
        return reject('Rol no autorizado');
      }
      if (data.rol === "admin") {
        sessionStorage.setItem("inicioAdmin", new Date().toISOString());
      }
      document.body.style.display = "block";
      resolve({ user, data });
    });
  });
}

// ---------- LOGIN ----------
export async function login(cedula, password) {
  const q = query(collection(db, "usuarios"), where("cedula", "==", cedula));
  const querySnapshot = await getDocs(q);
  
  if (querySnapshot.empty) {
    throw new Error("Usuario no encontrado");
  }

  const docUsuario = querySnapshot.docs[0];
  const data = docUsuario.data();
  const email = data.correo;

  // Autenticar con Firebase
  await signInWithEmailAndPassword(auth, email, password);

  // Verificar estado
  if (data.estado === "pendiente") {
    throw new Error("Tu cuenta está pendiente de aprobación");
  }
  if (data.estado === "inactivo") {
    throw new Error("Tu cuenta está inactiva, contacte al administrador");
  }
  // Nota: ya no existe estado "eliminado"

  return {
    uid: docUsuario.id,
    rol: data.rol,
    ...data
  };
}

// ---------- REGISTRO PROFESOR ----------
export async function registrarProfesor(datos) {
  const { nombre, cedula, materia, correo, password } = datos;
  const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
  const user = userCredential.user;

  await setDoc(doc(db, "usuarios", user.uid), {
    nombre,
    cedula,
    materia,
    correo,
    rol: "profesor",
    estado: "pendiente",
    fecha: new Date()
  });
}

// ---------- LOGOUT ----------
export async function logout() {
  await signOut(auth);
  window.location.href = "aula.html";
}

// ---------- OLVIDÉ CONTRASEÑA ----------
export async function olvidePassword(correo) {
  await sendPasswordResetEmail(auth, correo);
}

// ---------- CREAR ADMIN (app secundaria) ----------
export async function crearAdministrador(correo, nombre, cedula, password) {
  let secondaryApp;
  if (!getApps().some(app => app.name === "Secondary")) {
    secondaryApp = initializeApp(firebaseConfig, "Secondary");
  } else {
    secondaryApp = getApp("Secondary");
  }
  const secondaryAuth = getAuth(secondaryApp);
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, correo, password);
  const user = userCredential.user;

  await setDoc(doc(db, "usuarios", user.uid), {
    nombre: nombre,
    cedula: cedula,
    correo: correo,
    rol: "admin",
    estado: "activo",
    fecha: new Date()
  });

  return user.uid;
}

// ---------- EXPOSICIÓN GLOBAL (para onclick en HTML) ----------
window.login = async () => {
  const cedulaInput = document.getElementById("email");
  const passwordInput = document.getElementById("password");

  if (!cedulaInput || !passwordInput) {
    await mostrarAlerta("Error: campos de formulario no disponibles", "error");
    return;
  }

  const cedula = cedulaInput.value.trim();
  const password = passwordInput.value;

  if (!cedula || !password) {
    await mostrarAlerta("Ingrese cédula y contraseña", "error");
    return;
  }

  mostrarLoader();
  try {
    const usuario = await login(cedula, password);
    
    if (usuario.rol === "admin") {
      window.location.href = "admin.html";
    } else if (usuario.rol === "profesor") {
      window.location.href = "profesor.html";
    } else {
      window.location.href = "aula.html";
    }
  } catch (error) {
    ocultarLoader();
    await mostrarAlerta(error.message, "error");
  }
};

window.registrar = async () => {
  const nombreInput = document.getElementById("nombre");
  const cedulaInput = document.getElementById("cedula");
  const materiaInput = document.getElementById("materia");
  const correoInput = document.getElementById("correo");
  const passwordInput = document.getElementById("password");
  const confirmInput = document.getElementById("confirmPassword");

  if (!nombreInput || !cedulaInput || !materiaInput || !correoInput || !passwordInput || !confirmInput) {
    return await mostrarAlerta("Error: No se encontraron todos los campos del formulario", "error");
  }

  const nombre = nombreInput.value.trim();
  const cedula = cedulaInput.value.trim();
  const materia = materiaInput.value.trim();
  const correo = correoInput.value.trim();
  const password = passwordInput.value;
  const confirm = confirmInput.value;

  if (!nombre || !cedula || !materia || !correo || !password || !confirm) {
    return await mostrarAlerta("Todos los campos son obligatorios", "error");
  }
  if (password !== confirm) return await mostrarAlerta("Las contraseñas no coinciden", "error");
  if (password.length < 6) return await mostrarAlerta("Contraseña muy débil", "error");

  mostrarLoader();
  try {
    // Verificar cédula
    const cedulaQuery = query(collection(db, "usuarios"), where("cedula", "==", cedula));
    const cedulaSnapshot = await getDocs(cedulaQuery);
    if (!cedulaSnapshot.empty) {
      ocultarLoader();  // ← Ocultar antes de la alerta
      await mostrarAlerta("La cédula ingresada ya está registrada en el sistema.", "error");
      return;
    }

    // Verificar correo
    const correoQuery = query(collection(db, "usuarios"), where("correo", "==", correo));
    const correoSnapshot = await getDocs(correoQuery);
    if (!correoSnapshot.empty) {
      ocultarLoader();  // ← Ocultar antes de la alerta
      await mostrarAlerta("El correo electrónico ya está en uso por otra cuenta.", "error");
      return;
    }

    // Crear nuevo usuario
    await registrarProfesor({ nombre, cedula, materia, correo, password });
    ocultarLoader();
    await mostrarAlerta("Solicitud enviada al administrador", "success");
    window.location.href = "aula.html";
    
  } catch (e) {
    ocultarLoader();
    await mostrarAlerta("Error: " + e.message, "error");
  }
};

window.logout = logout;

window.olvidePassword = async () => {
  const correoInput = document.getElementById("correo");
  if (!correoInput) return;
  
  const correo = correoInput.value.trim();
  if (!correo) {
    await mostrarAlerta("Ingrese su correo electrónico", "error");
    return;
  }

  mostrarLoader();
  try {
    const q = query(collection(db, "usuarios"), where("correo", "==", correo));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      ocultarLoader();
      await mostrarAlerta("El correo ingresado no está registrado en el sistema.", "error");
      return;
    }

    const docUsuario = querySnapshot.docs[0];
    const data = docUsuario.data();
    
    if (data.estado === "inactivo") {
      ocultarLoader();
      await mostrarAlerta("Esta cuenta está inactiva. Contacte al administrador.", "info");
      return;
    }

    await sendPasswordResetEmail(auth, correo);
    ocultarLoader();
    await mostrarAlerta("Se ha enviado un enlace de restablecimiento a su correo.", "info");
    window.location.href = "aula.html";
    
  } catch (error) {
    ocultarLoader();
    console.error("Error al procesar solicitud:", error);
    await mostrarAlerta("Ocurrió un error. Intente de nuevo más tarde.", "error");
  }
};

// También exponer protegerPagina para usarse en scripts inline si es necesario
window.protegerPagina = protegerPagina;