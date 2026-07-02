import { addItemToInventory, type AddInventoryItemResult } from "../inventory/inventory.service";
import { upsertItemDefinition } from "../items/items.service";
import {
  applyActionProgressionRewards,
  getUserProgression,
  type AppliedActionProgressionRewards,
} from "../progression/progression.service";
import { buildFishingItemDefinitions, getFishingItemId } from "./fishing.items";
import {
  FISHING_FISH_TABLE,
  FISHING_JUNK_TABLE,
  FISHING_TREASURE_TABLE,
  FISH_QUALITIES,
  type FishQualityDefinition,
  type FishingDropCategory,
  type FishingDropEntry,
} from "./fishing.tables";

type Rng = () => number;

type WeightedOption<T> = {
  value: T;
  weight: number;
};

export type FishingCategoryProbabilities = Record<FishingDropCategory, number>;

export type FishingActionResult = {
  category: FishingDropCategory;
  item: {
    id: string;
    name: string;
    targetLevel: number;
    baseXp: number;
    xpGained: number;
    baseSellValue: number;
    sellValue: number;
    baseWeight: number;
    effectiveWeight: number;
  };
  quality: null | {
    value: FishQualityDefinition["quality"];
    label: string;
    xpMultiplier: number;
    sellMultiplier: number;
  };
  fishWeight: null | {
    value: number;
    unit: "kg";
    multiplier: number;
  };
  inventory: AddInventoryItemResult;
  resultModifiers: {
    fishingLevel: number;
    dexterityLevel: number;
    luckLevel: number;
    categoryProbabilities: FishingCategoryProbabilities;
    curveWidth: number;
  };
  progression: AppliedActionProgressionRewards;
};

const FISHING_CURVE_WIDTH = 18;
const MIN_CURVE_FACTOR = 0.02;
const MIN_WEIGHT = 0.000001;
const QUALITY_WEIGHT_MULTIPLIER = 0.35;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function weightedPick<T>(options: WeightedOption<T>[], rng: Rng): WeightedOption<T> {
  const totalWeight = options.reduce((sum, option) => sum + option.weight, 0);
  let roll = rng() * totalWeight;

  for (const option of options) {
    roll -= option.weight;

    if (roll <= 0) {
      return option;
    }
  }

  const fallback = options[options.length - 1];

  if (!fallback) {
    throw new Error("Cannot pick from an empty weighted table.");
  }

  return fallback;
}

export function calculateFishingCategoryProbabilities(luckLevel: number): FishingCategoryProbabilities {
  const luckAboveBaseline = Math.max(0, luckLevel - 1);
  const junkToTreasureShift = Math.min(0.06, luckAboveBaseline * 0.00055);
  const junk = Math.max(0.005, 0.075 - junkToTreasureShift);
  const treasure = 0.025 + junkToTreasureShift * 0.75;

  return {
    fish: 1 - junk - treasure,
    junk,
    treasure,
  };
}

export function calculateFishingDropWeight(
  entry: FishingDropEntry,
  levels: { fishingLevel: number; dexterityLevel: number; luckLevel: number },
  curveWidth = FISHING_CURVE_WIDTH,
): number {
  const distance = levels.fishingLevel - entry.targetLevel;
  const curveFactor = Math.exp(-(distance * distance) / (2 * curveWidth * curveWidth));
  const neverImpossibleCurveFactor = MIN_CURVE_FACTOR + (1 - MIN_CURVE_FACTOR) * curveFactor;
  const targetLevelFactor = entry.targetLevel / 100;
  const dexterityBonus = Math.max(0, levels.dexterityLevel - 1) * 0.004 * targetLevelFactor;
  const luckBonus = Math.max(0, levels.luckLevel - 1) * 0.0025 * targetLevelFactor;

  return Math.max(
    MIN_WEIGHT,
    entry.baseWeight * neverImpossibleCurveFactor * (1 + dexterityBonus + luckBonus),
  );
}

export function calculateFishQualityWeights(
  dexterityLevel: number,
  luckLevel: number,
): WeightedOption<FishQualityDefinition>[] {
  const dexterityFactor = Math.max(0, dexterityLevel - 1) / 99;
  const luckFactor = Math.max(0, luckLevel - 1) / 99;

  return FISH_QUALITIES.map((quality, index) => {
    if (index === 0) {
      const badOutcomeProtection = 1 + dexterityFactor * 1.25 + luckFactor * 2;
      return {
        value: quality,
        weight: Math.max(MIN_WEIGHT, quality.baseWeight / badOutcomeProtection),
      };
    }

    const tier = index / (FISH_QUALITIES.length - 1);
    const dexterityBonus = dexterityFactor * index * 2.4;
    const highQualityLuckBonus = luckFactor * Math.pow(index, 2.25) * 1.7;

    return {
      value: quality,
      weight: Math.max(
        MIN_WEIGHT,
        quality.baseWeight * (1 + dexterityBonus + highQualityLuckBonus) * (1 + tier * QUALITY_WEIGHT_MULTIPLIER),
      ),
    };
  });
}

function getTableForCategory(category: FishingDropCategory): FishingDropEntry[] {
  if (category === "fish") {
    return FISHING_FISH_TABLE;
  }

  if (category === "treasure") {
    return FISHING_TREASURE_TABLE;
  }

  return FISHING_JUNK_TABLE;
}

async function ensureFishingItemDefinitions(): Promise<void> {
  await Promise.all(buildFishingItemDefinitions().map(upsertItemDefinition));
}

function pickCategory(probabilities: FishingCategoryProbabilities, rng: Rng): FishingDropCategory {
  const categories: WeightedOption<FishingDropCategory>[] = [
    { value: "fish", weight: probabilities.fish },
    { value: "junk", weight: probabilities.junk },
    { value: "treasure", weight: probabilities.treasure },
  ];

  return weightedPick(categories, rng).value;
}

function rollFishWeight(entry: FishingDropEntry, quality: FishQualityDefinition, rng: Rng) {
  const targetLevelWeightBonus = 1 + entry.targetLevel / 150;
  const qualityWeightBonus = 1 + FISH_QUALITIES.indexOf(quality) * 0.09;
  const lowVarianceRoll = 0.75 + rng() * 0.65;
  const multiplier = Number((targetLevelWeightBonus * qualityWeightBonus * lowVarianceRoll).toFixed(3));

  return {
    value: Number(Math.max(0.1, multiplier * (0.2 + entry.targetLevel / 12)).toFixed(2)),
    unit: "kg" as const,
    multiplier,
  };
}

export async function performFishingAction(userId: number, rng: Rng = Math.random): Promise<FishingActionResult> {
  await ensureFishingItemDefinitions();

  const progression = await getUserProgression(userId);
  const fishingLevel = progression.skills.find((skill) => skill.skill === "fishing")?.level ?? 1;
  const dexterityLevel =
    progression.attributes.find((attribute) => attribute.attribute === "dexterity")?.level ?? 1;
  const luckLevel = progression.attributes.find((attribute) => attribute.attribute === "luck")?.level ?? 1;
  const categoryProbabilities = calculateFishingCategoryProbabilities(luckLevel);
  const category = pickCategory(categoryProbabilities, rng);
  const table = getTableForCategory(category);
  const weightedEntries = table.map((entry) => ({
    value: entry,
    weight: calculateFishingDropWeight(entry, { fishingLevel, dexterityLevel, luckLevel }),
  }));
  const pickedEntry = weightedPick(weightedEntries, rng);
  const itemId = getFishingItemId(pickedEntry.value, category);
  let quality: FishQualityDefinition | null = null;
  let fishWeight: ReturnType<typeof rollFishWeight> | null = null;

  if (category === "fish") {
    quality = weightedPick(calculateFishQualityWeights(dexterityLevel, luckLevel), rng).value;
    fishWeight = rollFishWeight(pickedEntry.value, quality, rng);
  }

  const xpMultiplier = quality?.xpMultiplier ?? 1;
  const sellMultiplier = quality?.sellMultiplier ?? 1;
  const fishWeightMultiplier = fishWeight?.multiplier ?? 1;
  const xpGained = Math.max(1, Math.round(pickedEntry.value.xp * xpMultiplier));
  const sellValue = Math.max(0, Math.round(pickedEntry.value.sellValue * sellMultiplier * fishWeightMultiplier));
  const inventory = await addItemToInventory(userId, itemId, 1, {
    source: "fishing",
    category,
    quality: quality?.quality ?? null,
    qualityLabel: quality?.label ?? null,
    fishWeight,
    sellValue,
    xpGained,
    caughtAt: new Date().toISOString(),
  });
  const progressionRewards = await applyActionProgressionRewards(userId, {
    skills: {
      fishing: xpGained,
    },
    attributes: {
      dexterity: category === "fish" ? Math.max(1, Math.round(xpGained * 0.2)) : 1,
      luck: category === "treasure" ? Math.max(1, Math.round(xpGained * 0.1)) : 1,
    },
  });

  return {
    category,
    item: {
      id: itemId,
      name: pickedEntry.value.item,
      targetLevel: pickedEntry.value.targetLevel,
      baseXp: pickedEntry.value.xp,
      xpGained,
      baseSellValue: pickedEntry.value.sellValue,
      sellValue,
      baseWeight: pickedEntry.value.baseWeight,
      effectiveWeight: Number(pickedEntry.weight.toFixed(6)),
    },
    quality:
      quality === null
        ? null
        : {
            value: quality.quality,
            label: quality.label,
            xpMultiplier: quality.xpMultiplier,
            sellMultiplier: quality.sellMultiplier,
          },
    fishWeight,
    inventory,
    resultModifiers: {
      fishingLevel,
      dexterityLevel,
      luckLevel,
      categoryProbabilities,
      curveWidth: FISHING_CURVE_WIDTH,
    },
    progression: progressionRewards,
  };
}
