# VibeChat

VibeChat is a private messaging web application. People register with a unique username, find each other through search, and chat one-to-one with text, photos, and videos in real time. There is no public feed, no follower graph, and no group chat. It is a messenger, built on original branding and UI.

## Features

- Email + username registration with bcrypt password hashing and JWT sessions
- Unique usernames with live duplicate checks on the server
- User search by exact or partial username
- 1-to-1 private conversations, created on demand
- Real-time text chat over Socket.IO with delivered and seen states
- Photo messages (JPG, PNG, WEBP) and video messages (MP4, MOV, WEBM) via Cloudinary
- Upload progress, media preview with caption, and cancel before send
- Full-screen media viewer for photos and videos
- Online status and "last seen" presence
- Typing indicators
- Unread counts per conversation and a badge in the browser tab title
- In-app toast notifications for new messages
- Delete for me on your own messages
- In-conversation message search across loaded history
- Light and dark themes persisted in localStorage
- Responsive layout: bottom navigation on mobile, sidebar on desktop
- Terms of Service page, favicon, 404 page
- Security: Helmet, CORS allowlist, rate limiting, authorization checks on every conversation and message, parameterized SQL, file type and size validation on the server

## Technology stack

| Layer     | Tools                                                    |
|-----------|----------------------------------------------------------|
| Frontend  | React 18, Vite, Tailwind CSS, React Router, Lucide icons |
| Backend   | Node.js, Express, Socket.IO, JWT, bcryptjs               |
| Database  | PostgreSQL on Supabase (pg pool, parameterized queries)  |
| Media     | Cloudinary                                               |
| Deployment| Vercel (client), Render or Railway (API), Supabase Postgres |

## Project structure

```
vibechat/
├── client/                     # React + Vite frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/           # MessageBubble, Composer, MediaViewer
│   │   │   ├── common/         # BrandMark logo
│   │   │   └── ui/             # Avatar, Toast, Skeleton, EmptyState, Spinner
│   │   ├── context/            # Auth, Theme, Conversations providers
│   │   ├── hooks/              # useAuth, useDebounce, useMediaQuery, ...
│   │   ├── layouts/            # AppLayout (sidebar + bottom nav)
│   │   ├── pages/
│   │   │   ├── auth/           # Login, Register, ForgotPassword, Terms
│   │   │   └── app/            # Messages, Chat, Search, Profile, UserProfile, Settings
│   │   ├── services/           # axios api client, socket client
│   │   ├── styles/
│   │   ├── utils/              # formatting, media validation
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── .env.example
│   ├── index.html              # includes the favicon
│   ├── tailwind.config.js
│   └── vite.config.js          # dev proxy for /api and /socket.io
│
├── server/                     # Express + Socket.IO API
│   ├── scripts/seed.js         # demo users and sample conversation
│   ├── src/
│   │   ├── config/             # env, db pool, cloudinary, socket instance
│   │   ├── controllers/        # auth, users, conversations, messages, uploads
│   │   ├── middleware/         # auth, rate limiters, upload, validation, errors
│   │   ├── routes/
│   │   ├── services/           # conversation logic, Cloudinary service
│   │   ├── socket/             # handshake auth, presence, typing, receipts
│   │   └── utils/              # tokens, serializers
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
├── database/schema.sql         # Postgres schema, constraints, indexes
├── .env.example                # copy to .env for the server when run from root
├── render.yaml                 # Render blueprint for the API
├── vercel.json                 # Vercel config for the client
└── package.json                # root convenience scripts
```

## 1. Prerequisites

- Node.js 18 or newer
- A Supabase project (free tier works): https://supabase.com
- A Cloudinary account (free tier is enough): https://console.cloudinary.com

## 2. Supabase (Postgres) setup

1. Create a project at https://supabase.com and choose a database password.
2. Copy `server/.env.example` to `server/.env` and fill in:
   - `DATABASE_URL`: Project Settings > Database > Connection string > URI, using the **transaction pooler** host and port 6543 (IPv4-compatible, works everywhere). Replace `[YOUR-PASSWORD]`.
   - `DIRECT_URL`: same page, **session pooler**, port 5432. Used for schema setup.
3. Create the tables:

```bash
npm --prefix server run setup-db
```

The script creates five tables:

- `users`: account data with unique `username` and `email`, presence fields
- `conversations`: one row per conversation
- `conversation_members`: exactly two rows per conversation in V1, with `last_read_at`
- `messages`: text and media messages with `delivered_at` / `seen_at` receipts
- `message_deletions`: per-user tombstones for "delete for me"

Indexes exist on `users.username`, `users.email`, `messages(conversation_id, created_at)`, and `conversation_members.user_id`.

## 3. Cloudinary setup

1. Create a free account at https://console.cloudinary.com.
2. Open Dashboard and copy the Cloud name, API key, and API secret.
3. Put them in the server environment (see below). Media is uploaded through the API server, so keys never reach the browser.

Uploads are organized into two Cloudinary folders: `vibechat/avatars` and `vibechat/messages`. Only URLs, public IDs, and metadata are stored in Postgres.

## 4. Environment variables

Copy both example files and fill them in:

```bash
cp .env.example server/.env   # or edit server/.env directly
cp client/.env.example client/.env
```

| Variable | Where | Purpose |
|---|---|---|
| `PORT` | server | HTTP port (default 5000) |
| `NODE_ENV` | server | `development` or `production` |
| `DATABASE_URL` | server | Supabase transaction pooler URI, port 6543, `?pgbouncer=true` |
| `DIRECT_URL` | server | Supabase session pooler URI, port 5432, used by `npm run setup-db` |
| `JWT_SECRET` | server | Long random string. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `JWT_EXPIRES_IN` | server | Token lifetime, e.g. `7d` |
| `CLIENT_URL` | server | Comma-separated list of allowed browser origins for CORS and Socket.IO |
| `CLOUDINARY_CLOUD_NAME` | server | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | server | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | server | Cloudinary API secret |
| `MAX_IMAGE_MB` | server | Image size cap in MB (default 10) |
| `MAX_VIDEO_MB` | server | Video size cap in MB (default 50) |
| `VITE_API_URL` | client | API origin. Leave empty in dev to use the Vite proxy |
| `VITE_SOCKET_URL` | client | Socket.IO origin. Same rule as above |

Never commit `.env` files. In production set these in the Vercel, Render, or Railway dashboards.

## 5. Local development

Terminal 1, the API:

```bash
npm --prefix server install
npm --prefix server run dev
```

Terminal 2, the client:

```bash
npm --prefix client install
npm --prefix client run dev
```

Open http://localhost:5173. The Vite dev server proxies `/api` and `/socket.io` to the API on port 5000, so no CORS setup is needed locally.

Optional demo data:

```bash
npm run seed
```

## 6. Test credentials, development only

Created by the seed script. Do not use these in production:

| Username     | Password      |
|--------------|---------------|
| `ayesha_ds`  | `Password123` |
| `rahul123`   | `Password123` |
| `subhan`     | `Password123` |

`ayesha_ds` and `rahul123` share a conversation with three sample messages.

## 7. Production build

```bash
npm --prefix client run build     # outputs client/dist
npm --prefix server start         # runs the API with NODE_ENV=production
```

## 8. Deploying the frontend (Vercel)

1. Push the repository to GitHub.
2. In Vercel, import the project. The included `vercel.json` sets the root directory to `client` and rewrites all routes to `index.html` for React Router.
3. Set environment variables:
   - `VITE_API_URL` = your API origin, e.g. `https://vibechat-api.onrender.com`
   - `VITE_SOCKET_URL` = the same API origin
4. Deploy.

## 9. Deploying the backend (Render or Railway)

Render: the included `render.yaml` blueprint creates a web service from the `server` directory with a health check at `/api/health`. Set `DATABASE_URL`, `CLIENT_URL` (your Vercel origin), and the three Cloudinary variables; `JWT_SECRET` is generated for you.

Railway: create a project, deploy from the `server` directory, and set the same environment variables, pointing `DATABASE_URL` at Supabase. Railway injects `PORT`, which the server reads automatically.

On Render or Railway, use the transaction pooler string for `DATABASE_URL`. After deploying, confirm:

- `GET https://your-api/api/health` returns `{"success":true}`
- `CLIENT_URL` exactly matches your Vercel origin, including `https://`
- Cloudinary credentials are set, or the upload endpoints will return a 503 with a clear message

## 10. API overview

All responses use the envelope `{"success": true, "message": "...", "data": {...}}` or `{"success": false, "message": "...", "errors": {...}}`. Protected routes require `Authorization: Bearer <token>`.

### Auth

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/register` | Create account. Body: `full_name`, `username`, `email`, `password`, `confirm_password`. Returns `{ token, user }` |
| POST | `/api/auth/login` | Body: `identifier` (email or username), `password`. Returns `{ token, user }` |
| GET | `/api/auth/me` | Current user |
| POST | `/api/auth/logout` | Stateless sign-off |

### Users

| Method | Path | Description |
|---|---|---|
| GET | `/api/users/search?q=sub` | Partial or exact username search, excludes self |
| GET | `/api/users/:username` | Public profile plus `conversationId` if one already exists |
| PUT | `/api/users/profile` | Update `full_name`, `username`, `bio` with uniqueness checks |
| PUT | `/api/users/avatar` | Multipart `image`. Uploads and replaces the profile picture |

### Conversations

| Method | Path | Description |
|---|---|---|
| GET | `/api/conversations` | List with other member, last message, unread count |
| POST | `/api/conversations` | Body: `username`. Finds or creates the 1-to-1 conversation |
| GET | `/api/conversations/:id` | One conversation with the other member. Members only |
| DELETE | `/api/conversations/:id` | Hides the conversation and its messages for this user only |

### Messages

| Method | Path | Description |
|---|---|---|
| GET | `/api/messages/:conversationId` | Latest 30 (or page before `?before=`, `?limit=`, `?q=`). Members only |
| POST | `/api/messages` | Body: `conversation_id`, `message_type` (`text`, `image`, `video`), optional `message_text`, optional `media { media_url, media_public_id, media_type, file_name, file_size }` |
| PUT | `/api/messages/:id/seen` | Receiver marks seen |
| DELETE | `/api/messages/:id` | Delete for me. Sender only |

### Uploads

| Method | Path | Description |
|---|---|---|
| POST | `/api/upload/image` | Multipart `image`, max 10 MB, JPG/PNG/WEBP |
| POST | `/api/upload/video` | Multipart `video`, max 50 MB, MP4/MOV/WEBM |

### Health

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Uptime probe for Render/Railway |

## Socket.IO events

Handshake sends `auth: { token }`; connections with a missing or expired JWT are rejected.

| Event | Direction | Payload |
|---|---|---|
| `user:online` | server to client | Own id after connect |
| `user:presence` | server to client | `{ user_id, is_online, last_seen }` |
| `conversation:join` | client to server | `{ conversation_id }`; membership verified |
| `typing:start` / `typing:stop` | both | `{ conversation_id, user_id }` |
| `message:new` | server to client | `{ conversation_id, message }` |
| `message:delivered` | both | `{ conversation_id, message_id, delivered_at }` |
| `message:seen` | both | `{ conversation_id, message_id, seen_at }` |
| `message:deleted` | server to client | `{ conversation_id, message_id, deleted_by }` |

## Security notes

- Passwords are hashed with bcrypt (cost 10) and never leave the server
- JWT is verified on every HTTP route that needs it and during the Socket.IO handshake
- Every conversation and message query first verifies membership, so changing IDs in the URL cannot expose another user's data
- All SQL uses parameterized placeholders (`$1, $2`); no string-built queries
- Rate limits: 20 requests per 15 minutes on auth endpoints, 300 per minute on the API
- Helmet sets secure headers; CORS only allows origins in `CLIENT_URL`
- Uploads are validated by MIME type and size on the server, not just the browser
- Error responses never include stack traces or database details

## Mobile app (React Native, Expo)

A React Native client lives in `mobile/`. It talks to the same API and uses the same JWT auth and Socket.IO events as the web client.

### Run it

```bash
cd mobile
npm install
npm start
```

Then press `a` for Android emulator, `i` for iOS simulator, or scan the QR with the Expo Go app on your phone.

### Point it at your backend

`mobile/app.json` has `extra.apiUrl`. Defaults per platform:

- Android emulator: `http://10.0.2.2:5000` (your machine's localhost)
- iOS simulator: `http://localhost:5000`
- Real device: set `extra.apiUrl` in `app.json` to your machine's LAN IP (`http://192.168.x.x:5000`) or your deployed backend (`https://vibechat-uukh.onrender.com`)

### Included screens

- Login and register (full validation, same rules as web)
- Chats list with unread badges, presence dots, pull to refresh
- 1-to-1 chat with real-time messages, typing indicator, seen/delivered ticks
- User search with a direct Message action
- Profile with account info and logout

Note: photo/video sending is not in the first mobile version; text messaging, presence, and receipts are fully wired.
