import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function AuthLogin() {
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from || "/dashboard";
  const { user } = useAuth();

  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // If we’re already logged in, go where we came from
  if (user) {
    nav(from, { replace: true });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(from, { replace: true });
      }
    } catch (err: any) {
      alert(err.message ?? "Auth error");
    }
  }

  return (
    <main className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-bold mb-4">{isSignup ? "Create an account" : "Log in"}</h1>
      <form onSubmit={onSubmit} className="space-y-4">
        <input
          type="email" placeholder="Email"
          className="border p-2 w-full"
          value={email} onChange={(e)=>setEmail(e.target.value)} required
        />
        <input
          type="password" placeholder="Password"
          className="border p-2 w-full"
          value={password} onChange={(e)=>setPassword(e.target.value)} required
        />

        <button className="px-4 py-2 bg-blue-600 text-white rounded w-full">
          {isSignup ? "Sign up" : "Log in"}
        </button>

        <button
          type="button"
          onClick={() => setIsSignup(s => !s)}
          className="text-sm text-gray-700 underline"
        >
          {isSignup ? "Already have an account? Log in" : "New here? Create an account"}
        </button>
      </form>
    </main>
  );
}
