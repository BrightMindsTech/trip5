import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import i18n from '../i18n';
import { useTheme } from '../context/ThemeContext';

function iosSpinnerPickerProps(isDark) {
  if (Platform.OS !== 'ios') return {};
  if (!isDark) return {};
  return { textColor: '#FFFFFF', themeVariant: 'dark' };
}

function createDateStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 24, paddingTop: 48, paddingBottom: 48 },
    title: { fontSize: 22, fontWeight: '600', marginBottom: 24, textAlign: 'center', color: colors.text },
    card: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      borderRadius: 12,
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    cardSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary, borderWidth: 1 },
    cardTitle: { fontSize: 18, fontWeight: '500', color: colors.text },
    cardTitleSelected: { color: colors.text },
    check: { color: colors.primary, fontSize: 20 },
    pickerButton: {
      padding: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      marginBottom: 16,
    },
    pickerLabel: { fontSize: 14, color: colors.textSecondary, marginBottom: 4 },
    pickerValue: { fontSize: 16, fontWeight: '500', color: colors.text },
    button: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 12,
      marginTop: 8,
      alignItems: 'center',
    },
    buttonText: { color: colors.white, fontSize: 18, fontWeight: '600' },
    pickerModalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.6)',
    },
    pickerModalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      paddingBottom: 32,
    },
    pickerModalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    pickerModalCancel: {
      fontSize: 17,
      color: colors.textSecondary,
    },
    pickerModalDone: {
      fontSize: 17,
      color: colors.primary,
      fontWeight: '600',
    },
  });
}

export default function DateScreen({ order, updateOrder, goNext }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => createDateStyles(colors), [colors]);
  const iosPickerDark = iosSpinnerPickerProps(isDark);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [pendingDate, setPendingDate] = useState(null);
  const [pendingTime, setPendingTime] = useState(null);

  const now = new Date();
  const minDate = new Date(now);
  minDate.setHours(0, 0, 0, 0);

  const getDefaultTime = () => {
    const d = new Date();
    d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30);
    d.setSeconds(0, 0);
    return d;
  };

  const scheduledDateTime = order.scheduledDate instanceof Date
    ? order.scheduledDate
    : new Date(order.scheduledDate || getDefaultTime());

  const displayDate = order.isToday ? now : scheduledDateTime;
  const displayTime = order.isToday ? (order.scheduledDate || getDefaultTime()) : scheduledDateTime;
  const timeToShow = displayTime instanceof Date ? displayTime : new Date(displayTime);

  const openDatePicker = () => {
    setPendingDate(new Date(displayDate));
    setShowDatePicker(true);
  };
  const openTimePicker = () => {
    setPendingTime(new Date(timeToShow));
    setShowTimePicker(true);
  };

  const onDateChange = (e, date) => {
    if (Platform.OS === 'android') {
      if (e?.type === 'dismissed') {
        setShowDatePicker(false);
        return;
      }
      if (date) {
        const merged = new Date(date);
        merged.setHours(scheduledDateTime.getHours(), scheduledDateTime.getMinutes(), 0, 0);
        updateOrder({ scheduledDate: merged });
        setShowDatePicker(false);
      }
      return;
    }
    if (e?.type === 'dismissed') {
      setShowDatePicker(false);
      return;
    }
    if (date) setPendingDate(new Date(date));
  };

  const onTimeChange = (e, time) => {
    if (Platform.OS === 'android') {
      if (e?.type === 'dismissed') {
        setShowTimePicker(false);
        return;
      }
      if (time) {
        const merged = order.isToday ? new Date() : new Date(scheduledDateTime);
        merged.setHours(time.getHours(), time.getMinutes(), 0, 0);
        if (order.isToday && merged < now) merged.setDate(merged.getDate() + 1);
        updateOrder({ scheduledDate: merged });
        setShowTimePicker(false);
      }
      return;
    }
    if (e?.type === 'dismissed') {
      setShowTimePicker(false);
      return;
    }
    if (time) setPendingTime(new Date(time));
  };

  const confirmDate = () => {
    if (pendingDate) {
      const merged = new Date(pendingDate);
      merged.setHours(scheduledDateTime.getHours(), scheduledDateTime.getMinutes(), 0, 0);
      updateOrder({ scheduledDate: merged });
    }
    setShowDatePicker(false);
    setPendingDate(null);
  };

  const confirmTime = () => {
    if (pendingTime) {
      const merged = order.isToday ? new Date() : new Date(scheduledDateTime);
      merged.setHours(pendingTime.getHours(), pendingTime.getMinutes(), 0, 0);
      if (order.isToday && merged < now) merged.setDate(merged.getDate() + 1);
      updateOrder({ scheduledDate: merged });
    }
    setShowTimePicker(false);
    setPendingTime(null);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{i18n.t('choose_date')}</Text>
      <TouchableOpacity
        style={[styles.card, order.isToday && styles.cardSelected]}
        onPress={() => updateOrder({ isToday: true, scheduledDate: getDefaultTime() })}
      >
        <Text style={[styles.cardTitle, order.isToday && styles.cardTitleSelected]}>
          {i18n.t('today')}
        </Text>
        {order.isToday && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.card, !order.isToday && styles.cardSelected]}
        onPress={() => updateOrder({ isToday: false, scheduledDate: scheduledDateTime })}
      >
        <Text style={[styles.cardTitle, !order.isToday && styles.cardTitleSelected]}>
          {i18n.t('scheduled')}
        </Text>
        {!order.isToday && <Text style={styles.check}>✓</Text>}
      </TouchableOpacity>

      {!order.isToday && (
        <TouchableOpacity style={styles.pickerButton} onPress={openDatePicker}>
          <Text style={styles.pickerLabel}>{i18n.t('select_date')}</Text>
          <Text style={styles.pickerValue}>{displayDate.toLocaleDateString()}</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.pickerButton} onPress={openTimePicker}>
        <Text style={styles.pickerLabel}>{i18n.t('select_time')}</Text>
        <Text style={styles.pickerValue}>
          {timeToShow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </TouchableOpacity>

      {Platform.OS === 'ios' && showDatePicker && pendingDate && (
        <Modal visible transparent animationType="slide">
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => { setShowDatePicker(false); setPendingDate(null); }}>
                  <Text style={styles.pickerModalCancel}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmDate}>
                  <Text style={styles.pickerModalDone}>{i18n.t('confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pendingDate}
                mode="date"
                minimumDate={minDate}
                onChange={onDateChange}
                display="spinner"
                {...iosPickerDark}
              />
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showDatePicker && (
        <DateTimePicker
          value={scheduledDateTime}
          mode="date"
          minimumDate={minDate}
          onChange={onDateChange}
        />
      )}

      {Platform.OS === 'ios' && showTimePicker && pendingTime && (
        <Modal visible transparent animationType="slide">
          <View style={styles.pickerModalOverlay}>
            <View style={styles.pickerModalContent}>
              <View style={styles.pickerModalHeader}>
                <TouchableOpacity onPress={() => { setShowTimePicker(false); setPendingTime(null); }}>
                  <Text style={styles.pickerModalCancel}>{i18n.t('cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={confirmTime}>
                  <Text style={styles.pickerModalDone}>{i18n.t('confirm')}</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={pendingTime}
                mode="time"
                onChange={onTimeChange}
                display="spinner"
                {...iosPickerDark}
              />
            </View>
          </View>
        </Modal>
      )}
      {Platform.OS !== 'ios' && showTimePicker && (
        <DateTimePicker
          value={timeToShow}
          mode="time"
          onChange={onTimeChange}
        />
      )}

      <TouchableOpacity style={styles.button} onPress={goNext}>
        <Text style={styles.buttonText}>{i18n.t('next')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
