/**
 * MongoDB Server Startup Script
 * 
 * This script checks if the required dependencies are installed
 * and starts the server with proper configuration.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Create interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Constants
const ENV_FILE = '.env';
const ENV_EXAMPLE = '.env.example';
const PACKAGE_JSON = 'package.json';

// Check if .env file exists, if not create it from example
const setupEnvFile = () => {
  console.log('Checking environment configuration...');
  
  if (!fs.existsSync(ENV_FILE) && fs.existsSync(ENV_EXAMPLE)) {
    console.log('Creating .env file from example...');
    fs.copyFileSync(ENV_EXAMPLE, ENV_FILE);
    console.log('Created .env file. Please edit it with your actual credentials.');
    return false;
  }
  
  if (!fs.existsSync(ENV_FILE)) {
    console.error('Error: No .env file found and no example to copy from.');
    console.log('Please create a .env file with the following variables:');
    console.log('MONGODB_URI=your_mongodb_connection_string');
    console.log('CLERK_API_KEY=your_clerk_api_key');
    console.log('PORT=5000');
    return false;
  }
  
  return true;
};

// Check if dependencies are installed
const checkDependencies = () => {
  try {
    console.log('Checking package.json...');
    if (!fs.existsSync(PACKAGE_JSON)) {
      console.error('Error: package.json not found.');
      return false;
    }
    
    console.log('Checking node_modules...');
    if (!fs.existsSync('node_modules')) {
      console.log('node_modules not found. Installing dependencies...');
      execSync('npm install', { stdio: 'inherit' });
    }
    
    return true;
  } catch (error) {
    console.error('Error checking dependencies:', error.message);
    return false;
  }
};

// Test MongoDB connection
const testMongoDBConnection = async () => {
  try {
    console.log('Testing MongoDB connection...');
    
    // Import mongoose for connection test
    const mongoose = require('mongoose');
    
    // Load environment variables
    require('dotenv').config();
    
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      console.error('Error: MONGODB_URI not found in .env file.');
      return false;
    }
    
    // Try to connect with a timeout
    const connectPromise = mongoose.connect(mongoURI);
    
    // Set a timeout for connection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Connection timeout')), 10000);
    });
    
    // Race the connection against the timeout
    await Promise.race([connectPromise, timeoutPromise]);
    
    console.log('Successfully connected to MongoDB.');
    await mongoose.disconnect();
    return true;
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('Please check your connection string in the .env file.');
    return false;
  }
};

// Start the server
const startServer = () => {
  try {
    console.log('Starting server...');
    execSync('npm run dev', { stdio: 'inherit' });
  } catch (error) {
    console.error('Error starting server:', error.message);
  }
};

// Main function
const main = async () => {
  console.log('=== Task Manager Server Setup ===');
  
  if (!checkDependencies()) {
    console.log('Please fix dependency issues before continuing.');
    process.exit(1);
  }
  
  if (!setupEnvFile()) {
    rl.question('Press Enter to continue after updating the .env file...', () => {
      main();
    });
    return;
  }
  
  const mongoConnected = await testMongoDBConnection();
  
  if (!mongoConnected) {
    rl.question('Do you want to start the server anyway? (y/n): ', (answer) => {
      if (answer.toLowerCase() === 'y') {
        startServer();
      } else {
        console.log('Server startup aborted. Please fix MongoDB connection issues.');
        process.exit(0);
      }
      rl.close();
    });
  } else {
    startServer();
    rl.close();
  }
};

// Start the script
main(); 