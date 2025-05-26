// MongoDB connection configuration
module.exports = {
  // Default connection URI (will be overridden by environment variables)
  mongoURI: process.env.MONGODB_URI || "mongodb://localhost:27017/taskmanager"
}; 