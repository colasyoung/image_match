"use client";

import { useCallback, useLayoutEffect, useState } from "react";

const STORAGE_KEY = "image_match_admin_upload_bypass";

export function useAdminUploadBypass() {
  const [adminUploadBypassToken, setAdminUploadBypassTokenState] = useState("");

  useLayoutEffect(() => {
    try {
      const v = sessionStorage.getItem(STORAGE_KEY);
      if (v) queueMicrotask(() => setAdminUploadBypassTokenState(v));
    } catch {
      /* private mode */
    }
  }, []);

  const setAdminUploadBypassToken = useCallback((value: string) => {
    setAdminUploadBypassTokenState(value);
    try {
      const t = value.trim();
      if (t) sessionStorage.setItem(STORAGE_KEY, t);
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  return { adminUploadBypassToken, setAdminUploadBypassToken };
}
