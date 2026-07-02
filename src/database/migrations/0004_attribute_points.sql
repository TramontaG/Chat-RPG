PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_attribute_points (
  user_id INTEGER PRIMARY KEY,
  available_points INTEGER NOT NULL DEFAULT 0 CHECK (available_points >= 0),
  total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
