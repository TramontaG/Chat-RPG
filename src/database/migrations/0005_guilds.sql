PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS guilds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_guild_memberships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  guild_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (guild_id) REFERENCES guilds(id)
);

CREATE INDEX IF NOT EXISTS user_guild_memberships_user_id_idx
  ON user_guild_memberships(user_id);

CREATE INDEX IF NOT EXISTS user_guild_memberships_guild_id_idx
  ON user_guild_memberships(guild_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_guild_memberships_user_guild_idx
  ON user_guild_memberships(user_id, guild_id);
