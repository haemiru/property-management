
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { Icons } from './constants';
import { Property, Client, ScheduleTask, PropertyType, ClientRole } from './types';
import DashboardView from './views/DashboardView';
import PropertyListView from './views/PropertyListView';
import ClientListView from './views/ClientListView';
import ScheduleView from './views/ScheduleView';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-white shadow-xl relative overflow-hidden">
      <header className="px-4 py-4 bg-indigo-600 text-white flex justify-between items-center shadow-md z-10">
        <h1 className="text-xl font-bold tracking-tight">중개노트</h1>
        <div className="flex space-x-2">
           {/* Add notification or user profile here if needed */}
        </div>
      </header>
      
      <main className="flex-1 overflow-y-auto pb-20 bg-slate-50">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white border-t border-slate-200 flex justify-around py-3 px-2 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-10">
        <NavLink 
          to="/" 
          className={({ isActive }) => `flex flex-col items-center space-y-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Icons.Home />
          <span className="text-[10px] font-medium">홈</span>
        </NavLink>
        <NavLink 
          to="/properties" 
          className={({ isActive }) => `flex flex-col items-center space-y-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Icons.Building />
          <span className="text-[10px] font-medium">매물</span>
        </NavLink>
        <NavLink 
          to="/clients" 
          className={({ isActive }) => `flex flex-col items-center space-y-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Icons.Users />
          <span className="text-[10px] font-medium">고객</span>
        </NavLink>
        <NavLink 
          to="/schedule" 
          className={({ isActive }) => `flex flex-col items-center space-y-1 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
        >
          <Icons.Calendar />
          <span className="text-[10px] font-medium">일정</span>
        </NavLink>
      </nav>
    </div>
  );
};

const App: React.FC = () => {
  const [properties, setProperties] = useState<Property[]>(() => {
    const saved = localStorage.getItem('realtor_properties');
    return saved ? JSON.parse(saved) : [];
  });

  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem('realtor_clients');
    return saved ? JSON.parse(saved) : [];
  });

  const [tasks, setTasks] = useState<ScheduleTask[]>(() => {
    const saved = localStorage.getItem('realtor_tasks');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('realtor_properties', JSON.stringify(properties));
  }, [properties]);

  useEffect(() => {
    localStorage.setItem('realtor_clients', JSON.stringify(clients));
  }, [clients]);

  useEffect(() => {
    localStorage.setItem('realtor_tasks', JSON.stringify(tasks));
  }, [tasks]);

  return (
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<DashboardView properties={properties} clients={clients} tasks={tasks} />} />
          <Route 
            path="/properties" 
            element={
              <PropertyListView 
                properties={properties} 
                clients={clients}
                onAdd={(p) => setProperties([p, ...properties])}
                onDelete={(id) => setProperties(properties.filter(p => p.id !== id))}
              />
            } 
          />
          <Route 
            path="/clients" 
            element={
              <ClientListView 
                clients={clients} 
                onAdd={(c) => setClients([c, ...clients])}
                onDelete={(id) => setClients(clients.filter(c => c.id !== id))}
              />
            } 
          />
          <Route 
            path="/schedule" 
            element={
              <ScheduleView 
                tasks={tasks} 
                clients={clients}
                properties={properties}
                onAdd={(t) => setTasks([t, ...tasks])}
                onUpdate={(updatedTask) => setTasks(tasks.map(t => t.id === updatedTask.id ? updatedTask : t))}
                onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))}
                onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))}
              />
            } 
          />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
