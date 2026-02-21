import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function TrackLookup() {
  const [value, setValue] = useState("");
  const navigate = useNavigate();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = value.trim();
    if (!id) return;
    navigate(`/track/${id}`);
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-gradient-hero text-primary-foreground py-10 shadow-md">
        <div className="max-w-xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Track your application</h1>
          <p className="mt-2 text-primary-foreground/90">
            Enter your application ID to view its status and details.
          </p>
        </div>
      </section>

      <section className="max-w-xl mx-auto px-4 py-10">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">Application ID</label>
            <input
              className="border p-2 w-full rounded"
              placeholder="e.g. 7f0a6b3c-...."
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <button className="inline-flex items-center bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md shadow-sm">
            Track status
          </button>
        </form>
      </section>
    </main>
  );
}