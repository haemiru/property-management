export enum PropertyType {
  HOUSE = '주택',
  FACTORY_WAREHOUSE = '공장/창고',
  LAND = '토지',
  COMMERCIAL = '상가',
  BUILDING = '건물',
  OTHERS = '기타'
}

export enum TransactionType {
  SALE = '매매',
  RENT = '월세',
  JEONSE = '전세'
}

export enum ClientRole {
  LANDLORD = '임대인',
  TENANT = '임차인',
  SELLER = '매도인',
  BUYER = '매수인'
}

// 용도지역 옵션
export const LAND_USE_ZONES = [
  '계획관리지역', '생산관리지역', '보전관리지역', '농림지역',
  '자연환경보전지역', '주거지역', '상업지역', '공업지역', '녹지지역', '자연녹지지역'
];

// 지목 옵션
export const LAND_CATEGORIES = [
  '대', '답', '전', '임야', '과수원', '목장용지', '광천지',
  '염전', '공장용지', '창고용지', '도로', '잡종지', '기타'
];

// 건축물 용도 옵션 (건축법 시행령 별표1 기반)
export const BUILDING_USES = [
  '단독주택', '공동주택', '제1종 근린생활시설', '제2종 근린생활시설',
  '문화 및 집회시설', '종교시설', '판매시설', '운수시설',
  '의료시설', '교육연구시설', '노유자시설', '수련시설',
  '운동시설', '업무시설', '숙박시설', '위락시설',
  '공장', '창고시설', '위험물 저장 및 처리 시설', '자동차 관련 시설',
  '동물 및 식물 관련 시설', '자원순환 관련 시설', '교정 및 군사 시설',
  '방송통신시설', '발전시설', '묘지 관련 시설', '관광 휴게 시설',
  '장례시설', '야영장 시설', '기타'
];

export interface Property {
  id: string;
  managementId?: string; // 관리번호 (수동 입력)
  title: string;
  type: PropertyType;
  transactionType: TransactionType;
  price: string;
  priceAmount: number;
  address: string;
  description: string;
  images: string[];
  clientId?: string;
  createdAt: number;
  updated_at?: string;
  // 공장/창고, 토지 공통
  landArea?: number;       // 대지면적 (m²)
  roadCondition?: string;  // 도로조건
  water?: string[];          // 수도
  sewage?: string[];         // 하수처리

  // 공장/창고 추가
  buildingArea?: number;   // 연면적/건평 (m²)
  structureHeight?: string;// 구조/층고
  usageApprovalDate?: string; // 사용승인일

  // 기존 상세 필드
  area?: number;           // 면적 (m²) - 기존 호환성 유지
  areaPyeong?: number;     // 면적 (평)
  rooms?: number;          // 방 개수 (주택)
  floors?: number;         // 층수
  parking?: boolean;       // 주차 가능 여부
  premium?: number;        // 권리금 (상가)
  // 주택
  apartmentName?: string;  // 아파트 단지명
  // 토지
  lotNumber?: string;      // 지번
  landUseZone?: string;    // 용도지역
  landCategory?: string;   // 지목
  // 공장/창고
  buildingUse?: string;    // 건축물 용도
  buildingUseDetail?: string; // 건축물 세부 용도 (예: 제조시설)
  buildings?: BuildingDetail[]; // 세부 건물 내역
  // 월세
  deposit?: number;        // 보증금 (천원)
  monthlyRent?: number;    // 월 임대료 (천원)
}

export interface BuildingDetail {
  id: string;
  name: string;
  area: number; // 건평
  floor?: number; // 층수
  totalFloorArea?: number; // 연면적 (평/m2 혼용 가능하지만 숫자로 관리)
  use?: string; // 건축물 용도
  specificUse?: string; // 세부 용도
  structureHeight?: string; // 구조/층고
  usageApprovalDate?: string; // 사용승인일
  note?: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  role: ClientRole;
  notes: string;
  call_history?: string;
  updated_at?: string;
}

export interface ScheduleTask {
  id: string;
  title: string;
  date: string;
  time: string;
  clientId?: string;
  propertyId?: string;
  completed: boolean;
}

export interface BrokerInfo {
  businessName: string;
  address: string;
  name: string;
  phone: string;
  logoUri?: string;
}
