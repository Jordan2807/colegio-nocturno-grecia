// js/auth.js
import { auth, db } from './firebase-init.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  updatePassword,
  onAuthStateChanged,
  getAuth,
  getApps,
  getApp,
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ---------- FUNCIÓN DE PROTECCIÓN (compartida) ----------
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
      // Guardar hora de inicio si es admin (para marcar solicitudes nuevas)
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
  if (querySnapshot.empty) throw new Error("Usuario no encontrado");

  const docUsuario = querySnapshot.docs[0];
  const data = docUsuario.data();
  const email = data.correo;

  await signInWithEmailAndPassword(auth, email, password);

  if (data.estado === "pendiente") throw new Error("Cuenta pendiente de aprobación");
  if (data.estado === "inactivo") throw new Error("Cuenta inactiva");
  if (data.estado === "eliminado") throw new Error("Cuenta eliminada");

  return { uid: docUsuario.id, ...data };
}

// ---------- REGISTRO DE PROFESOR ----------
export async function registrarProfesor(datos) {
  const { nombre, cedula, materia, correo, password } = datos;

  // Verificar si ya existe
  const q = query(collection(db, "usuarios"), where("correo", "==", correo));
  const querySnapshot = await getDocs(q);

  if (!querySnapshot.empty) {
    const docExistente = querySnapshot.docs[0];
    const data = docExistente.data();
    if (data.estado === "eliminado") {
      await updateDoc(doc(db, "usuarios", docExistente.id), {
        nombre, cedula, materia, correo, fecha: new Date()
      });
    }
    await sendPasswordResetEmail(auth, data.correo);
    await updateDoc(doc(db, "usuarios", docExistente.id), { estado: "pendiente" });
    return { existente: true };
  }

  // Crear nuevo usuario
  const userCredential = await createUserWithEmailAndPassword(auth, correo, password);
  const user = userCredential.user;

  await setDoc(doc(db, "usuarios", user.uid), {
    nombre, cedula, materia, correo,
    rol: "profesor",
    estado: "pendiente",
    fecha: new Date()
  });

  return { existente: false, uid: user.uid };
}

// ---------- CERRAR SESIÓN ----------
export async function logout() {
  await signOut(auth);
  window.location.href = "aula.html";
}

// ---------- OLVIDÉ CONTRASEÑA ----------
export async function olvidePassword(correo) {
  await sendPasswordResetEmail(auth, correo);
}

// ---------- CREAR ADMINISTRADOR (usa app secundaria) ----------
export async function crearAdministrador(correo, cedula, password) {
  const firebaseConfig = {
    apiKey: "AIzaSyBXHvRtn0tIxKGNYS9drwYhB9OXY8xYkV4",
    authDomain: "aula-virtual-colegio-f3290.firebaseapp.com",
    projectId: "aula-virtual-colegio-f3290",
    storageBucket: "aula-virtual-colegio-f3290.firebasestorage.app",
    messagingSenderId: "686411550211",
    appId: "1:686411550211:web:f9ec664b4a8d1e1067c836"
  };

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
    correo,
    cedula,
    rol: "admin",
    estado: "activo"
  });

  return user.uid;
}

// ---------- EXPONER ALGUNAS FUNCIONES AL WINDOW (para compatibilidad con onclick existente) ----------
window.login = async () => {
  const cedula = document.getElementById("email")?.value;
  const password = document.getElementById("password")?.value;
  if (!cedula || !password) return alert("Ingrese cédula y contraseña");
  try {
    await login(cedula, password);
    window.location.href = "admin.html"; // El login redirige según rol internamente
  } catch (e) {
    alert(e.message);
  }
};

window.registrar = async () => {
  const nombre = document.getElementById("nombre")?.value;
  const cedula = document.getElementById("cedula")?.value;
  const materia = document.getElementById("materia")?.value;
  const correo = document.getElementById("correo")?.value;
  const password = document.getElementById("password")?.value;
  const confirm = document.getElementById("confirmPassword")?.value;

  if (!nombre || !cedula || !materia || !correo || !password || !confirm) {
    return alert("Todos los campos son obligatorios");
  }
  if (password !== confirm) return alert("Las contraseñas no coinciden");
  if (password.length < 6) return alert("Contraseña muy débil");

  try {
    await registrarProfesor({ nombre, cedula, materia, correo, password });
    alert("Solicitud enviada al administrador");
    window.location.href = "aula.html";
  } catch (e) {
    alert("Error: " + e.message);
  }
};

window.logout = logout;

window.olvidePassword = async () => {
  const correo = document.getElementById("correo")?.value;
  if (!correo) return alert("Ingrese su correo");
  try {
    await olvidePassword(correo);
    alert("Correo de restablecimiento enviado");
    window.location.href = "aula.html";
  } catch (e) {
    alert("Correo no encontrado");
  }
};