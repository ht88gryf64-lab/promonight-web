export type AdSize = { w: number; h: number };

export type AdSlotConfig = {
  id: string;
  sizes: {
    desktop?: AdSize;
    tablet?: AdSize;
    mobile?: AdSize;
  };
  lazyLoad: boolean;
};

export const AD_SLOTS = {
  HEADER_LEADERBOARD: {
    id: 'header_leaderboard',
    sizes: {
      desktop: { w: 970, h: 250 },
      tablet: { w: 728, h: 90 },
      mobile: { w: 320, h: 100 },
    },
    lazyLoad: false,
  },
  TEAM_PAGE_AFTER_HERO: {
    id: 'team_page_after_hero',
    sizes: {
      desktop: { w: 728, h: 90 },
      mobile: { w: 300, h: 250 },
    },
    lazyLoad: true,
  },
  IN_CONTENT_1: {
    id: 'in_content_1',
    sizes: {
      desktop: { w: 728, h: 90 },
      mobile: { w: 300, h: 250 },
    },
    lazyLoad: true,
  },
  IN_CONTENT_2: {
    id: 'in_content_2',
    sizes: {
      desktop: { w: 300, h: 250 },
      mobile: { w: 300, h: 250 },
    },
    lazyLoad: true,
  },
  IN_CONTENT_3: {
    id: 'in_content_3',
    sizes: {
      desktop: { w: 728, h: 90 },
      mobile: { w: 300, h: 250 },
    },
    lazyLoad: true,
  },
  SIDEBAR_STICKY: {
    id: 'sidebar_sticky',
    sizes: {
      desktop: { w: 300, h: 600 },
    },
    lazyLoad: true,
  },
  ADHESION_FOOTER: {
    id: 'adhesion_footer',
    sizes: {
      mobile: { w: 320, h: 50 },
    },
    lazyLoad: false,
  },
  RECIRC_NATIVE: {
    id: 'recirc_native',
    sizes: {
      desktop: { w: 728, h: 250 },
      mobile: { w: 300, h: 250 },
    },
    lazyLoad: true,
  },
} as const satisfies Record<string, AdSlotConfig>;

export type AdSlotKey = keyof typeof AD_SLOTS;
