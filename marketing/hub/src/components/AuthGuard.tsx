import type { FC, ReactNode } from 'react';

interface AuthGuardProps {
  children: ReactNode;
}

const AuthGuard: FC<AuthGuardProps> = ({ children }) => {
  // Frontend-only app — no auth required
  return <>{children}</>;
};

export default AuthGuard;
