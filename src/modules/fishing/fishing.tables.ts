export type FishingDropCategory = "fish" | "treasure" | "junk";

export type FishingDropEntry = {
  item: string;
  targetLevel: number;
  baseWeight: number;
  xp: number;
  sellValue: number;
};

export const FISHING_FISH_TABLE: FishingDropEntry[] = [
  { item: "Lambari", targetLevel: 1, baseWeight: 500, xp: 5, sellValue: 4 },
  { item: "Tilápia", targetLevel: 5, baseWeight: 350, xp: 8, sellValue: 7 },
  { item: "Sardinha", targetLevel: 10, baseWeight: 250, xp: 10, sellValue: 10 },
  { item: "Traíra", targetLevel: 15, baseWeight: 160, xp: 14, sellValue: 15 },
  { item: "Bagre", targetLevel: 20, baseWeight: 120, xp: 20, sellValue: 24 },
  { item: "Tucunaré", targetLevel: 30, baseWeight: 70, xp: 28, sellValue: 35 },
  { item: "Dourado", targetLevel: 40, baseWeight: 40, xp: 42, sellValue: 60 },
  { item: "Salmão", targetLevel: 50, baseWeight: 25, xp: 60, sellValue: 95 },
  { item: "Pirarucu", targetLevel: 60, baseWeight: 12, xp: 82, sellValue: 140 },
  { item: "Atum", targetLevel: 70, baseWeight: 7, xp: 115, sellValue: 210 },
  { item: "Espadarte", targetLevel: 80, baseWeight: 3, xp: 155, sellValue: 320 },
  { item: "Tubarão", targetLevel: 90, baseWeight: 1, xp: 220, sellValue: 500 },
  { item: "Peixe Abissal", targetLevel: 97, baseWeight: 0.25, xp: 340, sellValue: 900 },
  { item: "Leviatã Jovem", targetLevel: 100, baseWeight: 0.05, xp: 650, sellValue: 2500 },
];

export const FISHING_TREASURE_TABLE: FishingDropEntry[] = [
  { item: "Baú Pequeno", targetLevel: 10, baseWeight: 4, xp: 25, sellValue: 300 },
  { item: "Pérola", targetLevel: 25, baseWeight: 2, xp: 40, sellValue: 600 },
  { item: "Garrafa com Mapa", targetLevel: 35, baseWeight: 1, xp: 60, sellValue: 0 },
  { item: "Colar Antigo", targetLevel: 55, baseWeight: 0.6, xp: 90, sellValue: 1200 },
  { item: "Pérola Negra", targetLevel: 70, baseWeight: 0.35, xp: 120, sellValue: 1800 },
  { item: "Relíquia Submersa", targetLevel: 85, baseWeight: 0.15, xp: 180, sellValue: 2500 },
  { item: "Chave Misteriosa", targetLevel: 95, baseWeight: 0.08, xp: 250, sellValue: 0 },
  { item: "Artefato do Leviatã", targetLevel: 100, baseWeight: 0.02, xp: 500, sellValue: 7500 },
];

export const FISHING_JUNK_TABLE: FishingDropEntry[] = [
  { item: "Alga", targetLevel: 1, baseWeight: 120, xp: 2, sellValue: 1 },
  { item: "Bota Velha", targetLevel: 1, baseWeight: 80, xp: 1, sellValue: 1 },
  { item: "Lata Enferrujada", targetLevel: 1, baseWeight: 60, xp: 1, sellValue: 2 },
  { item: "Graveto Molhado", targetLevel: 5, baseWeight: 50, xp: 1, sellValue: 1 },
  { item: "Garrafa Vazia", targetLevel: 8, baseWeight: 35, xp: 1, sellValue: 3 },
  { item: "Rede Rasgada", targetLevel: 15, baseWeight: 20, xp: 2, sellValue: 5 },
  { item: "Pneu Velho", targetLevel: 25, baseWeight: 10, xp: 3, sellValue: 10 },
  { item: "Âncora Quebrada", targetLevel: 40, baseWeight: 4, xp: 5, sellValue: 25 },
];

export const FISH_QUALITY_VALUES = [
  "poor",
  "common",
  "good",
  "excellent",
  "perfect",
  "legendary",
] as const;

export type FishQuality = (typeof FISH_QUALITY_VALUES)[number];

export type FishQualityDefinition = {
  quality: FishQuality;
  label: string;
  xpMultiplier: number;
  sellMultiplier: number;
  baseWeight: number;
};

export const FISH_QUALITIES: FishQualityDefinition[] = [
  { quality: "poor", label: "Ruim", xpMultiplier: 0.75, sellMultiplier: 0.6, baseWeight: 18 },
  { quality: "common", label: "Comum", xpMultiplier: 1, sellMultiplier: 1, baseWeight: 55 },
  { quality: "good", label: "Boa", xpMultiplier: 1.25, sellMultiplier: 1.35, baseWeight: 20 },
  {
    quality: "excellent",
    label: "Excelente",
    xpMultiplier: 1.6,
    sellMultiplier: 1.8,
    baseWeight: 6,
  },
  { quality: "perfect", label: "Perfeita", xpMultiplier: 2.25, sellMultiplier: 2.75, baseWeight: 0.9 },
  {
    quality: "legendary",
    label: "Lendária",
    xpMultiplier: 4,
    sellMultiplier: 6,
    baseWeight: 0.1,
  },
];
