"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSignIn() {
    setLoading(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);
    setMessage(null);
    const supabase = createBrowserSupabase();
    const { error } = await supabase.auth.signUp({ email, password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setMessage(
      "Account created. If email confirmation is on, confirm via email, then sign in.",
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-6">
      <h1 className="text-2xl font-bold">Sign in to TapTap</h1>
      <div className="flex flex-col gap-3">
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2"
          type="email"
          placeholder="you@business.co.ke"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="rounded-lg border border-neutral-300 px-3 py-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="flex gap-3">
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="flex-1 rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          Sign in
        </button>
        <button
          onClick={handleSignUp}
          disabled={loading}
          className="flex-1 rounded-lg border border-neutral-300 px-4 py-2 font-medium hover:bg-neutral-50 disabled:opacity-50"
        >
          Sign up
        </button>
      </div>
      {message && <p className="text-sm text-neutral-600">{message}</p>}
    </main>
  );
}
