require('dotenv').config();
const { pool } = require('./db');

(async () => {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS sv_users (
        uid         TEXT PRIMARY KEY,
        email       TEXT UNIQUE NOT NULL,
        name        TEXT NOT NULL,
        role        TEXT NOT NULL DEFAULT 'student',
        subject     TEXT DEFAULT '',
        status      TEXT DEFAULT 'active',
        batch_ids   JSONB DEFAULT '[]',
        created_by  TEXT,
        avatar      TEXT,
        last_seen_at TIMESTAMPTZ,
        fcm_token   TEXT,
        password    TEXT NOT NULL,
        created_at  TIMESTAMPTZ DEFAULT NOW(),
        updated_at  TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sv_batches (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        subject       TEXT,
        color         TEXT,
        teacher_id    TEXT,
        teacher_name  TEXT DEFAULT '',
        schedule_days JSONB DEFAULT '[]',
        schedule_time TEXT DEFAULT '',
        max_students  INT DEFAULT 30,
        status        TEXT DEFAULT 'active',
        student_ids   JSONB DEFAULT '[]',
        created_at    TIMESTAMPTZ DEFAULT NOW(),
        updated_at    TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sv_classes (
        id                  TEXT PRIMARY KEY,
        batch_id            TEXT,
        batch_name          TEXT,
        teacher_id          TEXT,
        teacher_name        TEXT,
        title               TEXT,
        description         TEXT DEFAULT '',
        scheduled_at        TIMESTAMPTZ,
        duration_min        INT DEFAULT 60,
        color               TEXT DEFAULT '#FF4B6E',
        status              TEXT DEFAULT 'scheduled',
        joined_student_ids  JSONB DEFAULT '[]',
        started_at          TIMESTAMPTZ,
        ended_at            TIMESTAMPTZ,
        reminder_sent_at    TIMESTAMPTZ,
        created_at          TIMESTAMPTZ DEFAULT NOW(),
        updated_at          TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sv_notes (
        id           TEXT PRIMARY KEY,
        title        TEXT NOT NULL,
        body         TEXT NOT NULL,
        batch_id     TEXT,
        batch_name   TEXT DEFAULT '',
        teacher_id   TEXT,
        teacher_name TEXT DEFAULT '',
        created_at   TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sv_notifications (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        title      TEXT NOT NULL,
        body       TEXT NOT NULL,
        type       TEXT DEFAULT 'info',
        class_id   TEXT,
        batch_id   TEXT,
        read       BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS sv_attendance (
        class_id    TEXT NOT NULL,
        student_id  TEXT NOT NULL,
        status      TEXT DEFAULT 'present',
        joined_at   TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (class_id, student_id)
      );

      CREATE TABLE IF NOT EXISTS sv_user_push_tokens (
        id         TEXT PRIMARY KEY,
        user_id    TEXT NOT NULL,
        token      TEXT NOT NULL UNIQUE,
        platform   TEXT DEFAULT '',
        device_id  TEXT DEFAULT '',
        enabled    BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      ALTER TABLE sv_classes
        ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

      ALTER TABLE sv_notes
        ADD COLUMN IF NOT EXISTS class_id TEXT,
        ADD COLUMN IF NOT EXISTS note_type TEXT NOT NULL DEFAULT 'text',
        ADD COLUMN IF NOT EXISTS file_url TEXT,
        ADD COLUMN IF NOT EXISTS file_name TEXT,
        ADD COLUMN IF NOT EXISTS file_size BIGINT,
        ADD COLUMN IF NOT EXISTS duration_sec INT,
        ADD COLUMN IF NOT EXISTS thumb_url TEXT;

      UPDATE sv_notes SET note_type='text' WHERE note_type IS NULL;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = 'chk_note_type'
            AND conrelid = 'sv_notes'::regclass
        ) THEN
          ALTER TABLE sv_notes
            ADD CONSTRAINT chk_note_type
            CHECK (note_type IN ('text','pdf','image','video','audio','voice','link'));
        END IF;
      END
      $$;

      CREATE INDEX IF NOT EXISTS idx_users_email      ON sv_users(email);
      CREATE INDEX IF NOT EXISTS idx_users_role       ON sv_users(role);
      CREATE INDEX IF NOT EXISTS idx_batches_teacher  ON sv_batches(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_classes_batch    ON sv_classes(batch_id);
      CREATE INDEX IF NOT EXISTS idx_classes_teacher  ON sv_classes(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_classes_reminder ON sv_classes(status,scheduled_at,reminder_sent_at);
      CREATE INDEX IF NOT EXISTS idx_notes_batch      ON sv_notes(batch_id);
      CREATE INDEX IF NOT EXISTS idx_notes_class_id   ON sv_notes(class_id);
      CREATE INDEX IF NOT EXISTS idx_notes_teacher    ON sv_notes(teacher_id);
      CREATE INDEX IF NOT EXISTS idx_notif_user       ON sv_notifications(user_id);
      CREATE INDEX IF NOT EXISTS idx_attend_class     ON sv_attendance(class_id);
      CREATE INDEX IF NOT EXISTS idx_push_tokens_user ON sv_user_push_tokens(user_id);
      CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON sv_user_push_tokens(token);
    `);
    console.log('✅ All tables created successfully!');
  } catch (e) {
    console.error('❌ Error creating tables:', e.message);
  } finally {
    client.release();
    await pool.end();
  }
})();
