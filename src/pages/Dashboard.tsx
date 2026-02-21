import DeveloperDashboard from "@/pages/DeveloperDashboard";
import { useAuth } from "@/lib/auth";

export default function Dashboard() {
  const { user, isDeveloper, loading } = useAuth();

  if (loading) return <main className="p-6">Loading...</main>;
  if (!user) return <main className="p-6">Please log in.</main>;

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-gradient-hero text-primary-foreground py-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {isDeveloper ? "Developer Dashboard" : "Citizen Dashboard"}
          </h1>
          {!isDeveloper && (
            <p className="mt-2 text-primary-foreground/90">Welcome {user.email}</p>
          )}
        </div>
      </section>

      {isDeveloper ? (
        <section className="max-w-6xl mx-auto px-4 py-8">
          <DeveloperDashboard />
        </section>
      ) : (
        <section className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <div className="bg-card text-card-foreground rounded-lg p-6 shadow-md border border-border">
            <h2 className="text-xl font-semibold mb-2">Start a new permit application</h2>
            <p className="text-muted-foreground">
              Submit online and track progress in real-time.
            </p>
            <a
              href="/apply"
              className="mt-4 inline-flex items-center bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md shadow-sm"
            >
              Start application
            </a>
          </div>

          <div className="bg-card text-card-foreground rounded-lg p-6 shadow-md border border-border">
            <h2 className="text-xl font-semibold mb-2">My permits</h2>
            <p className="text-muted-foreground">
              View statuses, decisions, and download issued permits.
            </p>
            <a
              href="/my-permits"
              className="mt-4 inline-flex items-center bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md shadow-sm"
            >
              My permits
            </a>
          </div>
        </section>
      )}
    </main>
  );
}