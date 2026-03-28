import { Link, useNavigate } from 'react-router';
import { authClient } from '../lib/auth-client';

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <nav className="flex items-center gap-6">
            <Link to="/" className="font-semibold">
              Todo Buddy
            </Link>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
              Todos
            </Link>
          </nav>
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
