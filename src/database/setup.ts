import { sqlite } from "./client";
import { buildProgressionLevelRequirements } from "../modules/progression/progression.constants";
import { buildFishingItemDefinitions } from "../modules/fishing/fishing.items";

export function initializeDatabase(): void {
  sqlite.exec("PRAGMA foreign_keys = ON;");

  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'player' CHECK (role IN ('master', 'player')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS progression_level_requirements (
      level INTEGER PRIMARY KEY,
      xp_required INTEGER NOT NULL CHECK (xp_required >= 0),
      multiplier REAL NOT NULL CHECK (multiplier > 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

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

    CREATE TABLE IF NOT EXISTS user_attribute_points (
      user_id INTEGER PRIMARY KEY,
      available_points INTEGER NOT NULL DEFAULT 0 CHECK (available_points >= 0),
      total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
      total_spent INTEGER NOT NULL DEFAULT 0 CHECK (total_spent >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

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
  `);

  seedProgressionLevelRequirements();
  seedFishingItemDefinitions();
}

function seedProgressionLevelRequirements(): void {
  const now = new Date().toISOString();
  const insertLevelRequirement = sqlite.prepare(`
    INSERT INTO progression_level_requirements (
      level,
      xp_required,
      multiplier,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(level) DO UPDATE SET
      xp_required = excluded.xp_required,
      multiplier = excluded.multiplier,
      updated_at = excluded.updated_at
  `);

  const transaction = sqlite.transaction(() => {
    for (const requirement of buildProgressionLevelRequirements()) {
      insertLevelRequirement.run(
        requirement.level,
        requirement.xpRequired,
        requirement.multiplier,
        now,
        now,
      );
    }
  });

  transaction();
}

function seedFishingItemDefinitions(): void {
  const insertItem = sqlite.prepare(`
    INSERT INTO items (
      id,
      name,
      description,
      category,
      type,
      rarity,
      stackable,
      max_stack,
      base_value,
      metadata,
      status,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      category = excluded.category,
      type = excluded.type,
      rarity = excluded.rarity,
      stackable = excluded.stackable,
      max_stack = excluded.max_stack,
      base_value = excluded.base_value,
      metadata = excluded.metadata,
      status = excluded.status,
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  const transaction = sqlite.transaction(() => {
    for (const item of buildFishingItemDefinitions(now)) {
      insertItem.run(
        item.id,
        item.name,
        item.description,
        item.category,
        item.type,
        item.rarity,
        item.stackable === false ? 0 : 1,
        item.maxStack ?? null,
        item.baseValue ?? 0,
        item.metadata ?? "{}",
        item.status ?? "active",
        item.createdAt ?? now,
        item.updatedAt ?? now,
      );
    }
  });

  transaction();
}
