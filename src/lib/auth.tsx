import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase, SUPABASE_CONFIGURED } from "./supabase";

type AuthCtx = { session: Session | null; user: User | null; loading: boolean };
const Ctx = createContext<AuthCtx>({ session: null, user: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // If Supabase isn't configured yet, don't block rendering behind a loading state.
    if (!SUPABASE_CONFIGURED) {
      setSession(null);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setSession(data.session ?? null);
      } catch (e) {
        console.error("[auth] getSession failed:", e);
        if (!mounted) return;
        setSession(null);
      } finally {
        if (mounted) setLoading(false);
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

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    loading,
  }), [session, loading]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  const [roles, setRoles] = useState<string[]>([]);
  const [rolesLoading, setRolesLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      if (!ctx.user?.id) {
        if (mounted) {
          setRoles([]);
          setRolesLoading(false);
        }
        return;
      }

      const { data: roleRows, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", ctx.user.id);

      if (!mounted) return;

      if (error) {
        console.error("user_roles select error", error);
        setRoles([]);
      } else {
        // Normalize roles to lowercase to match database storage, filtering out any null/undefined values
        const userRoles = (roleRows ?? [])
          .filter(r => r.role != null)
          .map(r => r.role.toLowerCase());
        setRoles(userRoles);
      }
      setRolesLoading(false);
    })();

    return () => {
      mounted = false;
    };
  }, [ctx.user?.id]);

  const isDeveloper = roles.includes("developer");

  return { 
    ...ctx, 
    isDeveloper, 
    roles, 
    rolesLoading,
    // Combine both loading states for convenience
    loading: ctx.loading || rolesLoading
  };
}