
import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Image,
    Alert,
    ActivityIndicator,
    StyleSheet,
    Platform
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { Property, Client, BrokerInfo, PropertyType, TransactionType } from '../types';
import { Colors, Icons } from '../constants';
import { getHeaderColor, sqmToPyeong } from '../utils/formatUtils';

interface PropertyShareModalProps {
    visible: boolean;
    onClose: () => void;
    property: Property;
    clients: Client[];
    brokerInfo: BrokerInfo | null;
}

export default function PropertyShareModal({
    visible,
    onClose,
    property,
    clients,
    brokerInfo
}: PropertyShareModalProps) {
    const [reportImages, setReportImages] = useState<string[]>([]);
    const [showImageSelector, setShowImageSelector] = useState(true); // Start with image selector
    const [isSharing, setIsSharing] = useState(false);
    const [selectedClientForShare, setSelectedClientForShare] = useState<Client | null>(null);
    const reportRef = useRef<View>(null);

    // Initial setup: check images
    useEffect(() => {
        if (visible) {
            if (property.images && property.images.length > 0) {
                // If images exist, show selector (default first 3)
                setReportImages(property.images.slice(0, 3));
                setShowImageSelector(true);
            } else {
                // No images, skip to preview
                setReportImages([]);
                setShowImageSelector(false);
            }
        }
    }, [visible, property]);

    const handleSendSMS = async () => {
        if (!selectedClientForShare) {
            Alert.alert('알림', '고객을 선택해주세요.');
            return;
        }
        // SMS sending logic would go here - for now it's just image sharing simulation
        // In a real app, you might use Linking.openURL(`sms:${phone}`) or an SMS API
        // For this requirement, we treat it similarly to image share but targeted
        await handleShareImage();
    };

    const handleShareImage = async () => {
        if (!reportRef.current) return;

        setIsSharing(true);
        try {
            const uri = await captureRef(reportRef, {
                format: 'png',
                quality: 0.8,
                result: 'tmpfile'
            });

            if (await Sharing.isAvailableAsync()) {
                if (Platform.OS === 'android') {
                    await Sharing.shareAsync(uri, {
                        mimeType: 'image/png',
                        dialogTitle: '매물장 공유하기',
                        UTI: 'public.png'
                    });
                } else {
                    await Sharing.shareAsync(uri);
                }
            } else {
                Alert.alert('알림', '공유 기능을 사용할 수 없습니다.');
            }
        } catch (error) {
            console.error('Image share error:', error);
            Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
        } finally {
            setIsSharing(false);
        }
    };

    const toggleImageSelection = (uri: string) => {
        setReportImages(prev => {
            if (prev.includes(uri)) {
                return prev.filter(img => img !== uri);
            } else {
                if (prev.length >= 3) {
                    Alert.alert('알림', '최대 3장까지 선택할 수 있습니다.');
                    return prev;
                }
                return [...prev, uri];
            }
        });
    };

    // 1. Image Selector View
    if (showImageSelector && property.images && property.images.length > 0) {
        return (
            <Modal
                visible={visible}
                animationType="slide"
                onRequestClose={onClose}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>매물장 이미지 선택 (최대 3장)</Text>
                        <TouchableOpacity onPress={onClose}>
                            <Text style={styles.modalClose}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.modalContent}>
                        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {property.images.map((item) => {
                                const selectedIdx = reportImages.indexOf(item);
                                const isSelected = selectedIdx !== -1;
                                return (
                                    <TouchableOpacity
                                        key={item}
                                        onPress={() => toggleImageSelection(item)}
                                        style={{ width: '31%', aspectRatio: 1, position: 'relative' }}
                                    >
                                        <Image
                                            source={{ uri: item }}
                                            style={{ width: '100%', height: '100%', borderRadius: 8, opacity: isSelected ? 0.5 : 1 }}
                                        />
                                        {isSelected && (
                                            <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: Colors.primary, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                                                <Text style={{ color: 'white', fontWeight: 'bold' }}>{selectedIdx + 1}</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                        <TouchableOpacity
                            style={[styles.submitButton, { marginTop: 20 }]}
                            onPress={() => setShowImageSelector(false)}
                        >
                            <Text style={styles.submitButtonText}>선택 완료 ({reportImages.length}/3)</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        );
    }

    // 2. Report Preview View
    const headerColor = getHeaderColor(property);
    const isRental = property.transactionType !== TransactionType.SALE;
    const transactionLabel = property.type === PropertyType.LAND ? '토지' :
        property.transactionType === TransactionType.SALE ? '매매' : '임대';

    // Parse description into bullet points
    const descriptionPoints = property.description
        ? property.description.split('\n').filter(line => line.trim())
        : [];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
        >
            <SafeAreaView style={{ flex: 1, backgroundColor: Colors.slate50 }}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>매물장 미리보기</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Text style={styles.modalClose}>닫기</Text>
                    </TouchableOpacity>
                </View>

                {/* Report Content (Capture Target) */}
                <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 10, alignItems: 'center' }}>
                    <View
                        ref={reportRef}
                        style={{
                            backgroundColor: 'white',
                            width: '100%',
                            maxWidth: 600,
                            borderWidth: 1,
                            borderColor: Colors.slate300,
                        }}
                        collapsable={false}
                    >
                        {/* Header Bar */}
                        <View style={{
                            backgroundColor: headerColor,
                            paddingHorizontal: 16,
                            paddingVertical: 12,
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <Text style={{
                                color: 'white',
                                fontSize: 18,
                                fontWeight: 'bold',
                                flex: 1,
                            }} numberOfLines={1}>
                                {property.title}
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{
                                    backgroundColor: 'white',
                                    paddingHorizontal: 10,
                                    paddingVertical: 4,
                                    borderRadius: 4,
                                }}>
                                    <Text style={{ color: headerColor, fontWeight: 'bold', fontSize: 13 }}>
                                        {transactionLabel}
                                    </Text>
                                </View>
                            </View>
                            <Text style={{ color: 'white', fontSize: 12 }}>
                                관리번호 {property.managementId || property.id.slice(-4)}
                            </Text>
                        </View>

                        {/* Image Section */}
                        <View style={{
                            flexDirection: 'row',
                            backgroundColor: '#f5f5f5',
                            borderBottomWidth: 1,
                            borderBottomColor: Colors.slate300,
                        }}>
                            {[0, 1, 2].map((index) => (
                                <View key={index} style={{ flex: 1, aspectRatio: 4 / 3 }}>
                                    {reportImages && reportImages[index] ? (
                                        <View style={{ flex: 1 }}>
                                            <Image
                                                source={{ uri: reportImages[index] }}
                                                style={{ width: '100%', height: '100%' }}
                                                resizeMode="cover"
                                            />
                                            <View style={{
                                                position: 'absolute',
                                                bottom: 0,
                                                left: 0,
                                                right: 0,
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                paddingVertical: 4,
                                            }}>
                                                <Text style={{
                                                    color: '#ffcc00',
                                                    fontSize: 10,
                                                    textAlign: 'center',
                                                    fontWeight: 'bold',
                                                }}>
                                                    {index === 0 ? '<외부 전경>' : index === 1 ? '<내부 전경>' : '<상세 사진>'}
                                                </Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={{
                                            flex: 1,
                                            backgroundColor: Colors.slate200,
                                            justifyContent: 'center',
                                            alignItems: 'center',
                                        }}>
                                            <Icons.Building size={32} color={Colors.slate400} />
                                            <Text style={{ fontSize: 10, color: Colors.slate400, marginTop: 4 }}>
                                                사진 {index + 1}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            ))}
                        </View>

                        {/* Property Details Grid */}
                        <View style={{ padding: 16, backgroundColor: 'white' }}>
                            <View style={{ borderWidth: 1, borderColor: Colors.slate300, marginBottom: 16 }}>
                                {/* Address */}
                                <View style={styles.tableRow}>
                                    <View style={styles.tableLabel}><Text style={styles.tableLabelText}>소재지</Text></View>
                                    <View style={styles.tableValue}><Text style={{ fontSize: 11, color: headerColor }}>{property.address || '-'}</Text></View>
                                </View>

                                {/* Building Use */}
                                {property.buildingUse && (
                                    <View style={styles.tableRow}>
                                        <View style={styles.tableLabel}><Text style={styles.tableLabelText}>건축물용도</Text></View>
                                        <View style={styles.tableValue}>
                                            <Text style={styles.tableValueText}>{property.buildingUse} {property.buildingUseDetail ? `(${property.buildingUseDetail})` : ''}</Text>
                                        </View>
                                    </View>
                                )}

                                {/* Area */}
                                <View style={styles.tableRow}>
                                    <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: 1, borderRightColor: Colors.slate200 }}>
                                        <View style={[styles.tableLabel, { width: 60 }]}><Text style={styles.tableLabelText}>대지면적</Text></View>
                                        <View style={styles.tableValue}>
                                            <Text style={styles.tableValueText}>{property.landArea ? `${sqmToPyeong(property.landArea)}평` : '-'}</Text>
                                            <Text style={{ fontSize: 9, color: Colors.slate400 }}>{property.landArea ? `(${property.landArea}m²)` : ''}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flex: 1, flexDirection: 'row' }}>
                                        <View style={[styles.tableLabel, { width: 60 }]}><Text style={styles.tableLabelText}>연면적</Text></View>
                                        <View style={styles.tableValue}>
                                            <Text style={styles.tableValueText}>{property.buildingArea ? `${sqmToPyeong(property.buildingArea)}평` : '-'}</Text>
                                            <Text style={{ fontSize: 9, color: Colors.slate400 }}>{property.buildingArea ? `(${property.buildingArea}m²)` : ''}</Text>
                                        </View>
                                    </View>
                                </View>

                                {/* Zone & Road */}
                                <View style={styles.tableRow}>
                                    <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: 1, borderRightColor: Colors.slate200 }}>
                                        <View style={[styles.tableLabel, { width: 60 }]}><Text style={styles.tableLabelText}>용도지역</Text></View>
                                        <View style={styles.tableValue}><Text style={styles.tableValueText}>{property.landUseZone || '-'}</Text></View>
                                    </View>
                                    <View style={{ flex: 1, flexDirection: 'row' }}>
                                        <View style={[styles.tableLabel, { width: 60 }]}><Text style={styles.tableLabelText}>도로조건</Text></View>
                                        <View style={styles.tableValue}><Text style={styles.tableValueText}>{property.roadCondition || '-'}</Text></View>
                                    </View>
                                </View>
                            </View>

                            {/* Price Section */}
                            <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                <View style={{
                                    backgroundColor: headerColor,
                                    paddingHorizontal: 24,
                                    paddingVertical: 8,
                                    borderRadius: 20,
                                    marginBottom: 12,
                                }}>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>{transactionLabel}</Text>
                                </View>
                                <Text style={{ fontSize: 28, fontWeight: 'bold', color: Colors.slate900, marginBottom: 8 }}>{property.price}</Text>
                                <Text style={{ fontSize: 12, color: Colors.slate400 }}>[부가세 별도]</Text>
                            </View>

                            {/* Description */}
                            <View style={{ padding: 16, backgroundColor: Colors.slate50, borderRadius: 12 }}>
                                <Text style={{ fontSize: 14, fontWeight: 'bold', color: Colors.slate800, marginBottom: 12 }}>매물 상세 특징</Text>
                                {descriptionPoints.length > 0 ? (
                                    descriptionPoints.map((point, index) => (
                                        <View key={index} style={{ flexDirection: 'row', marginBottom: 8 }}>
                                            <Text style={{ fontSize: 14, color: headerColor, marginRight: 8 }}>✓</Text>
                                            <Text style={{ fontSize: 14, color: Colors.slate700, flex: 1, lineHeight: 22 }}>{point}</Text>
                                        </View>
                                    ))
                                ) : (
                                    <Text style={{ fontSize: 14, color: Colors.slate400, fontStyle: 'italic' }}>상세 설명이 없습니다.</Text>
                                )}
                            </View>
                        </View>

                        {/* Footer: Broker Info */}
                        <View style={{
                            backgroundColor: headerColor,
                            paddingHorizontal: 16,
                            paddingVertical: 10,
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}>
                            {brokerInfo ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                        <View style={{ backgroundColor: 'white', width: 20, height: 20, borderRadius: 4, justifyContent: 'center', alignItems: 'center', marginRight: 8 }}>
                                            <Text style={{ color: headerColor, fontWeight: 'bold', fontSize: 10 }}>부</Text>
                                        </View>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{brokerInfo.businessName}</Text>
                                    </View>
                                    <Text style={{ color: 'white', fontSize: 11 }}>{brokerInfo.address}</Text>
                                    <Text style={{ color: 'white', fontSize: 11 }}>대표 {brokerInfo.name}</Text>
                                    <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>{brokerInfo.phone}</Text>
                                </View>
                            ) : (
                                <Text style={{ color: 'white', fontSize: 11 }}>중개사 정보가 없습니다.</Text>
                            )}
                        </View>
                    </View>
                </ScrollView>

                {/* Footer Actions */}
                <View style={{ padding: 16, paddingBottom: 40, borderTopWidth: 1, borderTopColor: Colors.slate200, backgroundColor: 'white' }}>
                    <Text style={styles.sectionLabel}>고객에게 바로 전달하기</Text>

                    {/* Client Selector */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            {clients.map(client => (
                                <TouchableOpacity
                                    key={client.id}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 10,
                                        borderRadius: 20,
                                        backgroundColor: selectedClientForShare?.id === client.id ? Colors.primary : Colors.slate100,
                                        borderWidth: 1,
                                        borderColor: selectedClientForShare?.id === client.id ? Colors.primary : Colors.slate200,
                                    }}
                                    onPress={() => setSelectedClientForShare(selectedClientForShare?.id === client.id ? null : client)}
                                >
                                    <Text style={{
                                        fontSize: 14,
                                        color: selectedClientForShare?.id === client.id ? 'white' : Colors.slate600,
                                        fontWeight: selectedClientForShare?.id === client.id ? 'bold' : 'normal'
                                    }}>
                                        {client.name}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    <View style={styles.shareButtonsContainer}>
                        <TouchableOpacity
                            style={[styles.shareButton, { backgroundColor: Colors.primary }]}
                            onPress={handleSendSMS}
                            disabled={!selectedClientForShare || isSharing}
                        >
                            {isSharing ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.shareButtonText}>문자 전송</Text>}
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.shareButton, { backgroundColor: Colors.slate600 }]}
                            onPress={handleShareImage}
                            disabled={isSharing}
                        >
                            {isSharing ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.shareButtonText}>이미지 공유</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalContainer: { flex: 1, backgroundColor: Colors.white },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    modalClose: { fontSize: 14, color: Colors.slate400 },
    modalContent: { padding: 16 },
    submitButton: { backgroundColor: Colors.slate800, padding: 16, borderRadius: 12, alignItems: 'center' },
    submitButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
    sectionLabel: { fontSize: 14, fontWeight: 'bold', color: Colors.slate800, marginBottom: 12 },
    shareButtonsContainer: { flexDirection: 'row', gap: 12 },
    shareButton: { flex: 1, padding: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    shareButtonText: { color: 'white', fontWeight: 'bold', fontSize: 14 },
    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
    tableLabel: { width: 80, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' },
    tableLabelText: { fontSize: 11, fontWeight: 'bold', color: Colors.slate700 },
    tableValue: { flex: 1, padding: 8, justifyContent: 'center' },
    tableValueText: { fontSize: 11, color: Colors.slate700 },
});
