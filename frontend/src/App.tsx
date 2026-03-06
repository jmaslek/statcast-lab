import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Dashboard from "@/pages/Dashboard";
import Leaderboard from "@/pages/Leaderboard";
import PlayerProfile from "@/pages/PlayerProfile";
import Compare from "@/pages/Compare";
import GameExplorer from "@/pages/GameExplorer";
import Analytics from "@/pages/Analytics";

const queryClient = new QueryClient();

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <nav className="w-56 border-r bg-muted/40 p-4 space-y-2">
        <h1 className="text-lg font-bold mb-4">MLB Analytics</h1>
        <NavLink to="/" end className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Dashboard</NavLink>
        <NavLink to="/leaderboard" className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Leaderboards</NavLink>
        <NavLink to="/players" className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Players</NavLink>
        <NavLink to="/compare" className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Compare</NavLink>
        <NavLink to="/games" className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Games</NavLink>
        <NavLink to="/analytics" className={({ isActive }) =>
          `block px-3 py-2 rounded-md text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`
        }>Analytics</NavLink>
      </nav>
      <main className="flex-1 overflow-auto p-6">
        {children}
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
            <Route path="/" element={<Dashboard />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="/players" element={<PlayerProfile />} />
            <Route path="/players/:playerId" element={<PlayerProfile />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/games" element={<GameExplorer />} />
            <Route path="/games/:gamePk" element={<GameExplorer />} />
            <Route path="/analytics" element={<Analytics />} />
          </Routes>
        </Layout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
