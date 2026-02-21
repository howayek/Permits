import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { Button } from "./button";

export default function Header() {
  const { user } = useAuth();

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
  }

  return (
    <header className="w-full border-b bg-white">
      {!SUPABASE_CONFIGURED && (
        <div className="bg-amber-50 text-amber-900 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-2 text-xs">
            Supabase is not configured. Copy <code>env.example</code> → <code>.env.local</code>, set{" "}
            <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>, then restart{" "}
            <code>npm run dev</code>.
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold">Home</Link>
        <nav className="flex items-center gap-3">
          <Link to="/apply" className="text-sm underline">Apply</Link>
          {user && (
            <>
              <Link to="/my-permits" className="text-sm underline">My Permits</Link>
              <Link to="/gov">
                <Button variant="outline" size="sm">Government portal</Button>
              </Link>
              <Link to="/gov/database" className="text-sm underline">Gov Database</Link>
            </>
          )}
          <Link to="/dashboard" className="text-sm underline">My dashboard</Link>
          <Link to="/auth/login">
            <Button variant={user ? "outline" : "default"} size="sm">
              Sign in
            </Button>
          </Link>
          <Button variant="destructive" size="sm" onClick={handleSignOut}>
            Sign out
          </Button>
        </nav>
      </div>
    </header>
  );
}
