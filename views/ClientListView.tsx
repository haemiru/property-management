import React, { useState, useMemo } from 'react';
import { Client, ClientRole } from '../types';
import { Icons } from '../constants';

// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface ClientListViewProps {
  clients: Client[];
  onAdd: (c: Client) => void;
  onUpdate: (c: Client) => void;
  onDelete: (id: string) => void;
}

const ClientListView: React.FC<ClientListViewProps> = ({ clients, onAdd, onUpdate, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<ClientRole | '전체'>('전체');

  const [formData, setFormData] = useState<Partial<Client>>({
    role: ClientRole.LANDLORD
  });

  const filteredClients = useMemo(() => {
    return clients.filter(client => {
      const matchesSearch =
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.phone.includes(searchTerm) ||
        (client.notes && client.notes.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (client.call_history && client.call_history.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesRole = filterRole === '전체' || client.role === filterRole;

      return matchesSearch && matchesRole;
    });
  }, [clients, searchTerm, filterRole]);

  const handleOpenAdd = () => {
    setEditingClient(null);
    setFormData({ role: ClientRole.LANDLORD, name: '', phone: '', notes: '', call_history: '' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (client: Client) => {
    setEditingClient(client);
    setFormData({
      name: client.name,
      phone: client.phone,
      role: client.role,
      notes: client.notes || '',
      call_history: client.call_history || ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    if (editingClient) {
      onUpdate({
        ...editingClient,
        name: formData.name!,
        phone: formData.phone!,
        role: formData.role as ClientRole,
        notes: formData.notes || '',
        call_history: formData.call_history || ''
      });
    } else {
      onAdd({
        id: generateUUID(),
        name: formData.name!,
        phone: formData.phone!,
        role: formData.role as ClientRole,
        notes: formData.notes || '',
        call_history: formData.call_history || ''
      });
    }

    setIsModalOpen(false);
    setEditingClient(null);
    setFormData({ role: ClientRole.LANDLORD });
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
          onClick={handleOpenAdd}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold">{editingClient ? '고객 정보 수정' : '고객 추가'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">닫기</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">성함</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="이름을 입력하세요"
                  value={formData.name || ''}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">연락처</label>
                <input
                  type="tel"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="010-0000-0000"
                  value={formData.phone || ''}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">구분</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  value={formData.role}
                  onChange={e => setFormData({ ...formData, role: e.target.value as ClientRole })}
                >
                  {Object.values(ClientRole).map(role => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">메모</label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none h-20"
                  placeholder="추가적인 정보를 입력하세요"
                  value={formData.notes || ''}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                ></textarea>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">통화 이력 <span className="normal-case font-normal text-slate-400">(최신 이력을 위에 적으세요)</span></label>
                <textarea
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none h-32"
                  placeholder="통화 내용을 기록하세요"
                  value={formData.call_history || ''}
                  onChange={e => setFormData({ ...formData, call_history: e.target.value })}
                ></textarea>
              </div>
              <button className="w-full bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-lg mt-2">
                {editingClient ? '수정 완료' : '고객 등록하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Card Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredClients.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            {searchTerm || filterRole !== '전체' ? '검색 결과가 없습니다.' : '등록된 고객이 없습니다.'}
          </div>
        ) : (
          filteredClients.map(client => (
            <div
              key={client.id}
              className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:border-emerald-200 transition-all cursor-pointer group"
              onClick={() => handleOpenEdit(client)}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-100 to-teal-50 flex items-center justify-center text-emerald-600 border border-emerald-100 group-hover:scale-110 transition-transform">
                  <Icons.Users />
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${client.role === ClientRole.LANDLORD ? 'bg-blue-50 text-blue-600' :
                  client.role === ClientRole.TENANT ? 'bg-orange-50 text-orange-600' :
                    client.role === ClientRole.SELLER ? 'bg-purple-50 text-purple-600' :
                      'bg-emerald-50 text-emerald-600'
                  }`}>
                  {client.role}
                </span>
              </div>

              {/* Client Info */}
              <div className="mb-4">
                <h3 className="font-bold text-lg text-slate-800 mb-1">{client.name}</h3>
                <p className="text-sm text-slate-500">{client.phone}</p>
              </div>

              {/* Notes Preview */}
              {client.notes && (
                <div className="bg-slate-50 rounded-xl p-3 mb-4">
                  <p className="text-xs text-slate-500 line-clamp-2 italic">
                    "{client.notes}"
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <a
                  href={`tel:${client.phone}`}
                  className="flex items-center space-x-1 text-emerald-600 hover:text-emerald-700 text-sm font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
                  <span>전화하기</span>
                </a>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`${client.name} 고객을 삭제하시겠습니까?`)) {
                      onDelete(client.id);
                    }
                  }}
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
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
