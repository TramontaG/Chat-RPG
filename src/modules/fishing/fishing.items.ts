import type { ItemRarity, NewItemRow } from "../../database/schema";
import {
  FISHING_FISH_TABLE,
  FISHING_JUNK_TABLE,
  FISHING_TREASURE_TABLE,
  type FishingDropCategory,
  type FishingDropEntry,
} from "./fishing.tables";

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function getRarity(entry: FishingDropEntry, category: FishingDropCategory): ItemRarity {
  if (category === "treasure" && entry.targetLevel >= 85) {
    return "legendary";
  }

  if (entry.targetLevel >= 70) {
    return "epic";
  }

  if (entry.targetLevel >= 40) {
    return "rare";
  }

  if (entry.targetLevel >= 15) {
    return "uncommon";
  }

  return "common";
}

const fishingItemDescriptions: Record<FishingDropCategory, Record<string, string>> = {
  fish: {
    Lambari: "Um peixinho prateado e ligeiro, comum nas margens rasas. Simples, mas sempre bem-vindo para quem está começando a pescar.",
    Tilápia: "Um peixe resistente e carnudo, conhecido por morder a isca sem muita cerimônia. Ótimo para uma refeição honesta.",
    Sardinha: "Pequena, brilhante e cheia de espinhas finas. Costuma aparecer em cardumes que agitam a água por alguns segundos.",
    Traíra: "Um predador de água doce com mordida firme e olhar mal-encarado. Puxá-la da água já exige alguma atenção.",
    Bagre: "Pesado, bigodudo e escorregadio. Não é bonito, mas rende mais do que parece quando vai para a balança.",
    Tucunaré: "Um peixe colorido e combativo, famoso por brigar com a linha até o último instante.",
    Dourado: "Escamas douradas, força absurda e valor alto no mercado. Um troféu respeitado por qualquer pescador.",
    Salmão: "Um peixe nobre, de carne rosada e sabor marcante. Encontrar um desses fora de águas frias é sinal de sorte.",
    Pirarucu: "Um gigante de água doce, coberto por escamas duras como placas. Carregá-lo de volta já parece uma missão.",
    Atum: "Músculo puro em forma de peixe. Rápido, pesado e valioso para cozinheiros que sabem o que fazer com ele.",
    Espadarte: "Um peixe imponente, com bico longo e presença intimidadora. Parece feito para duelos contra pescadores teimosos.",
    Tubarão: "Um predador enorme que transforma a pescaria em disputa de sobrevivência. Poucos conseguem trazê-lo inteiro.",
    "Peixe Abissal": "Uma criatura escura e fria, vinda de profundezas onde a luz quase não chega. Seus olhos ainda brilham fora da água.",
    "Leviatã Jovem": "Ainda jovem, mas já colossal. Suas escamas parecem guardar histórias de tempestades antigas.",
  },
  treasure: {
    "Baú Pequeno": "Um baú encharcado, coberto de sal e lodo. Pode guardar moedas esquecidas, bugigangas antigas ou só cheiro de mar fechado.",
    Pérola: "Uma pérola lisa e clara, formada lentamente no silêncio das águas. Pequena o bastante para caber na palma, valiosa demais para ignorar.",
    "Garrafa com Mapa": "Uma garrafa lacrada com um mapa manchado por dentro. Algumas linhas ainda são legíveis, outras parecem ter sido comidas pelo tempo.",
    "Colar Antigo": "Um colar escurecido pela água, mas ainda elegante. Talvez tenha pertencido a alguém que nunca voltou para buscá-lo.",
    "Pérola Negra": "Rara, escura e quase hipnótica. Comerciantes pagam bem por ela, e supersticiosos preferem nem tocar.",
    "Relíquia Submersa": "Um objeto antigo retirado do fundo, pesado de história e incrustado de conchas. Seu propósito original não é óbvio.",
    "Chave Misteriosa": "Uma chave fria, ornamentada e sem fechadura conhecida. O metal não enferrujou, o que talvez seja a parte mais estranha.",
    "Artefato do Leviatã": "Um fragmento lendário ligado às maiores criaturas das profundezas. Mesmo imóvel, parece vibrar com a pressão do oceano.",
  },
  junk: {
    Alga: "Um punhado de alga molhada grudado no anzol. Não era o prêmio esperado, mas ao menos prova que havia vida ali.",
    "Bota Velha": "Uma bota encharcada, sem par e sem dignidade. Provavelmente tem uma história, mas ninguém quer ouvir de perto.",
    "Lata Enferrujada": "Uma lata velha tomada pela ferrugem. Faz um barulho triste quando bate no chão.",
    "Graveto Molhado": "Um graveto pesado de água, liso e inútil. A natureza também sabe fazer pegadinhas.",
    "Garrafa Vazia": "Uma garrafa sem mensagem, sem tesouro e sem desculpa. Só vidro frio e decepção transparente.",
    "Rede Rasgada": "Um pedaço de rede velha, rasgada por uso, pedra ou azar. Pode servir como lembrança de uma pescaria ruim.",
    "Pneu Velho": "Um pneu abandonado que não deveria estar no rio. Pesado, sujo e estranhamente difícil de tirar da linha.",
    "Âncora Quebrada": "Uma âncora partida e coberta de marcas. Não segura mais barco nenhum, mas ainda pesa como uma péssima decisão.",
  },
};

function getDescription(entry: FishingDropEntry, category: FishingDropCategory): string {
  return (
    fishingItemDescriptions[category][entry.item] ??
    `Obtido ao pescar. Nível alvo de Fishing: ${entry.targetLevel}.`
  );
}

export function getFishingItemId(entry: FishingDropEntry, category: FishingDropCategory): string {
  return `fishing_${category}_${slugify(entry.item)}`;
}

export function buildFishingItemDefinition(
  entry: FishingDropEntry,
  category: FishingDropCategory,
  now = new Date().toISOString(),
): NewItemRow {
  return {
    id: getFishingItemId(entry, category),
    name: entry.item,
    description: getDescription(entry, category),
    category: category === "treasure" ? "treasure" : "material",
    type: category,
    rarity: getRarity(entry, category),
    stackable: true,
    maxStack: null,
    baseValue: entry.sellValue,
    metadata: JSON.stringify({
      source: "fishing",
      targetLevel: entry.targetLevel,
      baseWeight: entry.baseWeight,
      baseXp: entry.xp,
      baseSellValue: entry.sellValue,
    }),
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
}

export function buildFishingItemDefinitions(now = new Date().toISOString()): NewItemRow[] {
  return [
    ...FISHING_FISH_TABLE.map((entry) => buildFishingItemDefinition(entry, "fish", now)),
    ...FISHING_TREASURE_TABLE.map((entry) => buildFishingItemDefinition(entry, "treasure", now)),
    ...FISHING_JUNK_TABLE.map((entry) => buildFishingItemDefinition(entry, "junk", now)),
  ];
}
