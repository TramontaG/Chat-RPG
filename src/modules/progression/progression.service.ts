import { db } from "../../database/client";
import type {
  Attribute,
  ProgressionLevelRequirementRow,
  Skill,
  UserAttributePointsRow,
  UserAttributeRow,
  UserSkillRow,
} from "../../database/schema";
import { ATTRIBUTES, getSkillGroup, MAX_LEVEL, SKILLS } from "./progression.constants";
import { ProgressionRepository } from "./progression.repository";

const progressionRepository = new ProgressionRepository(db);

export type ProgressionState = {
  attributes: EnrichedUserAttribute[];
  attributePoints: UserAttributePointsRow;
  skills: EnrichedUserSkill[];
};

export type XpGrant = {
  xpGained: number;
  attributePointsGained?: number;
  previousXp: number;
  currentXp: number;
  previousLevel: number;
  currentLevel: number;
  leveledUp: boolean;
  xpForCurrentLevel: number;
  xpForNextLevel: number | null;
  xpRemainingToNextLevel: number | null;
};

export type LevelProgress = {
  level: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number | null;
  xpRemainingToNextLevel: number | null;
};

export type EnrichedUserAttribute = UserAttributeRow & LevelProgress;
export type EnrichedUserSkill = UserSkillRow & LevelProgress;

export type ActionProgressionRewards = {
  attributes?: Partial<Record<Attribute, number>>;
  skills?: Partial<Record<Skill, number>>;
};

export type AppliedActionProgressionRewards = {
  attributes: Partial<Record<Attribute, XpGrant>>;
  skills: Partial<Record<Skill, XpGrant>>;
};

export type AttributePointSpend = {
  attribute: Attribute;
  levelsPurchased: number;
  previousLevel: number;
  currentLevel: number;
  cost: number;
  attributePoints: UserAttributePointsRow;
};

export class InsufficientAttributePointsError extends Error {
  constructor(required: number, available: number) {
    super(`Insufficient attribute points. Required: ${required}. Available: ${available}.`);
    this.name = "InsufficientAttributePointsError";
  }
}

function assertPositiveXp(xp: number): void {
  if (!Number.isInteger(xp) || xp <= 0) {
    throw new Error("XP must be a positive integer.");
  }
}

function assertPositiveLevels(levels: number): void {
  if (!Number.isInteger(levels) || levels <= 0) {
    throw new Error("Levels must be a positive integer.");
  }
}

function calculateAttributePointsForSkillLevels(previousLevel: number, currentLevel: number): number {
  let points = 0;

  for (let level = previousLevel + 1; level <= currentLevel; level += 1) {
    points += Math.floor(level / 2);
  }

  return points;
}

function calculateAttributePointCost(previousLevel: number, levels: number): number {
  let cost = 0;

  for (let level = previousLevel + 1; level <= previousLevel + levels; level += 1) {
    cost += level;
  }

  return cost;
}

async function getLevelRequirements(): Promise<ProgressionLevelRequirementRow[]> {
  const requirements = await progressionRepository.listLevelRequirements();

  if (requirements.length === 0) {
    throw new Error("Progression level requirements are not seeded.");
  }

  return requirements.sort((first, second) => first.level - second.level);
}

function getRequirementForLevel(
  level: number,
  requirements: ProgressionLevelRequirementRow[],
): ProgressionLevelRequirementRow {
  const requirement = requirements.find((candidate) => candidate.level === level);

  if (!requirement) {
    throw new Error(`Missing level requirement for level ${level}.`);
  }

  return requirement;
}

function calculateLevelProgress(
  xp: number,
  requirements: ProgressionLevelRequirementRow[],
): LevelProgress {
  let currentRequirement = requirements[0];
  let nextRequirement: ProgressionLevelRequirementRow | undefined;

  for (let index = 0; index < requirements.length; index += 1) {
    const requirement = requirements[index];

    if (!requirement) {
      continue;
    }

    if (xp >= requirement.xpRequired) {
      currentRequirement = requirement;
      nextRequirement = requirements[index + 1];
    } else {
      nextRequirement = requirement;
      break;
    }
  }

  if (!currentRequirement) {
    throw new Error("Missing level 1 requirement.");
  }

  const isMaxLevel = currentRequirement.level >= MAX_LEVEL || !nextRequirement;
  let xpForNextLevel: number | null = null;

  if (!isMaxLevel && nextRequirement) {
    xpForNextLevel = nextRequirement.xpRequired;
  }

  return {
    level: currentRequirement.level,
    xpForCurrentLevel: currentRequirement.xpRequired,
    xpForNextLevel,
    xpRemainingToNextLevel: xpForNextLevel === null ? null : Math.max(0, xpForNextLevel - xp),
  };
}

async function enrichAttribute(attribute: UserAttributeRow): Promise<EnrichedUserAttribute> {
  const requirements = await getLevelRequirements();
  const levelProgress = calculateLevelProgress(attribute.xp, requirements);

  if (attribute.level !== levelProgress.level) {
    await progressionRepository.updateAttributeProgress(attribute.id, {
      xp: attribute.xp,
      level: levelProgress.level,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ...attribute,
    ...levelProgress,
  };
}

async function enrichSkill(skill: UserSkillRow): Promise<EnrichedUserSkill> {
  const requirements = await getLevelRequirements();
  const levelProgress = calculateLevelProgress(skill.xp, requirements);

  if (skill.level !== levelProgress.level) {
    await progressionRepository.updateSkillProgress(skill.id, {
      xp: skill.xp,
      level: levelProgress.level,
      updatedAt: new Date().toISOString(),
    });
  }

  return {
    ...skill,
    ...levelProgress,
  };
}

export async function ensureUserProgression(userId: number): Promise<void> {
  const now = new Date().toISOString();

  await progressionRepository.createAttributes(
    ATTRIBUTES.map((attribute) => ({
      userId,
      attribute,
      xp: 0,
      level: 1,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await progressionRepository.createSkills(
    SKILLS.map((skill) => ({
      userId,
      skill,
      skillGroup: getSkillGroup(skill),
      xp: 0,
      level: 1,
      createdAt: now,
      updatedAt: now,
    })),
  );

  await progressionRepository.createAttributePoints({
    userId,
    availablePoints: 0,
    totalEarned: 0,
    totalSpent: 0,
    createdAt: now,
    updatedAt: now,
  });
}

export async function getUserProgression(userId: number): Promise<ProgressionState> {
  await ensureUserProgression(userId);
  const attributes = await progressionRepository.listAttributes(userId);
  const attributePoints = await progressionRepository.findAttributePoints(userId);
  const skills = await progressionRepository.listSkills(userId);

  if (!attributePoints) {
    throw new Error("Attribute points not found after initialization.");
  }

  return {
    attributes: await Promise.all(attributes.map(enrichAttribute)),
    attributePoints,
    skills: await Promise.all(skills.map(enrichSkill)),
  };
}

export async function grantAttributeXp(
  userId: number,
  attribute: Attribute,
  xp: number,
): Promise<XpGrant> {
  assertPositiveXp(xp);
  await ensureUserProgression(userId);

  const currentAttribute = await progressionRepository.findAttribute(userId, attribute);

  if (!currentAttribute) {
    throw new Error(`Attribute not found after initialization: ${attribute}`);
  }

  const currentXp = currentAttribute.xp + xp;
  const levelProgress = calculateLevelProgress(currentXp, await getLevelRequirements());
  const updatedAt = new Date().toISOString();

  await progressionRepository.updateAttributeProgress(currentAttribute.id, {
    xp: currentXp,
    level: levelProgress.level,
    updatedAt,
  });

  return {
    xpGained: xp,
    previousXp: currentAttribute.xp,
    currentXp,
    previousLevel: currentAttribute.level,
    currentLevel: levelProgress.level,
    leveledUp: levelProgress.level > currentAttribute.level,
    xpForCurrentLevel: levelProgress.xpForCurrentLevel,
    xpForNextLevel: levelProgress.xpForNextLevel,
    xpRemainingToNextLevel: levelProgress.xpRemainingToNextLevel,
  };
}

export async function grantSkillXp(userId: number, skill: Skill, xp: number): Promise<XpGrant> {
  assertPositiveXp(xp);
  await ensureUserProgression(userId);

  const currentSkill = await progressionRepository.findSkill(userId, skill);

  if (!currentSkill) {
    throw new Error(`Skill not found after initialization: ${skill}`);
  }

  const currentXp = currentSkill.xp + xp;
  const levelProgress = calculateLevelProgress(currentXp, await getLevelRequirements());
  const updatedAt = new Date().toISOString();

  await progressionRepository.updateSkillProgress(currentSkill.id, {
    xp: currentXp,
    level: levelProgress.level,
    updatedAt,
  });

  const attributePointsGained = calculateAttributePointsForSkillLevels(
    currentSkill.level,
    levelProgress.level,
  );

  if (attributePointsGained > 0) {
    await progressionRepository.addAttributePoints(userId, attributePointsGained, updatedAt);
  }

  return {
    xpGained: xp,
    attributePointsGained,
    previousXp: currentSkill.xp,
    currentXp,
    previousLevel: currentSkill.level,
    currentLevel: levelProgress.level,
    leveledUp: levelProgress.level > currentSkill.level,
    xpForCurrentLevel: levelProgress.xpForCurrentLevel,
    xpForNextLevel: levelProgress.xpForNextLevel,
    xpRemainingToNextLevel: levelProgress.xpRemainingToNextLevel,
  };
}

export async function spendAttributePoints(
  userId: number,
  attribute: Attribute,
  levels = 1,
): Promise<AttributePointSpend> {
  assertPositiveLevels(levels);
  await ensureUserProgression(userId);

  const currentAttribute = await progressionRepository.findAttribute(userId, attribute);
  const currentPoints = await progressionRepository.findAttributePoints(userId);

  if (!currentAttribute) {
    throw new Error(`Attribute not found after initialization: ${attribute}`);
  }

  if (!currentPoints) {
    throw new Error("Attribute points not found after initialization.");
  }

  const targetLevel = currentAttribute.level + levels;

  if (targetLevel > MAX_LEVEL) {
    throw new Error(`Attribute cannot exceed level ${MAX_LEVEL}.`);
  }

  const cost = calculateAttributePointCost(currentAttribute.level, levels);

  if (currentPoints.availablePoints < cost) {
    throw new InsufficientAttributePointsError(cost, currentPoints.availablePoints);
  }

  const now = new Date().toISOString();
  const targetRequirement = getRequirementForLevel(targetLevel, await getLevelRequirements());
  await progressionRepository.spendAttributePoints(userId, cost, now);
  await progressionRepository.updateAttributeProgress(currentAttribute.id, {
    xp: Math.max(currentAttribute.xp, targetRequirement.xpRequired),
    level: targetLevel,
    updatedAt: now,
  });

  const attributePoints = await progressionRepository.findAttributePoints(userId);

  if (!attributePoints) {
    throw new Error("Attribute points not found after spending.");
  }

  return {
    attribute,
    levelsPurchased: levels,
    previousLevel: currentAttribute.level,
    currentLevel: targetLevel,
    cost,
    attributePoints,
  };
}

export async function applyActionProgressionRewards(
  userId: number,
  rewards: ActionProgressionRewards,
): Promise<AppliedActionProgressionRewards> {
  const appliedRewards: AppliedActionProgressionRewards = {
    attributes: {},
    skills: {},
  };

  for (const [attribute, xp] of Object.entries(rewards.attributes ?? {}) as Array<[Attribute, number]>) {
    appliedRewards.attributes[attribute] = await grantAttributeXp(userId, attribute, xp);
  }

  for (const [skill, xp] of Object.entries(rewards.skills ?? {}) as Array<[Skill, number]>) {
    appliedRewards.skills[skill] = await grantSkillXp(userId, skill, xp);
  }

  return appliedRewards;
}
