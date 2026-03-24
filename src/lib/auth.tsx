import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, SUPABASE_CONFIGURED } from "./supabase";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  roles: string[];
  isDeveloper: boolean;
  isGovernment: boolean;
  loading: boolean;
}

const Ctx = createContext<AuthCtx>({
  session: null,
  user: null,
  roles: [],
  isDeveloper: false,
  isGovernment: false,
  loading: true,
});

/**
 * Extracts roles from two sources (in priority order):
 * 1. user_roles table (authoritative — what RLS policies check)
 * 2. JWT user_metadata.role (set at sign-up — fallback if DB query returns empty)
 */
function mergeRoles(dbRoles: string[], user: User | null): string[] {
  if (dbRoles.length > 0) return dbRoles;
  const metaRole = user?.user_metadata?.role;
  if (metaRole && typeof metaRole === "string") {
    return [metaRole.toLowerCase()];
  }
  return [];
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [dbRoles, setDbRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  // ── Step 1: Load session ──────────────────────────────────────────
  useEffect(() => {
    let mounted = true;

    if (!SUPABASE_CONFIGURED) {
      setSession(null);
      setAuthLoading(false);
      setRolesLoading(false);
      return () => { mounted = false; };
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (mounted) setSession(data.session ?? null);
      } catch (e) {
        console.error("[auth] getSession failed:", e);
        if (mounted) setSession(null);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // ── Step 2: Fetch roles from user_roles table ─────────────────────
  const userId = session?.user?.id;

  useEffect(() => {
    let mounted = true;

    if (!userId) {
      setDbRoles([]);
      setRolesLoading(false);
      return () => { mounted = false; };
    }

    setRolesLoading(true);

    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId);

        if (!mounted) return;

        if (error) {
          console.error("[auth] user_roles query error:", error);
          setDbRoles([]);
        } else {
          setDbRoles(
            (data ?? [])
              .filter((r) => r.role != null)
              .map((r) => r.role.toLowerCase())
          );
        }
      } catch (e) {
        console.error("[auth] user_roles query exception:", e);
        if (mounted) setDbRoles([]);
      } finally {
        if (mounted) setRolesLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [userId]);

  // ── Derived context value ─────────────────────────────────────────
  const value = useMemo<AuthCtx>(() => {
    const loading = authLoading || rolesLoading;
    const user = session?.user ?? null;
    const roles = mergeRoles(dbRoles, user);

    return {
      session,
      user,
      roles,
      isDeveloper: roles.includes("developer"),
      isGovernment:
        roles.includes("government") ||
        roles.includes("admin") ||
        roles.includes("clerk"),
      loading,
    };
  }, [session, authLoading, dbRoles, rolesLoading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  return useContext(Ctx);
}
