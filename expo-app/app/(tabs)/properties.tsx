import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    Modal,
    TextInput,
    Alert,
    Image,
    RefreshControl,
    ActivityIndicator,
    KeyboardAvoidingView,

    Platform,
    BackHandler,
} from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Property, PropertyType, TransactionType, Client, LAND_USE_ZONES, LAND_CATEGORIES, BUILDING_USES, BrokerInfo, BuildingDetail } from '../../src/types';
import { storage } from '../../src/storageService';
import { Icons, Colors } from '../../src/constants';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { geminiService } from '../../src/services/geminiService';
import * as SMS from 'expo-sms';
import DateTimePicker from '@react-native-community/datetimepicker';
import PropertyDetail from '../../src/components/PropertyDetail';

interface DecimalInputProps extends Omit<React.ComponentProps<typeof TextInput>, 'value' | 'onChange'> {
    value?: number;
    onChange: (val: number | undefined) => void;
}

const DecimalInput = ({ value, onChange, style, ...props }: DecimalInputProps) => {
    const [text, setText] = useState(value !== undefined ? String(value) : '');

    useEffect(() => {
        if (value === undefined) {
            if (text !== '') setText('');
        } else {
            const currentParsed = parseFloat(text);
            if (currentParsed !== value) {
                setText(String(value));
            }
        }
    }, [value]);

    const handleChangeText = (newText: string) => {
        setText(newText);
        const parsed = parseFloat(newText);
        if (!isNaN(parsed)) {
            onChange(parsed);
        } else {
            onChange(undefined);
        }
    };

    return (
        <TextInput
            style={style}
            value={text}
            onChangeText={handleChangeText}
            keyboardType="decimal-pad"
            {...props}
        />
    );
};

const convertArea = (val: number, to: 'm2' | 'py') => {
    if (to === 'py') return parseFloat((val / 3.3058).toFixed(2));
    return parseFloat((val * 3.3058).toFixed(2));
};

interface AreaInputProps {
    valueM2?: number;
    onChangeM2: (val: number | undefined) => void;
    style?: any;
}

const AreaInput = ({ valueM2, onChangeM2, style }: AreaInputProps) => {
    const [unit, setUnit] = useState<'py' | 'm2'>('py');

    // displayValue logic: derived from valueM2 (source of truth) and current unit
    const displayValue = valueM2 !== undefined && valueM2 !== 0
        ? (unit === 'py' ? parseFloat((valueM2 / 3.3058).toFixed(2)) : valueM2)
        : undefined;

    const handleChange = (val: number | undefined) => {
        if (val === undefined) {
            onChangeM2(undefined);
            return;
        }
        if (unit === 'py') {
            // User typed in Pyeong, store as m2
            // Avoid precision drift: if user types 100 py, we store 330.58.
            // If we then display 330.58 / 3.3058 = 100. Correct.
            onChangeM2(parseFloat((val * 3.3058).toFixed(2)));
        } else {
            // User typed in m2, store as m2
            onChangeM2(val);
        }
    };

    const toggleUnit = () => {
        setUnit(prev => prev === 'py' ? 'm2' : 'py');
    };

    return (
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
                <DecimalInput
                    style={style}
                    placeholder={unit === 'py' ? "예: 100 (평)" : "예: 330.5 (m²)"}
                    value={displayValue}
                    onChange={handleChange}
                    placeholderTextColor={Colors.slate400}
                />
                <Text style={{ position: 'absolute', right: 12, top: 12, fontSize: 13, color: Colors.slate400 }}>
                    {unit === 'py' ? '평' : 'm²'}
                </Text>
            </View>
            <TouchableOpacity
                onPress={toggleUnit}
                style={{
                    backgroundColor: Colors.white,
                    borderWidth: 1,
                    borderColor: Colors.slate200,
                    borderRadius: 12,
                    paddingHorizontal: 16,
                    justifyContent: 'center',
                    height: 48 // Match input height roughly
                }}
            >
                <Text style={{ fontSize: 13, color: Colors.slate600, fontWeight: '600' }}>
                    {unit === 'py' ? '㎡로 변환' : '평으로 변환'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default function PropertiesScreen() {
    const [properties, setProperties] = useState<Property[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [brokerInfo, setBrokerInfo] = useState<BrokerInfo | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showReportPreview, setShowReportPreview] = useState(false);
    const [selectedClientForShare, setSelectedClientForShare] = useState<Client | null>(null);
    const [isReadOnly, setIsReadOnly] = useState(false);
    const reportRef = useRef<View>(null);
    const params = useLocalSearchParams();

    // Reset state on tab blur
    useFocusEffect(
        useCallback(() => {
            return () => {
                // When leaving the screen (blur), reset the selected property so next visit shows the list
                setSelectedProperty(null);
                setIsReadOnly(false);
                setIsAdding(false);
                setShowAdvancedSearch(false);
                setShowReportPreview(false);
            };
        }, [])
    );

    // Handle Hardware Back Button


    // Check if ID is passed via params
    useEffect(() => {
        if (params.id && properties.length > 0) {
            const found = properties.find(p => p.id === params.id);
            if (found) {
                setSelectedProperty(found);
                setIsReadOnly(params.readonly === 'true');
            }
        }
    }, [params.id, properties, params.readonly]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState<PropertyType | 'ALL'>('ALL');

    const [newProp, setNewProp] = useState<Partial<Property>>({
        type: PropertyType.HOUSE,
        transactionType: TransactionType.SALE,
        images: [],
        priceAmount: 0,
        buildings: [],
    });

    // Dropdown states
    const [showTypeDropdown, setShowTypeDropdown] = useState(false);
    const [showTransactionDropdown, setShowTransactionDropdown] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);


    // Advanced Search
    const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
    const [advancedFilters, setAdvancedFilters] = useState({
        type: PropertyType.HOUSE as PropertyType,
        transactionType: 'ALL' as TransactionType | 'ALL',
        minPrice: '',
        maxPrice: '',
        minArea: '',
        maxArea: '',
        minRooms: '',
        parking: 'ALL' as 'ALL' | 'YES' | 'NO',
        // 주택
        apartmentName: '',
        // 토지
        lotNumber: '',
        landUseZone: '',
        landCategory: '',
        // 공장/창고
        buildingUse: '',
        minAreaPyeong: '',
        maxAreaPyeong: '',
    });

    // Advanced Search Dropdown states
    const [showLandUseDropdown, setShowLandUseDropdown] = useState(false);
    const [showLandCategoryDropdown, setShowLandCategoryDropdown] = useState(false);
    const [showBuildingUseDropdown, setShowBuildingUseDropdown] = useState(false);

    // Registration Dropdown states
    const [showRegLandUseDropdown, setShowRegLandUseDropdown] = useState(false);
    const [showRegLandCategoryDropdown, setShowRegLandCategoryDropdown] = useState(false);

    const [showRegBuildingUseDropdown, setShowRegBuildingUseDropdown] = useState<string | boolean>(false);
    const [datePickerTarget, setDatePickerTarget] = useState<'property' | string>('property');

    // New Building Input State - used for adding MORE buildings
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

    // Ensure at least one building exists for Factory/Warehouse
    useEffect(() => {
        if (newProp.type === PropertyType.FACTORY_WAREHOUSE) {
            if (!newProp.buildings || newProp.buildings.length === 0) {
                setNewProp(prev => ({
                    ...prev,
                    buildings: [{
                        id: Date.now().toString(),
                        name: '주건물', // Default name
                        area: 0,
                        floor: undefined,
                        totalFloorArea: 0,
                        use: '',
                        specificUse: '',
                        structureHeight: '',
                        usageApprovalDate: '',
                        note: ''
                    }]
                }));
            }
        }
    }, [newProp.type]);

    const [reportImages, setReportImages] = useState<string[]>([]);
    const [showImageSelector, setShowImageSelector] = useState(false);


    const addBuilding = () => {
        if (!newBuilding.name) {
            Alert.alert('알림', '건물 명칭을 입력해주세요.');
            return;
        }
        const buildingToAdd = { ...newBuilding, id: Date.now().toString() };
        const updated = [...(newProp.buildings || []), buildingToAdd];
        setNewProp({ ...newProp, buildings: updated });

        // Reset form
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
        const updated = (newProp.buildings || []).filter(b => b.id !== id);
        setNewProp({ ...newProp, buildings: updated });
    };

    const isBuildingValid = newBuilding.name.trim().length > 0;

    useFocusEffect(
        useCallback(() => {
            const onBackPress = () => {
                if (selectedProperty) {
                    setSelectedProperty(null);
                    setIsReadOnly(false);
                    return true;
                }
                if (isAdding) {
                    setIsAdding(false);
                    return true;
                }
                if (showAdvancedSearch) {
                    setShowAdvancedSearch(false);
                    return true;
                }
                return false;
            };

            const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
            return () => subscription.remove();
        }, [selectedProperty, isAdding, showAdvancedSearch])
    );

    const renderImageSelector = () => {
        if (!showImageSelector || !selectedProperty) return null;

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

        const sortedImages = [...(selectedProperty.images || [])];

        return (
            <Modal
                visible={showImageSelector}
                animationType="slide"
                onRequestClose={() => setShowImageSelector(false)}
            >
                <SafeAreaView style={styles.modalContainer}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>매물장 이미지 선택 (최대 3장)</Text>
                        <TouchableOpacity onPress={() => setShowImageSelector(false)}>
                            <Text style={{ fontSize: 16, color: Colors.slate500 }}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.modalContent}>
                        <ScrollView contentContainerStyle={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                            {sortedImages.map((item) => {
                                const selectedIdx = reportImages.indexOf(item);
                                const isSelected = selectedIdx !== -1;
                                return (
                                    <TouchableOpacity key={item} onPress={() => toggleImageSelection(item)} style={{ width: '31%', aspectRatio: 1, position: 'relative' }}>
                                        <Image source={{ uri: item }} style={{ width: '100%', height: '100%', borderRadius: 8, opacity: isSelected ? 0.5 : 1 }} />
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
                            onPress={() => {
                                setShowImageSelector(false);
                                setShowReportPreview(true);
                            }}
                        >
                            <Text style={styles.submitButtonText}>선택 완료 ({reportImages.length}/3)</Text>
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </Modal>
        );
    };
    const [showDatePicker, setShowDatePicker] = useState(false);

    const resetFilters = (type: PropertyType) => ({
        type,
        transactionType: 'ALL' as TransactionType | 'ALL',
        minPrice: '',
        maxPrice: '',
        minArea: '',
        maxArea: '',
        minRooms: '',
        parking: 'ALL' as 'ALL' | 'YES' | 'NO',
        apartmentName: '',
        lotNumber: '',
        landUseZone: '',
        landCategory: '',
        buildingUse: '',
        minAreaPyeong: '',
        maxAreaPyeong: '',
    });

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async () => {
        const [props, clnts, broker] = await Promise.all([
            storage.getProperties(),
            storage.getClients(),
            storage.getBrokerInfo(),
        ]);
        setProperties(props);
        setClients(clnts);
        setBrokerInfo(broker);

    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    // Media picker functions are called directly from buttons

    const handlePickFromGallery = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images', 'videos'],
            allowsMultipleSelection: true,
            quality: 0.7,
        });

        if (!result.canceled) {
            const newMedia = result.assets.map(asset => asset.uri);
            setNewProp(prev => ({
                ...prev,
                images: [...(prev.images || []), ...newMedia],
            }));
        }
    };

    const handleTakePhoto = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            quality: 0.7,
        });

        if (!result.canceled) {
            setNewProp(prev => ({
                ...prev,
                images: [...(prev.images || []), result.assets[0].uri],
            }));
        }
    };

    const handleTakeVideo = async () => {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
            Alert.alert('권한 필요', '카메라 접근 권한이 필요합니다.');
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['videos'],
            videoMaxDuration: 60,
            quality: 0.7,
        });

        if (!result.canceled) {
            setNewProp(prev => ({
                ...prev,
                images: [...(prev.images || []), result.assets[0].uri],
            }));
        }
    };

    const handleGenerateAI = async () => {
        if (!newProp.title && !newProp.type && !newProp.address) {
            Alert.alert('알림', '매물명, 구분, 주소 중 하나 이상을 입력해주세요.');
            return;
        }

        setIsGeneratingAI(true);
        try {
            // Get current GPS location
            const location = await geminiService.getCurrentLocation();

            // Build details string
            const details = [
                newProp.title && `매물명: ${newProp.title}`,
                newProp.type && `매물 구분: ${newProp.type}`,
                newProp.transactionType && `거래 유형: ${newProp.transactionType}`,
                newProp.price && `가격: ${newProp.price}`,
                newProp.address && `주소: ${newProp.address}`,
            ].filter(Boolean).join(', ');

            const description = await geminiService.generatePropertyDescription(
                details,
                location || undefined
            );

            setNewProp(prev => ({
                ...prev,
                description: description,
            }));
        } catch (error) {
            console.error('AI generation error:', error);
            Alert.alert('오류', 'AI 문구 생성 중 오류가 발생했습니다.');
        } finally {
            setIsGeneratingAI(false);
        }
    };

    const handleSubmit = async () => {
        if (!newProp.title) {
            Alert.alert('알림', '매물명을 입력해주세요.');
            return;
        }

        const isUpdate = !!newProp.id;
        const id = newProp.id || Date.now().toString();

        const property: Property = {
            id,
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
            // New Fields
            landArea: newProp.landArea,
            roadCondition: newProp.roadCondition,
            water: newProp.water,
            sewage: newProp.sewage,
            buildingArea: newProp.buildingArea,
            structureHeight: newProp.structureHeight,
            usageApprovalDate: newProp.usageApprovalDate,
            landUseZone: newProp.landUseZone,
            landCategory: newProp.landCategory,
            buildingUse: newProp.buildingUse,
            buildingUseDetail: newProp.buildingUseDetail,
            buildings: newProp.buildings,
        };

        if (isUpdate) {
            newProperties = properties.map(p => p.id === id ? property : p);
            if (selectedProperty && selectedProperty.id === id) {
                setSelectedProperty(property);
            }
            // Use updateProperty instead of setProperties
            await storage.updateProperty(property);
        } else {
            newProperties = [property, ...properties];
            // Use addProperty
            await storage.addProperty(property);
        }

        setProperties(newProperties);
        // await storage.setProperties(newProperties); // Removed

        setNewProp({
            type: PropertyType.HOUSE,
            transactionType: TransactionType.SALE,
            images: [],
            priceAmount: 0,
            buildings: [],
        });
        setIsAdding(false);
    };

    const handleDelete = async (id: string) => {
        Alert.alert('삭제 확인', '정말로 이 매물을 삭제하시겠습니까?', [
            { text: '취소', style: 'cancel' },
            {
                text: '삭제',
                style: 'destructive',
                onPress: async () => {
                    const newProperties = properties.filter(p => p.id !== id);
                    setProperties(newProperties);
                    // Use deleteProperty
                    await storage.deleteProperty(id);
                    setSelectedProperty(null);
                },
            },
        ]);
    };

    const filteredProperties = properties.filter(prop => {
        const matchesSearch = prop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            prop.address.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || prop.type === filterType;

        // Advanced filters - 상세검색을 사용한 경우만 적용
        if (!showAdvancedSearch) {
            return matchesSearch && matchesType;
        }

        const af = advancedFilters;
        const matchesAdvType = prop.type === af.type;
        const matchesAdvTrans = af.transactionType === 'ALL' || prop.transactionType === af.transactionType;
        const matchesMinPrice = !af.minPrice || prop.priceAmount >= parseInt(af.minPrice);
        const matchesMaxPrice = !af.maxPrice || prop.priceAmount <= parseInt(af.maxPrice);
        const matchesMinArea = !af.minArea || !prop.area || prop.area >= parseFloat(af.minArea);
        const matchesMaxArea = !af.maxArea || !prop.area || prop.area <= parseFloat(af.maxArea);
        const matchesMinRooms = !af.minRooms || !prop.rooms || prop.rooms >= parseInt(af.minRooms);
        const matchesParking = af.parking === 'ALL' || prop.parking === undefined ||
            (af.parking === 'YES' && prop.parking === true) ||
            (af.parking === 'NO' && prop.parking === false);
        // 주택 - 아파트명
        const matchesApartment = !af.apartmentName ||
            (prop.apartmentName && prop.apartmentName.toLowerCase().includes(af.apartmentName.toLowerCase()));
        // 토지 - 지번, 용도지역, 지목
        const matchesLotNumber = !af.lotNumber ||
            (prop.lotNumber && prop.lotNumber.includes(af.lotNumber));
        const matchesLandUse = !af.landUseZone || prop.landUseZone === af.landUseZone;
        const matchesLandCat = !af.landCategory || prop.landCategory === af.landCategory;
        // 공장/창고 - 건축물용도, 면적(평)
        const matchesBuildingUse = !af.buildingUse || prop.buildingUse === af.buildingUse;
        const matchesMinAreaPyeong = !af.minAreaPyeong || !prop.areaPyeong || prop.areaPyeong >= parseFloat(af.minAreaPyeong);
        const matchesMaxAreaPyeong = !af.maxAreaPyeong || !prop.areaPyeong || prop.areaPyeong <= parseFloat(af.maxAreaPyeong);

        return matchesAdvType && matchesAdvTrans &&
            matchesMinPrice && matchesMaxPrice && matchesMinArea && matchesMaxArea &&
            matchesMinRooms && matchesParking &&
            matchesApartment && matchesLotNumber && matchesLandUse && matchesLandCat &&
            matchesBuildingUse && matchesMinAreaPyeong && matchesMaxAreaPyeong;
    });

    const handleShareImage = async () => {
        try {
            const uri = await captureRef(reportRef, {
                format: 'png',
                quality: 0.9,
            });
            await Sharing.shareAsync(uri);
        } catch (error) {
            console.error('Image capture error:', error);
            Alert.alert('오류', '이미지 생성 중 오류가 발생했습니다.');
        }
    };

    const handleSendSMS = async () => {
        if (!selectedClientForShare) {
            Alert.alert('알림', '전송할 고객을 선택해주세요.');
            return;
        }

        try {
            const uri = await captureRef(reportRef, {
                format: 'png',
                quality: 0.9,
            });

            // On Android, SMS with file attachments often fails due to FileProvider issues
            // So we go directly to the share sheet where user can pick SMS app
            if (Platform.OS === 'android') {
                Alert.alert(
                    '매물장 전송',
                    `${selectedClientForShare.name} 고객에게 전송합니다.\n공유 화면에서 메시지 앱을 선택해주세요.`,
                    [{ text: '공유하기', onPress: () => Sharing.shareAsync(uri) }]
                );
            } else {
                // iOS - try SMS with attachment
                const isAvailable = await SMS.isAvailableAsync();
                if (isAvailable) {
                    await SMS.sendSMSAsync(
                        [selectedClientForShare.phone],
                        '매물장 전달드립니다.',
                        {
                            attachments: [{
                                uri: uri,
                                mimeType: 'image/png',
                                filename: 'property_report.png',
                            }],
                        }
                    );
                } else {
                    await Sharing.shareAsync(uri);
                }
            }
        } catch (error) {
            console.error('Image send error:', error);
            Alert.alert('오류', '이미지 전송 중 오류가 발생했습니다.');
        }
    };

    // Helper function to get header color based on property type and transaction type
    const getHeaderColor = () => {
        if (!selectedProperty) return '#0066cc';
        // 토지는 녹색
        if (selectedProperty.type === PropertyType.LAND) return '#10b981';
        // 매매는 주황색
        if (selectedProperty.transactionType === TransactionType.SALE) return '#f97316';
        // 임대(월세, 전세)는 파란색
        return '#0066cc';
    };

    // Helper function to convert m² to 평
    const sqmToPyeong = (sqm: number) => Math.round(sqm * 0.3025 * 100) / 100;

    // Report Preview View - Template Style
    const renderReportPreview = () => {
        if (!selectedProperty) return null;

        const headerColor = getHeaderColor();
        const isRental = selectedProperty.transactionType !== TransactionType.SALE;
        const transactionLabel = selectedProperty.type === PropertyType.LAND ? '토지' :
            selectedProperty.transactionType === TransactionType.SALE ? '매매' : '임대';

        // Parse description into bullet points
        const descriptionPoints = selectedProperty.description
            ? selectedProperty.description.split('\n').filter(line => line.trim())
            : [];

        return (
            <Modal
                visible={showReportPreview}
                animationType="slide"
                onRequestClose={() => setShowReportPreview(false)}
            >
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors.slate50 }}>
                    <View style={styles.modalHeader}>
                        <Text style={styles.modalTitle}>매물장 미리보기</Text>
                        <TouchableOpacity onPress={() => setShowReportPreview(false)}>
                            <Text style={styles.modalClose}>닫기</Text>
                        </TouchableOpacity>
                    </View>

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
                            {/* Header Bar - 거래유형별 색상 */}
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
                                    {selectedProperty.title}
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
                                    관리번호 {selectedProperty.managementId || selectedProperty.id.slice(-4)}
                                </Text>
                            </View>


                            {/* Image Section - 3 Photos */}
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

                            {/* Content Section - Vertical Layout for Mobile */}
                            <View style={{
                                padding: 16,
                                backgroundColor: 'white',
                            }}>
                                {/* 1. Property Info Grid */}
                                <View style={{ borderWidth: 1, borderColor: Colors.slate300, marginBottom: 16 }}>
                                    {/* Row 1: Address (Full Width) */}
                                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                        <View style={{ width: 80, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>소재지</Text>
                                        </View>
                                        <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 11, color: headerColor }}>{selectedProperty.address || '-'}</Text>
                                        </View>
                                    </View>

                                    {/* Row 2: Building Use (Full Width) */}
                                    {selectedProperty.buildingUse && (
                                        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                            <View style={{ width: 80, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>건축물용도</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>
                                                    {selectedProperty.buildingUse} {selectedProperty.buildingUseDetail ? `(${selectedProperty.buildingUseDetail})` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    )}

                                    {/* Row 3: Land Area & Building Area (2 Columns) */}
                                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                        {/* Left: Land */}
                                        <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: 1, borderRightColor: Colors.slate200 }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>대지면적</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>
                                                    {selectedProperty.landArea ? `${sqmToPyeong(selectedProperty.landArea)}평` : '-'}
                                                </Text>
                                                <Text style={{ fontSize: 9, color: Colors.slate400 }}>
                                                    {selectedProperty.landArea ? `(${selectedProperty.landArea}m²)` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                        {/* Right: Building */}
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>연면적</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>
                                                    {selectedProperty.buildingArea ? `${sqmToPyeong(selectedProperty.buildingArea)}평` : '-'}
                                                </Text>
                                                <Text style={{ fontSize: 9, color: Colors.slate400 }}>
                                                    {selectedProperty.buildingArea ? `(${selectedProperty.buildingArea}m²)` : ''}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Building List (Full Width if exists) */}
                                    {selectedProperty.buildings && selectedProperty.buildings.length > 0 && (
                                        <View style={{ borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                            <View style={{ backgroundColor: Colors.slate100, padding: 8 }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>건축물 상세 정보</Text>
                                            </View>
                                            <View>
                                                {selectedProperty.buildings.map((b, idx) => (
                                                    <View key={idx} style={{ padding: 8, borderBottomWidth: idx < selectedProperty.buildings!.length - 1 ? 1 : 0, borderBottomColor: Colors.slate100 }}>
                                                        <View style={{ flexDirection: 'row', marginBottom: 4, alignItems: 'center' }}>
                                                            <View style={{ backgroundColor: Colors.slate100, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2, marginRight: 6 }}>
                                                                <Text style={{ fontSize: 10, fontWeight: 'bold', color: Colors.slate700 }}>{b.name || '건물'}</Text>
                                                            </View>
                                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate800 }}>{b.use}</Text>
                                                            {b.specificUse ? <Text style={{ fontSize: 11, color: Colors.slate600 }}> ({b.specificUse})</Text> : null}
                                                        </View>

                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 4 }}>
                                                            <Text style={{ fontSize: 10, color: Colors.slate600 }}>건축면적: {b.area}m²</Text>
                                                            {b.totalFloorArea ? <Text style={{ fontSize: 10, color: Colors.slate600 }}>연면적: {b.totalFloorArea}m²</Text> : null}
                                                        </View>

                                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
                                                            {b.structureHeight ? <Text style={{ fontSize: 10, color: Colors.slate600 }}>{b.structureHeight}</Text> : null}
                                                            {b.usageApprovalDate ? <Text style={{ fontSize: 10, color: Colors.slate600 }}>사용승인: {b.usageApprovalDate}</Text> : null}
                                                        </View>

                                                        {b.note ? (
                                                            <Text style={{ fontSize: 10, color: Colors.slate500, marginTop: 4 }}>비고: {b.note}</Text>
                                                        ) : null}
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                    )}

                                    {/* Row 4: Land Zone & Road (2 Columns) */}
                                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                        <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: 1, borderRightColor: Colors.slate200 }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>용도지역</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>{selectedProperty.landUseZone || '-'}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>도로조건</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>{selectedProperty.roadCondition || '-'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Row 5: Structure/Height(Full) or Split? keep Split for specific fields */}
                                    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.slate200 }}>
                                        <View style={{ flex: 1, flexDirection: 'row', borderRightWidth: 1, borderRightColor: Colors.slate200 }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>구조/층고</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 10, color: Colors.slate700 }} numberOfLines={2}>{selectedProperty.structureHeight || '-'}</Text>
                                            </View>
                                        </View>
                                        <View style={{ flex: 1, flexDirection: 'row' }}>
                                            <View style={{ width: 60, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>사용승인</Text>
                                            </View>
                                            <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                                <Text style={{ fontSize: 11, color: Colors.slate700 }}>{selectedProperty.usageApprovalDate || '-'}</Text>
                                            </View>
                                        </View>
                                    </View>

                                    {/* Row 6: Infrastructure (Water/Sewage) (Full Width) */}
                                    <View style={{ flexDirection: 'row' }}>
                                        <View style={{ width: 80, backgroundColor: Colors.slate100, padding: 8, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: Colors.slate700 }}>기타시설</Text>
                                        </View>
                                        <View style={{ flex: 1, padding: 8, justifyContent: 'center' }}>
                                            <Text style={{ fontSize: 11, color: Colors.slate700 }}>
                                                {[
                                                    selectedProperty.water?.length ? `상수도(${selectedProperty.water.join(',')})` : '',
                                                    selectedProperty.sewage?.length ? `하수(${selectedProperty.sewage.join(',')})` : ''
                                                ].filter(Boolean).join(' / ') || '-'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>

                                {/* 2. Price Section */}
                                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                                    <View style={{
                                        backgroundColor: headerColor,
                                        paddingHorizontal: 24,
                                        paddingVertical: 8,
                                        borderRadius: 20,
                                        marginBottom: 12,
                                    }}>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 16 }}>
                                            {transactionLabel}
                                        </Text>
                                    </View>
                                    <Text style={{ fontSize: 28, fontWeight: 'bold', color: Colors.slate900, marginBottom: 8 }}>
                                        {selectedProperty.price}
                                    </Text>
                                    {selectedProperty.deposit && selectedProperty.monthlyRent && (
                                        <Text style={{ fontSize: 16, color: Colors.slate600, marginBottom: 4 }}>
                                            (보증금 {(selectedProperty.deposit / 10000).toLocaleString()}억원 / 월 {(selectedProperty.monthlyRent / 10).toLocaleString()}만원)
                                        </Text>
                                    )}
                                    <Text style={{ fontSize: 12, color: Colors.slate400 }}>[부가세 별도]</Text>
                                </View>

                                {/* 3. Description Section */}
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

                            {/* Footer Bar - Broker Info */}
                            <View style={{
                                backgroundColor: headerColor,
                                paddingHorizontal: 16,
                                paddingVertical: 10,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}>
                                {brokerInfo ? (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <View style={{
                                                backgroundColor: 'white',
                                                width: 20,
                                                height: 20,
                                                borderRadius: 4,
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                marginRight: 8,
                                            }}>
                                                <Text style={{ color: headerColor, fontWeight: 'bold', fontSize: 10 }}>부</Text>
                                            </View>
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                                                {brokerInfo.businessName}
                                            </Text>
                                        </View>
                                        <Text style={{ color: 'white', fontSize: 11 }}>
                                            {brokerInfo.address}
                                        </Text>
                                        <Text style={{ color: 'white', fontSize: 11 }}>
                                            대표 {brokerInfo.name}
                                        </Text>
                                        <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 12 }}>
                                            {brokerInfo.phone}
                                        </Text>
                                    </View>
                                ) : (
                                    <Text style={{ color: 'white', fontSize: 11 }}>
                                        설정 {'>'} 중개사 정보에서 상호/주소/성명/전화번호를 등록해주세요.
                                    </Text>
                                )}
                            </View>
                        </View>
                    </ScrollView>

                    <View style={{ padding: 16, borderTopWidth: 1, borderTopColor: Colors.slate200, backgroundColor: 'white' }}>
                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: Colors.slate800, marginBottom: 12 }}>고객에게 바로 전달하기</Text>

                        {/* Client Selector (Simple Horizontal Scroll or Dropdown) */}
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
                                {clients.length === 0 && <Text style={{ color: Colors.slate400, padding: 8 }}>등록된 고객이 없습니다.</Text>}
                            </View>
                        </ScrollView>

                        {selectedClientForShare ? (
                            <TouchableOpacity
                                style={[styles.submitButton, { marginTop: 0, flexDirection: 'row', gap: 8, justifyContent: 'center', backgroundColor: Colors.slate800 }]}
                                onPress={handleSendSMS}
                            >
                                <Icons.Share size={20} color="white" />
                                <Text style={styles.submitButtonText}>{selectedClientForShare.name}님에게 문자 전송</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                style={[styles.submitButton, { marginTop: 0, flexDirection: 'row', gap: 8, justifyContent: 'center' }]}
                                onPress={handleShareImage}
                            >
                                <Icons.Share size={20} color="white" />
                                <Text style={styles.submitButtonText}>이미지 공유하기 (기본)</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </SafeAreaView>
            </Modal >
        );
    };

    const renderDetail = () => {
        if (!selectedProperty) return null;
        const connectedClient = clients.find(c => c.id === selectedProperty.clientId);

        return (
            <PropertyDetail
                property={selectedProperty}
                client={connectedClient}
                onBack={() => setSelectedProperty(null)}
                // Show edit/delete buttons only if not read-only (though readonly prop usage is deperecated for Home, keeping logic for safety)
                onEdit={!isReadOnly ? () => {
                    console.log('Edit pressed');
                    try {
                        const deepCopy = JSON.parse(JSON.stringify(selectedProperty));
                        console.log('Setting newProp to:', deepCopy);
                        setNewProp(deepCopy);
                        setIsAdding(true);
                    } catch (e) {
                        console.error('Error setting edit state:', e);
                    }
                } : undefined}
                onDelete={!isReadOnly ? () => handleDelete(selectedProperty.id) : undefined}
                onShare={(prop) => {
                    if (prop.images && prop.images.length > 0) {
                        setReportImages(prop.images.slice(0, 3));
                        setShowImageSelector(true);
                    } else {
                        setReportImages([]);
                        setShowReportPreview(true);
                    }
                }}
            />
        );
    };

    return (
        <View style={styles.container}>
            {selectedProperty ? renderDetail() : (
                <>
                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <View style={styles.searchInputWrapper}>
                            <Icons.Search size={18} color={Colors.slate400} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder="매물명 또는 주소 검색"
                                value={searchTerm}
                                onChangeText={setSearchTerm}
                                placeholderTextColor={Colors.slate400}
                            />
                        </View>
                        {/* Advanced Search Button */}
                        <TouchableOpacity
                            style={styles.advancedSearchButton}
                            onPress={() => setShowAdvancedSearch(true)}
                        >
                            <Icons.Search size={16} color={Colors.primary} />
                            <Text style={styles.advancedSearchText}>상세검색</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        style={styles.list}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    >
                        {filteredProperties.length === 0 ? (
                            <View style={styles.emptyContainer}>
                                <Icons.Building size={32} color={Colors.slate300} />
                                <Text style={styles.emptyText}>
                                    {searchTerm ? '검색 결과가 없습니다.' : '등록된 매물이 없습니다.'}
                                </Text>
                            </View>
                        ) : (
                            filteredProperties.map(prop => (
                                <TouchableOpacity
                                    key={prop.id}
                                    style={styles.propertyCard}
                                    onPress={() => setSelectedProperty(prop)}
                                    activeOpacity={0.8}
                                >
                                    <View style={styles.propertyImage}>
                                        {/* Management Number Badge */}
                                        {prop.managementId && (
                                            <View style={{
                                                position: 'absolute',
                                                top: 0,
                                                right: 0,
                                                backgroundColor: 'rgba(0,0,0,0.6)',
                                                paddingHorizontal: 8,
                                                paddingVertical: 4,
                                                borderBottomLeftRadius: 8,
                                                zIndex: 10
                                            }}>
                                                <Text style={{ color: 'white', fontSize: 12, fontWeight: 'bold' }}>
                                                    No. {prop.managementId}
                                                </Text>
                                            </View>
                                        )}
                                        {prop.images[0] ? (
                                            <Image source={{ uri: prop.images[0] }} style={styles.thumbnail} />
                                        ) : (
                                            <View style={styles.thumbnailPlaceholder}>
                                                <Icons.Building size={32} color={Colors.slate300} />
                                            </View>
                                        )}
                                        <View style={styles.cardTags}>
                                            <View style={[styles.cardTag, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                                                <Text style={[styles.cardTagText, { color: Colors.primary }]}>{prop.type}</Text>
                                            </View>
                                            <View style={[styles.cardTag, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                                                <Text style={[styles.cardTagText, { color: prop.transactionType === TransactionType.SALE ? Colors.orange : Colors.emerald }]}>
                                                    {prop.transactionType}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={styles.cardContent}>
                                        <View style={styles.cardHeader}>
                                            <Text style={styles.cardTitle} numberOfLines={1}>{prop.title}</Text>
                                            <Text style={styles.cardPrice}>{prop.price}</Text>
                                        </View>
                                        <View style={styles.cardAddressRow}>
                                            <Icons.Location size={12} color={Colors.slate400} />
                                            <Text style={styles.cardAddress} numberOfLines={1}>{prop.address}</Text>
                                        </View>
                                        {prop.description && (
                                            <View style={styles.cardDescBox}>
                                                <Text style={styles.cardDesc} numberOfLines={2}>{prop.description}</Text>
                                            </View>
                                        )}
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                        <View style={{ height: 100 }} />
                    </ScrollView>

                    {/* FAB */}
                    <TouchableOpacity style={styles.fab} onPress={() => setIsAdding(true)}>
                        <Icons.Plus size={24} color={Colors.white} />
                    </TouchableOpacity>
                </>
            )}

            {/* Add Modal */}
            <Modal visible={isAdding} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
                    <KeyboardAvoidingView
                        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                        style={{ flex: 1 }}
                    >
                        <View style={styles.modalContainer}>
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>{newProp.id ? '매물 수정' : '신규 매물 등록'}</Text>
                                <TouchableOpacity onPress={() => setIsAdding(false)}>
                                    <Text style={styles.modalClose}>닫기</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={styles.modalContent}>
                                <Text style={styles.label}>현장 사진/동영상</Text>
                                <View style={styles.mediaButtonRow}>
                                    <TouchableOpacity style={styles.mediaButton} onPress={handlePickFromGallery}>
                                        <Icons.Building size={20} color={Colors.primary} />
                                        <Text style={styles.mediaButtonText}>갤러리</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.mediaButton} onPress={handleTakePhoto}>
                                        <Icons.Camera size={20} color={Colors.emerald} />
                                        <Text style={styles.mediaButtonText}>사진 촬영</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.mediaButton} onPress={handleTakeVideo}>
                                        <Icons.Calendar size={20} color={Colors.orange} />
                                        <Text style={styles.mediaButtonText}>동영상</Text>
                                    </TouchableOpacity>
                                </View>
                                {newProp.images && newProp.images.length > 0 && (
                                    <View style={styles.imagePreviewRow}>
                                        {newProp.images.map((img, idx) => (
                                            <Image key={idx} source={{ uri: img }} style={styles.pickedImage} />
                                        ))}
                                    </View>
                                )}

                                <Text style={styles.label}>물건번호</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="예: 1001"
                                    value={newProp.managementId || ''}
                                    onChangeText={text => setNewProp({ ...newProp, managementId: text })}
                                    placeholderTextColor={Colors.slate400}
                                />

                                <Text style={styles.label}>매물명</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="예: 강남역 도보 5분 오피스텔"
                                    value={newProp.title || ''}
                                    onChangeText={text => setNewProp({ ...newProp, title: text })}
                                    placeholderTextColor={Colors.slate400}
                                />

                                <View style={styles.row}>
                                    <View style={[styles.halfField, { zIndex: 2 }]}>
                                        <Text style={styles.label}>매물 구분</Text>
                                        <TouchableOpacity
                                            style={styles.pickerWrapper}
                                            onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                                        >
                                            <Text style={styles.pickerText}>{newProp.type}</Text>
                                            <Text style={styles.pickerArrow}>{showTypeDropdown ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>
                                        {showTypeDropdown && (
                                            <View style={styles.dropdownList}>
                                                {Object.values(PropertyType).map((type) => (
                                                    <TouchableOpacity
                                                        key={type}
                                                        style={[
                                                            styles.dropdownItem,
                                                            newProp.type === type && styles.dropdownItemActive
                                                        ]}
                                                        onPress={() => {
                                                            setNewProp({ ...newProp, type });
                                                            setShowTypeDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.dropdownItemText,
                                                            newProp.type === type && styles.dropdownItemTextActive
                                                        ]}>{type}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                    <View style={[styles.halfField, { zIndex: 1 }]}>
                                        <Text style={styles.label}>거래 종류</Text>
                                        <TouchableOpacity
                                            style={styles.pickerWrapper}
                                            onPress={() => setShowTransactionDropdown(!showTransactionDropdown)}
                                        >
                                            <Text style={styles.pickerText}>{newProp.transactionType}</Text>
                                            <Text style={styles.pickerArrow}>{showTransactionDropdown ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>
                                        {showTransactionDropdown && (
                                            <View style={styles.dropdownList}>
                                                {Object.values(TransactionType).map((type) => (
                                                    <TouchableOpacity
                                                        key={type}
                                                        style={[
                                                            styles.dropdownItem,
                                                            newProp.transactionType === type && styles.dropdownItemActive
                                                        ]}
                                                        onPress={() => {
                                                            setNewProp({ ...newProp, transactionType: type });
                                                            setShowTransactionDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[
                                                            styles.dropdownItemText,
                                                            newProp.transactionType === type && styles.dropdownItemTextActive
                                                        ]}>{type}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </View>
                                {/* 금액 입력 - 월세일 때는 보증금/임대료 분리 */}
                                {newProp.transactionType === TransactionType.RENT ? (
                                    <>
                                        <Text style={styles.label}>보증금 (천원 단위)</Text>
                                        <View style={styles.priceInputWrapper}>
                                            <TextInput
                                                style={[styles.input, styles.priceInput]}
                                                placeholder="예: 10000 (⇒ 1억)"
                                                value={newProp.deposit?.toString() || ''}
                                                onChangeText={text => {
                                                    const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                                                    const displayDeposit = num >= 100000
                                                        ? `${Math.floor(num / 100000)}억${num % 100000 > 0 ? ` ${Math.floor((num % 100000) / 1000)}천` : ''}`
                                                        : num >= 1000
                                                            ? `${Math.floor(num / 1000)}천만원`
                                                            : `${num}만원`;
                                                    const monthlyDisplay = newProp.monthlyRent
                                                        ? `${newProp.monthlyRent}만원`
                                                        : '';
                                                    setNewProp({
                                                        ...newProp,
                                                        deposit: num,
                                                        priceAmount: num,
                                                        price: `보증금 ${displayDeposit}${monthlyDisplay ? ` / 월세 ${monthlyDisplay}` : ''}`
                                                    });
                                                }}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            <Text style={styles.pricePreview}>
                                                {newProp.deposit
                                                    ? (newProp.deposit >= 100000
                                                        ? `${Math.floor(newProp.deposit / 100000)}억${newProp.deposit % 100000 > 0 ? ` ${Math.floor((newProp.deposit % 100000) / 1000)}천` : ''}`
                                                        : newProp.deposit >= 1000
                                                            ? `${Math.floor(newProp.deposit / 1000)}천만원`
                                                            : `${newProp.deposit}만원`)
                                                    : '보증금'}
                                            </Text>
                                        </View>

                                        <Text style={styles.label}>월 임대료 (만원 단위)</Text>
                                        <View style={styles.priceInputWrapper}>
                                            <TextInput
                                                style={[styles.input, styles.priceInput]}
                                                placeholder="예: 100 (⇒ 100만원)"
                                                value={newProp.monthlyRent?.toString() || ''}
                                                onChangeText={text => {
                                                    const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                                                    const depositDisplay = newProp.deposit
                                                        ? (newProp.deposit >= 100000
                                                            ? `${Math.floor(newProp.deposit / 100000)}억${newProp.deposit % 100000 > 0 ? ` ${Math.floor((newProp.deposit % 100000) / 1000)}천` : ''}`
                                                            : newProp.deposit >= 1000
                                                                ? `${Math.floor(newProp.deposit / 1000)}천만원`
                                                                : `${newProp.deposit}만원`)
                                                        : '';
                                                    setNewProp({
                                                        ...newProp,
                                                        monthlyRent: num,
                                                        price: `보증금 ${depositDisplay || '0'} / 월세 ${num}만원`
                                                    });
                                                }}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            <Text style={styles.pricePreview}>
                                                {newProp.monthlyRent ? `${newProp.monthlyRent}만원` : '월세'}
                                            </Text>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <Text style={styles.label}>금액 (천원 단위)</Text>
                                        <View style={styles.priceInputWrapper}>
                                            <TextInput
                                                style={[styles.input, styles.priceInput]}
                                                placeholder="예: 500000 (⇒ 5억)"
                                                value={newProp.priceAmount?.toString() || ''}
                                                onChangeText={text => {
                                                    const num = parseInt(text.replace(/[^0-9]/g, '')) || 0;
                                                    const displayPrice = num >= 100000
                                                        ? `${Math.floor(num / 100000)}억${num % 100000 > 0 ? ` ${Math.floor((num % 100000) / 1000)}천` : ''}`
                                                        : num >= 1000
                                                            ? `${Math.floor(num / 1000)}천만원`
                                                            : `${num}만원`;
                                                    setNewProp({ ...newProp, priceAmount: num, price: displayPrice });
                                                }}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            <Text style={styles.pricePreview}>
                                                {newProp.price || '금액이 표시됩니다'}
                                            </Text>
                                        </View>
                                    </>
                                )}

                                <Text style={styles.label}>주소</Text>
                                <TextInput
                                    style={styles.input}
                                    placeholder="상세 주소를 입력하세요"
                                    value={newProp.address || ''}
                                    onChangeText={text => setNewProp({ ...newProp, address: text })}
                                    placeholderTextColor={Colors.slate400}
                                />

                                {/* Factory/Warehouse/Building/Commercial Specific Fields */}
                                {(newProp.type === PropertyType.FACTORY_WAREHOUSE ||
                                    newProp.type === PropertyType.BUILDING ||
                                    newProp.type === PropertyType.COMMERCIAL) && (
                                        <>
                                            <Text style={styles.sectionLabel}>공장/창고 상세 정보</Text>

                                            <Text style={styles.label}>대지면적</Text>
                                            <AreaInput
                                                style={styles.input}
                                                valueM2={newProp.landArea}
                                                onChangeM2={(val) => setNewProp({ ...newProp, landArea: val })}
                                            />

                                            <Text style={styles.sectionLabel}>건물 정보</Text>

                                            {/* Dynamic Building List */}
                                            <View style={{ gap: 24, marginBottom: 12, zIndex: 5000, overflow: 'visible' }}>
                                                {newProp.buildings && newProp.buildings.map((building, index) => (
                                                    <View key={building.id} style={{ backgroundColor: Colors.slate50, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: Colors.slate200, zIndex: 4000 - index, overflow: 'visible' }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: Colors.slate800 }}>건물 {index + 1}</Text>
                                                            {newProp.buildings!.length > 1 && (
                                                                <TouchableOpacity onPress={() => {
                                                                    const updated = newProp.buildings!.filter(b => b.id !== building.id);
                                                                    setNewProp({ ...newProp, buildings: updated });
                                                                }}>
                                                                    <Icons.Trash size={18} color={Colors.red} />
                                                                </TouchableOpacity>
                                                            )}
                                                        </View>

                                                        <Text style={styles.label}>건물 명칭 / 층수</Text>
                                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                                            <View style={{ flex: 2 }}>
                                                                <TextInput
                                                                    style={styles.input}
                                                                    value={building.name}
                                                                    onChangeText={(text) => {
                                                                        const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, name: text } : b);
                                                                        setNewProp({ ...newProp, buildings: updated });
                                                                    }}
                                                                    placeholder="예: 가동, 본관"
                                                                    placeholderTextColor={Colors.slate400}
                                                                />
                                                            </View>
                                                            <View style={{ flex: 1 }}>
                                                                <TextInput
                                                                    style={styles.input}
                                                                    value={building.floor ? String(building.floor) : ''}
                                                                    onChangeText={(text) => {
                                                                        const val = parseInt(text) || undefined;
                                                                        const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, floor: val } : b);
                                                                        setNewProp({ ...newProp, buildings: updated });
                                                                    }}
                                                                    placeholder="층수"
                                                                    keyboardType="numeric"
                                                                    placeholderTextColor={Colors.slate400}
                                                                />
                                                            </View>
                                                        </View>

                                                        <Text style={styles.label}>건평</Text>
                                                        <AreaInput
                                                            style={styles.input}
                                                            valueM2={building.area}
                                                            onChangeM2={(val) => {
                                                                const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, area: val || 0 } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }}
                                                        />

                                                        <Text style={styles.label}>연면적</Text>
                                                        <AreaInput
                                                            style={styles.input}
                                                            valueM2={building.totalFloorArea}
                                                            onChangeM2={(val) => {
                                                                const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, totalFloorArea: val || 0 } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }}
                                                        />

                                                        <Text style={styles.label}>건축물 용도</Text>
                                                        <TouchableOpacity
                                                            style={styles.pickerWrapper}
                                                            onPress={() => {
                                                                setShowRegBuildingUseDropdown(building.id);
                                                            }}
                                                        >
                                                            <Text style={styles.pickerText}>{building.use || '선택하세요'}</Text>
                                                            <Text style={styles.pickerArrow}>▼</Text>
                                                        </TouchableOpacity>

                                                        {/* Added Detailed Use Input */}
                                                        <Text style={styles.label}>세부 용도</Text>
                                                        <TextInput
                                                            style={styles.input}
                                                            value={building.specificUse}
                                                            onChangeText={(text) => {
                                                                const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, specificUse: text } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }}
                                                            placeholder="예: 제조업소, 동물병원 등"
                                                            placeholderTextColor={Colors.slate400}
                                                        />

                                                        <Text style={styles.label}>구조 / 층고</Text>
                                                        <TextInput
                                                            style={styles.input}
                                                            value={building.structureHeight}
                                                            onChangeText={(text) => {
                                                                const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, structureHeight: text } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }}
                                                            placeholder="예: 철골조 / 10m"
                                                            placeholderTextColor={Colors.slate400}
                                                        />

                                                        <Text style={styles.label}>사용승인일</Text>
                                                        <TouchableOpacity
                                                            style={styles.pickerWrapper}
                                                            onPress={() => {
                                                                // We need to know which building is triggering the date picker
                                                                setDatePickerTarget(building.id);
                                                                setShowDatePicker(true);
                                                            }}
                                                        >
                                                            <Text style={styles.pickerText}>{building.usageApprovalDate || '날짜 선택'}</Text>
                                                            <Icons.Calendar size={16} color={Colors.slate400} />
                                                        </TouchableOpacity>

                                                        <Text style={styles.label}>비고</Text>
                                                        <TextInput
                                                            style={[styles.input, { height: 80, textAlignVertical: 'top' }]}
                                                            multiline
                                                            value={building.note}
                                                            onChangeText={(text) => {
                                                                const updated = newProp.buildings!.map(b => b.id === building.id ? { ...b, note: text } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }}
                                                            placeholder="비고 입력"
                                                            placeholderTextColor={Colors.slate400}
                                                        />

                                                    </View>
                                                ))}

                                                <TouchableOpacity
                                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, backgroundColor: Colors.slate100, borderRadius: 8, gap: 8 }}
                                                    onPress={() => {
                                                        const newB: BuildingDetail = {
                                                            id: Date.now().toString(),
                                                            name: `건물 ${newProp.buildings!.length + 1}`,
                                                            area: 0,
                                                            totalFloorArea: 0,
                                                            use: '',
                                                            specificUse: '',
                                                            structureHeight: '',
                                                            usageApprovalDate: '',
                                                            note: ''
                                                        };
                                                        setNewProp({ ...newProp, buildings: [...newProp.buildings!, newB] });
                                                    }}
                                                >
                                                    <Icons.Plus size={16} color={Colors.slate600} />
                                                    <Text style={{ fontSize: 14, fontWeight: '600', color: Colors.slate600 }}>건물 추가</Text>
                                                </TouchableOpacity>
                                            </View>






                                            <View style={{ zIndex: 2 }}>
                                                <Text style={styles.label}>용도지역</Text>
                                                <TouchableOpacity
                                                    style={styles.pickerWrapper}
                                                    onPress={() => setShowRegLandUseDropdown(!showRegLandUseDropdown)}
                                                >
                                                    <Text style={styles.pickerText}>{newProp.landUseZone || '선택하세요'}</Text>
                                                    <Text style={styles.pickerArrow}>{showRegLandUseDropdown ? '▲' : '▼'}</Text>
                                                </TouchableOpacity>
                                                {showRegLandUseDropdown && (
                                                    <View style={styles.dropdownList}>
                                                        {LAND_USE_ZONES.map(zone => (
                                                            <TouchableOpacity
                                                                key={zone}
                                                                style={styles.dropdownItem}
                                                                onPress={() => {
                                                                    setNewProp({ ...newProp, landUseZone: zone });
                                                                    setShowRegLandUseDropdown(false);
                                                                }}
                                                            >
                                                                <Text style={styles.dropdownItemText}>{zone}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                )}
                                            </View>

                                            <Text style={styles.label}>도로조건</Text>
                                            <TextInput
                                                style={styles.input}
                                                placeholder="예: 6m 도로 접"
                                                value={newProp.roadCondition || ''}
                                                onChangeText={text => setNewProp({ ...newProp, roadCondition: text })}
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            {showDatePicker && (
                                                <DateTimePicker
                                                    value={
                                                        datePickerTarget === 'property'
                                                            ? (newProp.usageApprovalDate ? new Date(newProp.usageApprovalDate) : new Date())
                                                            : datePickerTarget === 'building'
                                                                ? (newBuilding.usageApprovalDate ? new Date(newBuilding.usageApprovalDate) : new Date())
                                                                : (newProp.buildings?.find(b => b.id === datePickerTarget)?.usageApprovalDate ? new Date(newProp.buildings.find(b => b.id === datePickerTarget)!.usageApprovalDate) : new Date())
                                                    }
                                                    mode="date"
                                                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                                                    onChange={(event, selectedDate) => {
                                                        setShowDatePicker(false);
                                                        if (selectedDate) {
                                                            const dateStr = selectedDate.toISOString().split('T')[0];
                                                            if (datePickerTarget === 'property') {
                                                                setNewProp({ ...newProp, usageApprovalDate: dateStr });
                                                            } else if (datePickerTarget === 'building') {
                                                                setNewBuilding({ ...newBuilding, usageApprovalDate: dateStr });
                                                            } else {
                                                                // Assume datePickerTarget is building ID
                                                                const updated = newProp.buildings!.map(b => b.id === datePickerTarget ? { ...b, usageApprovalDate: dateStr } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }
                                                        }
                                                        // Only clear if cancel logic is needed, but Android cancel usually returns undefined date or type dismissed
                                                        if (event.type === 'dismissed') {
                                                            if (datePickerTarget === 'property') {
                                                                setNewProp({ ...newProp, usageApprovalDate: '' });
                                                            } else if (datePickerTarget === 'building') {
                                                                setNewBuilding({ ...newBuilding, usageApprovalDate: '' });
                                                            } else {
                                                                const updated = newProp.buildings!.map(b => b.id === datePickerTarget ? { ...b, usageApprovalDate: '' } : b);
                                                                setNewProp({ ...newProp, buildings: updated });
                                                            }
                                                        }
                                                    }}
                                                />
                                            )}

                                            <Text style={styles.label}>수도</Text>
                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                                {['상수도', '지하수'].map(opt => (
                                                    <TouchableOpacity
                                                        key={opt}
                                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                                        onPress={() => {
                                                            const current = newProp.water || [];
                                                            const exists = current.includes(opt);
                                                            setNewProp({
                                                                ...newProp,
                                                                water: exists ? current.filter(i => i !== opt) : [...current, opt]
                                                            });
                                                        }}
                                                    >
                                                        <View style={{
                                                            width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: Colors.slate400, marginRight: 8,
                                                            backgroundColor: (newProp.water || []).includes(opt) ? Colors.primary : 'transparent',
                                                            justifyContent: 'center', alignItems: 'center'
                                                        }}>
                                                            {(newProp.water || []).includes(opt) && <Icons.Check size={14} color="white" />}
                                                        </View>
                                                        <Text style={{ fontSize: 14 }}>{opt}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>

                                            <Text style={styles.label}>하수처리</Text>
                                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                                {['직관연결', '정화조'].map(opt => (
                                                    <TouchableOpacity
                                                        key={opt}
                                                        style={{ flexDirection: 'row', alignItems: 'center' }}
                                                        onPress={() => {
                                                            const current = newProp.sewage || [];
                                                            const exists = current.includes(opt);
                                                            setNewProp({
                                                                ...newProp,
                                                                sewage: exists ? current.filter(i => i !== opt) : [...current, opt]
                                                            });
                                                        }}
                                                    >
                                                        <View style={{
                                                            width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: Colors.slate400, marginRight: 8,
                                                            backgroundColor: (newProp.sewage || []).includes(opt) ? Colors.primary : 'transparent',
                                                            justifyContent: 'center', alignItems: 'center'
                                                        }}>
                                                            {(newProp.sewage || []).includes(opt) && <Icons.Check size={14} color="white" />}
                                                        </View>
                                                        <Text style={{ fontSize: 14 }}>{opt}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        </>
                                    )}

                                {/* Land Specific Fields */}
                                {newProp.type === PropertyType.LAND && (
                                    <>
                                        <Text style={styles.sectionLabel}>토지 상세 정보</Text>

                                        <Text style={styles.label}>대지면적 (m²)</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="예: 660.5"
                                            value={newProp.landArea !== undefined ? String(newProp.landArea) : ''}
                                            onChangeText={text => {
                                                const val = parseFloat(text);
                                                setNewProp({ ...newProp, landArea: isNaN(val) ? undefined : val });
                                            }}
                                            keyboardType="decimal-pad"
                                            placeholderTextColor={Colors.slate400}
                                        />

                                        <View style={{ zIndex: 2 }}>
                                            <Text style={styles.label}>용도지역</Text>
                                            <TouchableOpacity
                                                style={styles.pickerWrapper}
                                                onPress={() => setShowRegLandUseDropdown(!showRegLandUseDropdown)}
                                            >
                                                <Text style={styles.pickerText}>{newProp.landUseZone || '선택하세요'}</Text>
                                                <Text style={styles.pickerArrow}>{showRegLandUseDropdown ? '▲' : '▼'}</Text>
                                            </TouchableOpacity>
                                            {showRegLandUseDropdown && (
                                                <View style={styles.dropdownList}>
                                                    {LAND_USE_ZONES.map(zone => (
                                                        <TouchableOpacity
                                                            key={zone}
                                                            style={styles.dropdownItem}
                                                            onPress={() => {
                                                                setNewProp({ ...newProp, landUseZone: zone });
                                                                setShowRegLandUseDropdown(false);
                                                            }}
                                                        >
                                                            <Text style={styles.dropdownItemText}>{zone}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                        <View style={{ zIndex: 1 }}>
                                            <Text style={styles.label}>지목</Text>
                                            <TouchableOpacity
                                                style={styles.pickerWrapper}
                                                onPress={() => setShowRegLandCategoryDropdown(!showRegLandCategoryDropdown)}
                                            >
                                                <Text style={styles.pickerText}>{newProp.landCategory || '선택하세요'}</Text>
                                                <Text style={styles.pickerArrow}>{showRegLandCategoryDropdown ? '▲' : '▼'}</Text>
                                            </TouchableOpacity>
                                            {showRegLandCategoryDropdown && (
                                                <View style={styles.dropdownList}>
                                                    {LAND_CATEGORIES.map(cat => (
                                                        <TouchableOpacity
                                                            key={cat}
                                                            style={styles.dropdownItem}
                                                            onPress={() => {
                                                                setNewProp({ ...newProp, landCategory: cat });
                                                                setShowRegLandCategoryDropdown(false);
                                                            }}
                                                        >
                                                            <Text style={styles.dropdownItemText}>{cat}</Text>
                                                        </TouchableOpacity>
                                                    ))}
                                                </View>
                                            )}
                                        </View>

                                        <Text style={styles.label}>도로조건</Text>
                                        <TextInput
                                            style={styles.input}
                                            placeholder="예: 4m 포장도로 접"
                                            value={newProp.roadCondition || ''}
                                            onChangeText={text => setNewProp({ ...newProp, roadCondition: text })}
                                            placeholderTextColor={Colors.slate400}
                                        />

                                        <Text style={styles.label}>하수처리</Text>
                                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                                            {['직관연결', '정화조'].map(opt => (
                                                <TouchableOpacity
                                                    key={opt}
                                                    style={{ flexDirection: 'row', alignItems: 'center' }}
                                                    onPress={() => {
                                                        const current = newProp.sewage || [];
                                                        const exists = current.includes(opt);
                                                        setNewProp({
                                                            ...newProp,
                                                            sewage: exists ? current.filter(i => i !== opt) : [...current, opt]
                                                        });
                                                    }}
                                                >
                                                    <View style={{
                                                        width: 20, height: 20, borderRadius: 4, borderWidth: 1, borderColor: Colors.slate400, marginRight: 8,
                                                        backgroundColor: (newProp.sewage || []).includes(opt) ? Colors.primary : 'transparent',
                                                        justifyContent: 'center', alignItems: 'center'
                                                    }}>
                                                        {(newProp.sewage || []).includes(opt) && <Icons.Check size={14} color="white" />}
                                                    </View>
                                                    <Text style={{ fontSize: 14 }}>{opt}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}

                                <Text style={styles.label}>설명</Text>
                                <TouchableOpacity
                                    style={styles.aiButton}
                                    onPress={handleGenerateAI}
                                    disabled={isGeneratingAI}
                                >
                                    {isGeneratingAI ? (
                                        <ActivityIndicator size="small" color={Colors.white} />
                                    ) : (
                                        <>
                                            <Icons.Search size={16} color={Colors.white} />
                                            <Text style={styles.aiButtonText}>
                                                AI 문구 생성
                                            </Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                                <TextInput
                                    style={[styles.input, styles.textarea]}
                                    placeholder="상세 설명을 입력하세요"
                                    value={newProp.description || ''}
                                    onChangeText={text => setNewProp({ ...newProp, description: text })}
                                    multiline
                                    numberOfLines={6}
                                    textAlignVertical="top"
                                    placeholderTextColor={Colors.slate400}
                                />

                                <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
                                    <Text style={styles.submitButtonText}>매물 등록하기</Text>
                                </TouchableOpacity>

                                <View style={{ height: 40 }} />
                            </ScrollView>
                        </View>
                    </KeyboardAvoidingView>
                </SafeAreaView>
            </Modal>

            {/* Advanced Search Modal */}
            <Modal visible={showAdvancedSearch} animationType="slide" presentationStyle="pageSheet">
                <SafeAreaView style={{ flex: 1, backgroundColor: Colors.white }}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>상세 검색</Text>
                            <TouchableOpacity onPress={() => {
                                setAdvancedFilters(resetFilters(PropertyType.HOUSE));
                                setShowAdvancedSearch(false);
                            }}>
                                <Text style={styles.modalClose}>닫기</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={styles.modalContent}>
                            {/* 매물 구분 */}
                            <Text style={styles.label}>매물 구분</Text>
                            <View style={styles.filterWrap}>
                                {Object.values(PropertyType).map(type => (
                                    <TouchableOpacity
                                        key={type}
                                        style={[styles.filterChip, advancedFilters.type === type && styles.filterChipActive]}
                                        onPress={() => setAdvancedFilters(resetFilters(type))}
                                    >
                                        <Text style={[styles.filterChipText, advancedFilters.type === type && styles.filterChipTextActive]}>{type}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* ===== 주택 필터 ===== */}
                            {advancedFilters.type === PropertyType.HOUSE && (
                                <>
                                    <Text style={styles.label}>거래 종류</Text>
                                    <View style={styles.row}>
                                        <TouchableOpacity
                                            style={[styles.filterChip, advancedFilters.transactionType === 'ALL' && styles.filterChipActive]}
                                            onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: 'ALL' })}
                                        >
                                            <Text style={[styles.filterChipText, advancedFilters.transactionType === 'ALL' && styles.filterChipTextActive]}>전체</Text>
                                        </TouchableOpacity>
                                        {Object.values(TransactionType).map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.filterChip, advancedFilters.transactionType === type && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: type })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.transactionType === type && styles.filterChipTextActive]}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>아파트 단지</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="예: 래미안, 자이"
                                        value={advancedFilters.apartmentName}
                                        onChangeText={text => setAdvancedFilters({ ...advancedFilters, apartmentName: text })}
                                        placeholderTextColor={Colors.slate400}
                                    />

                                    <Text style={styles.label}>가격 (천원)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>

                                    <Text style={styles.label}>면적 (m²)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>

                                    <Text style={styles.label}>최소 방 개수</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="예: 2"
                                        value={advancedFilters.minRooms}
                                        onChangeText={text => setAdvancedFilters({ ...advancedFilters, minRooms: text.replace(/[^0-9]/g, '') })}
                                        keyboardType="numeric"
                                        placeholderTextColor={Colors.slate400}
                                    />

                                    <Text style={styles.label}>주차 가능</Text>
                                    <View style={styles.row}>
                                        {(['ALL', 'YES', 'NO'] as const).map(option => (
                                            <TouchableOpacity
                                                key={option}
                                                style={[styles.filterChip, advancedFilters.parking === option && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, parking: option })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.parking === option && styles.filterChipTextActive]}>
                                                    {option === 'ALL' ? '전체' : option === 'YES' ? '가능' : '불가'}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}

                            {/* ===== 토지 필터 ===== */}
                            {advancedFilters.type === PropertyType.LAND && (
                                <>
                                    <Text style={styles.label}>거래 종류</Text>
                                    <View style={styles.row}>
                                        <TouchableOpacity
                                            style={[styles.filterChip, advancedFilters.transactionType === 'ALL' && styles.filterChipActive]}
                                            onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: 'ALL' })}
                                        >
                                            <Text style={[styles.filterChipText, advancedFilters.transactionType === 'ALL' && styles.filterChipTextActive]}>전체</Text>
                                        </TouchableOpacity>
                                        {/* 토지는 전세 제외 */}
                                        {Object.values(TransactionType).filter(t => t !== TransactionType.JEONSE).map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.filterChip, advancedFilters.transactionType === type && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: type })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.transactionType === type && styles.filterChipTextActive]}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>지번</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="예: 123-45"
                                        value={advancedFilters.lotNumber}
                                        onChangeText={text => setAdvancedFilters({ ...advancedFilters, lotNumber: text })}
                                        placeholderTextColor={Colors.slate400}
                                    />

                                    <Text style={styles.label}>면적 (m²)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>

                                    <View style={{ zIndex: 2 }}>
                                        <Text style={styles.label}>용도지역</Text>
                                        <TouchableOpacity
                                            style={styles.pickerWrapper}
                                            onPress={() => {
                                                setShowLandUseDropdown(!showLandUseDropdown);
                                                setShowLandCategoryDropdown(false);
                                            }}
                                        >
                                            <Text style={styles.pickerText}>{advancedFilters.landUseZone || '전체'}</Text>
                                            <Text style={styles.pickerArrow}>{showLandUseDropdown ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>
                                        {showLandUseDropdown && (
                                            <View style={styles.dropdownList}>
                                                <TouchableOpacity
                                                    style={[styles.dropdownItem, !advancedFilters.landUseZone && styles.dropdownItemActive]}
                                                    onPress={() => {
                                                        setAdvancedFilters({ ...advancedFilters, landUseZone: '' });
                                                        setShowLandUseDropdown(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, !advancedFilters.landUseZone && styles.dropdownItemTextActive]}>전체</Text>
                                                </TouchableOpacity>
                                                {LAND_USE_ZONES.map(zone => (
                                                    <TouchableOpacity
                                                        key={zone}
                                                        style={[styles.dropdownItem, advancedFilters.landUseZone === zone && styles.dropdownItemActive]}
                                                        onPress={() => {
                                                            setAdvancedFilters({ ...advancedFilters, landUseZone: zone });
                                                            setShowLandUseDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownItemText, advancedFilters.landUseZone === zone && styles.dropdownItemTextActive]}>{zone}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <View style={{ zIndex: 1 }}>
                                        <Text style={styles.label}>지목</Text>
                                        <TouchableOpacity
                                            style={styles.pickerWrapper}
                                            onPress={() => {
                                                setShowLandCategoryDropdown(!showLandCategoryDropdown);
                                                setShowLandUseDropdown(false);
                                            }}
                                        >
                                            <Text style={styles.pickerText}>{advancedFilters.landCategory || '전체'}</Text>
                                            <Text style={styles.pickerArrow}>{showLandCategoryDropdown ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>
                                        {showLandCategoryDropdown && (
                                            <View style={styles.dropdownList}>
                                                <TouchableOpacity
                                                    style={[styles.dropdownItem, !advancedFilters.landCategory && styles.dropdownItemActive]}
                                                    onPress={() => {
                                                        setAdvancedFilters({ ...advancedFilters, landCategory: '' });
                                                        setShowLandCategoryDropdown(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, !advancedFilters.landCategory && styles.dropdownItemTextActive]}>전체</Text>
                                                </TouchableOpacity>
                                                {LAND_CATEGORIES.map(cat => (
                                                    <TouchableOpacity
                                                        key={cat}
                                                        style={[styles.dropdownItem, advancedFilters.landCategory === cat && styles.dropdownItemActive]}
                                                        onPress={() => {
                                                            setAdvancedFilters({ ...advancedFilters, landCategory: cat });
                                                            setShowLandCategoryDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownItemText, advancedFilters.landCategory === cat && styles.dropdownItemTextActive]}>{cat}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                </>
                            )}

                            {/* ===== 공장/창고 필터 ===== */}
                            {advancedFilters.type === PropertyType.FACTORY_WAREHOUSE && (
                                <>
                                    <Text style={styles.label}>거래 종류</Text>
                                    <View style={styles.row}>
                                        <TouchableOpacity
                                            style={[styles.filterChip, advancedFilters.transactionType === 'ALL' && styles.filterChipActive]}
                                            onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: 'ALL' })}
                                        >
                                            <Text style={[styles.filterChipText, advancedFilters.transactionType === 'ALL' && styles.filterChipTextActive]}>전체</Text>
                                        </TouchableOpacity>
                                        {/* 공장/창고는 전세 제외 */}
                                        {Object.values(TransactionType).filter(t => t !== TransactionType.JEONSE).map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.filterChip, advancedFilters.transactionType === type && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: type })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.transactionType === type && styles.filterChipTextActive]}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>주소</Text>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="주소 검색"
                                        value={advancedFilters.lotNumber}
                                        onChangeText={text => setAdvancedFilters({ ...advancedFilters, lotNumber: text })}
                                        placeholderTextColor={Colors.slate400}
                                    />

                                    <View style={{ zIndex: 1 }}>
                                        <Text style={styles.label}>건축물 용도</Text>
                                        <TouchableOpacity
                                            style={styles.pickerWrapper}
                                            onPress={() => setShowBuildingUseDropdown(!showBuildingUseDropdown)}
                                        >
                                            <Text style={styles.pickerText}>{advancedFilters.buildingUse || '전체'}</Text>
                                            <Text style={styles.pickerArrow}>{showBuildingUseDropdown ? '▲' : '▼'}</Text>
                                        </TouchableOpacity>
                                        {showBuildingUseDropdown && (
                                            <View style={styles.dropdownList}>
                                                <TouchableOpacity
                                                    style={[styles.dropdownItem, !advancedFilters.buildingUse && styles.dropdownItemActive]}
                                                    onPress={() => {
                                                        setAdvancedFilters({ ...advancedFilters, buildingUse: '' });
                                                        setShowBuildingUseDropdown(false);
                                                    }}
                                                >
                                                    <Text style={[styles.dropdownItemText, !advancedFilters.buildingUse && styles.dropdownItemTextActive]}>전체</Text>
                                                </TouchableOpacity>
                                                {BUILDING_USES.map(use => (
                                                    <TouchableOpacity
                                                        key={use}
                                                        style={[styles.dropdownItem, advancedFilters.buildingUse === use && styles.dropdownItemActive]}
                                                        onPress={() => {
                                                            setAdvancedFilters({ ...advancedFilters, buildingUse: use });
                                                            setShowBuildingUseDropdown(false);
                                                        }}
                                                    >
                                                        <Text style={[styles.dropdownItemText, advancedFilters.buildingUse === use && styles.dropdownItemTextActive]}>{use}</Text>
                                                    </TouchableOpacity>
                                                ))}
                                            </View>
                                        )}
                                    </View>

                                    <Text style={styles.label}>면적 (평)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minAreaPyeong}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minAreaPyeong: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxAreaPyeong}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxAreaPyeong: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>

                                    <Text style={styles.label}>가격 (천원)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>
                                </>
                            )}

                            {/* ===== 상가 필터 ===== */}
                            {advancedFilters.type === PropertyType.COMMERCIAL && (
                                <>
                                    <Text style={styles.label}>거래 종류</Text>
                                    <View style={styles.row}>
                                        <TouchableOpacity
                                            style={[styles.filterChip, advancedFilters.transactionType === 'ALL' && styles.filterChipActive]}
                                            onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: 'ALL' })}
                                        >
                                            <Text style={[styles.filterChipText, advancedFilters.transactionType === 'ALL' && styles.filterChipTextActive]}>전체</Text>
                                        </TouchableOpacity>
                                        {/* 상가는 전세 제외 */}
                                        {Object.values(TransactionType).filter(t => t !== TransactionType.JEONSE).map(type => (
                                            <TouchableOpacity
                                                key={type}
                                                style={[styles.filterChip, advancedFilters.transactionType === type && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: type })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.transactionType === type && styles.filterChipTextActive]}>{type}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>

                                    <Text style={styles.label}>가격 (천원)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxPrice}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxPrice: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>

                                    <Text style={styles.label}>면적 (m²)</Text>
                                    <View style={styles.row}>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최소"
                                            value={advancedFilters.minArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, minArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                        <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                        <TextInput
                                            style={[styles.input, { flex: 1 }]}
                                            placeholder="최대"
                                            value={advancedFilters.maxArea}
                                            onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxArea: text.replace(/[^0-9]/g, '') })}
                                            keyboardType="numeric"
                                            placeholderTextColor={Colors.slate400}
                                        />
                                    </View>
                                </>
                            )}

                            {/* ===== 건물/기타 필터 (공통) ===== */}
                            {(advancedFilters.type === PropertyType.BUILDING ||
                                advancedFilters.type === PropertyType.OTHERS) && (
                                    <>
                                        <Text style={styles.label}>거래 종류</Text>
                                        <View style={styles.row}>
                                            <TouchableOpacity
                                                style={[styles.filterChip, advancedFilters.transactionType === 'ALL' && styles.filterChipActive]}
                                                onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: 'ALL' })}
                                            >
                                                <Text style={[styles.filterChipText, advancedFilters.transactionType === 'ALL' && styles.filterChipTextActive]}>전체</Text>
                                            </TouchableOpacity>
                                            {Object.values(TransactionType).map(type => (
                                                <TouchableOpacity
                                                    key={type}
                                                    style={[styles.filterChip, advancedFilters.transactionType === type && styles.filterChipActive]}
                                                    onPress={() => setAdvancedFilters({ ...advancedFilters, transactionType: type })}
                                                >
                                                    <Text style={[styles.filterChipText, advancedFilters.transactionType === type && styles.filterChipTextActive]}>{type}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={styles.label}>가격 (천원)</Text>
                                        <View style={styles.row}>
                                            <TextInput
                                                style={[styles.input, { flex: 1 }]}
                                                placeholder="최소"
                                                value={advancedFilters.minPrice}
                                                onChangeText={text => setAdvancedFilters({ ...advancedFilters, minPrice: text.replace(/[^0-9]/g, '') })}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                            <TextInput
                                                style={[styles.input, { flex: 1 }]}
                                                placeholder="최대"
                                                value={advancedFilters.maxPrice}
                                                onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxPrice: text.replace(/[^0-9]/g, '') })}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                        </View>

                                        <Text style={styles.label}>면적 (m²)</Text>
                                        <View style={styles.row}>
                                            <TextInput
                                                style={[styles.input, { flex: 1 }]}
                                                placeholder="최소"
                                                value={advancedFilters.minArea}
                                                onChangeText={text => setAdvancedFilters({ ...advancedFilters, minArea: text.replace(/[^0-9]/g, '') })}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                            <Text style={{ marginHorizontal: 8, color: Colors.slate400 }}>~</Text>
                                            <TextInput
                                                style={[styles.input, { flex: 1 }]}
                                                placeholder="최대"
                                                value={advancedFilters.maxArea}
                                                onChangeText={text => setAdvancedFilters({ ...advancedFilters, maxArea: text.replace(/[^0-9]/g, '') })}
                                                keyboardType="numeric"
                                                placeholderTextColor={Colors.slate400}
                                            />
                                        </View>
                                    </>
                                )}

                            {/* 버튼들 */}
                            <View style={[styles.row, { marginTop: 24 }]}>
                                <TouchableOpacity
                                    style={[styles.submitButton, { flex: 1, backgroundColor: Colors.slate200 }]}
                                    onPress={() => setAdvancedFilters(resetFilters(advancedFilters.type))}
                                >
                                    <Text style={[styles.submitButtonText, { color: Colors.slate600 }]}>초기화</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.submitButton, { flex: 2, marginLeft: 12 }]}
                                    onPress={() => {
                                        const af = advancedFilters;
                                        if (af.minPrice && af.maxPrice && parseInt(af.minPrice) > parseInt(af.maxPrice)) {
                                            Alert.alert('알림', '가격 범위가 올바르지 않습니다.');
                                            return;
                                        }
                                        if (af.minArea && af.maxArea && parseInt(af.minArea) > parseInt(af.maxArea)) {
                                            Alert.alert('알림', '면적 범위가 올바르지 않습니다.');
                                            return;
                                        }
                                        // 검색 실행 - 모달은 열린 상태로 유지하되 결과 표시
                                    }}
                                >
                                    <Text style={styles.submitButtonText}>검색하기</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </SafeAreaView>
            </Modal>

            {/* Report Preview Modal */}
            {/* Building Use Selection Modal */}
            <Modal
                visible={!!showRegBuildingUseDropdown && showRegBuildingUseDropdown !== false}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowRegBuildingUseDropdown(false)}
            >
                <TouchableOpacity
                    style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}
                    activeOpacity={1}
                    onPress={() => setShowRegBuildingUseDropdown(false)}
                >
                    <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '50%' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 16, textAlign: 'center', color: Colors.slate800 }}>건축물 용도 선택</Text>
                        <ScrollView style={{ marginBottom: 20 }}>
                            {BUILDING_USES.map(use => (
                                <TouchableOpacity
                                    key={use}
                                    style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 }}
                                    onPress={() => {
                                        if (typeof showRegBuildingUseDropdown === 'string') {
                                            const buildingId = showRegBuildingUseDropdown;
                                            const updated = newProp.buildings!.map(b => b.id === buildingId ? { ...b, use } : b);
                                            setNewProp({ ...newProp, buildings: updated });
                                            setShowRegBuildingUseDropdown(false);
                                        }
                                    }}
                                >
                                    <Text style={{ fontSize: 16, color: Colors.slate800, textAlign: 'center' }}>{use}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                        <TouchableOpacity
                            style={{ padding: 16, backgroundColor: Colors.slate100, borderRadius: 12, alignItems: 'center' }}
                            onPress={() => setShowRegBuildingUseDropdown(false)}
                        >
                            <Text style={{ color: Colors.slate600, fontWeight: 'bold' }}>닫기</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>

            {renderReportPreview()}
        </View >
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.slate50 },
    searchContainer: { padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate200 },
    searchInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.slate50, borderRadius: 12, paddingHorizontal: 12, gap: 8 },
    searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: Colors.slate800 },
    // Filter
    filterRow: { flexDirection: 'row', marginTop: 12, paddingBottom: 4 },
    filterChip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: Colors.slate100, borderRadius: 20, marginRight: 8 },
    filterChipActive: { backgroundColor: Colors.primary },
    filterChipText: { fontSize: 13, color: Colors.slate600, fontWeight: '500' },
    filterChipTextActive: { color: Colors.white },
    filterWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
    // Advanced Search Button
    advancedSearchButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-end', padding: 8, gap: 4, marginTop: 8 },
    advancedSearchText: { fontSize: 13, color: Colors.primary, fontWeight: '600' },
    // Price Input
    priceInputWrapper: { gap: 2 },
    priceInput: { flex: 1 },
    pricePreview: { fontSize: 14, color: Colors.primary, fontWeight: '600', paddingLeft: 4 },
    list: { flex: 1, padding: 16 },
    fab: { position: 'absolute', bottom: 90, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
    emptyContainer: { alignItems: 'center', paddingVertical: 60 },
    emptyText: { marginTop: 8, color: Colors.slate400, fontSize: 14 },
    propertyCard: { backgroundColor: Colors.white, borderRadius: 16, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: Colors.slate100 },
    propertyImage: { height: 160, backgroundColor: Colors.slate100, position: 'relative' },
    thumbnail: { width: '100%', height: '100%' },
    thumbnailPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    cardTags: { position: 'absolute', top: 12, left: 12, flexDirection: 'row', gap: 4 },
    cardTag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    cardTagText: { fontSize: 10, fontWeight: 'bold' },
    cardContent: { padding: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    cardTitle: { flex: 1, fontSize: 16, fontWeight: 'bold', color: Colors.slate800, marginRight: 8 },
    cardPrice: { fontSize: 16, fontWeight: 'bold', color: Colors.primary },
    cardAddressRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
    cardAddress: { fontSize: 12, color: Colors.slate500, flex: 1 },
    cardDescBox: { backgroundColor: Colors.slate50, padding: 8, borderRadius: 8 },
    cardDesc: { fontSize: 12, color: Colors.slate600, lineHeight: 18 },
    // Detail
    detailHeader: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.white, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    backButton: { padding: 4, marginRight: 8 },
    detailTitle: { flex: 1, fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    imageContainer: { height: 256, backgroundColor: Colors.slate100 },
    detailImage: { width: '100%', height: '100%' },
    imagePlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    detailContent: { padding: 16 },
    tagRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
    tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    tagText: { fontSize: 10, fontWeight: 'bold' },
    priceText: { fontSize: 24, fontWeight: 'bold', color: Colors.slate900, marginBottom: 4 },
    addressRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    addressText: { fontSize: 14, color: Colors.slate500 },
    divider: { height: 1, backgroundColor: Colors.slate100, marginVertical: 16 },
    sectionLabel: { fontWeight: 'bold', color: Colors.slate800, marginBottom: 8, marginTop: 8 },
    descriptionBox: { backgroundColor: Colors.slate50, padding: 16, borderRadius: 16 },
    descriptionText: { fontSize: 14, color: Colors.slate700, lineHeight: 22 },
    clientCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: Colors.slate100, gap: 12 },
    clientIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.slate50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Colors.primaryLight },
    clientInfo: { flex: 1 },
    clientName: { fontWeight: 'bold', color: Colors.slate800 },
    clientRole: { fontSize: 12, color: Colors.slate500 },
    metaText: { fontSize: 10, color: Colors.slate300, textAlign: 'center', marginTop: 24 },
    // Modal
    modalContainer: { flex: 1, backgroundColor: Colors.white },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    modalTitle: { fontSize: 18, fontWeight: 'bold', color: Colors.slate800 },
    modalClose: { color: Colors.slate400, fontSize: 14 },
    modalContent: { padding: 16 },
    label: { fontSize: 12, fontWeight: '600', color: Colors.slate500, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
    input: { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: Colors.slate800, backgroundColor: Colors.white },
    textarea: { height: 100 },
    row: { flexDirection: 'row', gap: 12 },
    halfField: { flex: 1 },
    pickerWrapper: { borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    pickerText: { fontSize: 14, color: Colors.slate800 },
    pickerArrow: { fontSize: 12, color: Colors.slate400 },
    // Dropdown
    dropdownList: { position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, marginTop: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 5 },
    dropdownItem: { paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    dropdownItemActive: { backgroundColor: Colors.primaryLight },
    dropdownItemText: { fontSize: 14, color: Colors.slate700 },
    dropdownItemTextActive: { color: Colors.primary, fontWeight: '600' },
    // Media Buttons
    mediaButtonRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
    mediaButton: { flex: 1, backgroundColor: Colors.white, borderWidth: 1, borderColor: Colors.slate200, borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', gap: 6 },
    mediaButtonText: { fontSize: 11, color: Colors.slate600, fontWeight: '500' },
    imagePreviewRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 12 },
    imagePickerRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    imagePicker: { width: 72, height: 72, backgroundColor: Colors.slate100, borderRadius: 8, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: Colors.slate200 },
    imagePickerText: { fontSize: 10, color: Colors.slate400, marginTop: 4 },
    pickedImage: { width: 64, height: 64, borderRadius: 8 },
    // AI Button
    aiButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.emerald, padding: 12, borderRadius: 10, marginBottom: 8, gap: 6 },
    aiButtonDisabled: { backgroundColor: Colors.slate200 },
    aiButtonText: { color: Colors.white, fontWeight: '600', fontSize: 13 },
    aiButtonTextDisabled: { color: Colors.slate400 },
    submitButton: { backgroundColor: Colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 24 },
    submitButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
    reportButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.slate800, padding: 16, borderRadius: 12, marginTop: 24, gap: 8, marginBottom: 40 },
    reportButtonText: { color: Colors.white, fontWeight: 'bold', fontSize: 16 },
    value: { fontSize: 16, marginBottom: 10, color: Colors.slate800 },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.slate100 },
    detailLabel: { fontSize: 14, color: Colors.slate500 },
    detailValue: { fontSize: 14, color: Colors.slate800, fontWeight: '500' },
    buildingItem: { flexDirection: 'row', backgroundColor: Colors.white, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: Colors.slate200, alignItems: 'center' },
});
