const { createNotification, createNotificationsForUsers } = require('../utils/notifications');

const toInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const REMINDER_MINUTES = toInt(process.env.CLASS_REMINDER_MINUTES, 5);
const POLL_MS = toInt(process.env.CLASS_REMINDER_POLL_MS, 60000);

const sendReminderForClass = async (pool, io, cls) => {
  const studentIds = Array.isArray(cls.student_ids) ? cls.student_ids : [];
  const title = cls.title || 'Class';
  const batchName = cls.batch_name || 'your batch';
  const teacherName = cls.teacher_name || 'your teacher';

  await createNotificationsForUsers(pool, io, studentIds, {
    title: 'Class starts in 5 minutes',
    body: `${title} with ${teacherName} is starting soon.`,
    type: 'schedule',
    classId: cls.id,
    batchId: cls.batch_id,
  });

  if (cls.teacher_id) {
    await createNotification(pool, io, {
      userId: cls.teacher_id,
      title: 'Class starts in 5 minutes',
      body: `${title} for ${batchName} is starting soon.`,
      type: 'schedule',
      classId: cls.id,
      batchId: cls.batch_id,
    });
  }
};

const runClassReminderPass = async (pool, io) => {
  const client = await pool.connect();
  try {
    const { rows } = await client.query(
      `UPDATE sv_classes
       SET reminder_sent_at=NOW(),updated_at=NOW()
       WHERE id IN (
         SELECT id
         FROM sv_classes
         WHERE status='scheduled'
           AND reminder_sent_at IS NULL
           AND scheduled_at > NOW()
           AND scheduled_at <= NOW() + ($1 || ' minutes')::interval
         ORDER BY scheduled_at ASC
         FOR UPDATE SKIP LOCKED
       )
       RETURNING *`,
      [REMINDER_MINUTES],
    );
    for (const cls of rows) {
      await sendReminderForClass(pool, io, cls);
    }
    if (rows.length) {
      console.log(`[class-reminders] Sent ${rows.length} reminder batch(es).`);
    }
  } catch (err) {
    console.warn('[class-reminders] Reminder pass failed:', err.message);
  } finally {
    client.release();
  }
};

const startClassReminderJob = ({ pool, io }) => {
  const run = () => runClassReminderPass(pool, io);
  const timer = setInterval(run, POLL_MS);
  run();
  return () => clearInterval(timer);
};

module.exports = {
  runClassReminderPass,
  startClassReminderJob,
};
