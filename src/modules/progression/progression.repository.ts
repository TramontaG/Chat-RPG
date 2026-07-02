import { and, eq, sql } from "drizzle-orm";
import type { db as dbClient } from "../../database/client";
import {
  userAttributes,
  userAttributePoints,
  progressionLevelRequirements,
  userSkills,
  type Attribute,
  type NewUserAttributePointsRow,
  type NewUserAttributeRow,
  type NewUserSkillRow,
  type ProgressionLevelRequirementRow,
  type Skill,
  type UserAttributePointsRow,
  type UserAttributeRow,
  type UserSkillRow,
} from "../../database/schema";

type Database = typeof dbClient;

export class ProgressionRepository {
  constructor(private readonly database: Database) {}

  async listLevelRequirements(): Promise<ProgressionLevelRequirementRow[]> {
    return this.database.select().from(progressionLevelRequirements).all();
  }

  async findLevelRequirement(level: number): Promise<ProgressionLevelRequirementRow | undefined> {
    const rows = this.database
      .select()
      .from(progressionLevelRequirements)
      .where(eq(progressionLevelRequirements.level, level))
      .limit(1)
      .all();

    return rows[0];
  }

  async listAttributes(userId: number): Promise<UserAttributeRow[]> {
    return this.database.select().from(userAttributes).where(eq(userAttributes.userId, userId)).all();
  }

  async listSkills(userId: number): Promise<UserSkillRow[]> {
    return this.database.select().from(userSkills).where(eq(userSkills.userId, userId)).all();
  }

  async findAttributePoints(userId: number): Promise<UserAttributePointsRow | undefined> {
    const rows = this.database
      .select()
      .from(userAttributePoints)
      .where(eq(userAttributePoints.userId, userId))
      .limit(1)
      .all();

    return rows[0];
  }

  async findAttribute(userId: number, attribute: Attribute): Promise<UserAttributeRow | undefined> {
    const rows = this.database
      .select()
      .from(userAttributes)
      .where(and(eq(userAttributes.userId, userId), eq(userAttributes.attribute, attribute)))
      .limit(1)
      .all();

    return rows[0];
  }

  async findSkill(userId: number, skill: Skill): Promise<UserSkillRow | undefined> {
    const rows = this.database
      .select()
      .from(userSkills)
      .where(and(eq(userSkills.userId, userId), eq(userSkills.skill, skill)))
      .limit(1)
      .all();

    return rows[0];
  }

  async createAttributes(attributes: NewUserAttributeRow[]): Promise<void> {
    if (attributes.length === 0) {
      return;
    }

    this.database.insert(userAttributes).values(attributes).onConflictDoNothing().run();
  }

  async createSkills(skills: NewUserSkillRow[]): Promise<void> {
    if (skills.length === 0) {
      return;
    }

    this.database.insert(userSkills).values(skills).onConflictDoNothing().run();
  }

  async createAttributePoints(points: NewUserAttributePointsRow): Promise<void> {
    this.database.insert(userAttributePoints).values(points).onConflictDoNothing().run();
  }

  async addAttributePoints(userId: number, points: number, updatedAt: string): Promise<void> {
    this.database
      .update(userAttributePoints)
      .set({
        availablePoints: sql`${userAttributePoints.availablePoints} + ${points}`,
        totalEarned: sql`${userAttributePoints.totalEarned} + ${points}`,
        updatedAt,
      })
      .where(eq(userAttributePoints.userId, userId))
      .run();
  }

  async spendAttributePoints(userId: number, points: number, updatedAt: string): Promise<void> {
    this.database
      .update(userAttributePoints)
      .set({
        availablePoints: sql`${userAttributePoints.availablePoints} - ${points}`,
        totalSpent: sql`${userAttributePoints.totalSpent} + ${points}`,
        updatedAt,
      })
      .where(eq(userAttributePoints.userId, userId))
      .run();
  }

  async updateAttributeProgress(
    id: number,
    progress: Pick<UserAttributeRow, "xp" | "level" | "updatedAt">,
  ): Promise<void> {
    this.database.update(userAttributes).set(progress).where(eq(userAttributes.id, id)).run();
  }

  async updateSkillProgress(
    id: number,
    progress: Pick<UserSkillRow, "xp" | "level" | "updatedAt">,
  ): Promise<void> {
    this.database.update(userSkills).set(progress).where(eq(userSkills.id, id)).run();
  }
}
