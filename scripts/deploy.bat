@echo off
echo === Task Manager Server Deployment ===
echo.

REM Check for Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo Error: Node.js is not installed or not in the PATH.
  echo Please install Node.js from https://nodejs.org/
  exit /b 1
)

REM Check if we're in the right directory
if not exist package.json (
  echo Error: package.json not found. Please run this script from the server directory.
  exit /b 1
)

REM Install dependencies
echo Installing dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
  echo Error: Failed to install dependencies.
  exit /b 1
)

REM Update MongoDB configuration
echo.
echo Please update your MongoDB configuration.
echo Run the following command after this script completes:
echo npm run update-config
echo.

REM Create scripts directory if it doesn't exist
if not exist scripts mkdir scripts

REM Prepare for deployment
echo Preparing for deployment...
if not exist dist mkdir dist

REM Copy necessary files to dist
echo Copying files to dist directory...
copy package.json dist\
copy server.js dist\
xcopy /S /E /Y models dist\models\
xcopy /S /E /Y routes dist\routes\
xcopy /S /E /Y middleware dist\middleware\
copy config.js dist\

REM Create a .env.example file in the dist folder
echo # MongoDB Connection > dist\.env.example
echo MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/taskmanager?retryWrites=true^&w=majority >> dist\.env.example
echo. >> dist\.env.example
echo # Clerk Authentication >> dist\.env.example
echo CLERK_API_KEY=your_clerk_api_key >> dist\.env.example
echo. >> dist\.env.example
echo # Server Configuration >> dist\.env.example
echo PORT=5000 >> dist\.env.example

echo.
echo Deployment preparation complete!
echo.
echo Next steps:
echo 1. Run 'npm run update-config' to set your MongoDB password.
echo 2. Copy the 'dist' directory to your server.
echo 3. On your server, navigate to the deployed directory.
echo 4. Run 'npm install --production' to install dependencies.
echo 5. Run 'node server.js' to start the server.
echo.
echo Don't forget to update your client-side API URL to point to your server!
echo. 