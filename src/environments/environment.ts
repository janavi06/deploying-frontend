// export const environment = {
//   production: false,
//   apiUrl: 'http://192.168.1.21:5000/api',       // ✅ this should match your backend
//   baseUrl: 'http://192.168.1.21:5000',           // ✅ used for images
//   assetsUrl: 'http://192.168.1.21:5000/uploads'  // ✅ optional if images not loading
// };


  export const environment = {
    production: false,
    apiUrl: 'http://localhost:5088/api',       // For API endpoints
    baseUrl: 'http://localhost:5088',          // For images and other assets
    assetsUrl: 'http://localhost:5088/uploads' // Specific path for uploaded files
  };


// export const environment = {
//   production: false,        // or true in production file
//   apiUrl:   '/api',         // ← no domain, just the path
//   baseUrl:  '',             // ← empty—images/assets will be served under wwwroot
//   assetsUrl:'/uploads'      // ← same relative path
// };
  // export const environment = {
  //   production: false,
  //   apiUrl: 'http://localhost/api',       // For API endpoints
  //   baseUrl: 'http://localhost',          // For images and other assets
  //   assetsUrl: 'http://localhost/uploads' // Specific path for uploaded files
  // };