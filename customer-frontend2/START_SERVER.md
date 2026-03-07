# Starting the Development Server

## Prerequisites
Make sure you have Node.js 18+ installed. If not, download it from: https://nodejs.org/

## Quick Start

1. **Open a terminal/command prompt** in the `customer-frontend` directory

2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to:
   ```
   http://localhost:3000
   ```

## Alternative: Using PowerShell

If you're using PowerShell, run these commands:

```powershell
cd "C:\Users\Asus\Documents\GitHub\psd_airserve\Integrated_Scheduling_System-master\customer-frontend"
npm install
npm run dev
```

## Troubleshooting

### If npm is not recognized:
- Make sure Node.js is installed
- Restart your terminal after installing Node.js
- Check if Node.js is in your PATH: `node --version`

### If port 3000 is already in use:
- Next.js will automatically use the next available port (3001, 3002, etc.)
- Check the terminal output for the actual URL

### If you see build errors:
- Delete `node_modules` folder and `.next` folder
- Run `npm install` again
- Make sure you're using Node.js 18 or higher

## What to Expect

Once the server starts, you should see:
```
✓ Ready in X seconds
○ Local:        http://localhost:3000
```

Then you can:
- View the landing page at http://localhost:3000
- Book an appointment at http://localhost:3000/book
- Login at http://localhost:3000/login
- View dashboard at http://localhost:3000/dashboard (after login)

## Backend Connection

Make sure your Django backend is running on `http://127.0.0.1:8000` for the frontend to work properly.
