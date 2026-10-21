import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import * as D from './AccountReference';
export function Auth({ register = false }: { register?: boolean }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const from = (location.state as { from?: string } | null)?.from;
  const getDestination = (targetUser?: { role?: string } | null) => {
    const role = (targetUser ?? user)?.role;
    if (role === 'admin') {
      return from?.startsWith('/admin') ? from : '/admin';
    }
    if (from && from !== '/' && from.startsWith('/') && !from.startsWith('//')) return from;
    return '/';
  };
  if (user) return <Navigate to={getDestination(user)} replace />;
  return register ? (
    <D.RegisterPage onLogin={() => navigate('/login')} onBack={() => navigate('/login')} />
  ) : (
    <D.LoginPage onLogin={(loggedUser) => navigate(getDestination(loggedUser))} onRegister={() => navigate('/register')} onForgot={() => navigate('/forgot-password')} />
  );
}

export function Forgot() { const navigate = useNavigate(); return <D.ForgotPasswordPage onBack={() => navigate('/login')} />; }

export function Settings() { const navigate = useNavigate(); return <D.SettingsPage onBack={() => navigate('/')} />; }
