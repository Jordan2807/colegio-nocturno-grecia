const functions = require("firebase-functions");
const admin = require("firebase-admin");
const cloudinary = require('cloudinary').v2;
const cors = require('cors')({ origin: true }); // Habilita CORS para cualquier origen

admin.initializeApp();

cloudinary.config({ 
  cloud_name: 'dfsikzvkn',    
  api_key: '295556172535514',          
  api_secret: '3sl3-DvMhJEG1ZN36GJHYexSMAw' 
});

// Usamos onRequest en lugar de onCall para tener control total sobre CORS
exports.eliminarArchivoCloudinary = functions.https.onRequest((req, res) => {
  // Habilitar CORS para todas las respuestas
  cors(req, res, async () => {
    // Solo permitir método POST
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // Verificar autenticación manualmente (el token viene en el header Authorization)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const idToken = authHeader.split('Bearer ')[1];
    
    try {
      // Verificar el token de Firebase
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // (Opcional) Verificar que sea profesor
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
      return res.status(500).json({ error: 'Error interno' });
    }
  });
});