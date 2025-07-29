// export const environment = {
//   production: true,
//   apiUrl: 'https://digieat-backend.onrender.com/api',          // API endpoint
//   baseUrl: 'https://digieat-backend.onrender.com',             // For images/assets
//   assetsUrl: 'https://digieat-backend.onrender.com/uploads'    // For uploaded files (if needed)
// };


// src/environments/environment.prod.ts

export const environment = {
  production: true,

  // ✅ Base API endpoint for all HTTP requests
  apiUrl: 'https://hosting-backend-fxwy.onrender.com/api',

  // ✅ Base domain (useful for WebSocket, ping, or general backend link)
  baseUrl: 'https://hosting-backend-fxwy.onrender.com',

  // ✅ Public URL where image/file uploads are accessible
  assetsUrl: 'https://hosting-backend-fxwy.onrender.com/uploads'
};
