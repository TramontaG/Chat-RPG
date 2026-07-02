import {
  addItemToInventory,
  listInventoryItems,
  removeItemFromInventory,
  type AddInventoryItemResult,
} from "../inventory/inventory.service";
import {
  consumeActionModifiers,
  createActionModifier,
  listActiveActionModifiers,
} from "../action-modifiers/action-modifiers.service";
import type { UserActionModifierRow } from "../../database/schema";
import { getItemOrThrow, listItems, upsertItemDefinition } from "../items/items.service";
import {
  applyActionProgressionRewards,
  getUserProgression,
  type AppliedActionProgressionRewards,
} from "../progression/progression.service";
import { buildFishingItemDefinitions, getFishingItemId } from "./fishing.items";
import {
  FISHING_RANDOM_EVENTS,
  type FishingRandomEventDefinition,
  type FishingRandomEventProbability,
} from "./fishing.random-events";
import type { BaitEffects } from "../shop/bait.items";
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

type FishingLevels = {
  fishingLevel: number;
  dexterityLevel: number;
  luckLevel: number;
};

type FishingInventoryResult =
  | AddInventoryItemResult
  | {
      added: false;
      reason: "no_catch";
      itemId: null;
      quantity: 0;
      occupiedSlots: null;
      maxSlots: null;
    };

export type FishingRandomEventResult =
  | {
      occurred: false;
      event: null;
    }
  | {
      occurred: true;
      event: {
        id: FishingRandomEventDefinition["id"];
        name: string;
        type: FishingRandomEventDefinition["type"];
        effect: string;
        baseChance: number;
        luckScaling: number;
        effectiveChance: number;
        rollProbability: number;
        effectApplied: boolean;
      };
    };

export type FishingBaitUseResult = {
  itemId: string;
  name: string;
  effects: BaitEffects;
  consumed: number;
  gained: number;
};

export type FishingDropProbability = {
  itemId: string;
  name: string;
  category: FishingDropCategory;
  targetLevel: number;
  baseWeight: number;
  effectiveWeight: number;
  probabilityWithinCategory: number;
  probabilityPerFishingAttempt: number;
};

export type FishingQualityProbability = {
  quality: FishQualityDefinition["quality"];
  label: string;
  xpMultiplier: number;
  sellMultiplier: number;
  effectiveWeight: number;
  probability: number;
};

export type FishingProbabilities = {
  levels: FishingLevels;
  activeModifiers: UserActionModifierRow[];
  bait: null | {
    itemId: string;
    name: string;
    effects: BaitEffects;
  };
  categoryProbabilities: FishingCategoryProbabilities;
  drops: {
    fish: FishingDropProbability[];
    treasure: FishingDropProbability[];
    junk: FishingDropProbability[];
  };
  fishQualities: FishingQualityProbability[];
  randomEvents: {
    none: number;
    events: FishingRandomEventProbability[];
  };
};

export type FishingActionResult = {
  outcome: "caught" | "no_catch";
  bait: FishingBaitUseResult;
  category: FishingDropCategory;
  item: null | {
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
  randomEvent: FishingRandomEventResult;
  actionModifiers: {
    applied: UserActionModifierRow[];
    created: UserActionModifierRow[];
  };
  inventory: FishingInventoryResult;
  resultModifiers: {
    fishingLevel: number;
    dexterityLevel: number;
    luckLevel: number;
    categoryProbabilities: FishingCategoryProbabilities;
    randomEventProbabilities: FishingProbabilities["randomEvents"];
    curveWidth: number;
  };
  progression: AppliedActionProgressionRewards;
};

const FISHING_CURVE_WIDTH = 18;
const MIN_CURVE_FACTOR = 0.02;
const MIN_WEIGHT = 0.000001;
const QUALITY_WEIGHT_MULTIPLIER = 0.35;

export type FishingActionInput = {
  baitItemId?: string;
  baitName?: string;
};

export class FishingBaitRequiredError extends Error {
  constructor() {
    super("Fishing requires bait.");
    this.name = "FishingBaitRequiredError";
  }
}

export class FishingBaitAmbiguousError extends Error {
  constructor() {
    super("Multiple bait types found. Specify baitItemId or baitName.");
    this.name = "FishingBaitAmbiguousError";
  }
}

export class FishingBaitNotFoundError extends Error {
  constructor() {
    super("Bait not found in player inventory.");
    this.name = "FishingBaitNotFoundError";
  }
}

type FishingActionModifierEffects = {
  fishChanceMultiplier: number;
  efficiencyMultiplier: number;
  minimumQuality: FishQualityDefinition["quality"] | null;
  rareFishWeightBonus: number;
};

function getDefaultActionModifierEffects(): FishingActionModifierEffects {
  return {
    fishChanceMultiplier: 1,
    efficiencyMultiplier: 1,
    minimumQuality: null,
    rareFishWeightBonus: 0,
  };
}

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

export function calculateFishingCategoryProbabilities(
  luckLevel: number,
  baitEffects: BaitEffects = {},
): FishingCategoryProbabilities {
  const luckAboveBaseline = Math.max(0, luckLevel - 1);
  const junkToTreasureShift = Math.min(0.06, luckAboveBaseline * 0.00055);
  const junk = Math.max(0.001, 0.075 - junkToTreasureShift - (baitEffects.junkChanceReduction ?? 0));
  const treasure = Math.min(0.75, 0.025 + junkToTreasureShift * 0.75 + (baitEffects.treasureChanceBonus ?? 0));
  const fish = Math.max(0.001, 1 - junk - treasure);
  const total = fish + junk + treasure;

  return {
    fish: fish / total,
    junk: junk / total,
    treasure: treasure / total,
  };
}

export function calculateFishingRandomEventProbabilities(luckLevel: number): FishingProbabilities["randomEvents"] {
  const eventsWithEffectiveChance = FISHING_RANDOM_EVENTS.map((event) => ({
    ...event,
    effectiveChance: clamp(event.baseChance + event.luckScaling * luckLevel, 0, 1),
    rollProbability: 0,
  }));
  const totalEffectiveChance = eventsWithEffectiveChance.reduce(
    (sum, event) => sum + event.effectiveChance,
    0,
  );
  const normalizer = Math.max(1, totalEffectiveChance);
  const events = eventsWithEffectiveChance.map((event) => ({
    ...event,
    rollProbability: event.effectiveChance / normalizer,
  }));

  return {
    none: Math.max(0, 1 - totalEffectiveChance),
    events,
  };
}

export function calculateFishingDropWeight(
  entry: FishingDropEntry,
  levels: { fishingLevel: number; dexterityLevel: number; luckLevel: number },
  curveWidth = FISHING_CURVE_WIDTH,
  baitEffects: BaitEffects = {},
): number {
  const distance = levels.fishingLevel - entry.targetLevel;
  const curveFactor = Math.exp(-(distance * distance) / (2 * curveWidth * curveWidth));
  const neverImpossibleCurveFactor = MIN_CURVE_FACTOR + (1 - MIN_CURVE_FACTOR) * curveFactor;
  const targetLevelFactor = entry.targetLevel / 100;
  const dexterityBonus = Math.max(0, levels.dexterityLevel - 1) * 0.004 * targetLevelFactor;
  const luckBonus = Math.max(0, levels.luckLevel - 1) * 0.0025 * targetLevelFactor;
  const rareFishBonus = (baitEffects.rareFishWeightBonus ?? 0) * targetLevelFactor;

  return Math.max(
    MIN_WEIGHT,
    entry.baseWeight * neverImpossibleCurveFactor * (1 + dexterityBonus + luckBonus + rareFishBonus),
  );
}

function calculateDropProbabilitiesForCategory(
  category: FishingDropCategory,
  levels: FishingLevels,
  categoryProbability: number,
  baitEffects: BaitEffects = {},
): FishingDropProbability[] {
  const table = getTableForCategory(category);
  const weightedEntries = table.map((entry) => ({
    entry,
    weight: calculateFishingDropWeight(entry, levels, FISHING_CURVE_WIDTH, baitEffects),
  }));
  const totalWeight = weightedEntries.reduce((sum, entry) => sum + entry.weight, 0);

  return weightedEntries.map(({ entry, weight }) => {
    const probabilityWithinCategory = totalWeight <= 0 ? 0 : weight / totalWeight;

    return {
      itemId: getFishingItemId(entry, category),
      name: entry.item,
      category,
      targetLevel: entry.targetLevel,
      baseWeight: entry.baseWeight,
      effectiveWeight: Number(weight.toFixed(6)),
      probabilityWithinCategory,
      probabilityPerFishingAttempt: categoryProbability * probabilityWithinCategory,
    };
  });
}

function calculateFishQualityProbabilities(
  dexterityLevel: number,
  luckLevel: number,
): FishingQualityProbability[] {
  const weights = calculateFishQualityWeights(dexterityLevel, luckLevel);
  const totalWeight = weights.reduce((sum, quality) => sum + quality.weight, 0);

  return weights.map(({ value, weight }) => ({
    quality: value.quality,
    label: value.label,
    xpMultiplier: value.xpMultiplier,
    sellMultiplier: value.sellMultiplier,
    effectiveWeight: Number(weight.toFixed(6)),
    probability: totalWeight <= 0 ? 0 : weight / totalWeight,
  }));
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

function pickRandomEvent(
  probabilities: FishingProbabilities["randomEvents"],
  rng: Rng,
): FishingRandomEventResult {
  const options: WeightedOption<FishingRandomEventProbability | null>[] = [
    { value: null, weight: probabilities.none },
    ...probabilities.events.map((event) => ({
      value: event,
      weight: event.rollProbability,
    })),
  ];
  const picked = weightedPick(options, rng).value;

  if (picked === null) {
    return {
      occurred: false,
      event: null,
    };
  }

  return {
    occurred: true,
    event: {
      id: picked.id,
      name: picked.name,
      type: picked.type,
      effect: picked.effect,
      baseChance: picked.baseChance,
      luckScaling: picked.luckScaling,
      effectiveChance: picked.effectiveChance,
      rollProbability: picked.rollProbability,
      effectApplied: false,
    },
  };
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

function getMinimumQuality(
  quality: FishQualityDefinition,
  minimumQuality: FishQualityDefinition["quality"],
): FishQualityDefinition {
  const currentIndex = FISH_QUALITIES.findIndex((candidate) => candidate.quality === quality.quality);
  const minimumIndex = FISH_QUALITIES.findIndex((candidate) => candidate.quality === minimumQuality);

  return currentIndex >= minimumIndex ? quality : FISH_QUALITIES[minimumIndex] ?? quality;
}

function getProgressionFishingLevels(progression: Awaited<ReturnType<typeof getUserProgression>>): FishingLevels {
  return {
    fishingLevel: progression.skills.find((skill) => skill.skill === "fishing")?.level ?? 1,
    dexterityLevel:
      progression.attributes.find((attribute) => attribute.attribute === "dexterity")?.level ?? 1,
    luckLevel: progression.attributes.find((attribute) => attribute.attribute === "luck")?.level ?? 1,
  };
}

function parseBaitEffects(metadata: string): BaitEffects {
  const parsedMetadata = JSON.parse(metadata) as { baitEffects?: BaitEffects };

  return parsedMetadata.baitEffects ?? {};
}

function parseModifierPayload(modifier: UserActionModifierRow): Record<string, unknown> {
  return JSON.parse(modifier.payload) as Record<string, unknown>;
}

function getFishingActionModifierEffects(
  modifiers: UserActionModifierRow[],
): FishingActionModifierEffects {
  const effects = getDefaultActionModifierEffects();

  for (const modifier of modifiers) {
    const payload = parseModifierPayload(modifier);

    if (modifier.modifierType === "fish_chance_multiplier") {
      const multiplier = payload.multiplier;

      if (typeof multiplier === "number") {
        effects.fishChanceMultiplier *= multiplier;
      }
    }

    if (modifier.modifierType === "efficiency_multiplier") {
      const multiplier = payload.multiplier;

      if (typeof multiplier === "number") {
        effects.efficiencyMultiplier *= multiplier;
      }
    }

    if (modifier.modifierType === "minimum_fish_quality") {
      const quality = payload.quality;

      if (typeof quality === "string" && FISH_QUALITIES.some((candidate) => candidate.quality === quality)) {
        effects.minimumQuality = quality as FishQualityDefinition["quality"];
      }
    }

    if (modifier.modifierType === "rare_fish_weight_bonus") {
      const bonus = payload.bonus;

      if (typeof bonus === "number") {
        effects.rareFishWeightBonus += bonus;
      }
    }
  }

  return effects;
}

function applyFishChanceMultiplier(
  probabilities: FishingCategoryProbabilities,
  multiplier: number,
): FishingCategoryProbabilities {
  if (multiplier === 1) {
    return probabilities;
  }

  const fish = probabilities.fish * multiplier;
  const total = fish + probabilities.junk + probabilities.treasure;

  return {
    fish: fish / total,
    junk: probabilities.junk / total,
    treasure: probabilities.treasure / total,
  };
}

async function listUserBaitOptions(userId: number) {
  const [inventoryItems, itemDefinitions] = await Promise.all([listInventoryItems(userId), listItems()]);
  const baitItemsById = new Map(
    itemDefinitions
      .filter((item) => item.type === "bait" && item.status === "active")
      .map((item) => [item.id, item]),
  );
  const baitStacks = inventoryItems.filter((inventoryItem) => baitItemsById.has(inventoryItem.itemId));
  const baitOptionsByItemId = new Map<
    string,
    {
      itemId: string;
      name: string;
      quantity: number;
      effects: BaitEffects;
    }
  >();

  for (const stack of baitStacks) {
    const item = baitItemsById.get(stack.itemId);

    if (!item) {
      continue;
    }

    const existingOption = baitOptionsByItemId.get(item.id);
    const quantity = (existingOption?.quantity ?? 0) + stack.quantity;

    baitOptionsByItemId.set(item.id, {
      itemId: item.id,
      name: item.name,
      quantity,
      effects: parseBaitEffects(item.metadata),
    });
  }

  return [...baitOptionsByItemId.values()].filter((option) => option.quantity > 0);
}

async function resolveFishingBait(
  userId: number,
  input: FishingActionInput,
  required: boolean,
): Promise<null | {
  itemId: string;
  name: string;
  quantity: number;
  effects: BaitEffects;
}> {
  const baitOptions = await listUserBaitOptions(userId);
  let selectedBait:
    | {
        itemId: string;
        name: string;
        quantity: number;
        effects: BaitEffects;
      }
    | undefined;

  if (input.baitItemId) {
    selectedBait = baitOptions.find((bait) => bait.itemId === input.baitItemId);
  } else if (input.baitName) {
    const normalizedName = input.baitName.trim().toLowerCase();
    selectedBait = baitOptions.find((bait) => bait.name.toLowerCase() === normalizedName);
  } else if (baitOptions.length === 1) {
    selectedBait = baitOptions[0];
  } else if (baitOptions.length > 1 && required) {
    throw new FishingBaitAmbiguousError();
  }

  if (!selectedBait && required) {
    if (baitOptions.length === 0) {
      throw new FishingBaitRequiredError();
    }

    throw new FishingBaitNotFoundError();
  }

  return selectedBait ?? null;
}

async function applyBaitConsumption(
  userId: number,
  bait: { itemId: string; name: string; quantity: number; effects: BaitEffects },
  eventId: FishingRandomEventDefinition["id"] | undefined,
): Promise<FishingBaitUseResult> {
  let consumed = 1;
  let gained = 0;

  if (eventId === "bait_recovered") {
    consumed = 0;
  }

  if (eventId === "bait_stolen") {
    consumed = Math.min(2, bait.quantity);
  }

  if (consumed > 0) {
    const removed = await removeItemFromInventory(userId, bait.itemId, consumed);

    if (!removed) {
      throw new FishingBaitNotFoundError();
    }
  }

  if (eventId === "bonus_bait") {
    gained = 1;
    await addItemToInventory(userId, bait.itemId, 1);
  }

  return {
    itemId: bait.itemId,
    name: bait.name,
    effects: bait.effects,
    consumed,
    gained,
  };
}

async function createFutureFishingModifiersForEvent(
  userId: number,
  eventId: FishingRandomEventDefinition["id"] | undefined,
): Promise<UserActionModifierRow[]> {
  if (eventId === "favorable_current") {
    return [
      await createActionModifier({
        userId,
        source: "fishing_random_event:favorable_current",
        action: "fish",
        modifierType: "fish_chance_multiplier",
        payload: {
          multiplier: 1.2,
        },
        remainingUses: 1,
      }),
    ];
  }

  if (eventId === "snagged_rod") {
    return [
      await createActionModifier({
        userId,
        source: "fishing_random_event:snagged_rod",
        action: "fish",
        modifierType: "efficiency_multiplier",
        payload: {
          multiplier: 0.8,
        },
        remainingUses: 1,
      }),
    ];
  }

  if (eventId === "golden_line") {
    return [
      await createActionModifier({
        userId,
        source: "fishing_random_event:golden_line",
        action: "fish",
        modifierType: "minimum_fish_quality",
        payload: {
          quality: "excellent",
        },
        remainingUses: 1,
      }),
    ];
  }

  if (eventId === "abyssal_shadow") {
    return [
      await createActionModifier({
        userId,
        source: "fishing_random_event:abyssal_shadow",
        action: "fish",
        modifierType: "rare_fish_weight_bonus",
        payload: {
          bonus: 0.8,
        },
        remainingUses: 1,
      }),
    ];
  }

  return [];
}

export async function getFishingProbabilities(
  userId: number,
  input: FishingActionInput = {},
): Promise<FishingProbabilities> {
  const progression = await getUserProgression(userId);
  const levels = getProgressionFishingLevels(progression);
  const bait = await resolveFishingBait(userId, input, false);
  const activeModifiers = await listActiveActionModifiers(userId, "fish");
  const actionModifierEffects = getFishingActionModifierEffects(activeModifiers);
  const baitEffects = bait?.effects ?? {};
  const categoryProbabilities = applyFishChanceMultiplier(
    calculateFishingCategoryProbabilities(levels.luckLevel, baitEffects),
    actionModifierEffects.fishChanceMultiplier,
  );
  const combinedBaitEffects = {
    ...baitEffects,
    rareFishWeightBonus:
      (baitEffects.rareFishWeightBonus ?? 0) + actionModifierEffects.rareFishWeightBonus,
  };

  return {
    levels,
    activeModifiers,
    bait:
      bait === null
        ? null
        : {
            itemId: bait.itemId,
            name: bait.name,
            effects: bait.effects,
          },
    categoryProbabilities,
    drops: {
      fish: calculateDropProbabilitiesForCategory("fish", levels, categoryProbabilities.fish, combinedBaitEffects),
      treasure: calculateDropProbabilitiesForCategory(
        "treasure",
        levels,
        categoryProbabilities.treasure,
        combinedBaitEffects,
      ),
      junk: calculateDropProbabilitiesForCategory("junk", levels, categoryProbabilities.junk, combinedBaitEffects),
    },
    fishQualities: calculateFishQualityProbabilities(
      levels.dexterityLevel + (baitEffects.qualityLevelBonus ?? 0),
      levels.luckLevel,
    ),
    randomEvents: calculateFishingRandomEventProbabilities(levels.luckLevel),
  };
}

export async function performFishingAction(
  userId: number,
  input: FishingActionInput = {},
  rng: Rng = Math.random,
): Promise<FishingActionResult> {
  const progression = await getUserProgression(userId);
  const { fishingLevel, dexterityLevel, luckLevel } = getProgressionFishingLevels(progression);
  const activeModifiers = await listActiveActionModifiers(userId, "fish");
  const actionModifierEffects = getFishingActionModifierEffects(activeModifiers);
  const bait = await resolveFishingBait(userId, input, true);

  if (!bait) {
    throw new FishingBaitRequiredError();
  }

  await ensureFishingItemDefinitions();

  const baitEffects = {
    ...bait.effects,
    rareFishWeightBonus:
      (bait.effects.rareFishWeightBonus ?? 0) + actionModifierEffects.rareFishWeightBonus,
  };
  const categoryProbabilities = applyFishChanceMultiplier(
    calculateFishingCategoryProbabilities(luckLevel, baitEffects),
    actionModifierEffects.fishChanceMultiplier,
  );
  const randomEventProbabilities = calculateFishingRandomEventProbabilities(luckLevel);
  const randomEvent = pickRandomEvent(randomEventProbabilities, rng);
  const eventId = randomEvent.event?.id;
  const baitUse = await applyBaitConsumption(userId, bait, eventId);
  const markRandomEventApplied = () => {
    if (randomEvent.occurred) {
      randomEvent.event.effectApplied = true;
    }
  };
  let category = pickCategory(categoryProbabilities, rng);

  if (eventId === "junk_on_hook") {
    category = "junk";
    markRandomEventApplied();
  }

  const table = getTableForCategory(category);
  const weightedEntries = table.map((entry) => ({
    value: entry,
    weight: calculateFishingDropWeight(
      entry,
      { fishingLevel, dexterityLevel, luckLevel },
      FISHING_CURVE_WIDTH,
      baitEffects,
    ),
  }));
  const pickedEntry = weightedPick(weightedEntries, rng);
  const itemId = getFishingItemId(pickedEntry.value, category);
  let quality: FishQualityDefinition | null = null;
  let fishWeight: ReturnType<typeof rollFishWeight> | null = null;
  let quantity = 1;
  let xpModifier = actionModifierEffects.efficiencyMultiplier;
  let sellModifier = actionModifierEffects.efficiencyMultiplier;
  let noCatch = false;
  let escaped = false;

  if (category === "fish") {
    quality = weightedPick(
      calculateFishQualityWeights(dexterityLevel + (baitEffects.qualityLevelBonus ?? 0), luckLevel),
      rng,
    ).value;

    if (eventId === "perfect_bite") {
      quality = getMinimumQuality(quality, "good");
      markRandomEventApplied();
    }

    if (actionModifierEffects.minimumQuality) {
      quality = getMinimumQuality(quality, actionModifierEffects.minimumQuality);
    }

    fishWeight = rollFishWeight(pickedEntry.value, quality, rng);
    fishWeight = {
      ...fishWeight,
      value: Number((fishWeight.value * (baitEffects.fishWeightMultiplier ?? 1)).toFixed(2)),
      multiplier: Number((fishWeight.multiplier * (baitEffects.fishWeightMultiplier ?? 1)).toFixed(3)),
    };
  }

  if (eventId === "line_snapped") {
    noCatch = true;
    markRandomEventApplied();
  }

  if (eventId === "fish_escaped") {
    noCatch = true;
    escaped = true;
    markRandomEventApplied();
  }

  if (eventId === "sudden_storm") {
    xpModifier *= 0.5;
    markRandomEventApplied();
  }

  if (eventId === "crystal_clear_water") {
    xpModifier *= 1.25;
    markRandomEventApplied();
  }

  if (eventId === "lake_blessing") {
    xpModifier *= 2;
    sellModifier *= 2;
    markRandomEventApplied();
  }

  if (eventId === "big_fish" && category === "fish") {
    sellModifier *= 1.3;
    markRandomEventApplied();
  }

  if (eventId === "double_fish" && category === "fish") {
    quantity = 2;
    markRandomEventApplied();
  }

  const xpMultiplier = quality?.xpMultiplier ?? 1;
  const sellMultiplier = quality?.sellMultiplier ?? 1;
  const fishWeightMultiplier = fishWeight?.multiplier ?? 1;
  const baseXpGained = pickedEntry.value.xp * xpMultiplier * xpModifier * (baitEffects.xpMultiplier ?? 1);
  const xpGained = noCatch && !escaped ? 0 : Math.max(1, Math.round(baseXpGained * (escaped ? 0.25 : 1)));
  const sellValue = noCatch
    ? 0
    : Math.max(
        0,
        Math.round(pickedEntry.value.sellValue * sellMultiplier * fishWeightMultiplier * sellModifier),
      );
  const inventory: FishingInventoryResult = noCatch
    ? {
        added: false,
        reason: "no_catch",
        itemId: null,
        quantity: 0,
        occupiedSlots: null,
        maxSlots: null,
      }
    : await addItemToInventory(userId, itemId, quantity, {
        source: "fishing",
        category,
        quality: quality?.quality ?? null,
        qualityLabel: quality?.label ?? null,
        fishWeight,
        sellValue,
        xpGained,
        randomEvent: randomEvent.event,
        caughtAt: new Date().toISOString(),
      });
  const rewards = {
    skills: xpGained > 0 ? { fishing: xpGained } : {},
    attributes:
      xpGained > 0
        ? {
            dexterity: category === "fish" ? Math.max(1, Math.round(xpGained * 0.2)) : 1,
            luck: category === "treasure" ? Math.max(1, Math.round(xpGained * 0.1)) : 1,
          }
        : {},
  };
  const progressionRewards = await applyActionProgressionRewards(userId, {
    skills: rewards.skills,
    attributes: rewards.attributes,
  });
  await consumeActionModifiers(activeModifiers);
  const createdActionModifiers = await createFutureFishingModifiersForEvent(userId, eventId);

  if (createdActionModifiers.length > 0) {
    markRandomEventApplied();
  }

  return {
    outcome: noCatch ? "no_catch" : "caught",
    bait: baitUse,
    category,
    item:
      noCatch && !escaped
        ? null
        : {
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
    randomEvent,
    actionModifiers: {
      applied: activeModifiers,
      created: createdActionModifiers,
    },
    inventory,
    resultModifiers: {
      fishingLevel,
      dexterityLevel,
      luckLevel,
      categoryProbabilities,
      randomEventProbabilities,
      curveWidth: FISHING_CURVE_WIDTH,
    },
    progression: progressionRewards,
  };
}
