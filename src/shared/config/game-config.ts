export interface TierConfig {
  id: number;
  name: string;
  radius: number;
  points: number;
  color: number;
  frames: string[];
  cap?: boolean;
}

export interface GameConfig {
  // Display settings
  width: number;
  height: number;
  
  // Physics settings
  gravity: number;
  restitution: number;
  friction: number;
  airFriction: number;
  maxBodies: number;
  
  // Game mechanics
  dangerLineY: number;
  dangerTurnLimit: number; // turns a piece can remain in danger
  dangerFallVyThreshold: number; // minimum downward vy to consider a piece "falling"
  dangerSuppressMs: number; // hide danger line briefly after a drop
  comboWindowMs: number;
  mergeRestMs: number;
  capPieceTierId: number;
  capPieceClearScore: number;
  
  // Input settings
  dropRateLimit: number; // drops per 10 seconds
  
  // Tier system
  allowedSpawnTierIds: number[];
  tiers: TierConfig[];
}

export const GAME_CONFIG: GameConfig = {
  width: 400,  
  height: 550,
  
  // Physics settings
  gravity: 1.6,
  restitution: 0.37, // moderate bounce
  friction: 0.05,
  airFriction: 0.02,
  maxBodies: 120,
  
  // Game mechanics
  dangerLineY: 35, // pixels from top
  dangerTurnLimit: 3, // turns a piece can remain in danger zone
  dangerFallVyThreshold: 0.7, // hide danger while pieces are falling faster than this vy
  dangerSuppressMs: 500, // hide danger line for this long after a drop
  comboWindowMs: 2500, // 2 second combo window
  mergeRestMs: 25, // ms to wait before confirming merge
  capPieceTierId: 11,
  capPieceClearScore: 500,
  
  // Input rate limiting
  dropRateLimit: 3, // 10 drops per 10 seconds
  
  // Tier system
  allowedSpawnTierIds: [1,2,3,4,5],
  tiers: [
    {
      id: 1,
      name: "Buddy Bear",
      radius: 16,
      points: 2,
      color: 0xFFB6C1, // light pink
      frames: ["buddy-bear", "buddy-bear-1"]
    },
    {
      id: 2,
      name: "Fruity Tutti",
      radius: 22,
      points: 4,
      color: 0xFF6B6B, // coral
      frames: ["fruity-tutti", "fruity-tutti-1"]
    },
    {
      id: 3,
      name: "Mellow Marcy",
      radius: 28,
      points: 6,
      color: 0xFFFAFA, // snow white
      frames: ["mellow-marcy", "mellow-marcy-1"]
    },
    {
      id: 4,
      name: "Lady Pop",
      radius: 33,
      points: 8,
      color: 0xE066FF, // orchid
      frames: ["lady-pop", "lady-pop-1"]
    },
    {
      id: 5,
      name: "Coco Dude",
      radius: 42,
      points: 10,
      color: 0x8B4513, // chocolate
      frames: ["coco-dude", "coco-dude-1"]
    },
    {
      id: 6,
      name: "Dodo Donut",
      radius: 54,
      points: 12,
      color: 0xFFE4B5, // peach
      frames: ["dodo-donut"]
    },
    {
      id: 7,
      name: "Frosty Franny",
      radius: 62,
      points: 14,
      color: 0xFFB6E1, // pink frosting
      frames: ["frosty-franny"]
    },
    {
      id: 8,
      name: "Speedy Shake",
      radius: 70,
      points: 16,
      color: 0xF5DEB3, // vanilla
      frames: ["speedy-shake"]
    },
    {
      id: 9,
      name: "Vanilla Ice Ice Baby",
      radius: 80,
      points: 18,
      color: 0xFFFACD, // lemon chiffon
      frames: ["vanilla-ice-ice-baby"]
    },
    {
      id: 10,
      name: "Abby Apples",
      radius: 95,
      points: 20,
      color: 0xDC143C, // crimson
      frames: ["abby-apples"]
    },
    {
      id: 11,
      name: "Big Ol Cake-a-rinos",
      radius: 115,
      points: 22,
      color: 0xFFC0CB, // pink
      frames: ["big-ol-cake-a-rinos"],
      cap: true
    }
  ]
};

// Helper functions
export const getTierById = (id: number): TierConfig | undefined => {
  return GAME_CONFIG.tiers.find(tier => tier.id === id);
};

export const getNextTier = (currentTierId: number): TierConfig | undefined => {
  const nextId = currentTierId + 1;
  return getTierById(nextId);
};

export const canMerge = (tierId: number): boolean => {
  const tier = getTierById(tierId);
  return tier ? !tier.cap : false;
};
