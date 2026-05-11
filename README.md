# Studivista

Studivista is a React Native learning app for admins, teachers, and students. The app includes role-based dashboards, batch and student management, scheduled classes, live classes with WebRTC, real-time chat, notes, attendance, and notifications.

The mobile app talks to the Node.js backend in `studivista-server` over HTTP and Socket.IO. The active server URL is configured in:

- `src/config.js`
- `src/services/api.js`

## Tech Stack

- React Native 0.83
- React 19
- React Navigation
- Socket.IO client
- React Native WebRTC
- AsyncStorage
- Custom server API with local compatibility shims for older data imports.

## Requirements

- Node.js 20 or newer
- npm
- Android Studio and Android SDK for Android builds
- Xcode and CocoaPods for iOS builds
- A running Studivista server from `studivista-server`

## Setup

Install app dependencies from the repository root:

```sh
npm install
```

Start Metro:

```sh
npm start
```

Run Android:

```sh
npm run android
```

Run iOS:

```sh
bundle install
bundle exec pod install --project-directory=ios
npm run ios
```

## Server Configuration

The app currently points to:

```js
http://144.24.114.0:3000
```

Update both files if the backend host changes:

```txt
src/config.js
src/services/api.js
```

`src/config.js` is used by live class and chat upload flows. `src/services/api.js` is used by API requests, subscriptions, and the shared Socket.IO client.

## Available Scripts

```sh
npm start
```

Starts the React Native Metro bundler.

```sh
npm run android
```

Builds and runs the Android app.

```sh
npm run ios
```

Builds and runs the iOS app.

```sh
npm run lint
```

Runs ESLint across the app and server folder.

```sh
npm test
```

Runs Jest tests.

## Project Structure

```txt
App.js
src/
  components/          Shared UI components
  contexts/            Auth context
  screens/             Admin, teacher, student, auth, and live class screens
  services/            API, auth, notifications, and data compatibility shims
  theme/               Theme constants and provider
studivista-server/     Backend API and Socket.IO server
```

## Current Verification Notes

As of the latest local check:

- `npm run lint` fails with React hook dependency errors and style warnings.
- `npm test -- --runInBand` fails before assertions because Jest is not transforming ESM from `@react-navigation/native`.
- Server JavaScript syntax checks pass.
- The server currently requires the `pg` package in `studivista-server/config/db.js`; ensure it is installed and listed in server dependencies before deploying.

## Backend

See `studivista-server/README.md` for backend setup, database configuration, API endpoints, and Socket.IO events.
