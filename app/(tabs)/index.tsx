import React, { useState, useEffect, useCallback } from 'react';
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
import { RealtimeChannel } from '@supabase/supabase-js';

interface ChatRoom {
  chat_room_id: string;
  other_user: {
    id: string;
    name: string;
    avatar_url?: string;
  };
  last_message: {
    content: string;
    created_at: string;
  } | null;
  unread_count: number;
}

export default function ChatsScreen() {
  const { user } = useAuth();
  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatUserId, setNewChatUserId] = useState('');
  const [searchingUser, setSearchingUser] = useState(false);

  const fetchChatRooms = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data, error } = await supabase.rpc('get_chat_rooms_for_user', {
        p_user_id: user.id,
      });

      if (error) {
        throw error;
      }
      
      setChats(data as ChatRoom[]);

    } catch (error) {
      console.error('Error loading chat rooms:', error);
      Alert.alert('خطأ', 'لم نتمكن من تحميل المحادثات.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchChatRooms();

    const chatUpdateChannel: RealtimeChannel = supabase
      .channel(`public:chat_rooms`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chat_rooms' },
        (payload) => {
          // A new message was inserted, so we refetch all rooms to get the new order and last message
          fetchChatRooms();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(chatUpdateChannel);
    };
  }, [user, fetchChatRooms]);

  const filteredChats = chats.filter(chat =>
    chat.other_user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleChatPress = (chat: ChatRoom) => {
    router.push(`/chat/${chat.chat_room_id}`);
  };

  const handleNewChat = () => {
    setShowNewChatModal(true);
  };

  const startNewChatWithUser = async (otherUser: any) => {
    if (!user) return;
    setSearchingUser(true);
    
    try {
      const { data: existingRoom, error: existingRoomError } = await supabase.rpc('find_existing_chat_room', {
        user1_id: user.id,
        user2_id: otherUser.id
      });

      if (existingRoomError) throw existingRoomError;

      if (existingRoom) {
        setShowNewChatModal(false);
        setNewChatUserId('');
        router.push(`/chat/${existingRoom}`);
        setSearchingUser(false);
        return;
      }

      const { data: newRoom, error: roomError } = await supabase
        .from('chat_rooms')
        .insert({})
        .select()
        .single();
      
      if (roomError) throw roomError;

      const { error: participantsError } = await supabase
        .from('chat_participants')
        .insert([
          { chat_room_id: newRoom.id, user_id: user.id },
          { chat_room_id: newRoom.id, user_id: otherUser.id },
        ]);

      if (participantsError) throw participantsError;

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
        if (userProfile.id === user?.id) {
          Alert.alert('لا يمكن', 'لا يمكنك بدء محادثة مع نفسك.');
          setSearchingUser(false);
          return;
        }
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

  const renderChatItem = ({ item }: { item: ChatRoom }) => (
    <TouchableOpacity style={styles.chatItem} onPress={() => handleChatPress(item)}>
      <View style={styles.chatInfo}>
        <View style={styles.chatHeader}>
          <Text style={styles.chatName}>{item.other_user.name}</Text>
          {item.last_message?.created_at && (
            <Text style={styles.chatTime}>
              {new Date(item.last_message.created_at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
            </Text>
          )}
        </View>
        <View style={styles.chatMessageRow}>
          <Text style={styles.chatMessage} numberOfLines={1}>
            {item.last_message?.content || 'لا توجد رسائل بعد'}
          </Text>
          {item.unread_count > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadCount}>{item.unread_count}</Text>
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
      
      {loading ? (
        <ActivityIndicator style={{ marginTop: 50 }} size="large" color="#25D366" />
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.chat_room_id}
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
          refreshing={loading}
          onRefresh={fetchChatRooms}
        />
      )}

      <Modal
        visible={showNewChatModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowNewChatModal(false)}
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
  chatsList: {
    flex: 1,
    marginTop: 16,
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
    textAlign: 'right',
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
