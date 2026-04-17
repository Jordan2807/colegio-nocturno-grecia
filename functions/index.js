const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cloudinary = require('cloudinary').v2;
const cors = require('cors')({ origin: true });

admin.initializeApp();

cloudinary.config({ 
  cloud_name: 'dfsikzvkn',
  api_key: '295556172535514',
  api_secret: '3sl3-DvMhJEG1ZN36GJHYexSMAw'
});

exports.eliminarArchivoCloudinary = functions.https.onRequest((req, res) => {
  cors(req, res, async () => {
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      return res.status(204).send('');
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
      if (!userDoc.exists) {
        return res.status(403).json({ error: 'Usuario no encontrado' });
      }

      const userData = userDoc.data();
      if (userData.rol !== 'profesor' && userData.rol !== 'admin') {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { publicId } = req.body;
      if (!publicId) {
        return res.status(400).json({ error: 'Falta publicId' });
      }

      // Determinar el tipo de recurso según la extensión del publicId
      const extension = publicId.split('.').pop().toLowerCase();
      const resourceType = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'zip', 'rar']
        .includes(extension) ? 'raw' : 'image';

      // Usar el método correspondiente
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType
      });

      return res.status(200).json({ success: true, result });
      
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Error interno' });
    }
  });
});

exports.eliminarUsuarioAuth = functions.https.onCall(async (data, context) => {
  // Verificar autenticación
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  // Verificar que el llamador sea administrador
  const callerUid = context.auth.uid;
  const callerDoc = await admin.firestore().collection('usuarios').doc(callerUid).get();
  if (!callerDoc.exists || callerDoc.data().rol !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Solo administradores pueden eliminar usuarios.');
  }

  const { uid } = data;
  if (!uid) {
    throw new functions.https.HttpsError('invalid-argument', 'Se requiere el UID del usuario.');
  }

  try {
    await admin.auth().deleteUser(uid);
    return { success: true };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { success: true, message: 'El usuario ya no existía en Auth' };
    }
    console.error('Error al eliminar usuario de Auth:', error);
    throw new functions.https.HttpsError('internal', 'No se pudo eliminar el usuario de autenticación.');
  }
});