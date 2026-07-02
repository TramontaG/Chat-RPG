import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const userRoleValues = ["master", "player"] as const;
export type UserRole = (typeof userRoleValues)[number];

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role", { enum: userRoleValues }).notNull().default("player"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserRow = typeof users.$inferSelect;
export type NewUserRow = typeof users.$inferInsert;

export const attributeValues = ["strength", "vitality", "dexterity", "intelligence", "luck"] as const;
export type Attribute = (typeof attributeValues)[number];

export const skillGroupValues = ["gathering", "processing", "combat", "wizardry"] as const;
export type SkillGroup = (typeof skillGroupValues)[number];

export const skillValues = [
  "fishing",
  "woodcutting",
  "mining",
  "farming",
  "cooking",
  "smithing",
  "crafting",
  "archaeology",
  "melee",
  "ranged",
  "magic",
  "runemaking",
  "alchemy",
  "potionbrewing",
] as const;
export type Skill = (typeof skillValues)[number];

export const progressionLevelRequirements = sqliteTable("progression_level_requirements", {
  level: integer("level").primaryKey(),
  xpRequired: integer("xp_required").notNull(),
  multiplier: real("multiplier").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ProgressionLevelRequirementRow = typeof progressionLevelRequirements.$inferSelect;
export type NewProgressionLevelRequirementRow = typeof progressionLevelRequirements.$inferInsert;

export const userAttributes = sqliteTable("user_attributes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  attribute: text("attribute", { enum: attributeValues }).notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserAttributeRow = typeof userAttributes.$inferSelect;
export type NewUserAttributeRow = typeof userAttributes.$inferInsert;

export const userAttributePoints = sqliteTable("user_attribute_points", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  availablePoints: integer("available_points").notNull().default(0),
  totalEarned: integer("total_earned").notNull().default(0),
  totalSpent: integer("total_spent").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserAttributePointsRow = typeof userAttributePoints.$inferSelect;
export type NewUserAttributePointsRow = typeof userAttributePoints.$inferInsert;

export const userSkills = sqliteTable("user_skills", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  skill: text("skill", { enum: skillValues }).notNull(),
  skillGroup: text("skill_group", { enum: skillGroupValues }).notNull(),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserSkillRow = typeof userSkills.$inferSelect;
export type NewUserSkillRow = typeof userSkills.$inferInsert;

export const itemCategoryValues = ["equipment", "consumable", "material", "treasure"] as const;
export type ItemCategory = (typeof itemCategoryValues)[number];

export const itemRarityValues = ["common", "uncommon", "rare", "epic", "legendary"] as const;
export type ItemRarity = (typeof itemRarityValues)[number];

export const itemStatusValues = ["active", "deprecated", "disabled"] as const;
export type ItemStatus = (typeof itemStatusValues)[number];

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category", { enum: itemCategoryValues }).notNull(),
  type: text("type").notNull(),
  rarity: text("rarity", { enum: itemRarityValues }).notNull(),
  stackable: integer("stackable", { mode: "boolean" }).notNull().default(true),
  maxStack: integer("max_stack"),
  baseValue: integer("base_value").notNull().default(0),
  metadata: text("metadata").notNull().default("{}"),
  status: text("status", { enum: itemStatusValues }).notNull().default("active"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type ItemRow = typeof items.$inferSelect;
export type NewItemRow = typeof items.$inferInsert;

export const userInventoryItems = sqliteTable("user_inventory_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserInventoryItemRow = typeof userInventoryItems.$inferSelect;
export type NewUserInventoryItemRow = typeof userInventoryItems.$inferInsert;

export const userInventorySlotBonuses = sqliteTable("user_inventory_slot_bonuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  source: text("source").notNull(),
  slots: integer("slots").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserInventorySlotBonusRow = typeof userInventorySlotBonuses.$inferSelect;
export type NewUserInventorySlotBonusRow = typeof userInventorySlotBonuses.$inferInsert;

export const userBanks = sqliteTable("user_banks", {
  userId: integer("user_id")
    .primaryKey()
    .references(() => users.id),
  gold: integer("gold").notNull().default(0),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserBankRow = typeof userBanks.$inferSelect;
export type NewUserBankRow = typeof userBanks.$inferInsert;

export const userBankItems = sqliteTable("user_bank_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  itemId: text("item_id")
    .notNull()
    .references(() => items.id),
  quantity: integer("quantity").notNull().default(1),
  metadata: text("metadata"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export type UserBankItemRow = typeof userBankItems.$inferSelect;
export type NewUserBankItemRow = typeof userBankItems.$inferInsert;
