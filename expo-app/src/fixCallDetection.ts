import { Platform } from 'react-native';
import BatchedBridge from 'react-native/Libraries/BatchedBridge/BatchedBridge';

// @ts-ignore
import CallStateUpdateActionModule from 'react-native-call-detection/CallStateUpdateActionModule';

export const registerCallDetectionModule = () => {
    if (Platform.OS === 'android') {
        console.log('!!! Manually registering CallStateUpdateActionModule !!!');
        BatchedBridge.registerCallableModule('CallStateUpdateActionModule', CallStateUpdateActionModule);
    }
};
