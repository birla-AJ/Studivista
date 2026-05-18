import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { RADIUS, SHADOWS, SIZES, SPACING } from '../../theme';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import BottomTabBar from '../../components/BottomTabBar';
import AppIcon from '../../components/AppIcon';
import { askGemini } from '../../services/geminiService';

const WELCOME_BY_ROLE = {
    student: 'Ask me anything from your classes. I can explain concepts, solve doubts, or help you revise.',
    teacher: 'Hi! I can help with lesson plans, classroom activities, grading rubrics, or clarifying any topic. What do you need?',
};

const ROUTES_BY_ROLE = {
    student: {
        StudentDashboard: 'StudentDashboard',
        JoinClass: 'JoinClass',
        StudentRecordings: 'StudentRecordings',
        StudentAttendance: 'StudentAttendance',
        Notifications: 'Notifications',
    },
    teacher: {
        TeacherDashboard: 'TeacherDashboard',
        MyClasses: 'MyClasses',
        Attendance: 'Attendance',
        Recordings: 'Recordings',
        Notifications: 'Notifications',
    },
};

const AIChat = ({ navigation, route }) => {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();
    const styles = useMemo(
        () => makeStyles(colors, insets.bottom),
        [colors, insets.bottom],
    );
    const role = route?.params?.role === 'teacher' ? 'teacher' : 'student';
    const userSender = role;

    const [active, setActive] = useState('AIChat');
    const [messages, setMessages] = useState([
        { id: 'welcome', sender: 'ai', text: WELCOME_BY_ROLE[role] },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const listRef = useRef(null);

    useEffect(() => {
        const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
        const showSub = Keyboard.addListener(showEvt, () => setKeyboardVisible(true));
        const hideSub = Keyboard.addListener(hideEvt, () => setKeyboardVisible(false));
        return () => { showSub.remove(); hideSub.remove(); };
    }, []);

    const handleNav = (screen) => {
        setActive(screen);
        if (screen === 'AIChat') return;
        const routes = ROUTES_BY_ROLE[role];
        if (routes[screen]) navigation.navigate(routes[screen]);
    };

    const sendMessage = async () => {
        const question = input.trim();
        if (!question || loading) return;

        const userMessage = {
            id: `${userSender}-${Date.now()}`,
            sender: userSender,
            text: question,
        };

        const nextMessages = [...messages, userMessage];
        setMessages(nextMessages);
        setInput('');
        setLoading(true);

        try {
            const answer = await askGemini({ messages, question, role });
            setMessages(prev => [
                ...prev,
                { id: `ai-${Date.now()}`, sender: 'ai', text: answer },
            ]);
        } catch (e) {
            const errText = e?.message || 'Something went wrong.';
            setMessages(prev => [
                ...prev,
                { id: `error-${Date.now()}`, sender: 'error', text: errText },
            ]);
        } finally {
            setLoading(false);
            setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
        }
    };

    const renderMessage = ({ item }) => {
        const isUser = item.sender === 'student' || item.sender === 'teacher';
        const isError = item.sender === 'error';

        return (
            <View style={[styles.messageRow, isUser && styles.messageRowStudent]}>
                {!isUser && (
                    <View style={[styles.avatar, isError && styles.avatarError]}>
                        <AppIcon name={isError ? 'exclamation-triangle' : 'robot'} size={16} color="#FFFFFF" />
                    </View>
                )}
                <View style={[
                    styles.bubble,
                    isUser && styles.studentBubble,
                    isError && styles.errorBubble,
                ]}>
                    <Text style={[styles.messageText, isUser && styles.studentText, isError && styles.errorText]}>
                        {item.text}
                    </Text>
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
            <Header
                title="AI Chat"
                subtitle={role === 'teacher' ? 'Teaching co-pilot' : 'Study assistant'}
                showBack
                onBack={() => navigation.goBack()}
            />

            <KeyboardAvoidingView
                style={styles.content}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
            >
                <FlatList
                    ref={listRef}
                    data={messages}
                    renderItem={renderMessage}
                    keyExtractor={item => item.id}
                    contentContainerStyle={styles.messages}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                    ListFooterComponent={
                        loading ? (
                            <View style={styles.loadingRow}>
                                <ActivityIndicator color={colors.primary} size="small" />
                                <Text style={styles.loadingText}>Thinking...</Text>
                            </View>
                        ) : null
                    }
                />

                <View style={styles.composer}>
                    <TextInput
                        style={styles.input}
                        placeholder="Ask a question..."
                        placeholderTextColor={colors.textMuted}
                        value={input}
                        onChangeText={setInput}
                        multiline
                        maxLength={800}
                    />
                    <TouchableOpacity
                        style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
                        onPress={sendMessage}
                        disabled={!input.trim() || loading}
                        activeOpacity={0.82}
                    >
                        <AppIcon name="paper-plane" size={16} color="#FFFFFF" />
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>

            {!keyboardVisible && <BottomTabBar activeScreen={active} onNavigate={handleNav} role={role} />}
        </SafeAreaView>
    );
};

const makeStyles = (colors, bottomInset) => StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg },
    content: { flex: 1 },
    messages: {
        padding: SPACING.base,
        paddingBottom: Math.max(bottomInset, SPACING.md) + SPACING.md,
    },
    messageRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: SPACING.md,
        gap: SPACING.sm,
    },
    messageRowStudent: { justifyContent: 'flex-end' },
    avatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.secondary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarError: { backgroundColor: colors.warning },
    bubble: {
        maxWidth: '82%',
        backgroundColor: colors.surface,
        borderRadius: RADIUS.lg,
        borderBottomLeftRadius: RADIUS.xs,
        padding: SPACING.md,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        ...SHADOWS.small,
    },
    studentBubble: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
        borderBottomLeftRadius: RADIUS.lg,
        borderBottomRightRadius: RADIUS.xs,
    },
    errorBubble: {
        backgroundColor: colors.warning + '18',
        borderColor: colors.warning + '44',
    },
    messageText: { color: colors.text, fontSize: SIZES.sm, lineHeight: 20 },
    studentText: { color: '#FFFFFF', fontWeight: '600' },
    errorText: { color: colors.warning, fontWeight: '600' },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: SPACING.sm,
        paddingLeft: 40,
        paddingBottom: SPACING.sm,
    },
    loadingText: { color: colors.textMuted, fontSize: SIZES.sm, fontWeight: '600' },
    composer: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: SPACING.sm,
        paddingHorizontal: SPACING.base,
        paddingVertical: SPACING.md,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        backgroundColor: colors.bg,
    },
    input: {
        flex: 1,
        maxHeight: 110,
        minHeight: 44,
        borderRadius: RADIUS.lg,
        backgroundColor: colors.inputBg,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: colors.border,
        paddingHorizontal: SPACING.md,
        paddingVertical: SPACING.sm,
        color: colors.text,
        fontSize: SIZES.md,
    },
    sendBtn: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
        ...SHADOWS.primary,
    },
    sendBtnDisabled: {
        backgroundColor: colors.border,
        shadowOpacity: 0,
        elevation: 0,
    },
});

export default AIChat;
