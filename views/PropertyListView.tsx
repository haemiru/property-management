
import React, { useState, useMemo, useRef } from 'react';
import { Property, PropertyType, TransactionType, Client } from '../types';
import { Icons } from '../constants';
import { generatePropertyDescription } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

interface PropertyListViewProps {
  properties: Property[];
  clients: Client[];
  onAdd: (p: Property) => void;
  onDelete: (id: string) => void;
}

const PropertyListView: React.FC<PropertyListViewProps> = ({ properties, clients, onAdd, onDelete }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | '전체'>('전체');
  const [filterTransaction, setFilterTransaction] = useState<TransactionType | '전체'>('전체');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [filterClientId, setFilterClientId] = useState<string>('');

  const [newProp, setNewProp] = useState<Partial<Property>>({
    type: PropertyType.HOUSE,
    transactionType: TransactionType.SALE,
    images: [],
    priceAmount: 0
  });
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [gpsStatus, setGpsStatus] = useState<string>('');

  const filteredProperties = useMemo(() => {
    return properties.filter(prop => {
      const matchesSearch = prop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          prop.address.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = filterType === '전체' || prop.type === filterType;
      const matchesTransaction = filterTransaction === '전체' || prop.transactionType === filterTransaction;
      
      const priceNum = prop.priceAmount || 0;
      const matchesMinPrice = minPrice === '' || priceNum >= parseInt(minPrice);
      const matchesMaxPrice = maxPrice === '' || priceNum <= parseInt(maxPrice);
      
      const matchesClient = filterClientId === '' || prop.clientId === filterClientId;

      return matchesSearch && matchesType && matchesTransaction && matchesMinPrice && matchesMaxPrice && matchesClient;
    });
  }, [properties, searchTerm, filterType, filterTransaction, minPrice, maxPrice, filterClientId]);

  const selectedProperty = useMemo(() => 
    properties.find(p => p.id === selectedPropertyId), 
    [properties, selectedPropertyId]
  );

  const handleShareProperty = async () => {
    if (!selectedProperty || !reportRef.current) return;
    
    setIsSharing(true);
    try {
      // 1. Generate Canvas from the hidden report template
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.85);
      
      // 2. Create PDF
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      
      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `${selectedProperty.title}_보고서.pdf`, { type: 'application/pdf' });

      // 3. Share via Web Share API
      if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `[중개노트] ${selectedProperty.title} 매물 보고서`,
          text: `${selectedProperty.price} - ${selectedProperty.address}`
        });
      } else {
        // Fallback for desktop: download the file
        pdf.save(`${selectedProperty.title}_보고서.pdf`);
        alert('모바일 공유가 지원되지 않는 환경입니다. 보고서가 다운로드되었습니다.');
      }
    } catch (error) {
      console.error('PDF Sharing failed:', error);
      alert('보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleExportCSV = () => {
    if (filteredProperties.length === 0) return;

    const headers = ['매물명', '구분', '거래종류', '가격(표시)', '금액(만원)', '주소', '설명', '연결고객', '사진개수', '등록일'];
    const rows = filteredProperties.map(p => [
      `"${p.title.replace(/"/g, '""')}"`,
      p.type,
      p.transactionType,
      `"${p.price.replace(/"/g, '""')}"`,
      p.priceAmount,
      `"${p.address.replace(/"/g, '""')}"`,
      `"${p.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`,
      `"${(clients.find(c => c.id === p.clientId)?.name || '').replace(/"/g, '""')}"`,
      p.images.length,
      new Date(p.createdAt).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `중개노트_매물내역_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach((file: File) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setNewProp(prev => ({
            ...prev,
            images: [...(prev.images || []), reader.result as string]
          }));
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const getGPSLocation = (): Promise<{lat: number, lng: number} | undefined> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn("Geolocation not supported");
        resolve(undefined);
        return;
      }
      setGpsStatus('위치 확인 중...');
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        (error) => {
          console.error("GPS error:", error);
          setGpsStatus('위치 확인 실패');
          resolve(undefined);
        },
        { timeout: 5000 }
      );
    });
  };

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    setGpsStatus('');
    const location = await getGPSLocation();
    const details = `${newProp.type} ${newProp.transactionType} 매물, 제목: ${newProp.title || '미정'}, 주소: ${newProp.address || '정보 없음'}, 가격: ${newProp.price || '협의'}`;
    const aiDesc = await generatePropertyDescription(details, location);
    setNewProp(prev => ({ ...prev, description: aiDesc }));
    setIsGenerating(false);
    setGpsStatus('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProp.title) return;
    
    onAdd({
      id: Date.now().toString(),
      title: newProp.title!,
      type: newProp.type as PropertyType,
      transactionType: newProp.transactionType as TransactionType,
      price: newProp.price || '협의',
      priceAmount: Number(newProp.priceAmount) || 0,
      address: newProp.address || '',
      description: newProp.description || '',
      images: newProp.images || [],
      clientId: newProp.clientId,
      createdAt: Date.now()
    });
    setNewProp({ type: PropertyType.HOUSE, transactionType: TransactionType.SALE, images: [], priceAmount: 0 });
    setIsAdding(false);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterType('전체');
    setFilterTransaction('전체');
    setMinPrice('');
    setMaxPrice('');
    setFilterClientId('');
  };

  // Property Detail View Component
  if (selectedProperty) {
    const connectedClient = clients.find(c => c.id === selectedProperty.clientId);
    return (
      <div className="animate-in fade-in slide-in-from-right-4 duration-300">
        {/* Hidden Report Template for PDF Generation */}
        <div id="pdf-report-template" ref={reportRef} style={{ fontFamily: 'Inter, sans-serif' }}>
          <div style={{ borderBottom: '2px solid #4f46e5', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <div>
              <h1 style={{ fontSize: '32px', fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}>매물 보고서</h1>
              <p style={{ fontSize: '14px', color: '#64748b' }}>중개노트 - 스마트 부동산 비서</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: '12px', color: '#94a3b8' }}>발행일: {new Date().toLocaleDateString()}</p>
            </div>
          </div>

          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px' }}>{selectedProperty.title}</h2>

          <div style={{ width: '100%', height: '400px', backgroundColor: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', marginBottom: '30px' }}>
            {selectedProperty.images[0] ? (
              <img src={selectedProperty.images[0]} style={{ width: '100%', height: '100%', objectCover: 'cover' }} alt="매물 사진" />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#cbd5e1', fontSize: '14px' }}>사진 없음</div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px', marginBottom: '30px' }}>
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>매물 종류</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold' }}>{selectedProperty.type} ({selectedProperty.transactionType})</p>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '20px', borderRadius: '12px', border: '1px solid #f1f5f9' }}>
              <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '4px', textTransform: 'uppercase' }}>거래 금액</p>
              <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#4f46e5' }}>{selectedProperty.price}</p>
            </div>
          </div>

          <div style={{ marginBottom: '30px' }}>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '8px', textTransform: 'uppercase' }}>소재지</p>
            <p style={{ fontSize: '16px' }}>{selectedProperty.address}</p>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '30px' }}>
            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 'bold', marginBottom: '12px', textTransform: 'uppercase' }}>상세 설명</p>
            <p style={{ fontSize: '14px', color: '#334155', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{selectedProperty.description}</p>
          </div>

          <div style={{ marginTop: '50px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0', textAlign: 'center' }}>
            <p style={{ fontSize: '10px', color: '#94a3b8' }}>본 자료는 공인중개사 전용 업무 앱 '중개노트'에서 생성되었습니다.</p>
          </div>
        </div>

        <div className="bg-white border-b border-slate-100 p-4 sticky top-0 z-20 flex items-center space-x-2">
          <button 
            onClick={() => setSelectedPropertyId(null)}
            className="p-1 hover:bg-slate-100 rounded-full transition-colors text-slate-600 mr-2"
          >
            <Icons.ChevronLeft />
          </button>
          <h2 className="font-bold text-lg truncate flex-1">{selectedProperty.title}</h2>
          
          <div className="flex items-center space-x-1">
            <button 
              onClick={handleShareProperty}
              disabled={isSharing}
              className={`p-2 rounded-full transition-colors ${isSharing ? 'bg-slate-100 text-slate-400' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}
              title="보고서 공유"
            >
              {isSharing ? (
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
              ) : (
                <Icons.Share />
              )}
            </button>
            <button 
              onClick={() => {
                if (confirm('정말로 이 매물을 삭제하시겠습니까?')) {
                  onDelete(selectedProperty.id);
                  setSelectedPropertyId(null);
                }
              }}
              className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
            >
              <Icons.Trash />
            </button>
          </div>
        </div>

        <div className="pb-8">
          {/* Image Gallery */}
          <div className="flex overflow-x-auto snap-x snap-mandatory bg-slate-100 hide-scrollbar h-64">
            {selectedProperty.images.length > 0 ? (
              selectedProperty.images.map((img, idx) => (
                <div key={idx} className="flex-shrink-0 w-full h-full snap-center">
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </div>
              ))
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Icons.Building />
              </div>
            )}
          </div>

          <div className="p-4 space-y-6">
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="bg-indigo-100 text-indigo-600 text-[10px] font-bold px-2 py-1 rounded">
                  {selectedProperty.type}
                </span>
                <span className={`text-[10px] font-bold px-2 py-1 rounded ${selectedProperty.transactionType === TransactionType.SALE ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'}`}>
                  {selectedProperty.transactionType}
                </span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                  {selectedProperty.price}
                </h1>
                <p className="text-sm text-slate-500 flex items-center mt-1">
                  <svg className="w-4 h-4 mr-1 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                  {selectedProperty.address}
                </p>
              </div>
            </div>

            <hr className="border-slate-100" />

            <section className="space-y-2">
              <h3 className="font-bold text-slate-800">매물 상세 설명</h3>
              <div className="bg-slate-50 p-4 rounded-2xl text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedProperty.description || "설명이 등록되지 않았습니다."}
              </div>
            </section>

            {connectedClient && (
              <section className="space-y-3">
                <h3 className="font-bold text-slate-800">연결된 고객</h3>
                <div className="bg-white border border-slate-100 p-4 rounded-2xl shadow-sm flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-indigo-600 border border-indigo-100">
                      <Icons.Users />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{connectedClient.name}</p>
                      <p className="text-xs text-slate-500">{connectedClient.role}</p>
                    </div>
                  </div>
                  <a 
                    href={`tel:${connectedClient.phone}`}
                    className="bg-emerald-500 text-white p-2.5 rounded-full shadow-md"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  </a>
                </div>
              </section>
            )}
            
            <div className="text-[10px] text-slate-300 text-center pt-4">
              등록일: {new Date(selectedProperty.createdAt).toLocaleString()}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">매물 관리</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleExportCSV}
            title="엑셀로 내보내기"
            className="bg-white border border-slate-200 text-slate-600 p-2 rounded-full shadow-sm hover:bg-slate-50 transition-colors"
          >
            <Icons.Download />
          </button>
          <button 
            onClick={() => setIsAdding(true)}
            className="bg-indigo-600 text-white p-2 rounded-full shadow-lg"
          >
            <Icons.Plus />
          </button>
        </div>
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
              placeholder="매물명 또는 주소 검색"
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 rounded-xl border transition-all flex items-center space-x-1 ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-slate-200 text-slate-600'}`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
            <span className="text-xs font-bold">필터</span>
          </button>
        </div>

        {/* Expanded Filters */}
        {showFilters && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">매물 구분</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                >
                  <option value="전체">전체 구분</option>
                  {Object.values(PropertyType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase">거래 종류</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                  value={filterTransaction}
                  onChange={(e) => setFilterTransaction(e.target.value as any)}
                >
                  <option value="전체">전체 거래</option>
                  {Object.values(TransactionType).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">금액 범위 (단위: 만원)</label>
              <div className="flex items-center space-x-2">
                <input 
                  type="number" 
                  placeholder="최소" 
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                />
                <span className="text-slate-300">~</span>
                <input 
                  type="number" 
                  placeholder="최대" 
                  className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">담당 고객</label>
              <select 
                className="w-full border border-slate-200 rounded-lg px-2 py-1.5 text-xs outline-none"
                value={filterClientId}
                onChange={(e) => setFilterClientId(e.target.value)}
              >
                <option value="">전체 고객</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <button 
              onClick={resetFilters}
              className="w-full py-2 text-[10px] font-bold text-slate-400 hover:text-indigo-600 transition-colors border-t border-slate-100 mt-2"
            >
              필터 초기화
            </button>
          </div>
        )}
      </div>

      {isAdding && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="font-bold">신규 매물 등록</h3>
              <button onClick={() => setIsAdding(false)} className="text-slate-400">닫기</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Photo Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">현장 사진</label>
                <div className="grid grid-cols-4 gap-2">
                  <label className="aspect-square bg-slate-100 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200 cursor-pointer">
                    <Icons.Camera />
                    <input type="file" className="hidden" accept="image/*" capture="environment" multiple onChange={handleFileChange} />
                  </label>
                  {newProp.images?.map((img, idx) => (
                    <div key={idx} className="aspect-square rounded-lg overflow-hidden bg-slate-100 relative group">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Basic Info */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">매물명</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                  placeholder="예: 강남역 도보 5분 오피스텔"
                  value={newProp.title || ''}
                  onChange={e => setNewProp({...newProp, title: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">매물 구분</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={newProp.type}
                    onChange={e => setNewProp({...newProp, type: e.target.value as PropertyType})}
                  >
                    {Object.values(PropertyType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">거래 종류</label>
                  <select 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={newProp.transactionType}
                    onChange={e => setNewProp({...newProp, transactionType: e.target.value as TransactionType})}
                  >
                    {Object.values(TransactionType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">표시 가격</label>
                  <input 
                    type="text" 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" 
                    placeholder="예: 5억 / 200"
                    value={newProp.price || ''}
                    onChange={e => setNewProp({...newProp, price: e.target.value})}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">검색용 금액 (만원)</label>
                  <input 
                    type="number" 
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" 
                    placeholder="예: 50000"
                    value={newProp.priceAmount || ''}
                    onChange={e => setNewProp({...newProp, priceAmount: parseInt(e.target.value) || 0})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">관련 고객 (선택)</label>
                <select 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  value={newProp.clientId || ''}
                  onChange={e => setNewProp({...newProp, clientId: e.target.value})}
                >
                  <option value="">고객 선택 없음</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500 uppercase">주소</label>
                <input 
                  type="text" 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" 
                  placeholder="상세 주소를 입력하세요"
                  value={newProp.address || ''}
                  onChange={e => setNewProp({...newProp, address: e.target.value})}
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">
                    설명 {gpsStatus && <span className="text-indigo-500 ml-1 text-[10px] animate-pulse">{gpsStatus}</span>}
                  </label>
                  <button 
                    type="button"
                    onClick={handleGenerateAI}
                    disabled={isGenerating}
                    className="flex items-center space-x-1 text-[10px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold hover:bg-indigo-200 disabled:opacity-50"
                  >
                    {isGenerating ? (
                      <span className="flex items-center">
                        <svg className="animate-spin -ml-1 mr-1 h-3 w-3 text-indigo-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        생성 중...
                      </span>
                    ) : (
                      <>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                        <span>AI 문구 생성</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea 
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none h-24" 
                  placeholder="상세 설명을 입력하세요."
                  value={newProp.description || ''}
                  onChange={e => setNewProp({...newProp, description: e.target.value})}
                ></textarea>
              </div>

              <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4">
                매물 등록하기
              </button>
            </form>
          </div>
        </div>
      )}

      {/* List */}
      <div className="space-y-4">
        {filteredProperties.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
             <div className="flex justify-center mb-2 opacity-20"><Icons.Building /></div>
             {(searchTerm || filterType !== '전체' || filterTransaction !== '전체' || minPrice || maxPrice || filterClientId) ? '필터 결과가 없습니다.' : '등록된 매물이 없습니다.'}
          </div>
        ) : (
          filteredProperties.map(prop => (
            <div 
              key={prop.id} 
              onClick={() => setSelectedPropertyId(prop.id)}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm active:scale-[0.98] transition-transform cursor-pointer"
            >
              <div className="h-40 bg-slate-100 relative overflow-hidden">
                {prop.images[0] ? (
                  <img src={prop.images[0]} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Icons.Building />
                  </div>
                )}
                <div className="absolute top-3 left-3 flex space-x-1">
                  <div className="bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-indigo-600 shadow-sm">
                    {prop.type}
                  </div>
                  <div className={`bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold shadow-sm ${prop.transactionType === TransactionType.SALE ? 'text-orange-600' : 'text-emerald-600'}`}>
                    {prop.transactionType}
                  </div>
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-start mb-1">
                  <div className="min-w-0 flex-1 mr-2">
                    <h3 className="font-bold text-slate-800 text-lg leading-tight truncate">{prop.title}</h3>
                  </div>
                  <span className="text-indigo-600 font-bold text-lg whitespace-nowrap">{prop.price}</span>
                </div>
                <p className="text-xs text-slate-500 flex items-center mb-3">
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                  {prop.address}
                </p>
                <div className="bg-slate-50 p-2 rounded-lg text-xs text-slate-600 line-clamp-2 whitespace-pre-line">
                  {prop.description}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default PropertyListView;
