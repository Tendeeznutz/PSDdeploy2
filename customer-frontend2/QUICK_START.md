# Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- Django backend running on `http://127.0.0.1:8000`

## Setup Steps

1. **Navigate to customer-frontend directory:**
   ```bash
   cd customer-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## First Time Setup

The frontend will automatically connect to the Django backend at `http://127.0.0.1:8000/api`.

If your backend is running on a different URL, create a `.env.local` file:
```env
NEXT_PUBLIC_API_URL=http://your-backend-url/api
```

## Test Accounts

Use the test accounts from the main README:
- Email: `alice.tan@email.com` or `bob.lee@email.com`
- Password: `password123`

## Available Pages

- **Landing Page**: `http://localhost:3000/`
- **Book Appointment**: `http://localhost:3000/book`
- **Login**: `http://localhost:3000/login`
- **Register**: `http://localhost:3000/register`
- **Dashboard**: `http://localhost:3000/dashboard` (requires login)

## Troubleshooting

### Port Already in Use
If port 3000 is already in use, Next.js will automatically use the next available port (3001, 3002, etc.)

### API Connection Issues
- Ensure Django backend is running
- Check CORS settings in Django `settings.py`
- Verify the API URL in `.env.local`

### Build Errors
- Delete `node_modules` and `.next` folders
- Run `npm install` again
- Check Node.js version: `node --version` (should be 18+)

## Production Build

To build for production:
```bash
npm run build
npm start
```
