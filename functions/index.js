const functions = require("firebase-functions");
const functionsV1 = require("firebase-functions/v1");
const admin = require("firebase-admin");
const cloudinary = require('cloudinary').v2;

admin.initializeApp();

cloudinary.config({ 
  cloud_name: 'dfsikzvkn',    
  api_key: '295556172535514',          
  api_secret: '3sl3-DvMhJEG1ZN36GJHYexSMAw'    
});

exports.eliminarArchivoCloudinary = functionsV1.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Debes iniciar sesión.');
  }

  const publicId = data.publicId;
  if (!publicId) {
    throw new functions.https.HttpsError('invalid-argument', 'Falta el publicId.');
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return { success: true, result };
  } catch (error) {
    console.error('Error al eliminar:', error);
    throw new functions.https.HttpsError('internal', 'No se pudo eliminar el archivo.');
  }
});