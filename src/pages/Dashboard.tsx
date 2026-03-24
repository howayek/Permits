import DeveloperDashboard from "@/pages/DeveloperDashboard";
import { useAuth } from "@/lib/auth";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { FileText, Shield, ClipboardList, Database } from "lucide-react";

export default function Dashboard() {
  const { user, isDeveloper, isGovernment, loading } = useAuth();

  if (loading) return <main className="p-6">Loading...</main>;
  if (!user) return <main className="p-6">Please log in.</main>;

  const dashboardTitle = isDeveloper
    ? "Developer Dashboard"
    : isGovernment
      ? "Government Dashboard"
      : "Citizen Dashboard";

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-gradient-hero text-primary-foreground py-10 shadow-md">
        <div className="max-w-5xl mx-auto px-4">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
            {dashboardTitle}
          </h1>
          <p className="mt-2 text-primary-foreground/90">
            Welcome, {user.user_metadata?.full_name || user.email}
          </p>
        </div>
      </section>

      {isDeveloper ? (
        <section className="max-w-6xl mx-auto px-4 py-8">
          <DeveloperDashboard />
        </section>
      ) : isGovernment ? (
        <section className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <DashCard
              icon={<ClipboardList className="w-6 h-6 text-primary" />}
              title="Review Queue"
              description="View pending applications, approve, reject, or request additional information."
              href="/gov"
              linkText="Open review queue"
            />
            <DashCard
              icon={<Database className="w-6 h-6 text-primary" />}
              title="Applications Database"
              description="Search and filter all applications across municipalities and permit types."
              href="/gov/database"
              linkText="Open database"
            />
          </div>
        </section>
      ) : (
        <section className="max-w-5xl mx-auto px-4 py-10 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <DashCard
              icon={<FileText className="w-6 h-6 text-primary" />}
              title="Start a new application"
              description="Submit a permit application online and track progress in real-time."
              href="/apply"
              linkText="Start application"
            />
            <DashCard
              icon={<Shield className="w-6 h-6 text-primary" />}
              title="My permits"
              description="View statuses, decisions, and download issued permits."
              href="/my-permits"
              linkText="View my permits"
            />
          </div>
        </section>
      )}
    </main>
  );
}

function DashCard({
  icon,
  title,
  description,
  href,
  linkText,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
  linkText: string;
}) {
  return (
    <Card className="p-6 shadow-md border border-border flex flex-col">
      <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
        {icon}
      </div>
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-muted-foreground mb-4 flex-1">{description}</p>
      <Link
        to={href}
        className="inline-flex items-center bg-accent text-accent-foreground hover:bg-accent/90 px-4 py-2 rounded-md shadow-sm self-start"
      >
        {linkText}
      </Link>
    </Card>
  );
}
