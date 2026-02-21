import { useAuth } from "@/lib/auth";

export default function CitizenDashboard() {
  const { user } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Citizen Dashboard</h1>
      <p>Welcome {user?.email ?? "citizen"}.</p>
      <a href="/apply" className="mt-4 inline-block bg-blue-600 text-white px-4 py-2 rounded">
        Start application
      </a>
    </div>
  );
}
