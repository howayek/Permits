import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type SignupRole = "CITIZEN" | "GOVERNMENT";

export default function AuthLogin() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from || "/dashboard";
  const { user, loading } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<SignupRole>("CITIZEN");
  const [error, setError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && user) nav(from, { replace: true });
  }, [user, loading, from, nav]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (isSignup) {
        const { error: signUpErr } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName, role: selectedRole },
          },
        });
        if (signUpErr) throw signUpErr;
        setConfirmationSent(true);
      } else {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInErr) throw signInErr;
        nav(from, { replace: true });
      }
    } catch (err: any) {
      setError(err.message ?? "Authentication error");
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmationSent) {
    return (
      <main className="min-h-[80vh] bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-7 h-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Check your email</h2>
          <p className="text-muted-foreground text-sm">
            We sent a confirmation link to <strong>{email}</strong>.
            Click the link in the email to activate your account, then come back here to sign in.
          </p>
          <Button
            variant="outline"
            onClick={() => { setConfirmationSent(false); setIsSignup(false); }}
          >
            Back to Sign In
          </Button>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[80vh] bg-background flex items-center justify-center p-6">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {isSignup ? "Create an account" : "Welcome back"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isSignup
              ? "Sign up to submit and track permit applications."
              : "Sign in to your GovStack account."}
          </p>
        </div>

        {error && (
          <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          {isSignup && (
            <>
              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <input
                  className="border rounded-md p-2 w-full focus:ring-2 focus:ring-primary/30 outline-none"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">I am a…</label>
                <div className="grid grid-cols-2 gap-3">
                  <RoleOption
                    label="Citizen"
                    description="Apply for permits"
                    selected={selectedRole === "CITIZEN"}
                    onClick={() => setSelectedRole("CITIZEN")}
                  />
                  <RoleOption
                    label="Government"
                    description="Review applications"
                    selected={selectedRole === "GOVERNMENT"}
                    onClick={() => setSelectedRole("GOVERNMENT")}
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <input
              type="email"
              className="border rounded-md p-2 w-full focus:ring-2 focus:ring-primary/30 outline-none"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Password</label>
            <input
              type="password"
              className="border rounded-md p-2 w-full focus:ring-2 focus:ring-primary/30 outline-none"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          <Button className="w-full" disabled={submitting}>
            {submitting
              ? "Please wait…"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>

          <button
            type="button"
            onClick={() => { setIsSignup((s) => !s); setError(null); }}
            className="text-sm text-muted-foreground hover:text-foreground underline w-full text-center"
          >
            {isSignup
              ? "Already have an account? Sign in"
              : "New here? Create an account"}
          </button>
        </form>
      </Card>
    </main>
  );
}

function RoleOption({
  label,
  description,
  selected,
  onClick,
}: {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border-2 p-3 text-left transition-colors ${
        selected
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/40"
      }`}
    >
      <div className="font-medium text-sm">{label}</div>
      <div className="text-xs text-muted-foreground">{description}</div>
    </button>
  );
}
