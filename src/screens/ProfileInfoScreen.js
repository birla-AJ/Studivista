import React, { useCallback, useMemo } from 'react';
import {
  Linking,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AppIcon from '../components/AppIcon';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { Toast } from '../components/Toast';
import { requestNotificationPermission } from '../services/notificationService';

const CONTENT = {
  help: {
    title: 'Help & FAQ',
    subtitle: 'User guide and common questions',
    icon: 'question-circle',
    sections: [
      {
        title: 'User guide',
        body: 'Use the bottom tabs to move between Home, classes, attendance, and Profile. Open Profile for account settings, permissions, notifications, support, and privacy details.',
      },
      {
        title: 'Getting started',
        body: 'Sign in with the role provided by your institute. Students should confirm their batch is assigned. Teachers should confirm their batches and classes are visible. Admins can manage teachers, students, batches, and classes.',
      },
      {
        title: 'For students',
        body: 'Open Home to see live and upcoming classes. Use Join to enter a class, Notes to view shared material, Attendance to check your presence, and Profile to update settings.',
      },
      {
        title: 'For teachers',
        body: 'Open Home or Classes to schedule and start classes. Use Students to review batch students, Attendance to track class presence, Notes to share study material, and Profile for settings.',
      },
      {
        title: 'For admins',
        body: 'Use the admin tabs to manage teachers, students, batches, and platform classes. Keep batch and role details updated so users see the correct classes and notes.',
      },
      {
        title: 'How do I join a live class?',
        body: 'Open your dashboard, tap the live class card, then wait for the teacher to admit you if approval is required.',
      },
      {
        title: 'How do I share my screen?',
        body: 'In a live class, tap Share. Students send a request first, and the teacher can allow or reject it.',
      },
      {
        title: 'Where are notes and files?',
        body: 'Open Notes from your dashboard. Teachers can add notes, files, videos, audio, and links for batches or classes.',
      },
      {
        title: 'Notifications are not coming',
        body: 'Open Profile, turn on Push alerts, and make sure Android notification permission is allowed for Studivista.',
      },
    ],
  },
  about: {
    title: 'About Studivista',
    subtitle: 'Version 1.0.0',
    icon: 'info-circle',
    sections: [
      {
        title: 'Studivista',
        body: 'Studivista is a classroom app for live classes, notes, attendance, notifications, and student learning tools.',
      },
      {
        title: 'Built for',
        body: 'Teachers, students, and admins who need a simple class workflow on mobile devices.',
      },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    subtitle: 'How data is handled',
    icon: 'shield-alt',
    sections: [
      {
        title: 'Account data',
        body: 'We use your name, email, role, batches, classes, notes, attendance, and notification tokens to run the app.',
      },
      {
        title: 'Camera, microphone, and screen share',
        body: 'Live class media is used only during class sessions. Students must request teacher approval before screen sharing.',
      },
      {
        title: 'Camera permission',
        body: 'Camera permission is used only for live class video. Your camera starts off by default and is shared only when you turn it on.',
      },
      {
        title: 'Microphone permission',
        body: 'Microphone permission is used for live class voice. Your mic starts muted by default and is shared only when you unmute.',
      },
      {
        title: 'Screen sharing permission',
        body: 'Screen capture is used only after you press Share. Students send a request first, and the teacher must approve before sharing begins.',
      },
      {
        title: 'Notification permission',
        body: 'Notification permission is used for class, notes, batch, and account alerts. You can turn push alerts and in-app alerts on or off from Profile.',
      },
      {
        title: 'Files and media permission',
        body: 'File access is used when you choose a profile photo or upload notes and attachments. The app only uses files you select.',
      },
      {
        title: 'Network permission',
        body: 'Internet access is required for login, live classes, chat, notes, attendance, notifications, and syncing class data.',
      },
      {
        title: 'Audio routing permission',
        body: 'Audio routing is used during live classes so sound works through the speaker, earpiece, Bluetooth, or headset.',
      },
      {
        title: 'Active class service permission',
        body: 'Android foreground service access keeps live class audio, video, and screen sharing stable while a class is active.',
      },
      {
        title: 'Vibration permission',
        body: 'Vibration is used only for Android notification alerts when your device notification settings allow vibration.',
      },
      {
        title: 'Files and notes',
        body: 'Uploaded class files are stored on the backend so students in the assigned class or batch can access them.',
      },
      {
        title: 'Control',
        body: 'You can turn push and in-app alerts on or off from Profile at any time.',
      },
    ],
  },
  terms: {
    title: 'Terms & Conditions',
    subtitle: 'Rules for using Studivista',
    icon: 'file-contract',
    sections: [
      {
        title: 'Use your assigned account',
        body: 'Sign in only with the account provided by your institute. Do not share your password or allow another person to use your account.',
      },
      {
        title: 'Classroom conduct',
        body: 'Use live classes, chat, screen sharing, notes, and feedback tools for learning and institute communication only.',
      },
      {
        title: 'Teacher and admin controls',
        body: 'Teachers and admins may manage classes, attendance, students, notes, live class admission, microphone, camera, and screen sharing controls.',
      },
      {
        title: 'Files and content',
        body: 'Upload only study material or relevant attachments you have permission to share. Your institute may remove content that is incorrect, unsafe, or unrelated.',
      },
      {
        title: 'Notifications',
        body: 'Studivista may send class, notes, batch, attendance, and account alerts. You can control push and in-app alerts from Profile.',
      },
      {
        title: 'Account responsibility',
        body: 'Keep your login details safe. Contact your institute admin if you lose access, notice incorrect information, or suspect account misuse.',
      },
    ],
  },
  permissions: {
    title: 'Permissions',
    subtitle: 'Why each permission is needed',
    icon: 'user-shield',
    sections: [
      {
        title: 'Camera',
        icon: 'camera',
        body: 'Required for live class video. Your camera stays off until you tap the camera control, and you can turn it off again at any time.',
        action: 'camera',
        actionLabel: 'Allow camera',
      },
      {
        title: 'Microphone',
        icon: 'microphone',
        body: 'Required for live class voice and voice notes. Your mic starts muted in class and records only after you tap the mic or recording control.',
        action: 'microphone',
        actionLabel: 'Allow microphone',
      },
      {
        title: 'Screen share',
        icon: 'desktop',
        body: 'Required when you present your phone screen in a live class. Students send a request first, and the teacher must approve before sharing starts.',
        action: 'settings',
        actionLabel: 'Open settings',
      },
      {
        title: 'Notifications',
        icon: 'bell',
        body: 'Required for class start alerts, notes, batch updates, and account messages. Push alerts and in-app alerts can be turned on or off from Profile.',
        action: 'notifications',
        actionLabel: 'Allow alerts',
      },
      {
        title: 'Files and media',
        icon: 'images',
        body: 'Required when you choose a profile picture or upload selected class notes, images, audio, video, or attachments. Studivista uses only the files you pick.',
        action: 'media',
        actionLabel: 'Allow media',
      },
      {
        title: 'Network',
        icon: 'wifi',
        body: 'Required to connect to the Studivista server for login, live classes, chat, notes, attendance, notifications, and data sync.',
        action: 'settings',
        actionLabel: 'Open settings',
      },
      {
        title: 'Audio routing',
        icon: 'volume-up',
        body: 'Required during live classes so sound can route correctly through the speaker, earpiece, Bluetooth, or a wired headset.',
        action: 'settings',
        actionLabel: 'Open settings',
      },
      {
        title: 'Active class service',
        icon: 'play-circle',
        body: 'Required on Android to keep live class audio, video, and screen sharing stable while a class session is active.',
        action: 'settings',
        actionLabel: 'Open settings',
      },
      {
        title: 'Vibration',
        icon: 'mobile-alt',
        body: 'Required on Android so important notifications can vibrate when your device notification settings allow vibration.',
        action: 'settings',
        actionLabel: 'Open settings',
      },
    ],
  },
  security: {
    title: 'Security & Privacy',
    subtitle: 'Account safety',
    icon: 'lock',
    sections: [
      {
        title: 'Keep your account safe',
        body: 'Use a strong password and do not share your login with another person.',
      },
      {
        title: 'Live class controls',
        body: 'Teachers can admit students, remove students, control student camera and mic, and approve screen sharing.',
      },
      {
        title: 'Sign out',
        body: 'Use Sign out on Profile when using a shared device.',
      },
    ],
  },
  licenses: {
    title: 'Licenses',
    subtitle: 'Open source notices',
    icon: 'file-contract',
    sections: [
      {
        title: 'React Native',
        body: 'This app is built with React Native and related open source packages.',
      },
      {
        title: 'Socket.IO and Express',
        body: 'Live class signaling and backend APIs use Socket.IO and Express.',
      },
      {
        title: 'Vector icons',
        body: 'Icons are provided through react-native-vector-icons / FontAwesome.',
      },
    ],
  },
  contact: {
    title: 'Contact Us',
    subtitle: 'Support and help',
    icon: 'headset',
    sections: [
      {
        title: 'Support',
        body: 'For class, login, notes, attendance, or live call issues, contact your institute admin or support team.',
      },
      {
        title: 'Before contacting support',
        body: 'Mention your role, device name, class or batch name, and what you were doing when the issue happened.',
      },
      {
        title: 'Feedback',
        body: 'Use Profile > Send feedback to send suggestions or improvement ideas.',
      },
    ],
  },
};

const ProfileInfoScreen = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const type = route?.params?.type || 'about';
  const content = CONTENT[type] || CONTENT.about;
  const isPermissionsScreen = type === 'permissions';

  const openSettings = useCallback(async () => {
    try {
      await Linking.openSettings();
    } catch (e) {
      Toast.error(e?.message || 'Could not open app settings.', 'Settings');
    }
  }, []);

  const requestAndroidPermission = useCallback(
    async (permission, label) => {
      if (Platform.OS !== 'android') {
        await openSettings();
        return;
      }

      try {
        const result = await PermissionsAndroid.request(permission);
        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          Toast.success(`${label} permission allowed.`);
        } else {
          Toast.warning(`${label} permission was not allowed.`);
        }
      } catch (e) {
        Toast.error(e?.message || `Could not request ${label.toLowerCase()}.`);
      }
    },
    [openSettings],
  );

  const requestAndroidPermissions = useCallback(
    async (permissions, label) => {
      if (Platform.OS !== 'android') {
        await openSettings();
        return;
      }

      try {
        const results = await PermissionsAndroid.requestMultiple(permissions);
        const allowed = permissions.every(
          permission =>
            results[permission] === PermissionsAndroid.RESULTS.GRANTED,
        );
        if (allowed) {
          Toast.success(`${label} permissions allowed.`);
        } else {
          Toast.warning(`${label} permissions were not fully allowed.`);
        }
      } catch (e) {
        Toast.error(e?.message || `Could not request ${label.toLowerCase()}.`);
      }
    },
    [openSettings],
  );

  const handlePermissionAction = useCallback(
    async action => {
      if (action === 'camera') {
        await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          'Camera',
        );
        return;
      }

      if (action === 'microphone') {
        await requestAndroidPermission(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          'Microphone',
        );
        return;
      }

      if (action === 'notifications') {
        const allowed = await requestNotificationPermission();
        if (allowed) {
          Toast.success('Notification permission allowed.');
        } else {
          Toast.warning('Notification permission was not allowed.');
        }
        return;
      }

      if (action === 'media') {
        const permissions = (
          Platform.OS === 'android' && Platform.Version >= 33
            ? [
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_VIDEO,
                PermissionsAndroid.PERMISSIONS.READ_MEDIA_AUDIO,
              ]
            : [PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE]
        ).filter(Boolean);

        if (permissions.length === 0) {
          await openSettings();
          return;
        }

        await requestAndroidPermissions(permissions, 'Media');
        return;
      }

      await openSettings();
    },
    [openSettings, requestAndroidPermission, requestAndroidPermissions],
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <AppIcon name="chevron-left" size={14} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <AppIcon name={content.icon} size={28} color={colors.primary} />
          </View>
          <Text style={styles.heroTitle}>{content.title}</Text>
          <Text style={styles.heroSub}>{content.subtitle}</Text>
        </View>

        {content.sections.map(section => (
          <InfoCard
            key={section.title}
            section={section}
            colors={colors}
            styles={styles}
            showIcon={isPermissionsScreen}
            onAction={
              isPermissionsScreen && section.action
                ? () => handlePermissionAction(section.action)
                : null
            }
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
};

const InfoCard = ({ section, styles, colors, showIcon, onAction }) => (
  <View style={styles.card}>
    <View style={styles.cardHeader}>
      {showIcon && (
        <View style={styles.cardIcon}>
          <AppIcon
            name={section.icon || 'info-circle'}
            size={15}
            color={colors.primary}
          />
        </View>
      )}
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{section.title}</Text>
        <Text style={styles.cardBody}>{section.body}</Text>
      </View>
    </View>
    {!!onAction && (
      <TouchableOpacity
        style={styles.actionButton}
        onPress={onAction}
        activeOpacity={0.85}
      >
        <AppIcon name="check-circle" size={13} color={colors.primary} />
        <Text style={styles.actionText}>
          {section.actionLabel || 'Manage permission'}
        </Text>
      </TouchableOpacity>
    )}
  </View>
);

const makeStyles = colors =>
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
      paddingBottom: SPACING.xxl,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: SPACING.md,
      ...SHADOWS.small,
    },
    hero: {
      alignItems: 'center',
      paddingVertical: SPACING.xl,
    },
    heroIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    heroTitle: {
      color: colors.text,
      fontSize: SIZES.xxl,
      fontWeight: '900',
      textAlign: 'center',
    },
    heroSub: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '600',
      marginTop: 4,
      textAlign: 'center',
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginBottom: SPACING.sm,
      ...SHADOWS.small,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: SPACING.md,
    },
    cardIcon: {
      width: 34,
      height: 34,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primary + '18',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      color: colors.text,
      fontSize: SIZES.md,
      fontWeight: '900',
      marginBottom: SPACING.xs,
    },
    cardBody: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '600',
      lineHeight: 21,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.xs,
      minHeight: 38,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.primary + '30',
      backgroundColor: colors.primary + '12',
      marginTop: SPACING.md,
    },
    actionText: {
      color: colors.primary,
      fontSize: SIZES.xs,
      fontWeight: '900',
    },
  });

export default ProfileInfoScreen;
