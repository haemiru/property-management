import AsyncStorage from '@react-native-async-storage/async-storage';
import { Property, Client, ScheduleTask, BrokerInfo } from './types';

const KEYS = {
    PROPERTIES: 'realtor_properties',
    CLIENTS: 'realtor_clients',
    TASKS: 'realtor_tasks',
    BROKER_INFO: 'realtor_broker_info',
};

export const storage = {
    async getProperties(): Promise<Property[]> {
        try {
            const data = await AsyncStorage.getItem(KEYS.PROPERTIES);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    async setProperties(properties: Property[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.PROPERTIES, JSON.stringify(properties));
    },

    async getClients(): Promise<Client[]> {
        try {
            const data = await AsyncStorage.getItem(KEYS.CLIENTS);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    async setClients(clients: Client[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.CLIENTS, JSON.stringify(clients));
    },

    async getTasks(): Promise<ScheduleTask[]> {
        try {
            const data = await AsyncStorage.getItem(KEYS.TASKS);
            return data ? JSON.parse(data) : [];
        } catch {
            return [];
        }
    },

    async setTasks(tasks: ScheduleTask[]): Promise<void> {
        await AsyncStorage.setItem(KEYS.TASKS, JSON.stringify(tasks));
    },

    async getBrokerInfo(): Promise<BrokerInfo | null> {
        try {
            const data = await AsyncStorage.getItem(KEYS.BROKER_INFO);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setBrokerInfo(info: BrokerInfo): Promise<void> {
        await AsyncStorage.setItem(KEYS.BROKER_INFO, JSON.stringify(info));
    },
};
