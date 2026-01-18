
import React, { useState, useMemo } from 'react';
import { Client, ClientRole } from '../types';
import { Icons } from '../constants';

interface ClientListViewProps {
  clients: Client[];
  onAdd: (c: Client) => void;
  onDelete: (id: string) => void;
}

const ClientListView: React.FC<ClientListViewProps> = ({ clients, onAdd, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<ClientRole | '전체'>('전체');

  const [newClient, setNewClient] = useState<Partial<Client>>({
    role: ClientRole.LANDLORD
  });

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch = 
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        (client.notes && client.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesRole = filterRole === '전체' || client.role === filterRole;

      return matchesSearch && matchesRole;
    });
  }, [clients, searchTerm, filterRole]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClient.name || !newClient.phone) return;
    
    onAdd({
      id: Date.now().toString(),
      name: newClient.name!,
      phone: newClient.phone!,
      role: newClient.role as ClientRole,
      notes: newClient.notes || ''
    });
    setNewClient({ role: ClientRole.LANDLORD });
    setIsAdding(false);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterRole('전체');
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">고객 관리</h2>
        <button 
          onClick={() => setIsAdding(true)}
          className="bg-emerald-600 text-white p-2 rounded-full shadow-lg"
        >
          <Icons.Plus />
        </button>
      </div>

      {/* Search & Filter Header */}
      <div className="space-y-3 mb-6">
        <div className="flex space-x-2">
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
              <Icons.Search />
            </div>
            <input 
              type="text" 
              placeholder="이름, 연락처 또는 메모 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 rounded-xl border transition-all flex items-center space-x-1 ${showFilters ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
            <span className="text-xs font-bold">필터</span>
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">고객 구분</label>
              <div className="flex flex-wrap gap-2">
                <button 
                  onClick={() => setFilterRole('전체')}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterRole === '전체' ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                >
                  전체
                </button>
                {Object.values(ClientRole).map(role => (
                  <button 
                    key={role}
                    onClick={() => setFilterRole(role)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filterRole === role ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600'}`}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <button 
              onClick={resetFilters}
              className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-emerald-600 transition-colors border-t border-slate-100 mt-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold">고객 추가</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400">닫기</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">성함</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" 
                  placeholder="이름을 입력하세요"
                  value={newClient.name || ''}
                  onChange={e => setNewClient({...newClient, name: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">연락처</label>
                <input 
                  type="tel" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" 
                  placeholder="010-0000-0000"
                  value={newClient.phone || ''}
                  onChange={e => setNewClient({...newClient, phone: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">구분</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  value={newClient.role}
                  onChange={e => setNewClient({...newClient, role: e.target.value as ClientRole})}
                >
                  {Object.values(ClientRole).map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">메모</label>
                <textarea 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none h-20" 
                  placeholder="추가적인 정보를 입력하세요"
                  value={newClient.notes || ''}
                  onChange={e => setNewClient({...newClient, notes: e.target.value})}
                ></textarea>
              </div>
              <button className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg mt-2">
                고객 등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {filteredClients.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
             {searchTerm || filterRole !== '전체' ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
          </div>
        ) : (
          filteredClients.map(client => (
            <div key={client.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                  <Icons.Users />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 flex items-center">
                    {client.name} 
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ml-2 ${
                      client.role === ClientRole.LANDLORD ? 'bg-blue-50 text-blue-600' :
                      client.role === ClientRole.TENANT ? 'bg-orange-50 text-orange-600' :
                      client.role === ClientRole.SELLER ? 'bg-purple-50 text-purple-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      {client.role}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">{client.phone}</p>
                  {client.notes && (
                    <p className="text-[11px] text-slate-400 mt-2 line-clamp-1 italic">
                      "{client.notes}"
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col space-y-2">
                <a href={`tel:${client.phone}`} className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-full transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </a>
                <button 
                  onClick={() => onDelete(client.id)}
                  className="p-1.5 text-slate-300 hover:text-red-500 transition-colors rounded-full"
                >
                  <Icons.Trash />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ClientListView;
