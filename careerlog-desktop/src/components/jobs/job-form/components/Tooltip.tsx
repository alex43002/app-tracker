import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Tooltip
 *
 * Self-contained, edge-safe tooltip.
 * - Never overflows viewport or modal
 * - Auto-repositions horizontally
 * - No portals
 * - No parent changes required
 */
export function Tooltip({
  content,
  children,
}: {
  content: string;
  children: ReactNode;
}) {
  const triggerRef = useRef<HTMLSpanElement | null>(null);
  const tooltipRef = useRef<HTMLSpanElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!visible || !triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();

    let left =
      triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;

    // Clamp horizontally to viewport
    const padding = 8;
    left = Math.max(
      padding,
      Math.min(left, window.innerWidth - tooltipRect.width - padding)
    );

    const top = triggerRect.top - tooltipRect.height - 8;

    setStyle({
      position: "fixed",
      top,
      left,
    });
  }, [visible]);

  return (
    <>
      <span
        ref={triggerRef}
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        className="inline-flex cursor-help text-gray-400 hover:text-gray-600"
      >
        {children}
      </span>

      {visible && (
        <span
          ref={tooltipRef}
          style={style}
          className="
            z-[9999]
            w-72
            rounded-md bg-black px-3 py-2
            text-xs text-white
            shadow-lg
          "
        >
          {content}
        </span>
      )}
    </>
  );
}
