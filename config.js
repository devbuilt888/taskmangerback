// MongoDB connection configuration
const getMongoURI = () => {
  // First check for environment variable
  if (process.env.MONGODB_URI) {
    console.log('Using MONGODB_URI from environment variables');
    
    // Validate the URI format
    const uri = process.env.MONGODB_URI;
    if (validateMongoURI(uri)) {
      return uri;
    } else {
      console.error('WARNING: Environment MONGODB_URI has invalid format');
    }
  }
  
  // Fall back to local MongoDB
  console.log('Falling back to default local MongoDB URI');
  const defaultURI = "mongodb://localhost:27017/taskmanager";
  return defaultURI;
};

/**
 * Validates MongoDB URI format
 * @param {string} uri - MongoDB connection string to validate
 * @returns {boolean} - Whether the URI is valid
 */
function validateMongoURI(uri) {
  if (!uri) return false;
  
  // Basic format check for MongoDB URI
  const mongoPattern = /^mongodb(\+srv)?:\/\//;
  if (!mongoPattern.test(uri)) {
    console.error('MongoDB URI must start with mongodb:// or mongodb+srv://');
    return false;
  }
  
  // Check for username and password
  try {
    // Extract components without exposing credentials in logs
    const withoutProtocol = uri.replace(/^mongodb(\+srv)?:\/\//, '');
    const hasAuth = withoutProtocol.includes('@');
    
    if (!hasAuth) {
      console.warn('MongoDB URI does not contain authentication credentials');
      // This might be valid for local development, so we don't fail
    } else {
      const authPart = withoutProtocol.split('@')[0];
      const hasPassword = authPart.includes(':');
      
      if (!hasPassword) {
        console.warn('MongoDB URI contains username but no password');
      }
    }
    
    return true;
  } catch (err) {
    console.error('Error validating MongoDB URI:', err.message);
    return false;
  }
}

module.exports = {
  // MongoDB URI with fallback
  mongoURI: getMongoURI()
}; 