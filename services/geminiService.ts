
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generatePropertyDescription = async (
  details: string, 
  location?: { lat: number, lng: number }
): Promise<string> => {
  try {
    const contents = `
      부동산 매물 정보: ${details}.
      ${location ? `현재 위치 GPS: 위도 ${location.lat}, 경도 ${location.lng}.` : ''}
      
      위 정보를 바탕으로 부동산 홍보 문구를 작성해줘. 
      특히 인근에서 가장 가까운 고속도로 IC(나들목)가 어디인지 찾아서, 그곳에서의 거리와 차량 이동 시간을 포함해줘. 
      교통 접근성이 강조된 전문적인 한국어 문구로 작성해줘.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash", // Maps grounding is supported in 2.5 series
      contents: contents,
      config: {
        tools: [{ googleMaps: {} }],
        ...(location && {
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: location.lat,
                longitude: location.lng
              }
            }
          }
        }),
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    return response.text || "설명을 생성할 수 없습니다.";
  } catch (error) {
    console.error("Gemini description generation failed:", error);
    return "설명 생성 중 오류가 발생했습니다. (GPS 정보를 가져오거나 지도를 분석하는 데 실패했을 수 있습니다.)";
  }
};
