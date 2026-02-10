
import React, { useState } from 'react';
import { ScheduleTask, Client, Property } from '../types';
import { Icons } from '../constants';

// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface ScheduleViewProps {
  tasks: ScheduleTask[];
  clients: Client[];
  properties: Property[];
  onAdd: (t: ScheduleTask) => void;
  onUpdate: (t: ScheduleTask) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const ScheduleView: React.FC<ScheduleViewProps> = ({ tasks, clients, properties, onAdd, onUpdate, onToggle, onDelete }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [formState, setFormState] = useState<Partial<ScheduleTask>>({
    date: new Date().toISOString().split('T')[0],
    time: '14:00'
  });

  const handleOpenAddModal = () => {
    setEditingTaskId(null);
    setFormState({
      date: new Date().toISOString().split('T')[0],
      time: '14:00'
    });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (task: ScheduleTask) => {
    setEditingTaskId(task.id);
    setFormState({
      title: task.title,
      date: task.date,
      time: task.time,
      clientId: task.clientId,
      propertyId: task.propertyId
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.title || !formState.date) return;

    if (editingTaskId) {
      const existingTask = tasks.find(t => t.id === editingTaskId);
      if (existingTask) {
        onUpdate({
          ...existingTask,
          title: formState.title!,
          date: formState.date!,
          time: formState.time || '',
          clientId: formState.clientId,
          propertyId: formState.propertyId,
        });
      }
    } else {
      onAdd({
        id: generateUUID(),
        title: formState.title!,
        date: formState.date!,
        time: formState.time || '',
        clientId: formState.clientId,
        propertyId: formState.propertyId,
        completed: false
      });
    }

    setIsModalOpen(false);
  };

  const sortedTasks = [...tasks].sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) return dateCompare;
    return a.time.localeCompare(b.time);
  });

  const now = new Date();

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold">일정 관리</h2>
        <button
          onClick={handleOpenAddModal}
          className="bg-amber-500 text-white p-2 rounded-full shadow-lg"
        >
          <Icons.Plus />
        </button>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold">{editingTaskId ? '일정 수정' : '일정 추가'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400">닫기</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">일정 내용</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="예: 미팅, 현장 방문 등"
                  value={formState.title || ''}
                  onChange={e => setFormState({ ...formState, title: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">날짜</label>
                  <input
                    type="date"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={formState.date}
                    onChange={e => setFormState({ ...formState, date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">시간</label>
                  <input
                    type="time"
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={formState.time}
                    onChange={e => setFormState({ ...formState, time: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">관련 고객 (선택)</label>
                <select
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  value={formState.clientId || ''}
                  onChange={e => setFormState({ ...formState, clientId: e.target.value })}
                >
                  <option value="">고객 선택 없음</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <button className={`w-full text-white font-bold py-3 rounded-xl shadow-lg mt-2 ${editingTaskId ? 'bg-indigo-600' : 'bg-amber-500'}`}>
                {editingTaskId ? '수정 완료' : '일정 추가하기'}
              </button>
            </form>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {sortedTasks.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            일정이 비어있습니다.
          </div>
        ) : (
          sortedTasks.map(task => {
            const client = clients.find(c => c.id === task.clientId);
            const taskDateTime = new Date(`${task.date}T${task.time || '00:00'}`);
            const isOverdue = !task.completed && taskDateTime < now;

            return (
              <div key={task.id} className={`p-4 rounded-xl border border-slate-100 shadow-sm flex items-start space-x-3 transition-all ${task.completed ? 'bg-slate-50 opacity-60' : 'bg-white'} ${isOverdue ? 'border-red-100' : ''}`}>
                <button
                  onClick={() => onToggle(task.id)}
                  className={`mt-1 h-5 w-5 rounded-md border flex-shrink-0 flex items-center justify-center transition-colors ${task.completed ? 'bg-indigo-600 border-indigo-600' : (isOverdue ? 'bg-white border-red-500' : 'bg-white border-slate-300')}`}
                >
                  {task.completed && (
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isOverdue && !task.completed && (
                    <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                  )}
                </button>
                <div className="flex-1">
                  <h3 className={`font-bold transition-colors ${task.completed ? 'line-through text-slate-400' : (isOverdue ? 'text-red-500' : 'text-slate-800')}`}>
                    {task.title}
                  </h3>
                  <p className={`text-xs mt-0.5 ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                    {task.date} {task.time} {isOverdue && '(기한 만료)'}
                  </p>
                  {client && (
                    <div className="mt-2 flex items-center text-[10px] bg-slate-100 text-slate-600 w-max px-2 py-0.5 rounded-full">
                      <Icons.Users />
                      <span className="ml-1">{client.name} ({client.phone})</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col space-y-2">
                  <button
                    onClick={() => handleOpenEditModal(task)}
                    className="text-slate-300 hover:text-indigo-600 transition-colors p-1"
                    title="수정"
                  >
                    <Icons.Edit />
                  </button>
                  <button
                    onClick={() => onDelete(task.id)}
                    className="text-slate-300 hover:text-red-500 transition-colors p-1"
                    title="삭제"
                  >
                    <Icons.Trash />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default ScheduleView;
