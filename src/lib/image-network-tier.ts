/**
 * 基于 `navigator.connection` 的粗粒度档位（仅客户端；Safari 常无 connection → unknown）。
 * 用于对战图：先出缩略图，再按档位延迟/并发拉高清。
 */
export type ImageNetworkTier = "economy" | "balanced" | "fast" | "unknown";

type NetworkInformation = {
  saveData?: boolean;
  effectiveType?: string;
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export function getImageNetworkTier(): ImageNetworkTier {
  if (typeof navigator === "undefined") return "unknown";
  const c = (navigator as Navigator & { connection?: NetworkInformation }).connection;
  if (!c) return "unknown";
  if (c.saveData) return "economy";
  const et = c.effectiveType;
  if (et === "slow-2g" || et === "2g") return "economy";
  if (et === "3g") return "balanced";
  if (et === "4g") return "fast";
  return "unknown";
}

/** 缩略图已就绪后，再等多久开始拉高清（减轻弱网双请求并发）。 */
export function fullImageUpgradeDelayMs(tier: ImageNetworkTier): number {
  switch (tier) {
    case "economy":
      return 2800;
    case "balanced":
      return 700;
    case "fast":
      return 0;
    case "unknown":
    default:
      return 400;
  }
}
