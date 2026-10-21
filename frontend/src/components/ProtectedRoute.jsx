import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <div className="relative">
          <div className="w-10 h-10 bg-white text-black flex items-center justify-center rounded-xl shadow-lg animate-pulse">
            <svg viewBox="0 0 76 65" fill="currentColor" className="w-5 h-5">
              <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" />
            </svg>
          </div>
          <div className="absolute -inset-2 rounded-2xl bg-white/5 blur-sm -z-10 animate-ping opacity-30" />
        </div>
        <div className="mt-4 text-xs font-mono text-neutral-500 tracking-wider uppercase">
          Authenticating session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
