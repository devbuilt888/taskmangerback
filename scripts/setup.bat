@echo off
echo === Task Manager MongoDB Setup ===
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
echo Installing server dependencies...
call npm install
if %ERRORLEVEL% neq 0 (
  echo Error: Failed to install dependencies.
  exit /b 1
)

REM Check if we need to create .env file
if not exist .env (
  if exist .env.example (
    echo Creating .env file from example...
    copy .env.example .env
    echo Created .env file. Please update it with your actual credentials.
  ) else (
    echo Creating basic .env file...
    echo # MongoDB Connection > .env
    echo MONGODB_URI=mongodb+srv://username:password@cluster0.example.mongodb.net/taskmanager?retryWrites=true^&w=majority >> .env
    echo. >> .env
    echo # Clerk Authentication >> .env
    echo CLERK_API_KEY=your_clerk_api_key >> .env
    echo. >> .env
    echo # Server Configuration >> .env
    echo PORT=5000 >> .env
    echo Created basic .env file. Please update it with your actual credentials.
  )
)

echo.
echo Server setup complete!
echo.
echo Next steps:
echo 1. Update your MongoDB connection string in the .env file
echo 2. Run 'npm run update-config' to configure your MongoDB password
echo 3. Run 'npm run dev' to start the development server
echo.
echo If you encounter any issues, please check the README.md file for troubleshooting.
echo. 