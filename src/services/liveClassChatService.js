const CHAT_EVENTS = [
    'live-chat-message',
    'live-class-chat-message',
    'chat-message',
    'chat-media',
    'chat-voice',
];

const getText = (payload) => {
    if (typeof payload?.text === 'string') return payload.text;
    if (typeof payload?.message?.text === 'string') return payload.message.text;
    if (typeof payload?.message === 'string') return payload.message;
    if (typeof payload?.body === 'string') return payload.body;
    return '';
};

export const buildLiveClassChatMessage = ({ roomId, text, senderId, senderName, role, replyTo }) => ({
    id: `${senderId || 'user'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    text: text.trim(),
    senderId: senderId || '',
    senderName: senderName || 'User',
    role: role || 'participant',
    createdAt: Date.now(),
    replyTo: replyTo || null,
});

export const buildLiveClassFileMessage = ({ roomId, file, senderId, senderName, role, replyTo }) => ({
    id: `${senderId || 'user'}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomId,
    text: file.name || 'Attachment',
    senderId: senderId || '',
    senderName: senderName || 'User',
    role: role || 'participant',
    createdAt: Date.now(),
    replyTo: replyTo || null,
    attachment: {
        name: file.name || 'Attachment',
        type: file.type || 'application/octet-stream',
        size: file.size || 0,
        dataUrl: file.dataUrl || null,
        url: file.url || null,
    },
});

export const emitLiveClassChatMessage = (socket, message) => {
    if (!socket || (!message?.text && !message?.attachment)) return false;
    socket.emit('live-chat-message', {
        ...message,
        message,
        body: message.text,
    });
    return true;
};

export const subscribeLiveClassChat = (socket, roomId, onMessage) => {
    if (!socket || !roomId || !onMessage) return () => {};

    const handler = (payload = {}) => {
        const text = getText(payload);
        const legacyAttachment = payload.fileData || payload.voiceData
            ? {
                name: payload.fileName || (payload.voiceData ? 'Voice note' : 'Attachment'),
                type: payload.fileType || (payload.voiceData ? 'audio/*' : 'application/octet-stream'),
                size: payload.fileSize || 0,
                dataUrl: payload.fileData || payload.voiceData,
                url: payload.fileUrl || null,
            }
            : null;
        const attachment = payload.attachment || payload.message?.attachment || legacyAttachment;
        if (!text?.trim() && !attachment) return;

        const message = payload.message && typeof payload.message === 'object'
            ? { ...payload.message }
            : { ...payload };

        const next = {
            id: message.id || payload.id || `${payload.from || payload.senderId || 'server'}-${Date.now()}`,
            roomId: message.roomId || payload.roomId || roomId,
            text: text.trim(),
            senderId: message.senderId || payload.senderId || payload.from || '',
            senderName: message.senderName || payload.senderName || payload.name || 'User',
            role: message.role || payload.role || payload.userRole || 'participant',
            createdAt: message.createdAt || payload.createdAt || Date.now(),
            replyTo: message.replyTo || payload.replyTo || null,
            attachment,
        };

        if (next.roomId === roomId) onMessage(next);
    };

    CHAT_EVENTS.forEach(eventName => socket.on(eventName, handler));
    return () => CHAT_EVENTS.forEach(eventName => socket.off(eventName, handler));
};
