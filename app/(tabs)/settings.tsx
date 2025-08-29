import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, checkUserIdExists } from '../../lib/supabase';
import { validateUserId, formatUserId } from '../../utils/userIdGenerator';
import * as Clipboard from 'expo-clipboard';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [name, setName] = useState('');
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.user_metadata?.name || '');
      setUserId(user.user_metadata?.user_id || '');
    }
  }, [user]);

  const handleSignOut = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تسجيل الخروج', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!name.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال الاسم');
      return;
    }

    const cleanUserId = userId.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!validateUserId(cleanUserId)) {
      Alert.alert('خطأ', 'المعرف الفريد يجب أن يكون بين 6-12 حرف/رقم');
      return;
    }

    setLoading(true);

    try {
      if (cleanUserId !== user?.user_metadata?.user_id) {
        const userIdExists = await checkUserIdExists(cleanUserId);
        if (userIdExists) {
          Alert.alert('خطأ', 'هذا المعرف مستخدم بالفعل، يرجى اختيار معرف آخر');
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.updateUser({
        data: { 
          name: name.trim(),
          user_id: cleanUserId
        }
      });

      if (error) throw error;

      Alert.alert('تم', 'تم تحديث بياناتك بنجاح');
      setShowEditProfile(false);

    } catch (error) {
      console.error('Update profile error:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء تحديث البيانات');
    } finally {
      setLoading(false);
    }
  };

  const copyUserId = async () => {
    const formattedId = formatUserId(user?.user_metadata?.user_id || '');
    await Clipboard.setStringAsync(formattedId);
    Alert.alert(
      'تم النسخ!',
      `لقد تم نسخ معرفك الفريد: ${formattedId}`,
      [{ text: 'حسناً' }]
    );
  };

  const settingsOptions = [
    {
      id: 1,
      title: 'تعديل الملف الشخصي',
      icon: 'person-outline',
      onPress: () => setShowEditProfile(true),
    },
    {
      id: 2,
      title: 'نسخ المعرف الفريد',
      icon: 'copy-outline',
      onPress: copyUserId,
    },
    {
      id: 3,
      title: 'الإشعارات',
      icon: 'notifications-outline',
      onPress: () => Alert.alert('قريباً', 'ميزة إعدادات الإشعارات ستكون متاحة قريباً'),
    },
    {
      id: 4,
      title: 'الخصوصية',
      icon: 'shield-outline',
      onPress: () => Alert.alert('قريباً', 'ميزة إعدادات الخصوصية ستكون متاحة قريباً'),
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>الإعدادات</Text>
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.profileSection}>
          <View style={styles.profileAvatar}>
            <Ionicons name="person-circle" size={80} color="#25D366" />
          </View>
          <Text style={styles.profileName}>{user?.user_metadata?.name || 'مستخدم'}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
          <Text style={styles.profileUserId}>
            {formatUserId(user?.user_metadata?.user_id || '')}
          </Text>
        </View>

        <View style={styles.settingsSection}>
          {settingsOptions.map((option) => (
            <TouchableOpacity
              key={option.id}
              style={styles.settingItem}
              onPress={option.onPress}
            >
              <View style={styles.settingContent}>
                <Text style={styles.settingTitle}>{option.title}</Text>
                <Ionicons name="chevron-back" size={20} color="#ccc" />
              </View>
              <Ionicons name={option.icon as any} size={24} color="#25D366" />
            </TouchableOpacity>
          ))}

          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <View style={styles.settingContent}>
              <Text style={styles.signOutText}>تسجيل الخروج</Text>
            </View>
            <Ionicons name="log-out-outline" size={24} color="#ff4444" />
          </TouchableOpacity>
        </View>
      </ScrollView>

      <Modal
        visible={showEditProfile}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowEditProfile(false)}>
              <Text style={styles.cancelButton}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>تعديل الملف الشخصي</Text>
            <TouchableOpacity onPress={handleUpdateProfile} disabled={loading}>
              <Text style={[styles.saveButton, loading && styles.saveButtonDisabled]}>
                {loading ? 'حفظ...' : 'حفظ'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <View style={styles.editAvatarContainer}>
              <View style={styles.editAvatar}>
                <Ionicons name="person-circle" size={100} color="#25D366" />
              </View>
              <TouchableOpacity 
                style={styles.editAvatarButton}
                onPress={() => Alert.alert('قريباً', 'ميزة تغيير الصورة ستكون متاحة قريباً')}
              >
                <Text style={styles.editAvatarText}>تغيير الصورة</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>الاسم</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="أدخل اسمك"
                textAlign="right"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>المعرف الفريد</Text>
              <View style={styles.userIdContainer}>
                <TextInput
                  style={styles.userIdInput}
                  value={userId}
                  onChangeText={(text) => setUserId(text.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                  placeholder="معرفك الفريد"
                  textAlign="right"
                  maxLength={12}
                />
                <Text style={styles.atSymbol}>@</Text>
              </View>
              <Text style={styles.userIdHint}>
                يمكن للآخرين العثور عليك باستخدام هذا المعرف
              </Text>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#25D366',
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  profileSection: {
    backgroundColor: '#fff',
    alignItems: 'center',
    paddingVertical: 30,
    marginBottom: 20,
  },
  profileAvatar: {
    marginBottom: 16,
  },
  profileName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  profileUserId: {
    fontSize: 16,
    color: '#25D366',
    fontWeight: 'bold',
  },
  settingsSection: {
    backgroundColor: '#fff',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingContent: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginLeft: 16,
  },
  settingTitle: {
    fontSize: 16,
    color: '#333',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginTop: 20,
    backgroundColor: '#fff',
  },
  signOutText: {
    fontSize: 16,
    color: '#ff4444',
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cancelButton: {
    fontSize: 16,
    color: '#666',
  },
  saveButton: {
    fontSize: 16,
    color: '#25D366',
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  editAvatarContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  editAvatar: {
    marginBottom: 16,
  },
  editAvatarButton: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 20,
  },
  editAvatarText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    color: '#333',
    marginBottom: 8,
    fontWeight: '600',
    textAlign: 'right',
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    textAlign: 'right',
  },
  userIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
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
});
