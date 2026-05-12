# Push Notifications With Firebase Cloud Messaging

This plan explains how to add real system push notifications to Studivista so users receive notifications when the app is foregrounded, backgrounded, or fully closed.

## Current Implementation Status

Last updated: 2026-05-12

Completed in this pass:
- Installed mobile packages:
  - `@react-native-firebase/app`
  - `@react-native-firebase/messaging`
- Installed server package:
  - `firebase-admin`
- Added Android Gradle Google Services plugin dependency.
- Added conditional Android app plugin application so debug builds do not fail before `android/app/google-services.json` exists.
- Added `.gitignore` entries for Firebase app files and server service-account secrets.
- Added mobile FCM token registration in `src/services/notificationService.js`.
- Added token registration on login/session restore in `src/contexts/AuthContext.js`.
- Added token unregister on sign-out in `src/contexts/AuthContext.js`.
- Added Firebase background message handler in `index.js`.
- Added server token table setup in `studivista-server/config/createTables.js`.
- Added `POST /api/notifications/push-token` and `DELETE /api/notifications/push-token`.
- Added `studivista-server/utils/fcm.js` for Firebase Admin push sending.
- Updated `studivista-server/utils/notifications.js` to send FCM after creating a DB notification and Socket.IO event.
- Added `studivista-server/jobs/classReminders.js`.
- Started the class reminder scheduler from `studivista-server/server.js`.
- Added `reminder_sent_at` support for scheduled classes.

Verified in this pass:
- `node --check studivista-server/utils/fcm.js`
- `node --check studivista-server/utils/notifications.js`
- `node --check studivista-server/jobs/classReminders.js`
- `node --check studivista-server/routes/notifications.js`
- `node --check studivista-server/server.js`
- `npm.cmd exec -- eslint src\services\notificationService.js src\contexts\AuthContext.js index.js`

Known not yet completed:
- Firebase project files are still missing:
  - `android/app/google-services.json`
  - iOS `GoogleService-Info.plist`
- Server Firebase Admin service-account JSON is still missing.
- Server `.env` still needs `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Database setup/migration still needs to be run against the real database.
- iOS native setup still needs to be done on macOS/Xcode.
- Full device testing is still pending.
- Existing Jest suite still has a project config issue with `@react-navigation/native` ESM transforms; this is unrelated to FCM work.

Where to start next:
1. Add Firebase project config files:
   - Android: `android/app/google-services.json`
   - iOS: add `GoogleService-Info.plist` to the Xcode target.
2. Add server service-account file, for example:
   - `studivista-server/secrets/firebase-service-account.json`
3. Add server env:
   - `FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json`
   - optional: `CLASS_REMINDER_MINUTES=5`
   - optional: `CLASS_REMINDER_POLL_MS=60000`
4. Run server DB setup:
   - `cd studivista-server`
   - `npm run setup-tables`
5. Start server and verify it logs `[FCM] Firebase Admin initialized.`
6. Rebuild Android app after adding `google-services.json`.
7. On iOS, run `pod install` and configure push capabilities.

Current state:
- The app already has in-app notifications stored in `sv_notifications`.
- The server already emits Socket.IO notification events for live foreground updates.
- This is not enough for closed-app push. Closed/background system notifications require Firebase Cloud Messaging on Android and APNs through Firebase on iOS.

Goal:
- Keep the current DB notification list and Socket.IO foreground updates.
- Add FCM device token registration from the mobile app.
- Store FCM tokens per user on the server.
- Send FCM pushes whenever a notification is created.
- Add a server scheduler that sends class reminder notifications 5 minutes before `scheduled_at`.

## Required Firebase Setup

1. Create or open a Firebase project for Studivista.
2. Add Android app:
   - Android package name: `com.studivista`
   - Download `google-services.json`.
   - Place it at `android/app/google-services.json`.
3. Add iOS app:
   - Bundle ID must match the Xcode project bundle ID.
   - Download `GoogleService-Info.plist`.
   - Add it to the iOS app target in Xcode.
4. Enable Cloud Messaging in Firebase.
5. For iOS push:
   - Enable Push Notifications capability in Xcode.
   - Enable Background Modes -> Remote notifications.
   - Upload APNs auth key or certificate in Firebase console.
6. Create a Firebase Admin service account key for the server.
   - Store it outside git, for example `studivista-server/secrets/firebase-service-account.json`.
   - Add this path to `.gitignore`.

## Mobile App Changes

Install app dependencies:

```bash
npm install @react-native-firebase/app @react-native-firebase/messaging
```

Android native setup:
- Add Google services Gradle plugin in `android/build.gradle`.
- Apply `com.google.gms.google-services` in `android/app/build.gradle`.
- Keep existing Android permission:
  - `android.permission.POST_NOTIFICATIONS`
- Add notification icon/channel if needed for Android display behavior.

iOS native setup:
- Run pods after package install:

```bash
cd ios
pod install
```

- Add `GoogleService-Info.plist` to the Xcode target.
- Enable push capabilities as described above.

Update `src/services/notificationService.js`:
- Import Firebase messaging.
- Request notification permission using Firebase messaging for iOS and Android 13+ permission for Android.
- Register for remote messages.
- Get the FCM token.
- Send the token to the server for the logged-in user.
- Listen for token refresh and update the server.
- Add foreground handler that still shows the existing `Toast`.
- Add background handler in `index.js` using `messaging().setBackgroundMessageHandler`.

Recommended exported functions:
- `requestNotificationPermission()`
- `registerPushTokenForUser(uid)`
- `unregisterPushTokenForUser(uid)`
- `onForegroundMessage(cb)`

Update `src/contexts/AuthContext.js`:
- After login/session restore:
  - Register Socket.IO user room as today.
  - Request push permission.
  - Register and save FCM token on server.
- On sign out:
  - Unregister or deactivate the current FCM token on server.
  - Disconnect socket as today.

Update `index.js`:
- Register Firebase background message handler before `AppRegistry.registerComponent`.
- The handler can be minimal because the OS displays notification payloads automatically.

## Server Database Changes

Prefer a separate device token table instead of a single `fcm_token` on `sv_users`, because a user can log in on multiple phones.

Add table in `studivista-server/config/createTables.js`:

```sql
CREATE TABLE IF NOT EXISTS sv_user_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  platform TEXT DEFAULT '',
  device_id TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON sv_user_push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON sv_user_push_tokens(token);
```

Optional class reminder tracking:

```sql
ALTER TABLE sv_classes
ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;
```

## Server Dependency

Install Firebase Admin SDK in `studivista-server`:

```bash
cd studivista-server
npm install firebase-admin
```

Environment variables:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=./secrets/firebase-service-account.json
CLASS_REMINDER_MINUTES=5
CLASS_REMINDER_POLL_MS=60000
```

Never commit the service account JSON.

## Server API Changes

Add endpoints in `studivista-server/routes/notifications.js` or a new route file:

`POST /api/notifications/push-token`
- Auth required.
- Body:
  - `token`
  - `platform`
  - `deviceId` optional
- Upsert token into `sv_user_push_tokens`.
- Associate with `req.user.uid`.
- Set `enabled=TRUE`.

`DELETE /api/notifications/push-token`
- Auth required.
- Body:
  - `token`
- Mark token disabled or delete it.
- Only allow the logged-in user to disable their own token.

Update app service `src/services/firestoreService.js` or `notificationService.js` to call these endpoints.

## FCM Send Helper

Create `studivista-server/utils/fcm.js`.

Responsibilities:
- Initialize Firebase Admin once.
- Load service account from `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Send notification to one token.
- Send notification to all tokens for a user.
- Disable/delete invalid tokens when Firebase returns permanent errors.

Payload shape:

```js
{
  notification: {
    title,
    body,
  },
  data: {
    notificationId,
    type,
    classId,
    batchId,
  },
  android: {
    priority: 'high',
    notification: {
      channelId: 'studivista_default',
      sound: 'default',
    },
  },
  apns: {
    payload: {
      aps: {
        sound: 'default',
      },
    },
  },
}
```

All `data` values must be strings for FCM.

## Update Notification Creation Flow

Update `studivista-server/utils/notifications.js`:

Current behavior:
- Insert notification row.
- Emit Socket.IO event to `user:${userId}`.

New behavior:
- Insert notification row.
- Emit Socket.IO event to `user:${userId}`.
- Send FCM push to all enabled tokens for `userId`.
- Do not fail the API request if FCM send fails; log it and keep DB notification created.

Important:
- Foreground app may receive both Socket.IO and FCM foreground event.
- To avoid duplicate toasts, use one foreground display path:
  - Option A: Keep Socket.IO toast and ignore FCM foreground display.
  - Option B: Use FCM foreground display and keep Socket.IO only for list sync.
- Recommended: keep Socket.IO for foreground toast/list because it is already implemented, and use FCM mainly for background/closed app.

## 5-Minute Class Reminder Scheduler

Add a scheduler module, for example `studivista-server/jobs/classReminders.js`.

Behavior:
- Runs every `CLASS_REMINDER_POLL_MS`, default 60000 ms.
- Finds scheduled classes where:
  - `status = 'scheduled'`
  - `scheduled_at > NOW()`
  - `scheduled_at <= NOW() + interval '5 minutes'`
  - `reminder_sent_at IS NULL`
- For each class:
  - Notify all students in the class batch.
  - Notify the assigned teacher.
  - Set `reminder_sent_at = NOW()` inside the same transaction or immediately after successful notification creation.

Suggested notification text:
- Student title: `Class starts in 5 minutes`
- Student body: `${title} with ${teacherName || 'your teacher'} is starting soon.`
- Teacher title: `Class starts in 5 minutes`
- Teacher body: `${title} for ${batchName || 'your batch'} is starting soon.`
- Type: `schedule`
- Include `classId` and `batchId`.

Where to start scheduler:
- Import and start it in `studivista-server/server.js` after `app.set('io', io)` or before `server.listen`.
- Pass `{ pool, io }` into the job.

Concurrency note:
- If the server can run multiple instances, use DB locking or an atomic update to avoid duplicate reminders.
- For one server instance, `reminder_sent_at IS NULL` is acceptable.

## Class Start Notification

Current class start flow already creates notifications in:
- `studivista-server/routes/classes.js`
- `POST /api/classes/:id/start`

After `createNotificationsForBatch` sends FCM, students will receive class-start push while app is closed.

Consider notifying teacher only for 5-minute reminders, not when the teacher manually starts their own class.

## Testing Checklist

Server:
- `node --check studivista-server/server.js`
- `node --check studivista-server/utils/notifications.js`
- `node --check studivista-server/utils/fcm.js`
- `node --check studivista-server/jobs/classReminders.js`
- Run table setup.
- Test token registration endpoint with authenticated user.
- Create a notification and confirm:
  - DB row exists.
  - Socket event still works in foreground.
  - FCM push arrives when app is backgrounded/closed.

Android:
- Add `google-services.json`.
- Build debug app.
- Log in and confirm server stores FCM token.
- Test Android 13+ notification permission prompt.
- Foreground: create notification, expect in-app toast/list update.
- Background: create notification, expect system notification.
- Killed app: create notification, expect system notification.
- Schedule class within 5 minutes, expect reminder push.
- Start class, expect class-start push to students.

iOS:
- Add `GoogleService-Info.plist`.
- Configure APNs in Firebase.
- Enable capabilities in Xcode.
- Install pods.
- Build on a physical device.
- Log in and confirm token stored.
- Test foreground/background/killed states.

## Files Likely To Change

Mobile:
- `package.json`
- `package-lock.json`
- `android/build.gradle`
- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `ios/Podfile.lock` after pods
- `index.js`
- `src/services/notificationService.js`
- `src/contexts/AuthContext.js`
- possibly `src/services/firestoreService.js`

Server:
- `studivista-server/package.json`
- `studivista-server/package-lock.json`
- `studivista-server/config/createTables.js`
- `studivista-server/routes/notifications.js`
- `studivista-server/utils/notifications.js`
- `studivista-server/utils/fcm.js`
- `studivista-server/jobs/classReminders.js`
- `studivista-server/server.js`
- `studivista-server/.env.example` if present, otherwise update README.

## Deployment Notes

- Upload Firebase service account JSON to the server manually.
- Set `FIREBASE_SERVICE_ACCOUNT_PATH`.
- Run DB migration/table setup before deploying server code.
- Restart server after adding scheduler.
- Rebuild and reinstall mobile apps after adding native Firebase packages.
- Existing users must open the updated app once so their FCM token can be registered.

## Acceptance Criteria

- A logged-in user has one or more enabled tokens in `sv_user_push_tokens`.
- Creating a notification sends:
  - DB notification row.
  - Socket.IO foreground event.
  - FCM push to all enabled user devices.
- Invalid FCM tokens are disabled or removed.
- Students get a push when teacher starts a class.
- Students and teacher get a push 5 minutes before scheduled class time.
- Notifications work in foreground, background, and fully closed app states.
