import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import InputField from '../components/InputField';
import AppIcon from '../components/AppIcon';
import { useAuth } from '../contexts/AuthContext';
import { changePassword } from '../services/authService';
import { Toast } from '../components/Toast';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const ProfilePassword = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth();
  const mode = route?.params?.mode || 'update';
  const isReset = mode === 'reset';

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (isReset) {
      Toast.info('Ask your institute admin to reset this account password.', 'Reset password');
      return;
    }
    if (!currentPassword || !newPassword || !confirmPassword) {
      Toast.warning('Fill all password fields.', 'Update password');
      return;
    }
    if (newPassword.length < 8) {
      Toast.warning('New password must be at least 8 characters.', 'Update password');
      return;
    }
    if (newPassword !== confirmPassword) {
      Toast.warning('New passwords do not match.', 'Update password');
      return;
    }

    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword });
      Toast.success('Password updated.');
      navigation.goBack();
    } catch (e) {
      Toast.error(e?.message || 'Could not update password.', 'Update password');
    } finally {
      setSaving(false);
    }
  };

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

        <Text style={styles.title}>{isReset ? 'Reset Password' : 'Update Password'}</Text>
        <Text style={styles.subtitle}>
          {isReset
            ? `Reset help for ${profile?.email || 'your account'}`
            : 'Change your password securely'}
        </Text>

        <View style={styles.card}>
          {isReset ? (
            <>
              <View style={styles.noticeIcon}>
                <AppIcon name="lock" size={24} color={colors.warning} />
              </View>
              <Text style={styles.noticeTitle}>Password reset needs admin help</Text>
              <Text style={styles.noticeText}>
                For account safety, password reset is handled by your institute admin.
                Share your registered email and ask them to create a new password.
              </Text>
              <Text style={styles.emailText}>{profile?.email || 'No email found'}</Text>
            </>
          ) : (
            <>
              <InputField
                label="Current password"
                placeholder="Enter current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                icon="lock"
              />
              <InputField
                label="New password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                icon="key"
              />
              <InputField
                label="Confirm password"
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                icon="check-circle"
              />
            </>
          )}
        </View>

        <TouchableOpacity
          style={[styles.submitBtn, saving && { opacity: 0.7 }]}
          onPress={submit}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name={isReset ? 'info-circle' : 'check'} size={14} color="#FFFFFF" />
          )}
          <Text style={styles.submitText}>{isReset ? 'Show Message' : 'Update Password'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

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
    title: {
      color: colors.text,
      fontSize: SIZES.xxl,
      fontWeight: '900',
      marginTop: SPACING.md,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '600',
      marginTop: 3,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.border,
      marginTop: SPACING.lg,
      ...SHADOWS.small,
    },
    noticeIcon: {
      width: 54,
      height: 54,
      borderRadius: 27,
      backgroundColor: colors.warning + '18',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: SPACING.md,
    },
    noticeTitle: {
      color: colors.text,
      fontSize: SIZES.md,
      fontWeight: '900',
      marginBottom: SPACING.xs,
    },
    noticeText: {
      color: colors.textMuted,
      fontSize: SIZES.sm,
      fontWeight: '600',
      lineHeight: 21,
    },
    emailText: {
      color: colors.primary,
      fontSize: SIZES.sm,
      fontWeight: '800',
      marginTop: SPACING.md,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginTop: SPACING.lg,
    },
    submitText: {
      color: '#FFFFFF',
      fontSize: SIZES.md,
      fontWeight: '900',
    },
  });

export default ProfilePassword;
