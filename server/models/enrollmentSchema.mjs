export const sqliteEnrollmentSchema = `
CREATE TABLE IF NOT EXISTS google_signup_intents (
  token_hash TEXT PRIMARY KEY, subject TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS google_signup_expiry ON google_signup_intents(expires_at);
CREATE TABLE IF NOT EXISTS google_login_challenges (
  token_hash TEXT PRIMARY KEY, expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS google_challenges_expiry ON google_login_challenges(expires_at);
CREATE TABLE IF NOT EXISTS google_identities (
  subject TEXT PRIMARY KEY, registration_id INTEGER NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE
);
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
  `CREATE TABLE IF NOT EXISTS google_signup_intents (
    token_hash TEXT PRIMARY KEY, subject TEXT NOT NULL, email TEXT NOT NULL, name TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS google_signup_expiry ON google_signup_intents(expires_at)`,
  `CREATE TABLE IF NOT EXISTS google_login_challenges (
    token_hash TEXT PRIMARY KEY, expires_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS google_challenges_expiry ON google_login_challenges(expires_at)`,
  `CREATE TABLE IF NOT EXISTS google_identities (
    subject TEXT PRIMARY KEY, registration_id BIGINT NOT NULL UNIQUE REFERENCES registrations(id) ON DELETE CASCADE
  )`,
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
