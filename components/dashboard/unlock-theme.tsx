"use client";

import { useLayoutEffect } from "react";

// The root layout locks <body> to light mode by default (see app/layout.tsx).
// The dashboard is the one area that should genuinely follow next-themes, so
// it removes the lock while mounted and restores it on navigating away.
export function UnlockTheme() {
  useLayoutEffect(() => {
    document.body.classList.remove("theme-locked-light");
    return () => {
      document.body.classList.add("theme-locked-light");
    };
  }, []);

  return null;
}
