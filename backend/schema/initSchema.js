const pool = require("../db");

const initSchema = async () => {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);

  await pool.query(`
    ALTER TABLE exams
    ADD COLUMN IF NOT EXISTS show_result BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_assignments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (exam_id, student_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exam_assignments_student_id
    ON exam_assignments(student_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exam_assignments_exam_id
    ON exam_assignments(exam_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_result_visibility (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      show_result BOOLEAN NOT NULL DEFAULT TRUE,
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (exam_id, student_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exam_result_visibility_exam_student
    ON exam_result_visibility(exam_id, student_id);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS institutes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      institute_name VARCHAR(255) NOT NULL UNIQUE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS student_groups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      group_name VARCHAR(255) NOT NULL,
      institute_id UUID NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
      is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
      deleted_at TIMESTAMP NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      UNIQUE (group_name, institute_id)
    );
  `);

  await pool.query(`
    ALTER TABLE institutes
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
  `);

  await pool.query(`
    ALTER TABLE student_groups
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP NULL;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_student_groups_institute_id
    ON student_groups(institute_id);
  `);

  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS roll_number VARCHAR(100),
    ADD COLUMN IF NOT EXISTS mobile VARCHAR(20),
    ADD COLUMN IF NOT EXISTS institute_id UUID REFERENCES institutes(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES student_groups(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_roll_number_unique
    ON users(LOWER(roll_number))
    WHERE roll_number IS NOT NULL AND roll_number <> '';
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_users_student_filters
    ON users(user_type, institute_id, group_id, is_active);
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS exam_assignment_audit_logs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      exam_id INT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
      student_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      action VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exam_assignment_audit_logs_exam_id
    ON exam_assignment_audit_logs(exam_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_exam_assignment_audit_logs_created_at
    ON exam_assignment_audit_logs(created_at DESC);
  `);
};

module.exports = initSchema;
