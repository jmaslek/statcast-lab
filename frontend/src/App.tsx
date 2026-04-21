import { useState, useEffect, lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Moon, Sun } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Explore from "@/pages/Explore";

const GameExplorer = lazy(() => import("@/pages/GameExplorer"));
const AbsChallenges = lazy(() => import("@/pages/AbsChallenges"));
const Reference = lazy(() => import("@/pages/Reference"));
const PlayerProfile = lazy(() => import("@/pages/PlayerProfile"));
const Compare = lazy(() => import("@/pages/Compare"));
const Standings = lazy(() => import("@/pages/Standings"));
const StatcastSearch = lazy(() => import("@/pages/StatcastSearch"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,  // 5 min — data doesn't change mid-session
      gcTime: 1000 * 60 * 30,    // 30 min garbage collection
      refetchOnWindowFocus: false,
    },
  },
});

const NAV_LINKS = [
  { to: "/", label: "Explore", end: true },
  { to: "/search", label: "Search", end: false },
  { to: "/games", label: "Games", end: false },
  { to: "/abs", label: "ABS Challenges", end: false },
  { to: "/standings", label: "Standings", end: false },
  { to: "/reference", label: "Reference", end: false },
];

function DarkModeToggle() {
  const [dark, setDark] = useState(() => {
    const saved = localStorage.getItem("theme");
    if (saved) return saved === "dark";
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem("theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <button
      onClick={() => setDark(!dark)}
      className="p-2 rounded-md hover:bg-muted"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

function NavContent({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      {NAV_LINKS.map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            `block px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-accent"
            }`
          }
        >
          {link.label}
        </NavLink>
      ))}
    </>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpenPath, setMobileNavOpenPath] = useState<string | null>(null);
  const location = useLocation();
  const mobileNavOpen = mobileNavOpenPath === location.pathname;

  return (
    <div className="flex h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-[60] focus:top-4 focus:left-20 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:text-sm focus:font-medium"
      >
        Skip to content
      </a>

      <button
        className="fixed top-4 left-4 z-50 p-2 rounded-md bg-background border shadow-sm lg:hidden"
        onClick={() => setMobileNavOpenPath(mobileNavOpen ? null : location.pathname)}
        aria-label={mobileNavOpen ? "Close navigation" : "Open navigation"}
        aria-expanded={mobileNavOpen}
      >
        {mobileNavOpen ? <X className="size-5" /> : <Menu className="size-5" />}
      </button>

      {mobileNavOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileNavOpenPath(null)}
          aria-hidden="true"
        />
      )}

      <nav
        aria-label="Main navigation"
        className={`fixed inset-y-0 left-0 z-40 w-52 border-r bg-sidebar p-4 space-y-1 transition-transform duration-200 lg:relative lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex items-center justify-between mb-5 pb-3 border-b">
          <span className="text-lg font-bold tracking-tight" style={{ fontFamily: "'Fraunces', Georgia, serif", fontVariationSettings: "'WONK' 1" }}>
            <span className="text-primary">MLB</span> Analytics
          </span>
          <DarkModeToggle />
        </div>
        <NavContent onNavigate={() => setMobileNavOpenPath(null)} />
      </nav>

      <main
        id="main-content"
        key={location.pathname}
        className="flex-1 overflow-auto p-6 pt-16 lg:pt-6 animate-in"
      >
        <ErrorBoundary>
          <Suspense fallback={<div className="space-y-4"><Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /></div>}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<Explore />} />
            <Route path="/search" element={<StatcastSearch />} />
            <Route path="/players/:playerId" element={<PlayerProfile />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/games" element={<GameExplorer />} />
            <Route path="/games/:gamePk" element={<GameExplorer />} />
            <Route path="/standings" element={<Standings />} />
            <Route path="/abs" element={<AbsChallenges />} />
            <Route path="/reference" element={<Reference />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
