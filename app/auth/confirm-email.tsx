import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';

export default function ConfirmEmailScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [loading, setLoading] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setLoading(false);

    if (error) {
      Alert.alert('خطأ', 'لم نتمكن من إعادة إرسال البريد. يرجى المحاولة مرة أخرى.');
    } else {
      Alert.alert('تم الإرسال', 'تم إرسال رابط تفعيل جديد إلى بريدك الإلكتروني.');
    }
  };

  const goToLogin = () => {
    router.replace('/auth/login');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="mail-unread-outline" size={80} color="#25D366" style={styles.icon} />
        <Text style={styles.title}>خطوة أخيرة!</Text>
        <Text style={styles.subtitle}>
          لقد أرسلنا رابط تفعيل إلى بريدك الإلكتروني:
        </Text>
        <Text style={styles.emailText}>{email}</Text>
        <Text style={styles.instructions}>
          يرجى الضغط على الرابط لتفعيل حسابك. لا تنسَ التحقق من مجلد الرسائل غير المرغوب فيها (Spam).
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={goToLogin}
        >
          <Text style={styles.primaryButtonText}>اذهب إلى صفحة تسجيل الدخول</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton, loading && styles.disabledButton]}
          onPress={handleResend}
          disabled={loading}
        >
          <Text style={styles.secondaryButtonText}>
            {loading ? 'جاري الإرسال...' : 'إعادة إرسال رابط التفعيل'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '90%',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 30,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  icon: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 10,
  },
  emailText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#25D366',
    marginBottom: 20,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 30,
  },
  button: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#25D366',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  secondaryButtonText: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
