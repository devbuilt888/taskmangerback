const { Clerk } = require('@clerk/clerk-sdk-node');
const clerk = Clerk({ apiKey: process.env.CLERK_API_KEY });

/**
 * Middleware to verify Clerk JWT token
 */
const requireAuth = async (req, res, next) => {
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

module.exports = { requireAuth }; 