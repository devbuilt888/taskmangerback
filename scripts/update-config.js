/**
 * Update MongoDB Configuration Script
 * 
 * This script updates the MongoDB connection string password in the config.js file
 * and creates a .env file with the updated connection string.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Paths
const CONFIG_PATH = path.join(__dirname, '..', 'config.js');
const ENV_PATH = path.join(__dirname, '..', '.env');

// Read the configuration file
const readConfig = () => {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      console.error('Error: config.js file not found.');
      return null;
    }
    
    return fs.readFileSync(CONFIG_PATH, 'utf8');
  } catch (error) {
    console.error('Error reading config file:', error.message);
    return null;
  }
};

// Update the MongoDB URI with the provided password
const updateMongoDBUri = (config, password) => {
  try {
    // Find the MongoDB URI in the config file
    const mongoUriRegex = /(MONGODB_URI:\s*['"])(.+?)(['"])/;
    const match = config.match(mongoUriRegex);
    
    if (!match) {
      console.error('Error: Could not find MONGODB_URI in config.js');
      return null;
    }
    
    // Extract the URI
    const uri = match[2];
    
    // Replace the <password> placeholder with the actual password
    const updatedUri = uri.replace('<password>', password);
    
    // Replace the URI in the config
    const updatedConfig = config.replace(mongoUriRegex, `$1${updatedUri}$3`);
    
    return {
      updatedConfig,
      updatedUri
    };
  } catch (error) {
    console.error('Error updating MongoDB URI:', error.message);
    return null;
  }
};

// Save the updated config file
const saveConfig = (updatedConfig) => {
  try {
    fs.writeFileSync(CONFIG_PATH, updatedConfig, 'utf8');
    console.log('Updated config.js file successfully.');
    return true;
  } catch (error) {
    console.error('Error saving config file:', error.message);
    return false;
  }
};

// Create or update the .env file
const updateEnvFile = (uri) => {
  try {
    let envContent = '';
    
    // Read existing .env file if it exists
    if (fs.existsSync(ENV_PATH)) {
      envContent = fs.readFileSync(ENV_PATH, 'utf8');
      
      // Check if MONGODB_URI already exists in the file
      const mongoUriRegex = /MONGODB_URI=.+/;
      if (mongoUriRegex.test(envContent)) {
        // Replace the existing URI
        envContent = envContent.replace(mongoUriRegex, `MONGODB_URI=${uri}`);
      } else {
        // Add the URI to the file
        envContent += `\nMONGODB_URI=${uri}`;
      }
    } else {
      // Create a new .env file
      envContent = `MONGODB_URI=${uri}\nPORT=5000`;
    }
    
    // Save the .env file
    fs.writeFileSync(ENV_PATH, envContent, 'utf8');
    console.log('Updated .env file successfully.');
    return true;
  } catch (error) {
    console.error('Error updating .env file:', error.message);
    return false;
  }
};

// Main function
const main = () => {
  console.log('=== MongoDB Configuration Update ===');
  
  const config = readConfig();
  if (!config) {
    process.exit(1);
  }
  
  rl.question('Enter your MongoDB password: ', (password) => {
    if (!password) {
      console.error('Error: Password cannot be empty.');
      rl.close();
      process.exit(1);
    }
    
    const result = updateMongoDBUri(config, password);
    if (!result) {
      rl.close();
      process.exit(1);
    }
    
    const { updatedConfig, updatedUri } = result;
    
    const configSaved = saveConfig(updatedConfig);
    if (!configSaved) {
      rl.close();
      process.exit(1);
    }
    
    const envUpdated = updateEnvFile(updatedUri);
    if (!envUpdated) {
      rl.close();
      process.exit(1);
    }
    
    console.log('MongoDB configuration updated successfully.');
    console.log('You can now run "node server.js" to start the server.');
    
    rl.close();
  });
};

// Start the script
main(); 