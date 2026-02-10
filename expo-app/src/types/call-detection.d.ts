declare module 'react-native-call-detection' {
    export default class CallDetectorManager {
        constructor(
            callback: (event: string, phoneNumber: string) => void,
            readPhoneNumber: boolean,
            permissionDeniedCallback: () => void,
            permissionOptions: {
                title: string;
                message: string;
            }
        );
        dispose(): void;
    }
}
