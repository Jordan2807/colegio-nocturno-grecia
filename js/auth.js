//js/utils.js
import { mostrarAlerta, mostrarConfirmacion } from './utils.js';

// js/auth.js
import { auth, db, firebaseConfig } from './firebase-init.js';

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
  if (data.estado === "eliminado") {
    throw new Error("Tu cuenta fue eliminada, vuelve a registrarte");
  }

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
// auth.js - función crearAdministrador actualizada
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

  try {
    const cedulaQuery = query(collection(db, "usuarios"), where("cedula", "==", cedula));
    const cedulaSnapshot = await getDocs(cedulaQuery);

    if (!cedulaSnapshot.empty) {
      const docExistente = cedulaSnapshot.docs[0];
      const data = docExistente.data();
      
      if (data.estado === "eliminado") {
        // Verificar que el correo también coincida con el registrado
        if (data.correo !== correo) {
          await mostrarAlerta("La cédula pertenece a una cuenta eliminada pero el correo no coincide con el registrado originalmente. Verifica los datos.", "error");
          return;
        }
        // Reactivar cuenta eliminada
        await updateDoc(doc(db, "usuarios", docExistente.id), {
          nombre,
          materia,
          estado: "pendiente",
          fecha: new Date()
        });
        await sendPasswordResetEmail(auth, data.correo);
        await mostrarAlerta("Tu cuenta estaba eliminada. Se ha enviado una nueva solicitud al administrador y un correo para restablecer tu contraseña.", "info");
        window.location.href = "aula.html";
        return;
      } else {
        await mostrarAlerta("La cédula ingresada ya está registrada en el sistema.", "error");
        return;
      }
    }
    
        // 2. Verificar si el correo ya existe
    const correoQuery = query(collection(db, "usuarios"), where("correo", "==", correo));
    const correoSnapshot = await getDocs(correoQuery);

    if (!correoSnapshot.empty) {
      const docExistente = correoSnapshot.docs[0];
      const data = docExistente.data();
      
      if (data.estado === "eliminado") {
        // Verificar que la cédula también coincida con la registrada
        if (data.cedula !== cedula) {
          await mostrarAlerta("El correo pertenece a una cuenta eliminada pero la cédula no coincide con la registrada originalmente. Verifica los datos.", "error");
          return;
        }
        // Reactivar cuenta eliminada (ya se actualizó en el paso anterior o se actualiza aquí)
        await updateDoc(doc(db, "usuarios", docExistente.id), {
          nombre,
          materia,
          estado: "pendiente",
          fecha: new Date()
        });
        await sendPasswordResetEmail(auth, data.correo);
        aawait mostrarAlerta("El correo ya estaba registrado previamente. Se ha enviado una nueva solicitud al administrador y un correo para restablecer tu contraseña.", "info");
        window.location.href = "aula.html";
        return;
      } else {
        await mostrarAlerta("El correo electrónico ya está en uso por otra cuenta.", "error");
        return;
      }
    }
    
    // 3. Si no hay conflictos, crear nuevo usuario
    await registrarProfesor({ nombre, cedula, materia, correo, password });
    await mostrarAlerta("Solicitud enviada al administrador", "success");
    window.location.href = "aula.html";
    
  } catch (e) {
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

  try {
    // 1. Verificar si el correo existe en Firestore
    const q = query(collection(db, "usuarios"), where("correo", "==", correo));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      await mostrarAlerta("El correo ingresado no está registrado en el sistema.", "error");
      return;
    }

    // 2. Verificar que el usuario no esté eliminado o inactivo
    const docUsuario = querySnapshot.docs[0];
    const data = docUsuario.data();
    
    if (data.estado === "eliminado") {
      await mostrarAlerta("Esta cuenta ha sido eliminada. Contacte al administrador.", "info");
      return;
    }
    
    if (data.estado === "inactivo") {
      await mostrarAlerta("Esta cuenta está inactiva. Contacte al administrador.", "info");
      return;
    }

    // 3. Enviar correo de restablecimiento
    await sendPasswordResetEmail(auth, correo);
    await mostrarAlerta("Se ha enviado un enlace de restablecimiento a su correo.", "info");
    window.location.href = "aula.html";
    
  } catch (error) {
    console.error("Error al procesar solicitud:", error);
    await mostrarAlerta("Ocurrió un error. Intente de nuevo más tarde.", "error");
  }
};

// También exponer protegerPagina para usarse en scripts inline si es necesario
window.protegerPagina = protegerPagina;