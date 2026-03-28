import { authClient } from '../lib/auth-client';

export default function DashboardPage() {
  const { data: session } = authClient.useSession();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back{session?.user?.name ? `, ${session.user.name}` : ''}.
        </p>
      </div>
    </div>
  );
}
