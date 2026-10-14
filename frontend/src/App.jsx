import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DashboardHome from './pages/DashboardHome';
import DeployForm from './pages/DeployForm';

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <Router>
      <div className="flex h-screen bg-slate-50 font-sans overflow-hidden selection:bg-blue-200">
        
        {/* Sidebar */}
        <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} />

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
          
          {/* Topbar */}
          <Header setIsSidebarOpen={setIsSidebarOpen} />

          {/* Page Content */}
          <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-8 bg-slate-50/50">
            <div className="max-w-7xl mx-auto pb-20">
              <Routes>
                <Route path="/" element={<DashboardHome />} />
                <Route path="/deploy" element={<DeployForm />} />
              </Routes>
            </div>
          </main>
          
        </div>
      </div>
    </Router>
  );
}

export default App;