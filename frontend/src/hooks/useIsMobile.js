import { useState, useEffect } from "react";

/**
 * Matches viewport width <= breakpoint (default 1024px).
 * Used for drawer visibility and master–detail layout branching.
 */
export function useIsMobile(breakpoint = 1024) {
  const query = `(max-width: ${breakpoint}px)`;

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(query).matches : false
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const sync = () => setIsMobile(mql.matches);

    sync();
    mql.addEventListener("change", sync);
    return () => mql.removeEventListener("change", sync);
  }, [query]);

  return isMobile;
}
