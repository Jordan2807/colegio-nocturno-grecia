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

// Manejador de eliminación de archivos
const eliminarHandler = async (req, res) => {
  // Habilitar CORS
  cors(req, res, async () => {
    // Responder a la solicitud preflight OPTIONS
    if (req.method === 'OPTIONS') {
      res.set('Access-Control-Allow-Methods', 'POST');
      res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.status(204).send('');
      return;
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Método no permitido' });
    }

    // Verificar autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Verificar que sea profesor (opcional)
      const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
      if (!userDoc.exists || userDoc.data().rol !== 'profesor') {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { publicId } = req.body;
      if (!publicId) {
        return res.status(400).json({ error: 'Falta publicId' });
      }

      const result = await cloudinary.uploader.destroy(publicId);
      return res.status(200).json({ success: true, result });
    } catch (error) {
      console.error('Error:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
};

// Exportar la función con manejo de CORS explícito
exports.eliminarArchivoCloudinary = functions.https.onRequest((req, res) => {
  // Forzar encabezados CORS en todas las respuestas
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }
  return eliminarHandler(req, res);
});