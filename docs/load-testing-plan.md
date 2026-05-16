# Studivista Load Testing Plan

## Goal

Find how many teachers and students the current Studivista server can support at the same time without:

- Socket connection drops
- Slow chat delivery
- Delayed hand raise events
- Failed live-class joins
- PM2/server restarts
- High CPU/RAM usage
- Database connection exhaustion
- Visible live-class lag on real devices

The deployed backend currently used by the app is:

```txt
http://144.24.114.0:3000
```

## Important Capacity Split

There are two different limits to measure.

### 1. Backend Signaling Capacity

This measures the server's ability to coordinate live classes:

- Socket.IO connections
- `join-room`
- `media-state`
- `hand-raise`
- `live-chat-message`
- teacher controls such as mute/camera-off/remove

This can be simulated with scripted clients.

### 2. Real WebRTC Video Capacity

The app uses mesh WebRTC. That means every participant connects to other participants directly. The server may be healthy while phones still lag because the real video/audio load is mostly on:

- student/teacher devices
- device CPU/GPU
- network bandwidth
- number of peer video streams

This must be tested with real phones/emulators.

## Phase 1: Test Data

Create test-only users:

```txt
10 teachers
500 students
10 batches
10 live classes
```

Suggested split:

```txt
Teacher 1  -> Batch 1  -> 50 students
Teacher 2  -> Batch 2  -> 50 students
Teacher 3  -> Batch 3  -> 50 students
...
Teacher 10 -> Batch 10 -> 50 students
```

Do not use real student accounts.

## Phase 2: Test Tooling

Create a load test folder later:

```txt
load-tests/
  api.k6.js
  socket-live-class.yml
  users.json
  README.md
```

Recommended tools:

- `k6` for REST API load tests
- `Artillery` for Socket.IO live-class simulations

## Phase 3: API Load Test

Test normal backend API traffic:

- `GET /health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/batches`
- `GET /api/classes`
- `GET /api/notes`
- `GET /api/notifications`

Ramp levels:

```txt
25 users for 5 minutes
50 users for 5 minutes
100 users for 10 minutes
250 users for 10 minutes
500 users for 10 minutes
```

Pass target:

```txt
p95 response time under 500ms
error rate under 1%
no PM2 restart
CPU under 80%
RAM stable
database connections stable
```

## Phase 4: Socket.IO Live Class Simulation

Simulate live classes without real video/audio first.

Each fake student should:

- connect to Socket.IO
- join a live room
- send `media-state`
- raise/lower hand
- send live chat
- stay connected
- randomly disconnect/reconnect

Each fake teacher should:

- connect to Socket.IO
- join room as host
- receive student events
- send mute/camera-off to random students
- end the class at the end

Test levels:

```txt
1 teacher + 10 students
1 teacher + 25 students
1 teacher + 50 students
1 teacher + 100 students
5 teachers + 50 students each
10 teachers + 50 students each
```

Run each scenario for:

```txt
10-20 minutes
```

Measure:

- successful joins
- failed joins
- disconnect count
- reconnect count
- chat delivery delay
- hand raise delivery delay
- media-state event delay
- teacher control delivery delay
- server CPU/RAM
- PM2 restart count

Pass target:

```txt
join success above 99%
socket disconnects under 1%
hand raise/chat p95 delay under 1 second
no PM2 restart
CPU under 80%
RAM not continuously increasing
```

## Phase 5: Real Device WebRTC Test

Use real phones/emulators after signaling simulation passes.

Test levels:

```txt
1 teacher + 5 students
1 teacher + 10 students
1 teacher + 15 students
1 teacher + 20 students
```

Check:

- video freeze
- audio delay
- app crash
- phone heating
- data usage
- delayed mic/camera controls
- delayed hand raise/chat

Pass target:

```txt
no app crash
audio delay acceptable
video does not freeze repeatedly
hand raise/chat under 1 second
teacher controls respond quickly
```

## Phase 6: Server Monitoring

During every test, monitor the server over SSH:

```sh
pm2 monit
pm2 status studivista
pm2 logs studivista --lines 100
htop
free -m
df -h
```

PostgreSQL checks:

```sh
sudo -u postgres psql -c "select count(*) from pg_stat_activity;"
sudo -u postgres psql -c "select state, count(*) from pg_stat_activity group by state;"
```

## Phase 7: Stop Conditions

Stop the test if:

```txt
socket disconnects > 5%
API error rate > 5%
hand raise/chat delay > 3 seconds
CPU > 90% for more than 2 minutes
RAM keeps increasing
PM2 restarts
database connections max out
students report heavy video/audio lag
```

## Phase 8: Report Format

Save one result for each scenario:

```txt
Date:
Server:
Test type:
Teachers:
Students:
Duration:
API p95:
Socket p95 delay:
Disconnects:
Errors:
CPU max:
RAM max:
DB connections max:
PM2 restarts:
Result: PASS/FAIL
Notes:
```

## First Test To Run Later

When instructed to start, begin with:

```txt
1 teacher + 50 simulated students
10 minute Socket.IO signaling test
```

Then increase only if the server remains stable.

