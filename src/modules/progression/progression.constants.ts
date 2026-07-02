import type { Attribute, Skill, SkillGroup } from "../../database/schema";

export const MAX_LEVEL = 100;
export const LEVEL_2_XP_REQUIRED = 100;
export const START_XP_REQUIRED_MULTIPLIER = 1.05;
export const END_XP_REQUIRED_MULTIPLIER = 1.08;
export const XP_REQUIRED_CURVE = 1.5;

export const ATTRIBUTES: Attribute[] = [
  "strength",
  "vitality",
  "dexterity",
  "intelligence",
  "luck",
];

export const SKILL_GROUPS = {
  gathering: ["fishing", "woodcutting", "mining", "farming"],
  processing: ["cooking", "smithing", "crafting", "archaeology"],
  combat: ["melee", "ranged", "magic"],
  wizardry: ["runemaking", "alchemy", "potionbrewing"],
} as const satisfies Record<SkillGroup, readonly Skill[]>;

export const SKILLS: Skill[] = Object.values(SKILL_GROUPS).flat();

export function getSkillGroup(skill: Skill): SkillGroup {
  for (const [skillGroup, skills] of Object.entries(SKILL_GROUPS)) {
    if ((skills as readonly Skill[]).includes(skill)) {
      return skillGroup as SkillGroup;
    }
  }

  throw new Error(`Unknown skill: ${skill}`);
}

export type ProgressionLevelRequirementDefinition = {
  level: number;
  xpRequired: number;
  multiplier: number;
};

export function expRequiredMultiplier(
  level: number,
  maxLevel: number,
  startMultiplier: number,
  endMultiplier: number,
  curve = 1.5,
): number {
  const t = (level - 1) / (maxLevel - 1);

  return startMultiplier + (endMultiplier - startMultiplier) * Math.pow(t, curve);
}

export function buildProgressionLevelRequirements(
  maxLevel = MAX_LEVEL,
): ProgressionLevelRequirementDefinition[] {
  const requirements: ProgressionLevelRequirementDefinition[] = [
    {
      level: 1,
      xpRequired: 0,
      multiplier: 1,
    },
  ];

  for (let level = 2; level <= maxLevel; level += 1) {
    const multiplier = expRequiredMultiplier(
      level,
      maxLevel,
      START_XP_REQUIRED_MULTIPLIER,
      END_XP_REQUIRED_MULTIPLIER,
      XP_REQUIRED_CURVE,
    );
    const previousRequirement = requirements[level - 2]?.xpRequired ?? LEVEL_2_XP_REQUIRED;
    const xpRequired =
      level === 2 ? LEVEL_2_XP_REQUIRED : Math.ceil(previousRequirement * multiplier);

    requirements.push({
      level,
      xpRequired,
      multiplier,
    });
  }

  return requirements;
}
