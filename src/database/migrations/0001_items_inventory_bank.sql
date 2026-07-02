PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('equipment', 'consumable', 'material', 'treasure')),
  type TEXT NOT NULL,
  rarity TEXT NOT NULL CHECK (rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')),
  stackable INTEGER NOT NULL DEFAULT 1 CHECK (stackable IN (0, 1)),
  max_stack INTEGER,
  base_value INTEGER NOT NULL DEFAULT 0,
  metadata TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deprecated', 'disabled')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_inventory_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS user_inventory_items_user_id_idx
  ON user_inventory_items(user_id);

CREATE INDEX IF NOT EXISTS user_inventory_items_user_item_idx
  ON user_inventory_items(user_id, item_id);

CREATE TABLE IF NOT EXISTS user_inventory_slot_bonuses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  source TEXT NOT NULL,
  slots INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS user_inventory_slot_bonuses_user_id_idx
  ON user_inventory_slot_bonuses(user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_inventory_slot_bonuses_user_source_idx
  ON user_inventory_slot_bonuses(user_id, source);

CREATE TABLE IF NOT EXISTS user_banks (
  user_id INTEGER PRIMARY KEY,
  gold INTEGER NOT NULL DEFAULT 0 CHECK (gold >= 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS user_bank_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE INDEX IF NOT EXISTS user_bank_items_user_id_idx
  ON user_bank_items(user_id);

CREATE INDEX IF NOT EXISTS user_bank_items_user_item_idx
  ON user_bank_items(user_id, item_id);
