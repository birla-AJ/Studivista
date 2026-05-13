/**
 * format.js  — updated to handle ISO strings from server
 *
 * Original only handled: Firestore Timestamp, Date, number
 * Added: ISO string (what our server returns), Firestore-like {_seconds, _nanoseconds}
 */
export const tsToDate = ts => {
  if (!ts) return null;
  // Firestore Timestamp object
  if (typeof ts.toDate === 'function') return ts.toDate();
  // Firestore-like plain object { _seconds, _nanoseconds }
  if (typeof ts._seconds === 'number') return new Date(ts._seconds * 1000);
  // Already a Date
  if (ts instanceof Date) return ts;
  // Number (epoch ms)
  if (typeof ts === 'number') return new Date(ts);
  // ISO string from server  ← NEW
  if (typeof ts === 'string') {
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
};

export const formatDateLabel = ts => {
  const d = tsToDate(ts);
  if (!d) return '';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short' });
};

export const formatTimeLabel = ts => {
  const d = tsToDate(ts);
  if (!d) return '';
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatJoined = ts => {
  const d = tsToDate(ts);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const minutesToLabel = m => `${Number(m) || 0} min`;

// Online if heartbeat ping was received within the last 90 seconds (3× the 30s interval).
export const isUserOnline = user => {
  const d = tsToDate(user?.lastSeenAt);
  if (!d) return false;
  return Date.now() - d.getTime() < 90 * 1000;
};
