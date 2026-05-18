import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  errorCodes,
  isErrorWithCode,
  pick,
  types,
} from '@react-native-documents/picker';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import BottomTabBar from '../components/BottomTabBar';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { updateProfileAvatar } from '../services/authService';
import {
  subscribeBatches,
  subscribeBatchesByIds,
  subscribeBatchesByTeacher,
  subscribeClasses,
  subscribeClassesByBatches,
  subscribeClassesByTeacher,
  subscribeNotificationsForUser,
  subscribeUsersByRole,
} from '../services/firestoreService';
import {
  isInAppNotificationEnabled,
  isPushNotificationEnabled,
  registerPushTokenForUser,
  requestNotificationPermission,
  setInAppNotificationPreference,
  setPushNotificationPreference,
  unregisterPushTokenForUser,
} from '../services/notificationService';
import { Toast } from '../components/Toast';
import { formatJoined } from '../utils/format';

const getInitial = value => (value || '?').charAt(0).toUpperCase();

const Profile = ({ navigation }) => {
  const { colors, isDark, toggle } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(
    () => makeStyles(colors, insets.top),
    [colors, insets.top],
  );
  const { user, profile, signOut, setSession } = useAuth();

  const [active, setActive] = useState('Profile');
  const [avatarSaving, setAvatarSaving] = useState(false);
  const [batches, setBatches] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [pushOn, setPushOn] = useState(true);
  const [inAppOn, setInAppOn] = useState(true);
  const [notificationBusy, setNotificationBusy] = useState(false);

  const isAdmin = profile?.role === 'admin';
  const isTeacher = profile?.role === 'teacher';
  const isStudent = profile?.role === 'student';
  const role = profile?.role || 'student';
  const roleColor = isTeacher
    ? colors.teacherColor
    : isStudent
    ? colors.studentColor
    : colors.adminColor;
  const roleLabel = isTeacher ? 'Teacher' : isStudent ? 'Student' : 'Admin';
  const profileBatchIds = useMemo(() => profile?.batchIds || [], [profile]);

  useEffect(() => {
    if (!user?.uid) return undefined;

    if (isAdmin) {
      const u1 = subscribeBatches(setBatches);
      const u2 = subscribeUsersByRole('teacher', setTeachers);
      const u3 = subscribeUsersByRole('student', setStudents);
      const u4 = subscribeClasses(setClasses);
      return () => {
        u1?.();
        u2?.();
        u3?.();
        u4?.();
      };
    }

    if (isTeacher) {
      const u1 = subscribeBatchesByTeacher(user.uid, setBatches);
      const u2 = subscribeClassesByTeacher(user.uid, setClasses);
      const u3 = subscribeUsersByRole('student', setStudents);
      return () => {
        u1?.();
        u2?.();
        u3?.();
      };
    }

    if (isStudent) {
      const u1 = subscribeBatchesByIds(profileBatchIds, setBatches);
      const u2 = subscribeClassesByBatches(profileBatchIds, setClasses);
      return () => {
        u1?.();
        u2?.();
      };
    }

    return undefined;
  }, [user?.uid, isAdmin, isTeacher, isStudent, profileBatchIds]);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      isPushNotificationEnabled(),
      isInAppNotificationEnabled(),
    ]).then(([pushEnabled, inAppEnabled]) => {
      if (!mounted) return;
      setPushOn(pushEnabled);
      setInAppOn(inAppEnabled);
    });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return undefined;
    const unsub = subscribeNotificationsForUser(user.uid, list => {
      setNotifications(list || []);
    });
    return () => unsub?.();
  }, [user?.uid]);

  const myBatchIds = useMemo(() => batches.map(b => b.id), [batches]);
  const myStudents = useMemo(
    () =>
      students.filter(s =>
        (s.batchIds || []).some(id => myBatchIds.includes(id)),
      ),
    [students, myBatchIds],
  );
  const joinedClasses = useMemo(
    () => classes.filter(c => (c.joinedStudentIds || []).includes(user?.uid)),
    [classes, user?.uid],
  );
  const unreadCount = notifications.filter(n => !n.read).length;

  const stats = isAdmin
    ? [
        { label: 'Batches', value: batches.length, color: colors.primary },
        { label: 'Teachers', value: teachers.length, color: colors.teacherColor },
        { label: 'Students', value: students.length, color: colors.studentColor },
      ]
    : isTeacher
    ? [
        { label: 'Batches', value: batches.length, color: colors.primary },
        { label: 'Students', value: myStudents.length, color: colors.secondary },
        { label: 'Classes', value: classes.length, color: colors.success },
      ]
    : [
        { label: 'Batches', value: batches.length, color: colors.primary },
        { label: 'Classes', value: classes.length, color: colors.success },
        { label: 'Joined', value: joinedClasses.length, color: colors.secondary },
      ];

  const photoURL = profile?.avatar || profile?.photoURL;
  const initial = getInitial(profile?.name || profile?.email);
  const joinedDate = formatJoined(profile?.createdAt) || 'Not available';

  const normalizeUploadUri = uri =>
    Platform.OS === 'android' && uri && !uri.includes('://')
      ? `file://${uri}`
      : uri;

  const handleAvatarPress = async () => {
    if (avatarSaving || !user?.uid) return;
    try {
      const [selected] = await pick({
        type: [types.images],
        allowMultiSelection: false,
      });
      if (!selected) return;

      setAvatarSaving(true);
      const nextProfile = await updateProfileAvatar(user.uid, {
        uri: normalizeUploadUri(selected.uri),
        name: selected.name || `profile-${user.uid}.jpg`,
        type: selected.type || 'image/jpeg',
      });
      await setSession(nextProfile);
      Toast.success('Profile picture saved.');
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Toast.error(e?.message || 'Could not save profile picture.', 'Profile');
    } finally {
      setAvatarSaving(false);
    }
  };

  const togglePush = async enabled => {
    if (notificationBusy) return;
    const previous = pushOn;
    setPushOn(enabled);
    setNotificationBusy(true);
    try {
      await setPushNotificationPreference(enabled);
      if (enabled) {
        const allowed = await requestNotificationPermission();
        if (!allowed) {
          setPushOn(false);
          await setPushNotificationPreference(false);
          Toast.warning('Notification permission was not granted.', 'Notifications');
          return;
        }
        await registerPushTokenForUser(user?.uid);
        Toast.success('Push notifications enabled.');
      } else {
        await unregisterPushTokenForUser();
        Toast.info('Push notifications disabled.');
      }
    } catch (e) {
      setPushOn(previous);
      Toast.error(e?.message || 'Could not update push notifications.', 'Notifications');
    } finally {
      setNotificationBusy(false);
    }
  };

  const toggleInApp = async enabled => {
    const previous = inAppOn;
    setInAppOn(enabled);
    try {
      await setInAppNotificationPreference(enabled);
      Toast.info(
        enabled ? 'In-app alerts enabled.' : 'In-app alerts disabled.',
        'Notifications',
      );
    } catch (e) {
      setInAppOn(previous);
      Toast.error(e?.message || 'Could not update in-app alerts.', 'Notifications');
    }
  };

  const handleLogout = () => {
    Alert.alert('Log out?', 'Sign out of this account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  const shareApp = async () => {
    try {
      await Share.share({
        title: 'Studivista',
        message: 'Join me on Studivista for live classes, notes, and learning.',
      });
    } catch (e) {
      Toast.error(e?.message || 'Could not share app.', 'Share');
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Profile</Text>
            <Text style={styles.headerSub}>Account, alerts, and privacy</Text>
          </View>
          <TouchableOpacity
            style={styles.headerButton}
            onPress={toggle}
            activeOpacity={0.85}
          >
            <AppIcon
              name={isDark ? 'sun' : 'moon'}
              size={16}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.heroCard}>
          <TouchableOpacity
            style={styles.avatarButton}
            onPress={handleAvatarPress}
            activeOpacity={0.85}
            disabled={avatarSaving}
          >
            {photoURL ? (
              <Image source={{ uri: photoURL }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={[styles.avatarInitial, { color: roleColor }]}>
                  {initial}
                </Text>
              </View>
            )}
            <View style={[styles.editAvatarBtn, { backgroundColor: roleColor }]}>
              {avatarSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <AppIcon name="camera" size={12} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.heroText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {profile?.name || 'User'}
              </Text>
              <View
                style={[
                  styles.roleBadge,
                  {
                    backgroundColor: roleColor + '18',
                    borderColor: roleColor + '40',
                  },
                ]}
              >
                <Text style={[styles.roleText, { color: roleColor }]}>
                  {roleLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.email} numberOfLines={1}>
              {profile?.email || 'No email added'}
            </Text>
            <Text style={styles.joined}>Joined {joinedDate}</Text>

            <View style={styles.heroStats}>
              {stats.map(stat => (
                <View key={stat.label} style={styles.heroStatItem}>
                  <Text style={[styles.heroStatValue, { color: stat.color }]}>
                    {stat.value}
                  </Text>
                  <Text style={styles.heroStatLabel} numberOfLines={1}>
                    {stat.label}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <Section title="Profile Settings" colors={colors}>
          <ActionRow
            icon="user-edit"
            color={colors.secondary}
            title="Edit info"
            subtitle="Update your name and account details"
            onPress={() => navigation.navigate('EditProfileInfo')}
            colors={colors}
          />
          <ActionRow
            icon="key"
            color={colors.primary}
            title="Update password"
            subtitle="Change your password while signed in"
            onPress={() => navigation.navigate('ProfilePassword', { mode: 'update' })}
            colors={colors}
          />
          <ActionRow
            icon="undo-alt"
            color={colors.warning}
            title="Reset password"
            subtitle="Send a reset link to your email"
            onPress={() => navigation.navigate('ProfilePassword', { mode: 'reset' })}
            colors={colors}
            last
          />
        </Section>

        <Section
          title="Notifications"
          subtitle="Choose how Studivista can alert you."
          colors={colors}
        >
          <ActionRow
            icon="bell"
            color={colors.warning}
            title="Notification center"
            subtitle={
              unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up'
            }
            onPress={() => navigation.navigate('Notifications')}
            colors={colors}
          />
          <ActionRow
            icon="mobile-alt"
            color={colors.primary}
            title="Push alerts"
            subtitle="Show alerts outside the app"
            right={
              <Switch
                value={pushOn}
                onValueChange={togglePush}
                disabled={notificationBusy}
                trackColor={{ false: colors.border, true: colors.primary + '66' }}
                thumbColor={pushOn ? colors.primary : colors.textMuted}
                ios_backgroundColor={colors.border}
              />
            }
            colors={colors}
          />
          <ActionRow
            icon="comment-dots"
            color={colors.secondary}
            title="In-app alerts"
            subtitle="Show toast alerts while the app is open"
            right={
              <Switch
                value={inAppOn}
                onValueChange={toggleInApp}
                trackColor={{ false: colors.border, true: colors.secondary + '66' }}
                thumbColor={inAppOn ? colors.secondary : colors.textMuted}
                ios_backgroundColor={colors.border}
              />
            }
            colors={colors}
            last
          />
        </Section>

        <Section
          title="Permissions"
          subtitle="Why Studivista asks for access on your device."
          colors={colors}
        >
          <ActionRow
            icon="user-shield"
            color={colors.primary}
            title="App permissions"
            subtitle="Camera, microphone, screen share, notifications, files, network, audio, service, and vibration"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'permissions' })}
            colors={colors}
            last
          />
        </Section>

        <Section title="Support" colors={colors}>
          <ActionRow
            icon="question-circle"
            color={colors.primary}
            title="Help and FAQ"
            subtitle="Answers for class, notes, and account issues"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'help' })}
            colors={colors}
          />
          <ActionRow
            icon="share-alt"
            color={colors.success}
            title="Share app"
            subtitle="Invite someone to Studivista"
            onPress={shareApp}
            colors={colors}
          />
          <ActionRow
            icon="paper-plane"
            color={colors.secondary}
            title="Send feedback"
            subtitle="Share suggestions and improvements"
            onPress={() => navigation.navigate('ReportBug', { mode: 'feedback' })}
            colors={colors}
          />
          <ActionRow
            icon="headset"
            color={colors.warning}
            title="Contact us"
            subtitle="Get help from your support team"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'contact' })}
            colors={colors}
          />
          <ActionRow
            icon="bug"
            color={colors.danger}
            title="Report bug"
            subtitle="Tell us what went wrong"
            onPress={() => navigation.navigate('ReportBug')}
            colors={colors}
            last
          />
        </Section>

        <Section title="Legal" colors={colors}>
          <ActionRow
            icon="info-circle"
            color={colors.secondary}
            title="About"
            subtitle="Studivista version and app details"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'about' })}
            colors={colors}
          />
          <ActionRow
            icon="shield-alt"
            color={colors.success}
            title="Privacy policy"
            subtitle="How account and class data is handled"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'privacy' })}
            colors={colors}
          />
          <ActionRow
            icon="lock"
            color={colors.warning}
            title="Security and privacy"
            subtitle="Account safety and class controls"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'security' })}
            colors={colors}
          />
          <ActionRow
            icon="file-contract"
            color={colors.textMuted}
            title="Licenses"
            subtitle="Open source notices"
            onPress={() => navigation.navigate('ProfileInfo', { type: 'licenses' })}
            colors={colors}
            last
          />
        </Section>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={handleLogout}
          activeOpacity={0.85}
        >
          <AppIcon name="sign-out-alt" size={16} color={colors.danger} />
          <Text style={styles.logoutText}>Sign out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>Studivista v1.0.0</Text>
      </ScrollView>

      <BottomTabBar activeScreen={active} onNavigate={setActive} role={role} />
    </View>
  );
};

const Section = ({ title, subtitle, children, colors }) => (
  <View style={sectionStyles(colors).wrap}>
    <View style={sectionStyles(colors).header}>
      <Text style={sectionStyles(colors).title}>{title}</Text>
      {!!subtitle && <Text style={sectionStyles(colors).subtitle}>{subtitle}</Text>}
    </View>
    <View style={sectionStyles(colors).card}>{children}</View>
  </View>
);

const ActionRow = ({
  icon,
  color,
  title,
  subtitle,
  onPress,
  right,
  colors,
  last,
}) => {
  const C = onPress ? TouchableOpacity : View;
  const accent = color || colors.textMuted;

  return (
    <C
      style={[
        rowStyles(colors).row,
        last && rowStyles(colors).lastRow,
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <View style={[rowStyles(colors).iconWrap, { backgroundColor: accent + '18' }]}>
        <AppIcon name={icon} size={14} color={accent} />
      </View>
      <View style={rowStyles(colors).textWrap}>
        <Text style={rowStyles(colors).title}>{title}</Text>
        {!!subtitle && (
          <Text style={rowStyles(colors).subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {right || (onPress ? (
        <AppIcon name="chevron-right" size={12} color={colors.textMuted} />
      ) : null)}
    </C>
  );
};

const sectionStyles = colors =>
  StyleSheet.create({
    wrap: {
      marginTop: SPACING.lg,
    },
    header: {
      marginBottom: SPACING.sm,
      paddingHorizontal: 2,
    },
    title: {
      color: colors.text,
      fontSize: SIZES.base,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      lineHeight: SIZES.xs + 5,
      marginTop: 2,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      paddingHorizontal: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
  });

const rowStyles = colors =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      minHeight: 62,
      paddingVertical: SPACING.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    lastRow: {
      borderBottomWidth: 0,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    textWrap: {
      flex: 1,
      paddingRight: SPACING.sm,
    },
    title: {
      color: colors.text,
      fontSize: SIZES.sm,
      fontWeight: '900',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      lineHeight: SIZES.xs + 5,
      marginTop: 3,
    },
  });

const makeStyles = (colors, topInset) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    scroll: {
      flex: 1,
      paddingHorizontal: SPACING.base,
    },
    content: {
      paddingTop: Math.max(topInset, SPACING.md),
      paddingBottom: 120,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: SPACING.md,
    },
    headerTitle: {
      color: colors.text,
      fontSize: SIZES.title,
      fontWeight: '900',
    },
    headerSub: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '700',
      marginTop: 2,
    },
    headerButton: {
      width: 42,
      height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.small,
    },
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.md,
      backgroundColor: colors.surface,
      borderRadius: RADIUS.xl,
      padding: SPACING.base,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      ...SHADOWS.medium,
    },
    avatarButton: {
      width: 92,
      height: 92,
      flexShrink: 0,
    },
    avatar: {
      width: 92,
      height: 92,
      borderRadius: 46,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceSubtle,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatarInitial: {
      fontSize: SIZES.xxxl,
      fontWeight: '900',
    },
    editAvatarBtn: {
      position: 'absolute',
      right: 0,
      bottom: 0,
      width: 30,
      height: 30,
      borderRadius: 15,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: colors.surface,
    },
    heroText: {
      flex: 1,
      minWidth: 0,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: SPACING.sm,
    },
    name: {
      flex: 1,
      color: colors.text,
      fontSize: SIZES.xl,
      fontWeight: '900',
    },
    roleBadge: {
      paddingHorizontal: SPACING.sm,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
      borderWidth: 1,
      flexShrink: 0,
    },
    roleText: {
      fontSize: SIZES.xs,
      fontWeight: '900',
      textTransform: 'uppercase',
    },
    email: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '700',
      marginTop: 4,
    },
    joined: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      marginTop: 2,
    },
    heroStats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: SPACING.xs,
      marginTop: SPACING.md,
    },
    heroStatItem: {
      flex: 1,
      minHeight: 42,
      borderRadius: RADIUS.md,
      paddingHorizontal: SPACING.xs,
      paddingVertical: SPACING.sm,
      backgroundColor: colors.surfaceSubtle,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    heroStatValue: {
      fontSize: SIZES.md,
      fontWeight: '900',
      textAlign: 'center',
    },
    heroStatLabel: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '800',
      marginTop: 1,
      textAlign: 'center',
    },
    logoutBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.danger + '14',
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginTop: SPACING.lg,
      borderWidth: 1,
      borderColor: colors.danger + '30',
    },
    logoutText: {
      color: colors.danger,
      fontSize: SIZES.md,
      fontWeight: '900',
    },
    versionText: {
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      marginTop: SPACING.lg,
    },
  });

export default Profile;
