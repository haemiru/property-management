import { Ionicons, MaterialIcons, Feather } from '@expo/vector-icons';

export const Icons = {
    Home: (props: { size?: number; color?: string }) => (
        <Ionicons name="home" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Building: (props: { size?: number; color?: string }) => (
        <MaterialIcons name="apartment" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Users: (props: { size?: number; color?: string }) => (
        <Ionicons name="people" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Calendar: (props: { size?: number; color?: string }) => (
        <Ionicons name="calendar" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Camera: (props: { size?: number; color?: string }) => (
        <Ionicons name="camera" size={props.size || 20} color={props.color || 'currentColor'} />
    ),
    Plus: (props: { size?: number; color?: string }) => (
        <Ionicons name="add" size={props.size || 20} color={props.color || 'currentColor'} />
    ),
    Trash: (props: { size?: number; color?: string }) => (
        <Ionicons name="trash-outline" size={props.size || 18} color={props.color || 'currentColor'} />
    ),
    Edit: (props: { size?: number; color?: string }) => (
        <Feather name="edit-2" size={props.size || 18} color={props.color || 'currentColor'} />
    ),
    Search: (props: { size?: number; color?: string }) => (
        <Ionicons name="search" size={props.size || 18} color={props.color || 'currentColor'} />
    ),
    ChevronLeft: (props: { size?: number; color?: string }) => (
        <Ionicons name="chevron-back" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Phone: (props: { size?: number; color?: string }) => (
        <Ionicons name="call" size={props.size || 20} color={props.color || 'currentColor'} />
    ),
    Location: (props: { size?: number; color?: string }) => (
        <Ionicons name="location-outline" size={props.size || 16} color={props.color || 'currentColor'} />
    ),
    Share: (props: { size?: number; color?: string }) => (
        <Ionicons name="share-outline" size={props.size || 20} color={props.color || 'currentColor'} />
    ),
    Check: (props: { size?: number; color?: string }) => (
        <Ionicons name="checkmark" size={props.size || 20} color={props.color || 'currentColor'} />
    ),
    X: (props: { size?: number; color?: string }) => (
        <Ionicons name="close" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
    Image: (props: { size?: number; color?: string }) => (
        <Ionicons name="image" size={props.size || 24} color={props.color || 'currentColor'} />
    ),
};

export const Colors = {
    primary: '#4f46e5',
    primaryLight: '#e0e7ff',
    emerald: '#10b981',
    emeraldLight: '#d1fae5',
    amber: '#f59e0b',
    amberLight: '#fef3c7',
    orange: '#f97316',
    orangeLight: '#ffedd5',
    red: '#ef4444',
    redLight: '#fee2e2',
    blue: '#3b82f6',
    blueLight: '#dbeafe',
    purple: '#8b5cf6',
    purpleLight: '#ede9fe',
    slate50: '#f8fafc',
    slate100: '#f1f5f9',
    slate200: '#e2e8f0',
    slate300: '#cbd5e1',
    slate400: '#94a3b8',
    slate500: '#64748b',
    slate600: '#475569',
    slate700: '#334155',
    slate800: '#1e293b',
    slate900: '#0f172a',
    white: '#ffffff',
};
