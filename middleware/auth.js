const { Clerk } = require('@clerk/clerk-sdk-node');

// Initialize Clerk only if API key is available
let clerk;
try {
  clerk = process.env.CLERK_API_KEY ? 
    Clerk({ apiKey: process.env.CLERK_API_KEY }) : 
    null;
} catch (error) {
  console.error('Failed to initialize Clerk:', error);
  clerk = null;
}

/**
 * Middleware to verify Clerk JWT token
 */
const requireAuth = async (req, res, next) => {
  // If Clerk is not initialized, continue without authentication
  if (!clerk) {
    console.warn('Clerk not initialized. Skipping authentication.');
    req.userId = 'anonymous';
    return next();
  }

  try {
    // Get the session token from the request headers
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res
        .status(401)
        .json({ error: 'Unauthorized: Invalid token format' });
    }
    
    try {
      // Verify the token with Clerk
      const { sub } = await clerk.verifyToken(token);
      
      if (!sub) {
        return res
          .status(401)
          .json({ error: 'Unauthorized: Invalid token' });
      }
      
      // Attach the user ID to the request
      req.userId = sub;
      
      // Continue to the next middleware or route handler
      next();
    } catch (error) {
      console.error('Token verification error:', error);
      return res
        .status(401)
        .json({ error: 'Unauthorized: Invalid token' });
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res
      .status(500)
      .json({ error: 'Internal server error' });
  }
};

/**
 * Optional authentication middleware
 * Continues to the next middleware regardless of authentication status
 */
requireAuth.optional = (req, res, next) => {
  // If Clerk is not initialized, continue without authentication
  if (!clerk) {
    console.warn('Clerk not initialized. Skipping optional authentication.');
    req.userId = 'anonymous';
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.userId = 'anonymous';
    return next();
  }
  
  const token = authHeader.split(' ')[1];
  
  if (!token) {
    req.userId = 'anonymous';
    return next();
  }
  
  try {
    // Try to verify the token, but continue anyway
    clerk.verifyToken(token)
      .then(({ sub }) => {
        if (sub) {
          req.userId = sub;
        } else {
          req.userId = 'anonymous';
        }
        next();
      })
      .catch(err => {
        console.error('Optional auth token error:', err);
        req.userId = 'anonymous';
        next();
      });
  } catch (error) {
    console.error('Optional auth error:', error);
    req.userId = 'anonymous';
    next();
  }
};

module.exports = { requireAuth }; 