PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_action_modifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  action TEXT NOT NULL,
  modifier_type TEXT NOT NULL,
  payload TEXT NOT NULL DEFAULT '{}',
  remaining_uses INTEGER NOT NULL DEFAULT 1 CHECK (remaining_uses >= 0),
  expires_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS user_action_modifiers_user_action_idx
  ON user_action_modifiers(user_id, action);
