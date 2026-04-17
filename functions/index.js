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
  // Habilitar CORS para todas las respuestas
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

    // Verificar autenticación manualmente
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Verificar que el usuario sea profesor
      const userDoc = await admin.firestore().collection('usuarios').doc(uid).get();
      if (!userDoc.exists || userDoc.data().rol !== 'profesor') {
        return res.status(403).json({ error: 'No autorizado' });
      }

      const { publicId } = req.body;
      if (!publicId) {
        return res.status(400).json({ error: 'Falta publicId' });
      }

      // Eliminar de Cloudinary
      const result = await cloudinary.uploader.destroy(publicId);
      return res.status(200).json({ success: true, result });
      
    } catch (error) {
      console.error('Error en la función:', error);
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  });
});