
export enum PropertyType {
  HOUSE = '주택',
  COMMERCIAL = '상가',
  BUILDING = '건물',
  LAND = '토지',
  FACTORY = '공장',
  WAREHOUSE = '창고',
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

export interface Property {
  id: string;
  title: string;
  type: PropertyType;
  transactionType: TransactionType;
  price: string; // Display string (e.g., "5억 / 200")
  priceAmount: number; // For filtering (numeric, in ten-thousand won)
  address: string;
  description: string;
  images: string[];
  clientId?: string;
  createdAt: number;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  role: ClientRole;
  notes: string;
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
