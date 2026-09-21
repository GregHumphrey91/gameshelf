import { Route, Routes } from 'react-router-dom';
import { LoginCallback } from '@okta/okta-react';
import { LOGIN_CALLBACK_PATH } from '@/auth/oktaAuth';
import { LoginError } from '@/auth/LoginError';
import { useAuth } from '@/hooks/useAuth';
import { ShelfPage } from '@/pages/ShelfPage';

export default function App() {
  const { enabled } = useAuth();

  return (
    <Routes>
      {/* The redirect target of the sign-in flow. Only registered with an identity provider:
          LoginCallback reads okta-react's context, which does not exist in local mode. */}
      {enabled && <Route path={LOGIN_CALLBACK_PATH} element={<LoginCallback errorComponent={LoginError} />} />}
      <Route path="*" element={<ShelfPage />} />
    </Routes>
  );
}
