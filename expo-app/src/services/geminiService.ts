import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY_STORAGE = 'gemini_api_key';

export const geminiService = {
    async getApiKey(): Promise<string | null> {
        return await AsyncStorage.getItem(API_KEY_STORAGE);
    },

    async setApiKey(key: string): Promise<void> {
        await AsyncStorage.setItem(API_KEY_STORAGE, key);
    },

    async generatePropertyDescription(
        details: string,
        location?: { lat: number; lng: number }
    ): Promise<string> {
        try {
            const apiKey = await this.getApiKey();
            if (!apiKey) {
                return '❌ API 키가 설정되지 않았습니다. 홈 화면에서 설정해주세요.';
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

            const prompt = `
        부동산 매물 정보: ${details}.
        ${location ? `현재 위치 GPS: 위도 ${location.lat}, 경도 ${location.lng}.` : ''}
        
        위 정보를 바탕으로 부동산 홍보 문구를 작성해줘.
        ${location ? '특히 인근에서 가장 가까운 고속도로 IC(나들목)가 어디인지 찾아서, 그곳에서의 거리와 차량 이동 시간을 포함해줘.' : ''}
        교통 접근성이 강조된 전문적인 한국어 문구로 작성해줘.
        마크다운 형식 없이 일반 텍스트로 작성해줘.
      `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text() || '설명을 생성할 수 없습니다.';
        } catch (error) {
            console.error('Gemini description generation failed:', error);
            return '❌ 설명 생성 중 오류가 발생했습니다. API 키를 확인해주세요.';
        }
    },

    async getCurrentLocation(): Promise<{ lat: number; lng: number } | null> {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                return null;
            }

            const location = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            return {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };
        } catch (error) {
            console.error('Location error:', error);
            return null;
        }
    },
};
