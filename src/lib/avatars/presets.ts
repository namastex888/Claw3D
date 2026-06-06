import type { AgentAvatarProfile } from "@/lib/avatars/profile";

export const TOWER_PRESIDENT_AGENT_ID = "tower-president";
export const TOWER_PRESIDENT_AVATAR_SEED = "tower-president";

export const TOWER_PRESIDENT_AVATAR_PROFILE: AgentAvatarProfile = {
  version: 1,
  seed: TOWER_PRESIDENT_AVATAR_SEED,
  body: {
    skinTone: "#d8a06e",
  },
  hair: {
    style: "parted",
    color: "#151515",
  },
  clothing: {
    topStyle: "jacket",
    topColor: "#111827",
    bottomStyle: "pants",
    bottomColor: "#2d3748",
    shoesColor: "#1a1a1a",
  },
  accessories: {
    glasses: true,
    headset: true,
    hatStyle: "none",
    backpack: false,
  },
};
