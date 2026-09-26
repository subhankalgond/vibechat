import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useEffect } from 'react';

const BASE_TITLE = 'VibeChat | Private messaging for real conversations';

import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';
import Terms from './pages/auth/Terms';
import AppLayout from './layouts/AppLayout';
import Messages from './pages/app/Messages';
import Chat from './pages/app/Chat';
import Search from './pages/app/Search';
import Profile from './pages/app/Profile';
import UserProfile from './pages/app/UserProfile';
import Settings from './pages/app/Settings';
import NotFound from './pages/NotFound';
import CallOverlay from './components/call/CallOverlay';
import { useCall } from './context/CallContext';

function FullPageSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 dark:bg-neutral-950">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-600 border-t-transparent" role="status" aria-label="Loading" />
    </div>
  );
}

/** Mounts the global call overlay inside the authenticated shell. */
function CallLayer() {
  const { incoming, active } = useCall();
  if (!incoming && !active) return null;
  return <CallOverlay />;
}

function Protected() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { user } = useAuth();
  if (user) return <Navigate to="/app/messages" replace />;
  return <Outlet />;
}

export default function App() {
  const { user, initializing } = useAuth();

  useEffect(() => {
    return () => {
      document.title = BASE_TITLE;
    };
  }, []);

  if (initializing) return <FullPageSpinner />;

  return (
    <>
      <Routes>
      <Route path="/" element={<Navigate to={user ? '/app/messages' : '/login'} replace />} />

      <Route element={<GuestOnly />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      <Route path="/terms" element={<Terms />} />

      <Route element={<Protected />}>
        <Route path="/app" element={<AppLayout />}>
          <Route index element={<Navigate to="messages" replace />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:conversationId" element={<Chat />} />
          <Route path="search" element={<Search />} />
          <Route path="profile" element={<Profile />} />
          <Route path="u/:username" element={<UserProfile />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
      <CallLayer />
    </>
  );
}
