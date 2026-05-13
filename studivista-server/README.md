# Studivista Server

Studivista Server is the backend for the Studivista mobile app. It provides REST APIs for auth, users, batches, classes, notes, notifications, and attendance, plus Socket.IO signaling for live classes, chat, join requests, host controls, and real-time data updates.

## Tech Stack

- Node.js
- Express
- Socket.IO
- PostgreSQL
- JSON Web Tokens
- Multer file uploads
- bcrypt password hashing

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL
- A `.env` file with database and JWT settings

Important: the current code imports `pg` from `config/db.js`. Make sure `pg` is installed and listed in `package.json` before deploying or running from a clean install.

## Setup

Install dependencies:

```sh
npm install
```

Create a `.env` file:

```env
PORT=3000
JWT_SECRET=change_this_secret

DB_HOST=localhost
DB_PORT=5432
DB_NAME=studivista
DB_USER=studivistauser
DB_PASSWORD=change_this_password

ADMIN_EMAIL=admin@studivista.com
ADMIN_PASSWORD=change_this_password
```

Create database tables:

```sh
npm run setup-tables
```

Start the server:

```sh
npm start
```

For development with nodemon:

```sh
npm run dev
```

## Deployment Notes

The server listens on `0.0.0.0` and uses `PORT` from the environment, defaulting to `3000`.

For a VM deployment, a typical PM2 setup is:

```sh
npm install -g pm2
pm2 start server.js --name studivista
pm2 save
pm2 startup
```

Open the configured port in the VM firewall/security list so the mobile app can reach HTTP and WebSocket traffic.

## Database

`config/createTables.js` creates these PostgreSQL tables:

- `sv_users`
- `sv_batches`
- `sv_classes`
- `sv_notes`
- `sv_notifications`
- `sv_attendance`

Connection settings are read by `config/db.js` from:

- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

## File Uploads

Uploaded chat files are stored in:

```txt
studivista-server/uploads
```

Relevant routes:

- `POST /chat-upload`
- `POST /chat-uploade`
- `GET /download/:filename`
- `GET /uploads/:filename`

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| POST | `/api/auth/login` | Login |
| POST | `/api/auth/ensure-admin` | Seed or return admin profile |
| POST | `/api/auth/create-user` | Admin/teacher creates user |
| GET | `/api/auth/me` | Get current profile |
| GET | `/api/users` | List users, optionally by role |
| GET | `/api/users/:uid` | Get user |
| PATCH | `/api/users/:uid` | Update user |
| GET | `/api/batches` | List batches |
| POST | `/api/batches/by-ids` | Get batches by IDs |
| POST | `/api/batches` | Create batch |
| PATCH | `/api/batches/:id` | Update batch |
| DELETE | `/api/batches/:id` | Delete batch |
| POST | `/api/batches/:id/add-students` | Add students to batch |
| POST | `/api/batches/:id/remove-student` | Remove student from batch |
| GET | `/api/classes` | List classes |
| POST | `/api/classes/by-batches` | Get classes by batch IDs |
| POST | `/api/classes` | Create class |
| PATCH | `/api/classes/:id` | Update class |
| POST | `/api/classes/:id/start` | Mark class live |
| POST | `/api/classes/:id/end` | Mark class completed |
| POST | `/api/classes/:id/join` | Add student to joined list |
| GET | `/api/notes` | List notes |
| POST | `/api/notes/by-batches` | Get notes by batch IDs |
| POST | `/api/notes` | Create note |
| DELETE | `/api/notes/:id` | Delete note |
| GET | `/api/notifications` | List notifications |
| POST | `/api/notifications` | Create notification |
| POST | `/api/notifications/fan-out` | Send notification to batch students |
| PATCH | `/api/notifications/:id/read` | Mark notification read |
| GET | `/api/attendance/:classId` | Get class attendance |
| POST | `/api/attendance/mark` | Mark student present |
| GET | `/health` | Health check |

Most `/api/*` routes require `Authorization: Bearer <token>`.

## Socket.IO Events

Client to server:

| Event | Payload | Description |
| --- | --- | --- |
| `register-user` | `{ userId }` | Register socket for user-targeted notifications |
| `subscribe` | `{ channel }` | Join a real-time data channel |
| `unsubscribe` | `{ channel }` | Leave a real-time data channel |
| `request-join` | `{ roomId, name }` | Request permission to join a live room |
| `approve-join` | `{ to, roomId }` | Approve a waiting student |
| `reject-join` | `{ to, roomId }` | Reject a waiting student |
| `join-room` | `{ roomId, role, name }` | Join a live class room |
| `chat-message` | `{ roomId, message, name }` | Send basic text chat |
| `live-chat-message` | `{ roomId, text, attachment, replyTo }` | Send rich live chat |
| `chat-media` | `{ roomId, name, fileName, fileType, fileData }` | Send media payload |
| `chat-voice` | `{ roomId, name, voiceData, duration }` | Send voice payload |
| `offer` | `{ to, offer }` | WebRTC offer |
| `answer` | `{ to, answer }` | WebRTC answer |
| `ice-candidate` | `{ to, candidate }` | WebRTC ICE candidate |
| `screen-share-started` | `{ roomId, sharerName }` | Start screen-share state |
| `screen-share-stopped` | `{ roomId }` | Stop screen-share state |
| `screen-share-request` | `{ to }` | Request screen-share connection |
| `screen-offer` | `{ to, offer }` | Screen-share WebRTC offer |
| `screen-answer` | `{ to, answer }` | Screen-share WebRTC answer |
| `screen-ice-candidate` | `{ to, candidate }` | Screen-share ICE candidate |
| `mute-student` | `{ studentId }` | Force mute a student |
| `unmute-student` | `{ studentId }` | Force unmute a student |
| `camera-off-student` | `{ studentId }` | Force camera off |
| `remove-student` | `{ studentId, roomId }` | Remove student from room |
| `media-state` | `{ micOn, cameraOn }` | Broadcast participant media state |

Server to client:

| Event | Description |
| --- | --- |
| `room-users` | Existing socket IDs in the room |
| `existing-users` | Existing room participants with role/name details |
| `user-joined` | Participant joined |
| `user-left` | Participant left |
| `pending-join` | Waiting student notification for host |
| `join-request` | Waiting student notification for host |
| `join-approved` | Student approved to join |
| `join-rejected` | Student rejected |
| `chat-message` | Incoming basic chat |
| `live-chat-message` | Incoming rich chat |
| `chat-media` | Incoming media chat |
| `chat-voice` | Incoming voice chat |
| `offer` | WebRTC offer |
| `answer` | WebRTC answer |
| `ice-candidate` | WebRTC ICE candidate |
| `screen-share-active` | Existing screen share is active |
| `screen-share-started` | Screen share started |
| `screen-share-stopped` | Screen share stopped |
| `screen-share-request` | Screen share requested |
| `screen-offer` | Screen-share offer |
| `screen-answer` | Screen-share answer |
| `screen-ice-candidate` | Screen-share ICE candidate |
| `force-mute` | Host forced mute |
| `force-unmute` | Host forced unmute |
| `force-camera-off` | Host forced camera off |
| `force-remove` | Host removed participant |
| `media-state` | Participant media state update |
| `data-update` | Real-time API data update |

## Known Local Check Results

- Server JavaScript syntax checks passed.
- `npm start` will fail on a clean install unless `pg` is installed.
- ESLint from the app root currently reports warnings in server files and app hook dependency errors.
- `routes/auth.js` contains a suspicious `pool.query('/api/auth/login')` call inside `/api/auth/ensure-admin`; review before relying on that route in production.
