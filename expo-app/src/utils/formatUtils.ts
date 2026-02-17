
import { PropertyType, TransactionType, Property } from '../types';

// Helper function to convert numeric price to Korean currency string
export const formatPrice = (num: number) => {
    if (!num) return '';
    if (num >= 100000) { // 1억 이상
        const uk = Math.floor(num / 100000);
        const rest = num % 100000;
        const chun = Math.floor(rest / 10000);
        return `${uk}억${chun > 0 ? ` ${chun}천` : ''}만원`; // e.g. 1억 5천만원
    } else if (num >= 10000) { // 1천만 이상
        const chun = Math.floor(num / 10000);
        const rest = num % 10000;
        const baek = Math.floor(rest / 1000);
        return `${chun}천${baek > 0 ? ` ${baek}백` : ''}만원`; // e.g. 1천 5백만원
    } else if (num >= 1000) { // 1백만 이상
        return `${Math.floor(num / 1000)}백만원`;
    }
    return `${num}천원`;
};

// Helper function to get header color based on property type and transaction type
export const getHeaderColor = (property?: Property) => {
    if (!property) return '#0066cc';
    // 토지는 녹색
    if (property.type === PropertyType.LAND) return '#10b981';
    // 매매는 주황색
    if (property.transactionType === TransactionType.SALE) return '#f97316';
    // 임대(월세, 전세)는 파란색
    return '#0066cc';
};

// Helper function to convert m² to 평
export const sqmToPyeong = (sqm: number) => Math.round(sqm * 0.3025 * 100) / 100;
