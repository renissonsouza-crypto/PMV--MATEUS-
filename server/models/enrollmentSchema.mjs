export const sqliteEnrollmentSchema = `
CREATE TABLE IF NOT EXISTS profile_sessions (
  token_hash TEXT PRIMARY KEY, registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS course_enrollment_requests (
  id TEXT PRIMARY KEY, registration_id INTEGER NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
  course_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, status_hash TEXT NOT NULL,
  delivery TEXT NOT NULL, created_at TEXT NOT NULL, expires_at TEXT NOT NULL,
  confirmed_at TEXT, cancelled_at TEXT
);
CREATE INDEX IF NOT EXISTS enrollment_requests_person ON course_enrollment_requests(registration_id, created_at);
`;
export const postgresEnrollmentSchema = [
  `CREATE TABLE IF NOT EXISTS profile_sessions (
    token_hash TEXT PRIMARY KEY, registration_id BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS course_enrollment_requests (
    id TEXT PRIMARY KEY, registration_id BIGINT NOT NULL REFERENCES registrations(id) ON DELETE CASCADE,
    course_id INTEGER NOT NULL, token_hash TEXT NOT NULL UNIQUE, status_hash TEXT NOT NULL,
    delivery TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, expires_at TIMESTAMPTZ NOT NULL,
    confirmed_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ
  )`,
  `CREATE INDEX IF NOT EXISTS enrollment_requests_person ON course_enrollment_requests(registration_id, created_at)`,
];
