
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Property, PropertyType, TransactionType, Client, LAND_USE_ZONES, LAND_CATEGORIES, BUILDING_USES, BuildingDetail } from '../types';
import { Icons } from '../constants';

import { getAppSettings } from './SettingsView';
import { useAuth } from '../src/contexts/AuthContext';
import { generatePropertyDescription } from '../services/geminiService';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

// AreaInput 컴포넌트 - 평/m² 변환 지원
// Simple UUID generator
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

interface AreaInputProps {
  label: string;
  valueM2?: number;
  onChangeM2: (val: number | undefined) => void;
  defaultUnit?: 'py' | 'm2';
}

const AreaInput: React.FC<AreaInputProps> = ({ label, valueM2, onChangeM2, defaultUnit = 'py' }) => {
  const [unit, setUnit] = useState<'py' | 'm2'>(defaultUnit);
  const [inputValue, setInputValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  React.useEffect(() => {
    if (!isFocused) {
      if (valueM2 === undefined || valueM2 === 0) {
        setInputValue('');
      } else {
        const val = unit === 'py' ? (valueM2 / 3.3058) : valueM2;
        setInputValue(val.toFixed(2).replace(/\.00$/, ''));
      }
    }
  }, [valueM2, unit, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    const val = parseFloat(raw);
    if (isNaN(val) || raw === '') {
      onChangeM2(undefined);
      return;
    }
    if (unit === 'py') {
      onChangeM2(val * 3.3058);
    } else {
      onChangeM2(val);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (valueM2 !== undefined && valueM2 !== 0) {
      const val = unit === 'py' ? (valueM2 / 3.3058) : valueM2;
      setInputValue(val.toFixed(2).replace(/\.00$/, ''));
    }
  };

  const toggleUnit = () => {
    setUnit(prev => prev === 'py' ? 'm2' : 'py');
  };

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none pr-12"
            placeholder={unit === 'py' ? "평 단위 입력" : "m² 단위 입력"}
            value={inputValue}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={handleBlur}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
            {unit === 'py' ? '평' : 'm²'}
          </span>
        </div>
        <button
          type="button"
          onClick={toggleUnit}
          className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-600 whitespace-nowrap transition-colors"
        >
          {unit === 'py' ? 'm²로 변환' : '평으로 변환'}
        </button>
      </div>
    </div>
  );
};

interface PropertyListViewProps {
  properties: Property[];
  clients: Client[];
  onAdd: (p: Property) => void;
  onUpdate: (p: Property) => void;
  onDelete: (id: string) => void;
}

const PropertyListView: React.FC<PropertyListViewProps> = ({ properties, clients, onAdd, onUpdate, onDelete }) => {
  const location = useLocation();
  const [isAdding, setIsAdding] = useState(false);

  // Load app settings
  const { user } = useAuth();
  const appSettings = useMemo(() => getAppSettings(user?.id), [user?.id]);
  const orderedTypes = appSettings.propertyTypeOrder as PropertyType[];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (location.state?.selectedId) {
      setSelectedPropertyId(location.state.selectedId);
    }
  }, [location.state]);

  const reportRef = useRef<HTMLDivElement>(null);

  // Search & Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<PropertyType | '전체'>('전체');
  const [filterTransaction, setFilterTransaction] = useState<TransactionType | '전체'>('전체');
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [filterClientId, setFilterClientId] = useState<string>('');

  const [newProp, setNewProp] = useState<Partial<Property>>({
    type: orderedTypes[0] || PropertyType.HOUSE,
    transactionType: TransactionType.SALE,
    images: [],
    priceAmount: 0,
    buildings: []
  });

  // Update default type when orderedTypes changes (e.g. user login/settings load)
  useEffect(() => {
    if (!isAdding && !editingId && orderedTypes.length > 0) {
      setNewProp(prev => ({
        ...prev,
        type: orderedTypes[0]
      }));
    }
  }, [orderedTypes, isAdding, editingId]);

  // Building management
  const [newBuilding, setNewBuilding] = useState<BuildingDetail>({
    id: '',
    name: '',
    area: 0,
    floor: undefined,
    totalFloorArea: 0,
    use: '',
    specificUse: '',
    structureHeight: '',
    usageApprovalDate: '',
    note: ''
  });

  const addBuilding = () => {
    if (!newBuilding.name) {
      alert('건물 명칭을 입력해주세요.');
      return;
    }
    const buildingToAdd = { ...newBuilding, id: generateUUID() };
    setNewProp(prev => ({
      ...prev,
      buildings: [...(prev.buildings || []), buildingToAdd]
    }));
    setNewBuilding({
      id: '',
      name: '',
      area: 0,
      floor: undefined,
      totalFloorArea: 0,
      use: '',
      specificUse: '',
      structureHeight: '',
      usageApprovalDate: '',
      note: ''
    });
  };

  const removeBuilding = (id: string) => {
    setNewProp(prev => ({
      ...prev,
      buildings: (prev.buildings || []).filter(b => b.id !== id)
    }));
  };

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
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.85);

      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);

      const pdfBlob = pdf.output('blob');
      const pdfFile = new File([pdfBlob], `${selectedProperty.title}_보고서.pdf`, { type: 'application/pdf' });

      if (navigator.share && navigator.canShare({ files: [pdfFile] })) {
        await navigator.share({
          files: [pdfFile],
          title: `[중개노트] ${selectedProperty.title} 매물 보고서`,
          text: `${selectedProperty.price} - ${selectedProperty.address}`
        });
      } else {
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

  const getGPSLocation = (): Promise<{ lat: number, lng: number } | undefined> => {
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

    const propertyData = {
      id: editingId || generateUUID(),
      managementId: newProp.managementId,
      title: newProp.title!,
      type: newProp.type as PropertyType,
      transactionType: newProp.transactionType as TransactionType,
      price: newProp.price || '협의',
      priceAmount: Number(newProp.priceAmount) || 0,
      address: newProp.address || '',
      description: newProp.description || '',
      images: newProp.images || [],
      clientId: newProp.clientId,
      createdAt: newProp.createdAt || Date.now(),
      landArea: newProp.landArea,
      landUseZone: newProp.landUseZone,
      landCategory: newProp.landCategory,
      roadCondition: newProp.roadCondition,
      buildings: newProp.buildings,
      buildingArea: newProp.buildingArea,
      structureHeight: newProp.structureHeight,
      usageApprovalDate: newProp.usageApprovalDate,
      water: newProp.water,
      sewage: newProp.sewage,
      deposit: newProp.deposit,
      monthlyRent: newProp.monthlyRent
    };

    if (editingId) {
      onUpdate(propertyData as Property);
    } else {
      onAdd(propertyData as Property);
    }

    setNewProp({
      type: orderedTypes[0] || PropertyType.HOUSE,
      transactionType: TransactionType.SALE,
      images: [],
      priceAmount: 0,
      buildings: [],
      deposit: 0,
      monthlyRent: 0
    });
    setNewBuilding({ id: '', name: '', area: 0, floor: undefined, totalFloorArea: 0, use: '', specificUse: '', structureHeight: '', usageApprovalDate: '', note: '' });
    setIsAdding(false);
    setEditingId(null);
  };

  const handleStartEdit = (prop: Property) => {
    setNewProp(prop);
    setEditingId(prop.id);
    setIsAdding(true);
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
              onClick={() => handleStartEdit(selectedProperty)}
              className="p-2 rounded-full transition-colors text-indigo-600 hover:bg-indigo-50"
              title="매물 수정"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
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
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>
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
                  {orderedTypes.map(t => <option key={t} value={t}>{t}</option>)}
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
              <button onClick={() => { setIsAdding(false); setEditingId(null); }} className="text-slate-400">닫기</button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4 overflow-y-auto flex-1">
              {/* Photo Input */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">현장 사진/동영상</label>
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

              {/* 물건번호 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">물건번호</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="예: 1001"
                  value={newProp.managementId || ''}
                  onChange={e => setNewProp({ ...newProp, managementId: e.target.value })}
                />
              </div>

              {/* 매물명 */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">매물명</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="예: 강남역 도보 5분 오피스텔"
                  value={newProp.title || ''}
                  onChange={e => setNewProp({ ...newProp, title: e.target.value })}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">매물 구분</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={newProp.type}
                    onChange={e => setNewProp({ ...newProp, type: e.target.value as PropertyType })}
                  >
                    {orderedTypes.map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 uppercase">거래 종류</label>
                  <select
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                    value={newProp.transactionType}
                    onChange={e => setNewProp({ ...newProp, transactionType: e.target.value as TransactionType })}
                  >
                    {Object.values(TransactionType).map(type => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">
                  {newProp.transactionType === TransactionType.RENT ? '보증금 (천원 단위)' : `금액 (${newProp.transactionType === TransactionType.SALE ? '매매가' : '보증금'}, 천원 단위)`}
                </label>
                {newProp.transactionType === TransactionType.RENT ? (
                  // 월세인 경우: 보증금 + 월세 입력
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                        placeholder="예: 10000 (=> 1000만원)"
                        value={newProp.deposit || ''}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;
                          // Format Deposit
                          let fmt = '';
                          if (val > 0) {
                            const uk = Math.floor(val / 10000);
                            const rem = val % 10000;
                            if (uk > 0 && rem > 0) fmt = `${uk}억 ${rem}만원`;
                            else if (uk > 0) fmt = `${uk}억원`;
                            else fmt = `${rem}만원`;
                          }

                          // Update Price String (Deposit / Rent)
                          const rentName = newProp.monthlyRent ? ` / ${newProp.monthlyRent}만원` : '';
                          const priceStr = fmt ? `보증금 ${fmt}${rentName}` : '가격 협의';

                          setNewProp({ ...newProp, deposit: val, priceAmount: val, price: priceStr });
                        }}
                      />
                      {newProp.deposit ? (
                        <p className="text-xs text-indigo-600 font-bold">
                          보증금: {(() => {
                            const val = newProp.deposit || 0;
                            const uk = Math.floor(val / 10000);
                            const rem = val % 10000;
                            if (uk > 0 && rem > 0) return `${uk}억 ${rem}만원`;
                            if (uk > 0) return `${uk}억원`;
                            return `${rem}만원`;
                          })()}
                        </p>
                      ) : null}
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">월 임대료 (만원 단위)</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                        placeholder="예: 100 (=> 100만원)"
                        value={newProp.monthlyRent || ''}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 0;

                          // Re-calculate Deposit Format
                          const dVal = newProp.deposit || 0;
                          let dFmt = '';
                          if (dVal > 0) {
                            const uk = Math.floor(dVal / 10000);
                            const rem = dVal % 10000;
                            if (uk > 0 && rem > 0) dFmt = `${uk}억 ${rem}만원`;
                            else if (uk > 0) dFmt = `${uk}억원`;
                            else dFmt = `${rem}만원`;
                          }

                          const priceStr = dFmt ? `보증금 ${dFmt} / ${val}만원` : `월세 ${val}만원`;
                          setNewProp({ ...newProp, monthlyRent: val, price: priceStr });
                        }}
                      />
                      {newProp.monthlyRent ? <p className="text-xs text-indigo-600 font-bold">월세: {newProp.monthlyRent}만원</p> : null}
                    </div>
                  </div>
                ) : (
                  // 매매/전세인 경우: 단일 금액 입력
                  <>
                    <input
                      type="number"
                      inputMode="numeric"
                      className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                      placeholder="예: 50000 (=> 5억원)"
                      value={newProp.priceAmount || ''}
                      onChange={e => {
                        const val = parseInt(e.target.value) || 0;
                        // Auto format price string
                        let formattedPrice = '가격 협의';
                        if (val > 0) {
                          const uk = Math.floor(val / 10000);
                          const remainder = val % 10000;
                          if (uk > 0 && remainder > 0) formattedPrice = `${uk}억 ${remainder}만원`;
                          else if (uk > 0) formattedPrice = `${uk}억원`;
                          else formattedPrice = `${remainder}만원`;
                        }
                        setNewProp({ ...newProp, priceAmount: val, price: formattedPrice });
                      }}
                    />
                    {newProp.price && (
                      <p className="text-sm font-bold text-indigo-600 mt-1">{newProp.price}</p>
                    )}
                  </>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-500">주소</label>
                <input
                  type="text"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                  placeholder="상세 주소를 입력하세요"
                  value={newProp.address || ''}
                  onChange={e => setNewProp({ ...newProp, address: e.target.value })}
                />
              </div>

              {/* 공장/창고 & 토지 전용 필드 */}
              {(newProp.type === PropertyType.FACTORY_WAREHOUSE || newProp.type === PropertyType.LAND) && (
                <>
                  <div className="bg-slate-50 p-3 rounded-xl space-y-3 border border-slate-200">
                    <h4 className="text-xs font-bold text-indigo-600 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg>
                      공장/창고 상세 정보
                    </h4>

                    {/* 대지면적 - AreaInput 사용 */}
                    <AreaInput
                      label="대지면적"
                      valueM2={newProp.landArea}
                      onChangeM2={(val) => setNewProp({ ...newProp, landArea: val })}
                      defaultUnit={appSettings.defaultAreaUnit}
                    />
                  </div>

                  {/* 건물 정보 (공장/창고일 때만) */}
                  {newProp.type === PropertyType.FACTORY_WAREHOUSE && (
                    <div className="bg-slate-50 p-3 rounded-xl space-y-3 border border-slate-200">
                      <h4 className="text-xs font-bold text-indigo-600 flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5"></path></svg>
                        건물 정보
                      </h4>

                      {/* 등록된 건물 목록 */}
                      {(newProp.buildings || []).map((bld, idx) => (
                        <div key={bld.id} className="bg-white p-3 rounded-lg border border-slate-200 space-y-1">
                          <div className="flex justify-between items-center">
                            <h5 className="font-bold text-sm text-slate-700">{bld.name || `건물 ${idx + 1}`}</h5>
                            <button type="button" onClick={() => removeBuilding(bld.id)} className="text-red-500 text-xs">삭제</button>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
                            <div>{bld.floor ? `${bld.floor}층` : '-'} | 건평: {(bld.area / 3.3058).toFixed(1)}평</div>
                            <div>연면적: {(bld.totalFloorArea / 3.3058).toFixed(1)}평</div>
                            <div>용도: {bld.use}</div>
                            <div>구조: {bld.structureHeight}</div>
                          </div>
                        </div>
                      ))}

                      {/* 건물 추가 폼 */}
                      <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-3">
                        <p className="text-xs font-bold text-slate-700">+ 건물 추가</p>

                        {/* 용도지역 - This was incorrectly placed inside buildings in layout, moving OUT in next block, but wait, screenshot shows 용도지역 AFTER building list */}
                        {/* Actually, looking at screenshot 1, it has Building 1 (with name 주건물). Below it is Building Add Form? Or Building details? */}
                        {/* Screenshot 2 shows "건물 1" expanded inputs. It seems to be editing "건물 1". */}
                        {/* Screenshot 3 shows "용도지역" below "건물 추가" section. */}

                        {/* Replicating Building Add Form */}
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="flex-1 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                              placeholder="건물 명칭 (예: 가동)"
                              value={newBuilding.name}
                              onChange={e => setNewBuilding({ ...newBuilding, name: e.target.value })}
                            />
                            <input
                              type="number"
                              className="w-24 border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                              placeholder="층수"
                              value={newBuilding.floor || ''}
                              onChange={e => setNewBuilding({ ...newBuilding, floor: parseInt(e.target.value) || undefined })}
                            />
                          </div>
                          <AreaInput label="건평" valueM2={newBuilding.area} onChangeM2={v => setNewBuilding({ ...newBuilding, area: v || 0 })} defaultUnit={appSettings.defaultAreaUnit} />
                          <AreaInput label="연면적" valueM2={newBuilding.totalFloorArea} onChangeM2={v => setNewBuilding({ ...newBuilding, totalFloorArea: v || 0 })} defaultUnit={appSettings.defaultAreaUnit} />

                          <select
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                            value={newBuilding.use || ''}
                            onChange={e => setNewBuilding({ ...newBuilding, use: e.target.value })}
                          >
                            <option value="">건축물 용도 선택</option>
                            {BUILDING_USES.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>

                          <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="세부 용도" value={newBuilding.specificUse || ''} onChange={e => setNewBuilding({ ...newBuilding, specificUse: e.target.value })} />
                          <input type="text" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" placeholder="구조 / 층고" value={newBuilding.structureHeight || ''} onChange={e => setNewBuilding({ ...newBuilding, structureHeight: e.target.value })} />
                          <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none" value={newBuilding.usageApprovalDate || ''} onChange={e => setNewBuilding({ ...newBuilding, usageApprovalDate: e.target.value })} />
                          <textarea className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none h-16" placeholder="비고" value={newBuilding.note || ''} onChange={e => setNewBuilding({ ...newBuilding, note: e.target.value })} />

                          <button type="button" onClick={addBuilding} className="w-full bg-indigo-500 text-white font-bold py-2 rounded-lg text-sm hover:bg-indigo-600 transition-colors">
                            + 건물 추가
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 나머지 상세 정보 (용도지역, 도로조건, 수도, 하수) */}
                  <div className="bg-slate-50 p-3 rounded-xl space-y-3 border border-slate-200">
                    {/* 용도지역 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">용도지역</label>
                      <select
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                        value={newProp.landUseZone || ''}
                        onChange={e => setNewProp({ ...newProp, landUseZone: e.target.value })}
                      >
                        <option value="">선택하세요</option>
                        {LAND_USE_ZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                      </select>
                    </div>

                    {/* 도로조건 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">도로조건</label>
                      <input
                        type="text"
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none"
                        placeholder="예: 6m 도로 접"
                        value={newProp.roadCondition || ''}
                        onChange={e => setNewProp({ ...newProp, roadCondition: e.target.value })}
                      />
                    </div>

                    {/* 수도 체크박스 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">수도</label>
                      <div className="flex gap-4">
                        {['상수도', '지하수'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-indigo-600"
                              checked={(newProp.water || []).includes(opt)}
                              onChange={() => {
                                const current = newProp.water || [];
                                const exists = current.includes(opt);
                                setNewProp({
                                  ...newProp,
                                  water: exists ? current.filter(i => i !== opt) : [...current, opt]
                                });
                              }}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 하수처리 체크박스 */}
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-500">하수처리</label>
                      <div className="flex gap-4">
                        {['직관연결', '정화조'].map(opt => (
                          <label key={opt} className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-indigo-600"
                              checked={(newProp.sewage || []).includes(opt)}
                              onChange={() => {
                                const current = newProp.sewage || [];
                                const exists = current.includes(opt);
                                setNewProp({
                                  ...newProp,
                                  sewage: exists ? current.filter(i => i !== opt) : [...current, opt]
                                });
                              }}
                            />
                            <span className="text-sm">{opt}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="space-y-1">
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-500">
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
                  onChange={e => setNewProp({ ...newProp, description: e.target.value })}
                ></textarea>
              </div>

              <button className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl shadow-lg mt-4">
                매물 등록하기
              </button>

            </form>
          </div>
        </div>
      )}

      {/* Card Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProperties.length === 0 ? (
          <div className="col-span-full text-center py-20 text-slate-400">
            <div className="flex justify-center mb-2 opacity-20"><Icons.Building /></div>
            {(searchTerm || filterType !== '전체' || filterTransaction !== '전체' || minPrice || maxPrice || filterClientId) ? '필터 결과가 없습니다.' : '등록된 매물이 없습니다.'}
          </div>
        ) : (
          filteredProperties.map(prop => (
            <div
              key={prop.id}
              onClick={() => setSelectedPropertyId(prop.id)}
              className="bg-white rounded-2xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-200 transition-all cursor-pointer group"
            >
              {/* Image Section */}
              <div className="h-48 bg-slate-100 relative overflow-hidden">
                {prop.images[0] ? (
                  <img src={prop.images[0]} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-300">
                    <Icons.Building />
                  </div>
                )}
                {/* Badges */}
                <div className="absolute top-3 left-3 flex flex-wrap gap-1">
                  <div className="bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 shadow-sm">
                    {prop.type}
                  </div>
                  <div className={`bg-white/90 backdrop-blur px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm ${prop.transactionType === TransactionType.SALE ? 'text-orange-600' : 'text-emerald-600'}`}>
                    {prop.transactionType}
                  </div>
                </div>
                {/* Management ID Badge */}
                {prop.managementId && (
                  <div className="absolute top-3 right-3 bg-black/50 backdrop-blur text-white px-2 py-1 rounded-lg text-[10px] font-mono">
                    #{prop.managementId}
                  </div>
                )}
              </div>

              {/* Content Section */}
              <div className="p-5">
                {/* Price - Prominent */}
                <div className="text-indigo-600 font-bold text-xl mb-2">{prop.price}</div>

                {/* Title */}
                <h3 className="font-bold text-slate-800 text-lg leading-tight mb-2 line-clamp-1 group-hover:text-indigo-600 transition-colors">
                  {prop.title}
                </h3>

                {/* Address */}
                <p className="text-sm text-slate-500 flex items-center mb-3">
                  <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path></svg>
                  <span className="line-clamp-1">{prop.address}</span>
                </p>

                {/* Description Preview */}
                <div className="bg-slate-50 p-3 rounded-xl text-xs text-slate-600 line-clamp-2 whitespace-pre-line">
                  {prop.description || '상세 설명이 없습니다.'}
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
