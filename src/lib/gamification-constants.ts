export interface LevelTier {
  level: number;
  minXp: number;
  maxXp: number;
  title: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  { level: 1, minXp: 0, maxXp: 100, title: 'Pelajar Pemula' },
  { level: 2, minXp: 101, maxXp: 300, title: 'Penjelajah Ilmu' },
  { level: 3, minXp: 301, maxXp: 600, title: 'Cendekia Muda' },
  { level: 4, minXp: 601, maxXp: 950, title: 'Bintang Kelas' },
  { level: 5, minXp: 951, maxXp: 1400, title: 'Pakar Lentera' },
  { level: 6, minXp: 1401, maxXp: 999999, title: 'Master Lentera' },
];

export interface LevelInfo {
  level: number;
  title: string;
  totalXp: number;
  currentXp: number;
  currentLevelXp: number;
  nextLevelRequiredXp: number;
  currentBaseXp: number;
  nextLevelXp: number;
  progressPercent: number;
}

export function calculateLevelInfo(totalXp: number): LevelInfo {
  let tier = LEVEL_TIERS[0];
  for (const t of LEVEL_TIERS) {
    if (totalXp >= t.minXp) {
      tier = t;
    }
  }

  const isMax = tier.level === 6;
  const currentBase = tier.minXp;
  const nextTarget = isMax ? tier.minXp + 1000 : tier.maxXp;
  const progressInLevel = Math.max(0, totalXp - currentBase);
  const neededForLevel = Math.max(1, nextTarget - currentBase);
  const progressPercent = isMax ? 100 : Math.min(100, Math.round((progressInLevel / neededForLevel) * 100));

  return {
    level: tier.level,
    title: tier.title,
    totalXp,
    currentXp: totalXp,
    currentLevelXp: progressInLevel,
    nextLevelRequiredXp: neededForLevel,
    currentBaseXp: currentBase,
    nextLevelXp: nextTarget,
    progressPercent,
  };
}

export interface BadgeCatalogItem {
  code: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  xpReward: number;
}

export const BADGE_CATALOG: BadgeCatalogItem[] = [
  {
    code: 'QUIZ_PERFECT',
    name: 'Juara Kuis 100',
    description: 'Mendapatkan nilai sempurna (100) pada salah satu kuis CBT.',
    category: 'QUIZ',
    icon: '🎯',
    xpReward: 50,
  },
  {
    code: 'QUIZ_FIRST',
    name: 'Tuntas Perdana',
    description: 'Menyelesaikan kuis pertama dengan nilai mencapai KKM.',
    category: 'QUIZ',
    icon: '🌟',
    xpReward: 30,
  },
  {
    code: 'SPEEDY_SUBMIT',
    name: 'Pengumpul Kilat',
    description: 'Mengumpulkan tugas lebih dari 24 jam sebelum batas waktu.',
    category: 'ASSIGNMENT',
    icon: '⚡',
    xpReward: 40,
  },
  {
    code: 'STREAK_3',
    name: 'Streak 3 Hari',
    description: 'Aktif belajar di platform selama 3 hari berturut-turut.',
    category: 'STREAK',
    icon: '🔥',
    xpReward: 30,
  },
  {
    code: 'STREAK_7',
    name: 'Master Konsistensi',
    description: 'Aktif belajar di platform selama 7 hari berturut-turut.',
    category: 'STREAK',
    icon: '🏆',
    xpReward: 70,
  },
  {
    code: 'BOOKWORM_5',
    name: 'Kutu Buku Pemula',
    description: 'Menyelesaikan membaca 5 konten materi pembelajaran.',
    category: 'MODULE',
    icon: '📚',
    xpReward: 25,
  },
  {
    code: 'BOOKWORM_15',
    name: 'Penjelajah Materi',
    description: 'Menyelesaikan membaca 15 konten materi pembelajaran.',
    category: 'MODULE',
    icon: '📖',
    xpReward: 60,
  },
  {
    code: 'FORUM_ACTIVE',
    name: 'Kolega Aktif',
    description: 'Aktif berdiskusi di forum kelas (minimal 3 pertanyaan atau jawaban).',
    category: 'FORUM',
    icon: '💬',
    xpReward: 35,
  },
];
