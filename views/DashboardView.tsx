
import React from 'react';
import { Property, Client, ScheduleTask } from '../types';
import { Icons } from '../constants';

interface DashboardViewProps {
  properties: Property[];
  clients: Client[];
  tasks: ScheduleTask[];
}

const DashboardView: React.FC<DashboardViewProps> = ({ properties, clients, tasks }) => {
  const pendingTasks = tasks.filter(t => !t.completed);
  const recentProperties = properties.slice(0, 3);
  const now = new Date();

  return (
    <div className="p-4 space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 flex flex-col items-center">
          <span className="text-3xl font-bold text-indigo-600">{properties.length}</span>
          <span className="text-xs font-medium text-slate-500 mt-1">등록 매물</span>
        </div>
        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex flex-col items-center">
          <span className="text-3xl font-bold text-emerald-600">{clients.length}</span>
          <span className="text-xs font-medium text-slate-500 mt-1">보유 고객</span>
        </div>
      </div>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="bg-amber-100 p-1 rounded-md mr-2"><Icons.Calendar /></span>
          오늘의 일정 ({pendingTasks.length})
        </h2>
        <div className="space-y-2">
          {pendingTasks.length > 0 ? (
            pendingTasks.slice(0, 3).map(task => {
              const taskDateTime = new Date(`${task.date}T${task.time || '00:00'}`);
              const isOverdue = taskDateTime < now;

              return (
                <div key={task.id} className={`bg-white p-3 rounded-xl border shadow-sm flex items-center justify-between ${isOverdue ? 'border-red-100' : 'border-slate-100'}`}>
                  <div className="min-w-0 flex-1">
                    <p className={`font-semibold truncate ${isOverdue ? 'text-red-600' : 'text-slate-700'}`}>
                      {task.title}
                    </p>
                    <p className={`text-xs ${isOverdue ? 'text-red-400 font-medium' : 'text-slate-400'}`}>
                      {task.date} {task.time} {isOverdue && ' (지연됨)'}
                    </p>
                  </div>
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ml-2 ${isOverdue ? 'bg-red-500 animate-pulse' : 'bg-amber-400'}`}></div>
                </div>
              );
            })
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">일정이 없습니다.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-bold mb-3 flex items-center">
          <span className="bg-blue-100 p-1 rounded-md mr-2"><Icons.Building /></span>
          최근 등록 매물
        </h2>
        <div className="space-y-3">
          {recentProperties.length > 0 ? (
            recentProperties.map(prop => (
              <div key={prop.id} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex gap-3">
                <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                  {prop.images[0] ? (
                    <img src={prop.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Icons.Building />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 truncate">{prop.title}</p>
                  <p className="text-xs text-indigo-600 font-medium">{prop.type} • {prop.price}</p>
                  <p className="text-[10px] text-slate-400 truncate">{prop.address}</p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-400 text-center py-4">등록된 매물이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
};

export default DashboardView;
