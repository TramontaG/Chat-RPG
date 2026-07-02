import type { NewItemRow } from "../../database/schema";

export type BaitEffects = {
  treasureChanceBonus?: number;
  junkChanceReduction?: number;
  fishWeightMultiplier?: number;
  qualityLevelBonus?: number;
  rareFishWeightBonus?: number;
  xpMultiplier?: number;
};

export type BaitDefinition = {
  id: string;
  name: string;
  description: string;
  buyPrice: number;
  effects: BaitEffects;
};

export const BAIT_DEFINITIONS: BaitDefinition[] = [
  {
    id: "bait_basic_worm",
    name: "Minhoca Básica",
    description: "Uma isca simples e barata. Não oferece bônus, mas é confiável o bastante para qualquer pescaria.",
    buyPrice: 1,
    effects: {},
  },
  {
    id: "bait_golden_corn",
    name: "Milho Dourado",
    description: "Grãos brilhantes que chamam atenção no fundo da água. Aumenta levemente a chance de fisgar tesouros.",
    buyPrice: 3,
    effects: {
      treasureChanceBonus: 0.03,
      junkChanceReduction: 0.01,
    },
  },
  {
    id: "bait_heavy_grub",
    name: "Larva Pesada",
    description: "Uma isca densa e nutritiva, ideal para atrair peixes maiores e melhorar o peso final da captura.",
    buyPrice: 4,
    effects: {
      fishWeightMultiplier: 1.2,
    },
  },
  {
    id: "bait_crystal_fly",
    name: "Mosca Cristalina",
    description: "Uma isca delicada que reflete luz na superfície. Ajuda a conseguir peixes de qualidade melhor.",
    buyPrice: 5,
    effects: {
      qualityLevelBonus: 8,
      xpMultiplier: 1.05,
    },
  },
  {
    id: "bait_deep_lure",
    name: "Isca Abissal",
    description: "Um anzol preparado para águas profundas. Favorece peixes raros e reduz a chance de puxar lixo.",
    buyPrice: 8,
    effects: {
      treasureChanceBonus: 0.015,
      junkChanceReduction: 0.025,
      rareFishWeightBonus: 0.35,
    },
  },
];

export function buildBaitItemDefinitions(now = new Date().toISOString()): NewItemRow[] {
  return BAIT_DEFINITIONS.map((bait) => ({
    id: bait.id,
    name: bait.name,
    description: bait.description,
    category: "consumable",
    type: "bait",
    rarity: bait.buyPrice >= 8 ? "rare" : bait.buyPrice >= 5 ? "uncommon" : "common",
    stackable: true,
    maxStack: null,
    baseValue: Math.max(0, Math.floor(bait.buyPrice / 2)),
    metadata: JSON.stringify({
      source: "bait_shop",
      shop: {
        buyPrice: bait.buyPrice,
      },
      baitEffects: bait.effects,
    }),
    status: "active",
    createdAt: now,
    updatedAt: now,
  }));
}
