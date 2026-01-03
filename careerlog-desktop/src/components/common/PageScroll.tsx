import type { ReactNode } from "react";

export function PageScroll({ children }: { children: ReactNode }) {
  return (
    <div className="h-full w-full overflow-y-auto overflow-x-hidden">
      {children}
    </div>
  );
}
