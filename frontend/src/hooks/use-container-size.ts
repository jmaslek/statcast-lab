import { useEffect, useRef, useState } from "react";

/** Returns a ref and the measured width of its element via ResizeObserver */
export function useContainerSize(maxWidth?: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const w = entries[0].contentRect.width;
      setWidth(maxWidth ? Math.min(w, maxWidth) : w);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [maxWidth]);

  return { ref, width };
}
