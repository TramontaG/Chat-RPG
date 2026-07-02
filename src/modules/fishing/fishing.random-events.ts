export const FISHING_RANDOM_EVENT_TYPES = ["good", "bad"] as const;
export type FishingRandomEventType = (typeof FISHING_RANDOM_EVENT_TYPES)[number];

export const FISHING_RANDOM_EVENT_IDS = [
  "bait_recovered",
  "bonus_bait",
  "big_fish",
  "double_fish",
  "small_school",
  "perfect_bite",
  "crystal_clear_water",
  "hooked_treasure",
  "favorable_current",
  "rare_fish_spotted",
  "hidden_pearl",
  "lake_blessing",
  "line_snapped",
  "fish_escaped",
  "bait_stolen",
  "junk_on_hook",
  "snagged_rod",
  "sudden_storm",
  "golden_line",
  "abyssal_shadow",
] as const;

export type FishingRandomEventId = (typeof FISHING_RANDOM_EVENT_IDS)[number];

export type FishingRandomEventDefinition = {
  id: FishingRandomEventId;
  name: string;
  type: FishingRandomEventType;
  baseChance: number;
  luckScaling: number;
  effect: string;
};

export type FishingRandomEventProbability = FishingRandomEventDefinition & {
  effectiveChance: number;
  rollProbability: number;
};

export const FISHING_RANDOM_EVENTS: FishingRandomEventDefinition[] = [
  {
    id: "bait_recovered",
    name: "Isca recuperada",
    type: "good",
    baseChance: 0.08,
    luckScaling: 0.005,
    effect: "Não consome isca nessa tentativa",
  },
  {
    id: "bonus_bait",
    name: "Isca bônus",
    type: "good",
    baseChance: 0.04,
    luckScaling: 0.007,
    effect: "Ganha +1 isca",
  },
  {
    id: "big_fish",
    name: "Peixe grande",
    type: "good",
    baseChance: 0.05,
    luckScaling: 0.004,
    effect: "Peixe recebe +30% valor de venda",
  },
  {
    id: "double_fish",
    name: "Peixe em dobro",
    type: "good",
    baseChance: 0.03,
    luckScaling: 0.005,
    effect: "Recebe 2 unidades do peixe pescado",
  },
  {
    id: "small_school",
    name: "Cardume pequeno",
    type: "good",
    baseChance: 0.015,
    luckScaling: 0.007,
    effect: "Recebe +2 peixes comuns extras",
  },
  {
    id: "perfect_bite",
    name: "Mordida perfeita",
    type: "good",
    baseChance: 0.02,
    luckScaling: 0.008,
    effect: "Força qualidade mínima Boa",
  },
  {
    id: "crystal_clear_water",
    name: "Água cristalina",
    type: "good",
    baseChance: 0.012,
    luckScaling: 0.008,
    effect: "+25% XP nessa pesca",
  },
  {
    id: "hooked_treasure",
    name: "Tesouro fisgado",
    type: "good",
    baseChance: 0.008,
    luckScaling: 0.002,
    effect: "Rola um tesouro adicional",
  },
  {
    id: "favorable_current",
    name: "Corrente favorável",
    type: "good",
    baseChance: 0.007,
    luckScaling: 0.008,
    effect: "Próxima pesca tem +20% chance de peixe",
  },
  {
    id: "rare_fish_spotted",
    name: "Peixe raro avistado",
    type: "good",
    baseChance: 0.01,
    luckScaling: 0.0005,
    effect: "Re-rola o drop favorecendo peixes raros",
  },
  {
    id: "hidden_pearl",
    name: "Pérola escondida",
    type: "good",
    baseChance: 0.025,
    luckScaling: 0.002,
    effect: "Ganha uma pérola ou material raro",
  },
  {
    id: "lake_blessing",
    name: "Benção do lago",
    type: "good",
    baseChance: 0.01,
    luckScaling: 0.001,
    effect: "+100% XP e +100% venda nessa pesca",
  },
  {
    id: "line_snapped",
    name: "Linha arrebentou",
    type: "bad",
    baseChance: 0.05,
    luckScaling: -0.0007,
    effect: "Perde a isca e não pega nada",
  },
  {
    id: "fish_escaped",
    name: "Peixe escapou",
    type: "bad",
    baseChance: 0.04,
    luckScaling: -0.0006,
    effect: "Pega nada, mas ganha 25% da XP",
  },
  {
    id: "bait_stolen",
    name: "Isca roubada",
    type: "bad",
    baseChance: 0.03,
    luckScaling: -0.0008,
    effect: "Perde +1 isca extra",
  },
  {
    id: "junk_on_hook",
    name: "Lixo preso no anzol",
    type: "bad",
    baseChance: 0.03,
    luckScaling: -0.0005,
    effect: "Substitui o drop por junk",
  },
  {
    id: "snagged_rod",
    name: "Vara enroscada",
    type: "bad",
    baseChance: 0.015,
    luckScaling: -0.0007,
    effect: "Próxima pesca tem -20% eficiência",
  },
  {
    id: "sudden_storm",
    name: "Tempestade repentina",
    type: "bad",
    baseChance: 0.005,
    luckScaling: -0.0008,
    effect: "Perde isca e recebe -50% XP",
  },
  {
    id: "golden_line",
    name: "Linha dourada",
    type: "good",
    baseChance: 0.0008,
    luckScaling: 0.0005,
    effect: "Próximo peixe terá qualidade mínima Excelente",
  },
  {
    id: "abyssal_shadow",
    name: "Sombra abissal",
    type: "good",
    baseChance: 0.0002,
    luckScaling: 0.0001,
    effect: "Rola uma chance extra de peixe lendário",
  },
];
