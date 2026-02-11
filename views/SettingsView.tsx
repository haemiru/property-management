import React, { useState, useEffect } from 'react';
import { Icons } from '../constants';
import { useAuth } from '../src/contexts/AuthContext';
import { PropertyType } from '../types';

interface BrokerInfo {
    businessName: string;
    address: string;
    name: string;
    phone: string;
    logoUri?: string;
}

export interface AppSettings {
    propertyTypeOrder: string[];
    defaultAreaUnit: 'py' | 'm2';
}

const DEFAULT_PROPERTY_TYPE_ORDER = Object.values(PropertyType);

export function getAppSettings(userId?: string): AppSettings {
    if (!userId) return { propertyTypeOrder: DEFAULT_PROPERTY_TYPE_ORDER, defaultAreaUnit: 'py' };
    const data = localStorage.getItem(`appSettings_${userId}`);
    if (data) {
        try {
            const parsed = JSON.parse(data);
            // Ensure all PropertyType values are included
            const allTypes = Object.values(PropertyType);
            const savedOrder: string[] = parsed.propertyTypeOrder || [];
            // Add any missing types at the end
            const finalOrder = [
                ...savedOrder.filter((t: string) => allTypes.includes(t as PropertyType)),
                ...allTypes.filter(t => !savedOrder.includes(t)),
            ];
            return {
                propertyTypeOrder: finalOrder,
                defaultAreaUnit: parsed.defaultAreaUnit || 'py',
            };
        } catch {
            return { propertyTypeOrder: DEFAULT_PROPERTY_TYPE_ORDER, defaultAreaUnit: 'py' };
        }
    }
    return { propertyTypeOrder: DEFAULT_PROPERTY_TYPE_ORDER, defaultAreaUnit: 'py' };
}

const SettingsView: React.FC = () => {
    const { signOut, user } = useAuth();
    const [info, setInfo] = useState<BrokerInfo>({
        businessName: '',
        address: '',
        name: '',
        phone: '',
    });
    const [saved, setSaved] = useState(false);
    const [typeOrder, setTypeOrder] = useState<string[]>(DEFAULT_PROPERTY_TYPE_ORDER);
    const [areaUnit, setAreaUnit] = useState<'py' | 'm2'>('py');

    useEffect(() => {
        if (!user) return;
        const data = localStorage.getItem(`brokerInfo_${user.id}`);
        if (data) {
            setInfo(JSON.parse(data));
        } else {
            // Reset info if no data found for this user (to avoid showing previous user's data)
            setInfo({
                businessName: '',
                address: '',
                name: '',
                phone: '',
            });
        }
        const settings = getAppSettings(user.id);
        setTypeOrder(settings.propertyTypeOrder);
        setAreaUnit(settings.defaultAreaUnit);
    }, [user]);

    const handleSave = () => {
        if (!info.businessName || !info.name) {
            alert('상호와 성명은 필수 입력입니다.');
            return;
        }
        if (user) {
            localStorage.setItem(`brokerInfo_${user.id}`, JSON.stringify(info));
            // Save app settings
            const appSettings: AppSettings = {
                propertyTypeOrder: typeOrder,
                defaultAreaUnit: areaUnit,
            };
            localStorage.setItem(`appSettings_${user.id}`, JSON.stringify(appSettings));
            setSaved(true);
        }
        setTimeout(() => setSaved(false), 2000);
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setInfo({ ...info, logoUri: reader.result as string });
            };
            reader.readAsDataURL(file);
        }
    };

    const moveTypeUp = (index: number) => {
        if (index === 0) return;
        const newOrder = [...typeOrder];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        setTypeOrder(newOrder);
    };

    const moveTypeDown = (index: number) => {
        if (index === typeOrder.length - 1) return;
        const newOrder = [...typeOrder];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        setTypeOrder(newOrder);
    };

    return (
        <div className="max-w-2xl mx-auto">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-slate-800">환경설정</h1>
                <p className="text-sm text-slate-500 mt-1">매물장 전달 시 표시될 정보를 입력하세요.</p>
            </div>

            {/* Broker Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center space-x-2">
                    <Icons.Users />
                    <span>내 정보 설정</span>
                </h2>

                {/* Logo Upload */}
                <div className="mb-8">
                    <label className="text-sm font-semibold text-slate-600 block mb-3">부동산 로고 (선택)</label>
                    <div className="flex items-center space-x-6">
                        {info.logoUri ? (
                            <div className="relative">
                                <img
                                    src={info.logoUri}
                                    alt="logo"
                                    className="w-24 h-24 rounded-full object-cover border-2 border-slate-200 shadow-sm"
                                />
                                <button
                                    onClick={() => setInfo({ ...info, logoUri: undefined })}
                                    className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 shadow"
                                >
                                    ✕
                                </button>
                            </div>
                        ) : (
                            <label className="w-24 h-24 rounded-full border-2 border-dashed border-slate-300 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                                <Icons.Image />
                                <span className="text-xs text-slate-400 mt-1">로고 등록</span>
                                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                            </label>
                        )}
                        <p className="text-xs text-slate-400">매물장 중앙에 워터마크로 표시됩니다.</p>
                    </div>
                </div>

                {/* Form Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="text-sm font-semibold text-slate-600 block mb-2">상호 (부동산명) <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                            placeholder="예: 행복공인중개사사무소"
                            value={info.businessName}
                            onChange={e => setInfo({ ...info, businessName: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-600 block mb-2">성명 (대표자) <span className="text-red-400">*</span></label>
                        <input
                            type="text"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                            placeholder="예: 홍길동"
                            value={info.name}
                            onChange={e => setInfo({ ...info, name: e.target.value })}
                        />
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-sm font-semibold text-slate-600 block mb-2">소재지 (주소)</label>
                        <input
                            type="text"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                            placeholder="예: 서울시 강남구 테헤란로 123"
                            value={info.address}
                            onChange={e => setInfo({ ...info, address: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-slate-600 block mb-2">전화번호</label>
                        <input
                            type="tel"
                            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition"
                            placeholder="예: 010-1234-5678"
                            value={info.phone}
                            onChange={e => setInfo({ ...info, phone: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* Property Type Order Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-2 flex items-center space-x-2">
                    <Icons.Building />
                    <span>중개 분야 설정</span>
                </h2>
                <p className="text-sm text-slate-500 mb-6">매물 등록 시 '매물 구분' 드롭다운의 순서를 조정합니다.</p>

                <div className="space-y-2">
                    {typeOrder.map((type, index) => (
                        <div
                            key={type}
                            className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3 border border-slate-100"
                        >
                            <div className="flex items-center space-x-3">
                                <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold">
                                    {index + 1}
                                </span>
                                <span className="text-sm font-medium text-slate-700">{type}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                                <button
                                    onClick={() => moveTypeUp(index)}
                                    disabled={index === 0}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${index === 0
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                                        }`}
                                >
                                    ▲
                                </button>
                                <button
                                    onClick={() => moveTypeDown(index)}
                                    disabled={index === typeOrder.length - 1}
                                    className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors ${index === typeOrder.length - 1
                                        ? 'text-slate-300 cursor-not-allowed'
                                        : 'text-slate-500 hover:bg-indigo-100 hover:text-indigo-600'
                                        }`}
                                >
                                    ▼
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Area Unit Setting Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 mb-6">
                <h2 className="text-lg font-semibold text-slate-800 mb-2 flex items-center space-x-2">
                    <Icons.Edit />
                    <span>면적 단위 설정</span>
                </h2>
                <p className="text-sm text-slate-500 mb-6">면적 입력 시 기본 단위를 선택합니다. (대지면적, 연면적, 건평 등)</p>

                <div className="flex space-x-4">
                    <button
                        onClick={() => setAreaUnit('py')}
                        className={`flex-1 py-4 rounded-xl font-semibold text-center transition-all border-2 ${areaUnit === 'py'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                            }`}
                    >
                        <div className="text-2xl mb-1">평</div>
                        <div className="text-xs opacity-70">1평 = 3.3058m²</div>
                    </button>
                    <button
                        onClick={() => setAreaUnit('m2')}
                        className={`flex-1 py-4 rounded-xl font-semibold text-center transition-all border-2 ${areaUnit === 'm2'
                            ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-sm'
                            : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                            }`}
                    >
                        <div className="text-2xl mb-1">m²</div>
                        <div className="text-xs opacity-70">제곱미터</div>
                    </button>
                </div>
            </div>

            {/* Save Button */}
            <div className="mb-6 flex items-center space-x-4">
                <button
                    onClick={handleSave}
                    className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-sm"
                >
                    저장하기
                </button>
                {saved && (
                    <span className="text-green-600 text-sm font-medium flex items-center space-x-1">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        <span>저장 완료!</span>
                    </span>
                )}
            </div>

            {/* Account Info Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
                <h2 className="text-lg font-semibold text-slate-800 mb-6 flex items-center space-x-2">
                    <Icons.Users />
                    <span>계정 정보</span>
                </h2>

                <div className="space-y-4">
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <span className="text-sm text-slate-500">이메일</span>
                        <span className="text-sm font-medium text-slate-800">{user?.email || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between py-3 border-b border-slate-100">
                        <span className="text-sm text-slate-500">로그인 방법</span>
                        <span className="text-sm font-medium text-slate-800">
                            {user?.app_metadata?.provider === 'google' ? 'Google' : '이메일'}
                        </span>
                    </div>
                </div>

                <div className="mt-8">
                    <button
                        onClick={signOut}
                        className="text-red-500 border border-red-200 px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors"
                    >
                        로그아웃
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsView;
