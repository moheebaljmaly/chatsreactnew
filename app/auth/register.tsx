import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { supabase, checkUserIdExists } from '../../lib/supabase';
import { Link, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { generateUserId, validateUserId, formatUserId } from '../../utils/userIdGenerator';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [checkingUserId, setCheckingUserId] = useState(false);

  const generateRandomUserId = async () => {
    setCheckingUserId(true);
    let newUserId = generateUserId();
    
    while (await checkUserIdExists(newUserId)) {
      newUserId = generateUserId();
    }
    
    setUserId(newUserId);
    setCheckingUserId(false);
  };

  const handleUserIdChange = async (text: string) => {
    const cleanText = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    setUserId(cleanText);
  };

  const handleRegister = async () => {
    if (!email || !password || !name || !userId) {
      Alert.alert('خطأ', 'يرجى ملء جميع الحقول');
      return;
    }

    if (password.length < 6) {
      Alert.alert('خطأ', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (!validateUserId(userId)) {
      Alert.alert('خطأ', 'المعرف الفريد يجب أن يكون بين 6-12 حرف/رقم');
      return;
    }

    setLoading(true);

    const userIdExists = await checkUserIdExists(userId);
    if (userIdExists) {
      Alert.alert('خطأ', 'هذا المعرف مستخدم بالفعل، يرجى اختيار معرف آخر');
      setLoading(false);
      return;
    }
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
            user_id: userId,
            avatar_url: null,
          },
        },
      });

      if (error) {
        if (error.message.includes('User already registered')) {
            Alert.alert('خطأ', 'هذا البريد الإلكتروني مسجل بالفعل.');
        } else {
            Alert.alert('خطأ في إنشاء الحساب', error.message);
        }
      } else if (data.user) {
        const needsConfirmation = data.user.identities?.length > 0 && !data.user.email_confirmed_at;
        
        if (needsConfirmation) {
            router.replace({ pathname: '/auth/confirm-email', params: { email: email } });
        } else {
            Alert.alert(
              'تم إنشاء الحساب بنجاح! 🎉', 
              `معرفك الفريد هو: ${formatUserId(userId)}\nيمكنك الآن تسجيل الدخول.`,
              [{ text: 'حسناً', onPress: () => router.replace('/auth/login') }]
            );
        }
      }
    } catch (err) {
      Alert.alert('خطأ', 'حدث خطأ غير متوقع');
      console.error('Registration error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="chatbubbles" size={60} color="#25D366" />
            </View>
            <Text style={styles.title}>وصل</Text>
            <Text style={styles.subtitle}>إنشاء حساب جديد</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Ionicons name="person-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="الاسم"
                placeholderTextColor="#999"
                value={name}
                onChangeText={setName}
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="البريد الإلكتروني"
                placeholderTextColor="#999"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.inputIcon}
              >
                <Ionicons 
                  name={showPassword ? "eye-off-outline" : "eye-outline"} 
                  size={20} 
                  color="#666" 
                />
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="كلمة المرور (6 أحرف على الأقل)"
                placeholderTextColor="#999"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign="right"
              />
            </View>

            <View style={styles.userIdSection}>
              <Text style={styles.userIdLabel}>المعرف الفريد الخاص بك</Text>
              <View style={styles.userIdContainer}>
                <TouchableOpacity
                  onPress={generateRandomUserId}
                  style={styles.generateButton}
                  disabled={checkingUserId}
                >
                  <Ionicons 
                    name="refresh" 
                    size={20} 
                    color="#25D366" 
                  />
                </TouchableOpacity>
                <TextInput
                  style={styles.userIdInput}
                  placeholder="معرفك الفريد"
                  placeholderTextColor="#999"
                  value={userId}
                  onChangeText={handleUserIdChange}
                  autoCapitalize="none"
                  textAlign="right"
                  maxLength={12}
                />
                <Text style={styles.atSymbol}>@</Text>
              </View>
              <Text style={styles.userIdHint}>
                سيستخدم الآخرون هذا المعرف للعثور عليك والتواصل معك
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.registerButtonDisabled]}
              onPress={handleRegister}
              disabled={loading}
            >
              <Text style={styles.registerButtonText}>
                {loading ? 'جاري إنشاء الحساب...' : 'إنشاء حساب'}
              </Text>
            </TouchableOpacity>

            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>تملك حساباً بالفعل؟ </Text>
              <Link href="/auth/login" asChild>
                <TouchableOpacity>
                  <Text style={styles.loginLink}>تسجيل الدخول</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#25D366',
    marginBottom: 8,
    fontFamily: 'Arial',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputIcon: {
    marginLeft: 12,
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  userIdSection: {
    marginBottom: 16,
  },
  userIdLabel: {
    fontSize: 14,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  generateButton: {
    marginLeft: 12,
  },
  userIdInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  atSymbol: {
    fontSize: 18,
    color: '#25D366',
    fontWeight: 'bold',
    marginRight: 8,
  },
  userIdHint: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'right',
  },
  registerButton: {
    backgroundColor: '#25D366',
    borderRadius: 12,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#25D366',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  loginText: {
    fontSize: 14,
    color: '#666',
  },
  loginLink: {
    fontSize: 14,
    color: '#25D366',
    fontWeight: 'bold',
  },
});
