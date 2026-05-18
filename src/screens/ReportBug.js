import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import InputField from '../components/InputField';
import AppIcon from '../components/AppIcon';
import { Toast } from '../components/Toast';
import { useAuth } from '../contexts/AuthContext';
import { SIZES, SPACING, RADIUS, SHADOWS } from '../theme';
import { useTheme } from '../theme/ThemeContext';

const ReportBug = ({ navigation, route }) => {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { profile } = useAuth();
  const isFeedback = route?.params?.mode === 'feedback';
  const [title, setTitle] = useState('');
  const [details, setDetails] = useState('');

  const submit = () => {
    if (!title.trim() || !details.trim()) {
      Toast.warning('Add title and details.', isFeedback ? 'Feedback' : 'Report bug');
      return;
    }
    setTitle('');
    setDetails('');
    Toast.success(
      isFeedback ? 'Feedback sent. Thank you.' : 'Bug report saved for support review.',
      isFeedback ? 'Feedback' : 'Report bug',
    );
    navigation.goBack();
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
        <Text style={styles.title}>{isFeedback ? 'Send Feedback' : 'Report Bug'}</Text>
        <Text style={styles.subtitle}>
          {isFeedback ? 'Share your suggestions' : 'Tell us what went wrong'}
        </Text>
        <View style={styles.card}>
          <InputField
            label={isFeedback ? 'Subject' : 'Problem'}
            placeholder={
              isFeedback
                ? 'Example: Improve live class controls'
                : 'Example: Screen share request not visible'
            }
            value={title}
            onChangeText={setTitle}
            icon={isFeedback ? 'paper-plane' : 'bug'}
          />
          <InputField
            label="Details"
            placeholder={
              isFeedback
                ? 'What should we improve?'
                : 'What happened? Which screen? Which device?'
            }
            value={details}
            onChangeText={setDetails}
            icon="align-left"
            multiline
            numberOfLines={5}
          />
          <Text style={styles.meta}>
            From: {profile?.name || 'User'} - {profile?.email || 'no email'}
          </Text>
        </View>

        <TouchableOpacity style={styles.submitBtn} onPress={submit} activeOpacity={0.85}>
          <AppIcon name="paper-plane" size={14} color="#FFFFFF" />
          <Text style={styles.submitText}>{isFeedback ? 'Send Feedback' : 'Send Report'}</Text>
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
    meta: {
      color: colors.textMuted,
      fontSize: SIZES.xs,
      fontWeight: '600',
      lineHeight: 18,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: SPACING.sm,
      backgroundColor: colors.danger,
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

export default ReportBug;
