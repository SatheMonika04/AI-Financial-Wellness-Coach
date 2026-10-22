# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS

## Authentication API (local development)

Copy `.env.example` to `.env` and set `DATABASE_URL` to the existing PostgreSQL database plus a random `SESSION_SECRET` of at least 32 characters. Keep `.env` private. The API uses the existing SQLAlchemy engine and `users` table; at startup it creates the table only if missing, then adds nullable `updated_at` and `is_active` columns with `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Existing `username` stores the signup full name for compatibility. Existing emails are trimmed and lowercased and a case insensitive unique index is added. Startup stops with an actionable error if existing rows collide after normalization so they can be reviewed before continuing. No existing table is dropped or reset.

In PowerShell, install the backend dependencies once with `venv\Scripts\python.exe -m pip install -r requirements.txt`, then start the API using `venv\Scripts\python.exe -m uvicorn src.main:app --reload --port 8000`. Start the frontend in another PowerShell window using `npm.cmd run dev`. Set `VITE_API_BASE_URL=http://localhost:8000` in the frontend environment when needed. By default, the API allows exactly `http://localhost:5173` and `http://127.0.0.1:5173`; set `FRONTEND_ORIGINS` to a comma-separated list of exact HTTP(S) origins if the frontend uses different hosts or ports.

The API exposes `POST /api/auth/signup` (`{name,email,password}`; returns safe profile, 201), `POST /api/auth/login` (`{email,password}`; returns safe profile and sets an HttpOnly session cookie), `GET /api/auth/me` (safe profile, requires session), and `POST /api/auth/logout` (clears session cookie). The frontend API client sends cookies with `credentials: "include"`. State-changing auth requests with an explicit Origin must match the configured list. Requests without Origin are allowed only when they do not carry the session cookie; cookie-authenticated requests without Origin are rejected to preserve CSRF protection. For command-line testing of logout, send a configured Origin header along with the session cookie. Set `COOKIE_SECURE=true` and use HTTPS in production. Session cookies are signed, HttpOnly, SameSite=Lax, and expire after seven days.
