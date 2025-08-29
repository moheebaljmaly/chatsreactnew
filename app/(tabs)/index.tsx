import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, findUserByUserId } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { router } from 'expo-router';
import { validateUserId, formatUserId } from '../../utils/userIdGenerator';

interface Chat {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  avatar?: string;
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);

  useEffect(() => {
    // --- رسالة توضيحية ---
    // في هذا الإصدار، قائمة المحادثات هي للعرض فقط.
    // المحادثات الحقيقية تبدأ من خلال زر "محادثة جديدة".
    loadSampleChats();
  }, []);

  const loadSampleChats = async () => {
    try {
      const sampleChats: Chat[] = [
        {
          id: '1',
          name: 'أحمد محمد',
          lastMessage: 'مرحباً، كيف حالك؟',
          lastMessageTime: '10:30',
          unreadCount: 2,
        },
        {
          id: '2',
          name: 'فاطمة أحمد',
          lastMessage: 'شكراً لك على المساعدة',
          lastMessageTime: 'أمس',
          unreadCount: 0,
        },
      ];
      setChats(sampleChats);
    } catch (error) {
      console.error('Error loading chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = (chat: Chat) => {
    // بما أن هذه بيانات وهمية، سنعرض رسالة توضيحية
    Alert.alert('ميزة تجريبية', 'هذه محادثة وهمية للعرض. يمكنك بدء محادثة حقيقية من خلال زر "محادثة جديدة".');
    // router.push(`/chat/${chat.id}`);
  };

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  // --- تفعيل بدء المحادثات ---
  // هذه الدالة تبحث عن مستخدم، وإذا تم العثور عليه، تنشئ غرفة محادثة حقيقية.
  const startNewChatWithUser = async (otherUser: any) => {
    if (!user) return;
    setSearchingUser(true);
    
    try {
      // 1. إنشاء غرفة محادثة جديدة
      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({})
        .select()
        .single();
      
      if (roomError) throw roomError;

      // 2. إضافة المشاركين (أنت والمستخدم الآخر) إلى الغرفة
      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_room_id: newRoom.id, user_id: user.id },
          { chat_room_id: newRoom.id, user_id: otherUser.id },
        ]);

      if (participantsError) throw participantsError;

      // 3. إغلاق المودال والانتقال إلى شاشة المحادثة الجديدة
      setShowNewChatModal(false);
      setNewChatUserId('');
      router.push(`/chat/${newRoom.id}`);

    } catch (error) {
      console.error('Error starting new chat:', error);
      Alert.alert('خطأ', 'لم نتمكن من بدء المحادثة. يرجى المحاولة مرة أخرى.');
    } finally {
      setSearchingUser(false);
    }
  };

  const searchUserByUserId = async () => {
    if (!newChatUserId.trim()) {
      Alert.alert('خطأ', 'يرجى إدخال المعرف الفريد');
      return;
    }

    const cleanUserId = newChatUserId.toLowerCase().replace(/[^a-z0-9]/g, '');
    
    if (!validateUserId(cleanUserId)) {
      Alert.alert('خطأ', 'المعرف الفريد غير صحيح');
      return;
    }

    setSearchingUser(true);
    
    try {
      const userProfile = await findUserByUserId(cleanUserId);
      
      if (userProfile) {
        Alert.alert(
          'تم العثور على المستخدم',
          `الاسم: ${userProfile.name}\nالمعرف: ${formatUserId(userProfile.user_id)}`,
          [
            { text: 'إلغاء', style: 'cancel' },
            { 
              text: 'بدء محادثة', 
              onPress: () => startNewChatWithUser(userProfile)
            }
          ]
        );
      } else {
        Alert.alert('غير موجود', 'لم يتم العثور على مستخدم بهذا المعرف');
      }
    } catch (error) {
      console.error('Error searching user:', error);
      Alert.alert('خطأ', 'حدث خطأ أثناء البحث');
    } finally {
      setSearchingUser(false);
    }
  };

  const renderChatItem = ({ item }: { item: Chat }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.name}</Text>
          <Text style={styles.chatTime}>{item.lastMessageTime}</Text>
        </View>
        <View style={styles.chatMessageRow}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {item.lastMessage}
          </Text>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unreadCount}</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.avatar}>
        <Ionicons name="person-circle" size={50} color="#25D366" />
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>وصل</Text>
        <TouchableOpacity onPress={handleNewChat} style={styles.newChatButton}>
          <Ionicons name="add" size={24} color="#25D366" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="البحث في المحادثات..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          textAlign="right"
        />
      </View>
      
      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color="#333" />
        <Text style={styles.infoText}>
          قائمة المحادثات هذه للعرض فقط. لبدء محادثة حقيقية، اضغط على زر (+).
        </Text>
      </View>

      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderChatItem}
        style={styles.chatsList}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={64} color="#ccc" />
            <Text style={styles.emptyStateText}>لا توجد محادثات بعد</Text>
            <Text style={styles.emptyStateSubtext}>ابدأ محادثة جديدة باستخدام المعرف الفريد</Text>
          </View>
        }
      />

      <Modal
        visible={showNewChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowNewChatModal(false)}>
              <Text style={styles.cancelButton}>إلغاء</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>محادثة جديدة</Text>
            <TouchableOpacity onPress={searchUserByUserId} disabled={searchingUser}>
              {searchingUser ? (
                <ActivityIndicator color="#25D366" />
              ) : (
                <Text style={styles.searchButton}>بحث</Text>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.instructionText}>
              أدخل المعرف الفريد للشخص الذي تريد التواصل معه
            </Text>
            
            <View style={styles.userIdContainer}>
              <TextInput
                style={styles.userIdInput}
                placeholder="المعرف الفريد"
                placeholderTextColor="#999"
                value={newChatUserId}
                onChangeText={setNewChatUserId}
                autoCapitalize="none"
                textAlign="right"
              />
              <Text style={styles.atSymbol}>@</Text>
            </View>

            <Text style={styles.hintText}>
              مثال: user123, ahmed2024
            </Text>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#25D366',
  },
  newChatButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 25,
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
  searchIcon: {
    marginLeft: 12,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#333',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e6f7ff',
    padding: 12,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#91d5ff',
  },
  infoText: {
    flex: 1,
    marginLeft: 8,
    fontSize: 13,
    color: '#333',
    textAlign: 'right',
    lineHeight: 18,
  },
  chatsList: {
    flex: 1,
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  chatInfo: {
    flex: 1,
    marginLeft: 12,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  chatTime: {
    fontSize: 12,
    color: '#999',
  },
  chatMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chatMessage: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#25D366',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  unreadCount: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyStateText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    fontWeight: '600',
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
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
  searchButton: {
    fontSize: 16,
    color: '#25D366',
    fontWeight: 'bold',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  instructionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
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
    marginBottom: 16,
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
  hintText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});
