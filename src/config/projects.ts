/**
 * Central project configuration for multi-project support.
 * Each project (260004, 260005, 260006) has its own schemes and gift options.
 */

export interface GiftOption {
  id: string;
  name: string;
  /** true = radio group (pick one), false/undefined = quantity stepper */
  selectable?: boolean;
}

export interface SchemeConfig {
  id: string;
  name: string;
  description: string;
  subCode: string;
  gifts: GiftOption[];
}

export interface ProjectConfig {
  slug: string;
  projectCode: string;
  displayName: string;
  firebaseBucketPath: string;
  schemes: SchemeConfig[];
  /** true if project has multiple schemes requiring a selector UI */
  hasSchemeSelector: boolean;
}

// ─── Project 260004 ─────────────────────────────────────────────────────────

const PROJECT_260004: ProjectConfig = {
  slug: "260004",
  projectCode: "nx-gs-thienlong-260004",
  displayName: "Thiên Long PG Inline Mùa Thi",
  firebaseBucketPath: "thienlong-260004-2026/redeem",
  hasSchemeSelector: true,
  schemes: [
    {
      id: "260004_scheme_1",
      name: "Scheme 1 - Colokit 69K",
      description: "Hóa đơn Colokit đạt giá trị từ 69K",
      subCode: "colokit_69k",
      gifts: [
        { id: "260004_s1_but_gel_ak", name: "Bút gel DS Gel-073/AK", selectable: true },
        { id: "260004_s1_but_gel_ds", name: "Bút gel DS Gel-057/DS", selectable: true },
      ],
    },
    {
      id: "260004_scheme_2",
      name: "Scheme 2 - BST Akooland 119K",
      description: "Hóa đơn 119K các sản phẩm BST Akooland",
      subCode: "akooland_119k",
      gifts: [
        { id: "260004_s2_hop_qua_akooland", name: "Hộp quà Akooland" },
      ],
    },
    {
      id: "260004_scheme_3",
      name: "Scheme 3 - BST Demon Slayer 119K",
      description: "Hóa đơn 119K các sản phẩm BST Demon Slayer",
      subCode: "demon_slayer_119k",
      gifts: [
        { id: "260004_s3_day_deo_the", name: "Dây đeo thẻ random + Pack card bản quyền" },
      ],
    },
    {
      id: "260004_scheme_4",
      name: "Scheme 4 - Cặp chống gù Kid",
      description: "Mua 1 Cặp chống gù Kid",
      subCode: "cap_chong_gu_kid",
      gifts: [
        { id: "260004_s4_bo_hoc_cu", name: "Bộ học cụ (Bút chì, gôm keo khô, 1 bộ bút lông màu đầu brush)" },
      ],
    },
    {
      id: "260004_scheme_5",
      name: "Scheme 5 - Balo Teen",
      description: "Mua 1 Balo Teen",
      subCode: "balo_teen",
      gifts: [
        { id: "260004_s5_hop_but_son", name: "Hộp bút sơn" },
      ],
    },
  ],
};

// ─── Project 260005 ─────────────────────────────────────────────────────────

const PROJECT_260005: ProjectConfig = {
  slug: "260005",
  projectCode: "nx-gs-thienlong-260005",
  displayName: "Thiên Long Activation Bút Gel",
  firebaseBucketPath: "thienlong-260005-2026/redeem",
  hasSchemeSelector: true,
  schemes: [
    {
      id: "260005_scheme_1",
      name: "Scheme 1 - BÚT GEL TL 66K",
      description: "Hóa đơn BÚT GEL TL từ 66K",
      subCode: "but_gel_66k",
      gifts: [
        { id: "260005_s1_but_da_quang", name: "BÚT DẠ QUANG HL-03/PLUS" },
      ],
    },
    {
      id: "260005_scheme_2",
      name: "Scheme 2 - BÚT GEL TL 99K",
      description: "Hóa đơn BÚT GEL TL từ 99K",
      subCode: "but_gel_99k",
      gifts: [
        { id: "260005_s2_hl03_luck_gel040", name: "HL-03/LUCK + GEL-040/LUCK" },
      ],
    },
  ],
};

// ─── Project 260006 ─────────────────────────────────────────────────────────

const PROJECT_260006: ProjectConfig = {
  slug: "260006",
  projectCode: "nx-gs-thienlong-260006",
  displayName: "Thiên Long Activation 30-04",
  firebaseBucketPath: "thienlong-holiday-304-2026/redeem",
  hasSchemeSelector: false,
  schemes: [
    {
      id: "holiday_304_scheme",
      name: "Lễ 30/4",
      description: "Hóa đơn Thiên Long từ 75K",
      subCode: "thienlong_75k",
      gifts: [
        { id: "holiday_304_gift", name: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá" },
      ],
    },
  ],
};

// ─── Exports ────────────────────────────────────────────────────────────────

export const PROJECT_CONFIGS: Record<string, ProjectConfig> = {
  "260004": PROJECT_260004,
  "260005": PROJECT_260005,
  "260006": PROJECT_260006,
};

export const VALID_PROJECT_SLUGS = Object.keys(PROJECT_CONFIGS);

export function getProjectConfig(slug: string): ProjectConfig | null {
  return PROJECT_CONFIGS[slug] ?? null;
}

/**
 * Get a flat list of all gift configs across all schemes for a project.
 * Used by admin/customer views to map gift IDs to display names.
 */
export function getAllGiftConfigs(config: ProjectConfig): { id: string; name: string }[] {
  const seen = new Set<string>();
  const result: { id: string; name: string }[] = [];

  for (const scheme of config.schemes) {
    for (const gift of scheme.gifts) {
      if (!seen.has(gift.id)) {
        seen.add(gift.id);
        result.push({ id: gift.id, name: gift.name });
      }
    }
  }

  return result;
}
