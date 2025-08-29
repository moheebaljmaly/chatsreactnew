import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { RealtimeChannel } from '@supabase/supabase-js';

// --- شرح الواجهة ---
// هذا هو تعريف شكل الرسالة في التطبيق
interface Message {
  id: string; // معرف فريد للرسالة
  text: string; // محتوى الرسالة
  sender_id: string; // معرف المرسل
  timestamp: Date; // وقت إرسال الرسالة
  status?: 'sent' | 'delivered' | 'read'; // حالة الرسالة
}

export default function ChatScreen() {
  const { id: chatRoomId } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [otherUser, setOtherUser] = useState<{ name: string; id: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  // --- شرح الدالة ---
  // هذه الدالة تجلب بيانات الطرف الآخر في المحادثة (اسمه ومعرفه)
  const fetchOtherUserData = useCallback(async () => {
    if (!chatRoomId || !user) return;

    // 1. جلب المشاركين في غرفة المحادثة
    const { data: participants, error } = await supabase
      .from('chat_participants')
      .select('user_id')
      .eq('chat_room_id', chatRoomId)
      .neq('user_id', user.id); // استثناء المستخدم الحالي

    if (error || !participants || participants.length === 0) {
      console.error('Error fetching other user:', error);
      return;
    }

    // 2. جلب بيانات الملف الشخصي للمشارك الآخر
    const otherUserId = participants[0].user_id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('name, id')
      .eq('id', otherUserId)
      .single();

    if (profile) {
      setOtherUser(profile);
    }
  }, [chatRoomId, user]);
  
  // --- شرح الدالة ---
  // هذه الدالة تجلب جميع الرسائل السابقة في المحادثة عند فتحها
  const fetchMessages = useCallback(async () => {
    if (!chatRoomId) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('messages')
      .select('id, content, created_at, user_id')
      .eq('chat_room_id', chatRoomId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    } else {
      const formattedMessages: Message[] = data.map((msg: any) => ({
        id: msg.id,
        text: msg.content,
        sender_id: msg.user_id,
        timestamp: new Date(msg.created_at),
      }));
      setMessages(formattedMessages);
    }
    setLoading(false);
  }, [chatRoomId]);

  // --- شرح التأثير ---
  // هذا التأثير (Effect) يعمل مرة واحدة عند فتح الشاشة
  // يقوم بجلب بيانات المستخدم الآخر والرسائل السابقة
  // ثم يقوم بإنشاء اشتراك فوري (Real-time) للاستماع للرسائل الجديدة
  useEffect(() => {
    fetchOtherUserData();
    fetchMessages();

    // --- شرح الاشتراكات الفورية (Real-time) ---
    // 1. نحدد القناة التي سنستمع إليها، وهي قناة الرسائل في غرفة المحادثة الحالية
    const channel = supabase
      .channel(`chat_room:${chatRoomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_room_id=eq.${chatRoomId}`,
        },
        // 2. عند وصول رسالة جديدة (payload)، نقوم بتحديث حالة الرسائل
        (payload) => {
          const newMessageData = payload.new as any;
          const formattedMessage: Message = {
            id: newMessageData.id,
            text: newMessageData.content,
            sender_id: newMessageData.user_id,
            timestamp: new Date(newMessageData.created_at),
          };
          // نضيف الرسالة الجديدة إلى قائمة الرسائل
          setMessages((prevMessages) => [...prevMessages, formattedMessage]);
        }
      )
      .subscribe();
    
    channelRef.current = channel;

    // 3. عند إغلاق الشاشة، نقوم بإلغاء الاشتراك لتوفير الموارد
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [chatRoomId, fetchMessages, fetchOtherUserData]);

  // --- شرح الدالة ---
  // هذه الدالة ترسل رسالة جديدة إلى قاعدة البيانات
  const sendMessage = async () => {
    if (!newMessage.trim() || !user || !chatRoomId) return;

    const messageContent = newMessage.trim();
    setNewMessage(''); // تفريغ حقل الإدخال فوراً لتحسين التجربة

    const { error } = await supabase.from('messages').insert({
      chat_room_id: chatRoomId,
      user_id: user.id,
      content: messageContent,
    });

    if (error) {
      console.error('Error sending message:', error);
      // في حالة حدوث خطأ، يمكن إعادة النص إلى حقل الإدخال
      setNewMessage(messageContent);
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMyMessage = item.sender_id === user?.id;
    return (
      <View style={[styles.messageContainer, isMyMessage ? styles.myMessage : styles.otherMessage]}>
        <View style={[styles.messageBubble, isMyMessage ? styles.myMessageBubble : styles.otherMessageBubble]}>
          <Text style={[styles.messageText, isMyMessage ? styles.myMessageText : styles.otherMessageText]}>
            {item.text}
          </Text>
          <View style={styles.messageInfo}>
            <Text style={[styles.messageTime, isMyMessage ? styles.myMessageTime : styles.otherMessageTime]}>
              {formatTime(item.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#25D366" />
          <Text style={styles.loadingText}>جاري تحميل المحادثة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-forward" size={24} color="#25D366" />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{otherUser?.name || 'محادثة'}</Text>
          <Text style={styles.headerSubtitle}>متصل</Text>
        </View>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        style={styles.messagesList}
        contentContainerStyle={styles.messagesContainer}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.textInput}
              value={newMessage}
              onChangeText={setNewMessage}
              placeholder="اكتب رسالة..."
              placeholderTextColor="#999"
              multiline
              textAlign="right"
            />
            <TouchableOpacity
              style={styles.sendButton}
              onPress={sendMessage}
              disabled={!newMessage.trim()}
            >
              <Ionicons name="send" size={20} color={'#fff'} />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  backButton: {
    marginLeft: 8,
  },
  headerInfo: {
    flex: 1,
    marginHorizontal: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'right',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#25D366',
    marginTop: 2,
    textAlign: 'right',
  },
  messagesList: {
    flex: 1,
  },
  messagesContainer: {
    padding: 16,
  },
  messageContainer: {
    marginVertical: 4,
  },
  myMessage: {
    alignItems: 'flex-end',
  },
  otherMessage: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
  },
  myMessageBubble: {
    backgroundColor: '#25D366',
    borderBottomRightRadius: 4,
  },
  otherMessageBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'right',
  },
  myMessageText: {
    color: '#fff',
  },
  otherMessageText: {
    color: '#333',
  },
  messageInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  messageTime: {
    fontSize: 12,
    marginLeft: 4,
  },
  myMessageTime: {
    color: 'rgba(255,255,255,0.7)',
  },
  otherMessageTime: {
    color: '#999',
  },
  inputContainer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: '#333',
    marginHorizontal: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#25D366',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
