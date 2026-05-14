"use client";

import { useEffect, useState } from "react";
import { getImageNetworkTier, type ImageNetworkTier } from "@/lib/image-network-tier";

type Conn = {
  addEventListener?: (type: "change", listener: () => void) => void;
  removeEventListener?: (type: "change", listener: () => void) => void;
};

export function useNetworkImageTier(): ImageNetworkTier {
  const [tier, setTier] = useState<ImageNetworkTier>(() =>
    typeof window !== "undefined" ? getImageNetworkTier() : "unknown"
  );

  useEffect(() => {
    const sync = () => setTier(getImageNetworkTier());
    sync();
    const c = (navigator as Navigator & { connection?: Conn }).connection;
    c?.addEventListener?.("change", sync);
    return () => c?.removeEventListener?.("change", sync);
  }, []);

  return tier;
}
