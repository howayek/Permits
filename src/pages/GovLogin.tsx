import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth";

export default function GovLogin() {
  const { user } = useAuth();
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from || "/gov";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (user) nav(from, { replace: true });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return alert(error.message);
    nav(from, { replace: true });
  }

  return (
    <main className="p-6 max-w-sm mx-auto">
      <h1 className="text-2xl font-bold mb-4">Government portal</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="border p-2 w-full" type="email" placeholder="Official email" value={email} onChange={e=>setEmail(e.target.value)} required />
        <input className="border p-2 w-full" type="password" placeholder="Password" value={password} onChange={e=>setPassword(e.target.value)} required />
        <button className="px-4 py-2 bg-black text-white rounded w-full">Sign in</button>
        <p className="text-xs text-gray-600">Access restricted to government accounts.</p>
      </form>
    </main>
  );
}
