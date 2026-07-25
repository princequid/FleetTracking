import React, { useMemo } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme, useThemeMode } from '../theme/ThemeContext';

const OPTIONS = [
  { value: 'light',  label: 'Light',  icon: 'sun' },
  { value: 'system', label: 'System', icon: 'smartphone' },
  { value: 'dark',   label: 'Dark',   icon: 'moon' },
];

// Segmented Light / System / Dark control. Drives ThemeContext (persisted).
export function ThemeToggle() {
  const C = useTheme();
  const { mode, setMode } = useThemeMode();
  const styles = useMemo(() => makeStyles(C), [C]);

  return (
    <View style={styles.wrap}>
      {OPTIONS.map((o) => {
        const active = mode === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => {
              if (mode !== o.value) {
                Haptics.selectionAsync().catch(() => {});
                setMode(o.value);
              }
            }}
            style={[styles.seg, active && styles.segActive]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${o.label} theme`}
          >
            <Feather name={o.icon} size={15} color={active ? C.teal : C.text3} />
            <Text style={[styles.label, { color: active ? C.text1 : C.text3 }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (C) => StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    backgroundColor: C.bg,
    borderRadius: 14,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: C.border,
  },
  seg: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  segActive: {
    backgroundColor: C.surface,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  label: { fontFamily: 'Inter-SemiBold', fontSize: 13 },
});

export default ThemeToggle;
