import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { Icons } from './constants';
import { Property, Client, ScheduleTask } from './types';
import DashboardView from './views/DashboardView';
import PropertyListView from './views/PropertyListView';
import ClientListView from './views/ClientListView';
import ScheduleView from './views/ScheduleView';
import SettingsView from './views/SettingsView';
import LoginView from './views/LoginView';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { supabase } from './src/lib/supabase';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { signOut, user } = useAuth();

  return (
    <div className="flex h-screen bg-slate-100">
      {/* Fixed Left Sidebar */}
      <aside className="w-64 bg-indigo-700 text-white flex flex-col shadow-xl">
        {/* Logo / Header */}
        <div className="p-6 border-b border-indigo-600">
          <h1 className="text-2xl font-bold tracking-tight">중개노트</h1>
          <p className="text-indigo-300 text-xs mt-1">부동산 관리 시스템</p>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-4 space-y-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-white text-indigo-700 shadow-lg font-semibold'
                : 'text-indigo-100 hover:bg-indigo-600'
              }`
            }
          >
            <Icons.Home />
            <span>대시보드</span>
          </NavLink>
          <NavLink
            to="/properties"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-white text-indigo-700 shadow-lg font-semibold'
                : 'text-indigo-100 hover:bg-indigo-600'
              }`
            }
          >
            <Icons.Building />
            <span>매물 관리</span>
          </NavLink>
          <NavLink
            to="/clients"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-white text-indigo-700 shadow-lg font-semibold'
                : 'text-indigo-100 hover:bg-indigo-600'
              }`
            }
          >
            <Icons.Users />
            <span>고객 관리</span>
          </NavLink>
          <NavLink
            to="/schedule"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-white text-indigo-700 shadow-lg font-semibold'
                : 'text-indigo-100 hover:bg-indigo-600'
              }`
            }
          >
            <Icons.Calendar />
            <span>일정 관리</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${isActive
                ? 'bg-white text-indigo-700 shadow-lg font-semibold'
                : 'text-indigo-100 hover:bg-indigo-600'
              }`
            }
          >
            <Icons.Settings />
            <span>환경설정</span>
          </NavLink>
        </nav>

        {/* User Section at Bottom */}
        <div className="p-4 border-t border-indigo-600">
          <div className="flex items-center justify-between">
            <div className="text-xs text-indigo-300 truncate max-w-[140px]">
              {user?.email || '사용자'}
            </div>
            <button
              onClick={signOut}
              className="text-indigo-200 hover:text-white text-xs border border-indigo-500 px-3 py-1.5 rounded-lg hover:bg-indigo-600 transition-colors"
            >
              로그아웃
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area with Header */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header Bar */}
        <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between shadow-sm">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">환영합니다!</h2>
            <p className="text-xs text-slate-500">오늘도 좋은 하루 되세요</p>
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <p className="text-sm font-medium text-slate-700">{user?.email?.split('@')[0] || '사용자'}</p>
              <p className="text-xs text-slate-400">{new Date().toLocaleDateString('ko-KR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              {user?.email?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Scrollable Content */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

const AuthenticatedApp: React.FC = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<Property[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [tasks, setTasks] = useState<ScheduleTask[]>([]);
  const [loadingConfig, setLoadingConfig] = useState(true);

  // Fetch Data from Supabase
  const fetchData = async () => {
    if (!user) return;
    setLoadingConfig(true);
    try {
      const [propRes, clientRes, taskRes] = await Promise.all([
        supabase.from('properties').select('*').order('updated_at', { ascending: false, nullsFirst: false }),
        supabase.from('clients').select('*').order('updated_at', { ascending: false, nullsFirst: false }),
        supabase.from('tasks').select('*').order('created_at', { ascending: false })
      ]);

      if (propRes.error) console.error('Error fetching properties:', propRes.error);
      if (clientRes.error) console.error('Error fetching clients:', clientRes.error);
      if (taskRes.error) console.error('Error fetching tasks:', taskRes.error);

      if (propRes.data) setProperties(propRes.data as any);
      if (clientRes.data) setClients(clientRes.data as any);
      if (taskRes.data) setTasks(taskRes.data as any);
    } catch (error) {
      console.error('Error fetching data (Promise):', error);
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  // Data Handlers using Supabase
  const handleAddProperty = async (p: Property) => {
    if (!user) return;
    const { error } = await supabase.from('properties').insert([{ ...p, user_id: user.id }]);
    if (error) {
      console.error('Error adding property:', error);
      alert('매물 등록 중 오류가 발생했습니다: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleUpdateProperty = async (p: Property) => {
    if (!user) return;
    const { error } = await supabase.from('properties').update(p).eq('id', p.id);
    if (error) {
      console.error('Error updating property:', error);
      alert('매물 수정 중 오류가 발생했습니다: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleDeleteProperty = async (id: string) => {
    const { error } = await supabase.from('properties').delete().eq('id', id);
    if (!error) fetchData();
  };

  const handleAddClient = async (c: Client) => {
    if (!user) {
      alert('로그인이 필요합니다.');
      return;
    }
    console.log('Attempting to add client:', c, 'User:', user.id);
    const { data, error } = await supabase.from('clients').insert([{ ...c, user_id: user.id }]);

    if (error) {
      console.error('Error adding client:', error);
      alert('고객 등록 실패: ' + error.message + ' (Code: ' + error.code + ')');
    } else {
      console.log('Client added successfully');
      fetchData();
    }
  };

  const handleUpdateClient = async (updatedClient: Client) => {
    if (!user) return;
    const { error } = await supabase.from('clients').update(updatedClient).eq('id', updatedClient.id);
    if (error) {
      console.error('Error updating client:', error);
      alert('고객 수정 실패: ' + error.message);
    } else {
      fetchData();
    }
  };

  const handleDeleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) fetchData();
  };

  const handleAddTask = async (t: ScheduleTask) => {
    if (!user) return;
    const { error } = await supabase.from('tasks').insert([{ ...t, user_id: user.id }]);
    if (!error) fetchData();
  };

  const handleUpdateTask = async (updatedTask: ScheduleTask) => {
    const { error } = await supabase.from('tasks').update(updatedTask).eq('id', updatedTask.id);
    if (!error) fetchData();
  };

  const handleTaskToggle = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (task) {
      await handleUpdateTask({ ...task, completed: !task.completed });
    }
  };

  const handleDeleteTask = async (id: string) => {
    const { error } = await supabase.from('tasks').delete().eq('id', id);
    if (!error) fetchData();
  };


  if (loadingConfig) {
    return <div className="flex h-screen items-center justify-center bg-slate-50">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
    </div>;
  }

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
                onAdd={handleAddProperty}
                onUpdate={handleUpdateProperty}
                onDelete={handleDeleteProperty}
              />
            }
          />
          <Route
            path="/clients"
            element={
              <ClientListView
                clients={clients}
                onAdd={handleAddClient}
                onUpdate={handleUpdateClient}
                onDelete={handleDeleteClient}
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
                onAdd={handleAddTask}
                onUpdate={handleUpdateTask}
                onToggle={handleTaskToggle}
                onDelete={handleDeleteTask}
              />
            }
          />
          <Route path="/settings" element={<SettingsView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

const AppContent: React.FC = () => {
  const { session, loading } = useAuth();

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-50">로딩 중...</div>;
  }

  if (!session) {
    return <LoginView />;
  }

  return <AuthenticatedApp />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
