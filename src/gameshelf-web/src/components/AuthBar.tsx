import type { AuthStatus } from '@/auth/authClient';
import type { UserRole } from '@/types/user';

interface AuthBarProps {
  enabled: boolean;
  status: AuthStatus;
  email: string | null;
  role: UserRole | null | undefined;
  onSignIn: () => void;
  onSignOut: () => void;
}

/** Header strip: who is signed in, what they may do, and the way in or out. */
export function AuthBar({ enabled, status, email, role, onSignIn, onSignOut }: AuthBarProps) {
  if (!enabled) {
    return (
      <div className="auth-bar" data-testid="auth-bar">
        <span className="auth-bar__note" data-testid="auth-disabled">
          Local mode
        </span>
        {role && <RoleBadge role={role} />}
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="auth-bar" data-testid="auth-bar" />;
  }

  if (status === 'signed-out') {
    return (
      <div className="auth-bar" data-testid="auth-bar">
        <button type="button" onClick={onSignIn} data-testid="sign-in">
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="auth-bar" data-testid="auth-bar">
      {email && (
        <span className="auth-bar__note" data-testid="user-email">
          {email}
        </span>
      )}
      {role && <RoleBadge role={role} />}
      <button type="button" onClick={onSignOut} data-testid="sign-out">
        Sign out
      </button>
    </div>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className="badge badge--role" data-testid="role-badge">
      {role}
    </span>
  );
}
