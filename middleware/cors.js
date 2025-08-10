/**
 * Custom middleware to add CORS headers to all responses
 * This helps ensure CORS headers are added even in error cases
 */
const customCors = (req, res, next) => {
  // Get the origin from the request
  const origin = req.headers.origin;
  
  // Check if origin is in allowed origins
  const allowedOrigins = [
    process.env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:5173',
    'https://task-manager-frontend.vercel.app',
    'https://bbglobalsolutions.com',
    'https://bbglobalsolutions.org',
    'https://taskmangerback-t2b1.vercel.app'
  ].filter(Boolean); // Remove any undefined values
  
  // If FRONTEND_URL is not set or empty, allow all origins in non-production
  if (
    !origin || 
    allowedOrigins.length === 0 || 
    allowedOrigins.includes(origin) || 
    process.env.NODE_ENV !== 'production'
  ) {
    // Set CORS headers
    res.header('Access-Control-Allow-Origin', origin || '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
  }
  
  next();
};

module.exports = { customCors }; 