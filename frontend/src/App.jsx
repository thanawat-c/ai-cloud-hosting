import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './pages/DashboardHome';
import DeployForm from './pages/DeployForm';
import AuthPage from './pages/AuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { WorkspaceProvider } from './context/WorkspaceContext';

function DashboardLayout({ isSidebarOpen, setIsSidebarOpen }) {
  return (
    <div className="flex h-screen bg-black text-neutral-100 font-sans overflow-hidden selection:bg-neutral-800 selection:text-white">
      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative bg-black">
        {/* Topbar */}
        <Header setIsSidebarOpen={setIsSidebarOpen} />

        {/* Page Content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-3 sm:p-5 md:p-6 lg:p-8 bg-black">
          <div className="max-w-7xl mx-auto pb-20">
            <Routes>
              <Route path="/" element={<DashboardHome />} />
              <Route path="/deploy" element={<DeployForm />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  );
}

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AuthProvider>
      <WorkspaceProvider>
        <Router>
          <Toaster position="top-right" theme="dark" richColors closeButton expand={false} />
          <Routes>
            <Route path="/login" element={<AuthPage initialMode="login" />} />
            <Route path="/signup" element={<AuthPage initialMode="register" />} />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <DashboardLayout
                    isSidebarOpen={isSidebarOpen}
                    setIsSidebarOpen={setIsSidebarOpen}
                  />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Router>
      </WorkspaceProvider>
    </AuthProvider>
  );
}

export default App;