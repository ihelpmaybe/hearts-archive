import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "./wagmi";
import "./styles.css";

/** Defer App (protocol + UI) so first paint isn’t one fat graph. */
const App = lazy(() =>
  import("./App").then((m) => ({ default: m.App })),
);

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <Suspense
          fallback={
            <div
              className="boot-shell"
              style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                margin: 0,
                background: "#100805",
                color: "#d0ad8c",
              }}
            >
              Heart’s Archive…
            </div>
          }
        >
          <App />
        </Suspense>
      </QueryClientProvider>
    </WagmiProvider>
  </StrictMode>,
);
