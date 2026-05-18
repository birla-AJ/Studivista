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
import { updateProfileInfo } from '../services/authService';
import { Toast } from '../components/Toast';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const EditProfileInfo = ({ navigation }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, profile, setSession } = useAuth();
  const [name, setName] = useState(profile?.name || '');
  const [subject, setSubject] = useState(profile?.subject || '');
  const [saving, setSaving] = useState(false);

  const isTeacher = profile?.role === 'teacher';

  const save = async () => {
    if (saving) return;
    if (!name.trim()) {
      Toast.warning('Name is required.', 'Edit info');
      return;
    }

    setSaving(true);
    try {
      const next = await updateProfileInfo(user.uid, {
        name: name.trim(),
        ...(isTeacher ? { subject: subject.trim() } : {}),
      });
      await setSession(next);
      Toast.success('Profile updated.');
      navigation.goBack();
    } catch (e) {
      Toast.error(e?.message || 'Could not update profile.', 'Edit info');
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
        <Text style={styles.title}>Edit Info</Text>
        <Text style={styles.subtitle}>Update basic profile details</Text>
        <View style={styles.card}>
          <InputField
            label="Name"
            placeholder="Your name"
            value={name}
            onChangeText={setName}
            icon="user"
          />
          <InputField
            label="Email"
            placeholder="Email"
            value={profile?.email || ''}
            onChangeText={() => {}}
            icon="envelope"
          />
          {isTeacher && (
            <InputField
              label="Subject"
              placeholder="Teaching subject"
              value={subject}
              onChangeText={setSubject}
              icon="book-open"
            />
          )}
          <Text style={styles.note}>
            Email and role are managed by the institute admin.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.7 }]}
          onPress={save}
          disabled={saving}
          activeOpacity={0.85}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AppIcon name="check" size={14} color="#FFFFFF" />
          )}
          <Text style={styles.saveText}>Save Changes</Text>
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
    note: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      lineHeight: 18,
    },
    saveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.primary,
      borderRadius: RADIUS.lg,
      padding: SPACING.md,
      marginTop: SPACING.lg,
    },
    saveText: {
      color: '#FFFFFF',
      fontSize: SIZES.md,
      fontWeight: '900',
    },
  });

export default EditProfileInfo;
