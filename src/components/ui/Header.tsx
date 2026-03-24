import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase, SUPABASE_CONFIGURED } from "@/lib/supabase";
import { Button } from "./button";

export default function Header() {
  const { user, isGovernment, isDeveloper, loading } = useAuth();

  const showGovLinks = isGovernment || isDeveloper;
  const showCitizenLinks = user && !isGovernment;

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Sign-out error:", error.message);
  }

  return (
    <header className="w-full border-b bg-white">
      {!SUPABASE_CONFIGURED && (
        <div className="bg-amber-50 text-amber-900 border-b border-amber-200">
          <div className="max-w-7xl mx-auto px-4 py-2 text-xs">
            Supabase is not configured. Copy <code>env.example</code> →{" "}
            <code>.env.local</code>, set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code>, then restart{" "}
            <code>npm run dev</code>.
          </div>
        </div>
      )}
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="font-semibold text-lg">
          GovStack
        </Link>

        <nav className="flex items-center gap-3">
          {showCitizenLinks && (
            <>
              <Link to="/apply" className="text-sm hover:underline">
                Apply
              </Link>
              <Link to="/my-permits" className="text-sm hover:underline">
                My Permits
              </Link>
            </>
          )}

          {user && (
            <Link to="/dashboard" className="text-sm hover:underline">
              Dashboard
            </Link>
          )}

          {user && showGovLinks && (
            <>
              <Link to="/gov">
                <Button variant="outline" size="sm">
                  Review Queue
                </Button>
              </Link>
              <Link to="/gov/database" className="text-sm hover:underline">
                Applications
              </Link>
            </>
          )}

          {!loading && !user && (
            <Link to="/auth/login">
              <Button size="sm">Sign in</Button>
            </Link>
          )}

          {!loading && user && (
            <Button variant="destructive" size="sm" onClick={handleSignOut}>
              Sign out
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
