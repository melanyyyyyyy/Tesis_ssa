import { useState } from 'react';

interface Notification {
    severity: 'error' | 'success' | 'info',
    message: string,
}

interface StackbarProps {
    notifications: Notification[],
    cosa: number 
}

export function useManageNotifications () {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const addNotifications = (notification: Notification) => {
        setNotifications(prev => [...prev, notification]);
    }

    const clearNotifications = () => {
        setNotifications([]);
    }

    return {notifications, addNotifications, clearNotifications};
}


const Stackbar: React.FC<StackbarProps> = () => {

    return (
        <>
        </>
    )
}

export default Stackbar;