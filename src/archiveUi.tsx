import { createContext, useContext, type ReactNode } from "react";

/**
 * Fat UI bag for view splits — App owns state; views only render.
 * Typed loosely so extracting JSX doesn’t require a 200-field interface
 * on day one; tighten fields as views stabilize.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ArchiveUi = Record<string, any>;

const ArchiveUiContext = createContext<ArchiveUi | null>(null);

export function ArchiveUiProvider({
  value,
  children,
}: {
  value: ArchiveUi;
  children: ReactNode;
}) {
  return (
    <ArchiveUiContext.Provider value={value}>
      {children}
    </ArchiveUiContext.Provider>
  );
}

export function useArchiveUi(): ArchiveUi {
  const v = useContext(ArchiveUiContext);
  if (!v) throw new Error("useArchiveUi outside ArchiveUiProvider");
  return v;
}
