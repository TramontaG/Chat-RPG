PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS user_attributes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  attribute TEXT NOT NULL CHECK (attribute IN ('strength', 'vitality', 'dexterity', 'intelligence', 'luck')),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, attribute)
);

CREATE INDEX IF NOT EXISTS user_attributes_user_id_idx
  ON user_attributes(user_id);

CREATE TABLE IF NOT EXISTS user_skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill TEXT NOT NULL CHECK (skill IN (
    'fishing',
    'woodcutting',
    'mining',
    'farming',
    'cooking',
    'smithing',
    'crafting',
    'archaeology',
    'melee',
    'ranged',
    'magic',
    'runemaking',
    'alchemy',
    'potionbrewing'
  )),
  skill_group TEXT NOT NULL CHECK (skill_group IN ('gathering', 'processing', 'combat', 'wizardry')),
  xp INTEGER NOT NULL DEFAULT 0 CHECK (xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE(user_id, skill)
);

CREATE INDEX IF NOT EXISTS user_skills_user_id_idx
  ON user_skills(user_id);
