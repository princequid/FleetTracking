import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

// Reusable loading indicator for the whole app.
//
// Inline mode (default) — drop it wherever a button/row needs a small spinner in
// place of its label, e.g. `loading ? <LoadingSpinner color="#fff" /> : <Text>Sign in</Text>`.
//
// Full-screen mode (`fullScreen`) — a blocking overlay with an optional message, for
// async actions that shouldn't be interrupted (sign-out, etc).
export default function LoadingSpinner({ fullScreen = false, message, size = 'small', color }) {
  const C = useTheme();
  const spinnerColor = color || C.teal;

  if (!fullScreen) {
    return <ActivityIndicator size={size} color={spinnerColor} />;
  }

  const styles = makeStyles(C);
  return (
    <Modal transparent animationType="fade" visible statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ActivityIndicator size="large" color={spinnerColor} />
          {!!message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const makeStyles = (C) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 47, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 32,
    alignItems: 'center',
    gap: 12,
    minWidth: 160,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  message: {
    fontFamily: 'Inter-Medium',
    fontSize: 14,
    color: C.text2,
    textAlign: 'center',
  },
});
