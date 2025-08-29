/*
# إنشاء قاعدة بيانات تطبيق وصل
هذا الملف يحتوي على جميع الجداول المطلوبة لتطبيق وصل للدردشة.

## Query Description: 
سيتم إنشاء جداول جديدة لإدارة ملفات المستخدمين، غرف المحادثة، المشاركين، والرسائل. 
هذه عملية آمنة ولا تؤثر على أي بيانات موجودة.

## Metadata:
- Schema-Category: "Safe"
- Impact-Level: "Low"
- Requires-Backup: false
- Reversible: true

## Structure Details:
- profiles: جدول ملفات المستخدمين
- chat_rooms: جدول غرف المحادثة
- chat_participants: جدول المشاركين في المحادثات
- messages: جدول الرسائل

## Security Implications:
- RLS Status: Enabled
- Policy Changes: Yes
- Auth Requirements: يتطلب مصادقة للوصول للبيانات

## Performance Impact:
- Indexes: Added for better query performance
- Triggers: Added for automatic profile creation
- Estimated Impact: لا يوجد تأثير على الأداء
*/

-- إنشاء جدول ملفات المستخدمين
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL,
  user_id TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول غرف المحادثة
CREATE TABLE IF NOT EXISTS public.chat_rooms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء جدول المشاركين في المحادثات
CREATE TABLE IF NOT EXISTS public.chat_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(chat_room_id, user_id)
);

-- إنشاء جدول الرسائل
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_room_id UUID REFERENCES public.chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- إنشاء فهارس لتحسين الأداء
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_room_id ON public.chat_participants(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_room_id ON public.messages(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- تفعيل RLS على جميع الجداول
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- سياسات الأمان لجدول profiles
CREATE POLICY "المستخدمون يمكنهم رؤية جميع الملفات الشخصية" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "المستخدمون يمكنهم تحديث ملفهم الشخصي فقط" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "المستخدمون يمكنهم إدراج ملفهم الشخصي" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- سياسات الأمان لجدول chat_rooms
CREATE POLICY "المستخدمون يمكنهم رؤية الغرف التي يشاركون فيها" ON public.chat_rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants 
      WHERE chat_room_id = id AND user_id = auth.uid()
    )
  );

CREATE POLICY "المستخدمون يمكنهم إنشاء غرف جديدة" ON public.chat_rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- سياسات الأمان لجدول chat_participants
CREATE POLICY "المشاركون يمكنهم رؤية مشاركي الغرفة" ON public.chat_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants cp 
      WHERE cp.chat_room_id = chat_room_id AND cp.user_id = auth.uid()
    )
  );

CREATE POLICY "المستخدمون يمكنهم الانضمام للغرف" ON public.chat_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- سياسات الأمان لجدول messages
CREATE POLICY "المشاركون يمكنهم رؤية رسائل الغرفة" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_participants 
      WHERE chat_room_id = messages.chat_room_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "المشاركون يمكنهم إرسال رسائل" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.chat_participants 
      WHERE chat_room_id = messages.chat_room_id AND user_id = auth.uid()
    )
  );

-- دالة تحديث updated_at تلقائياً
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إضافة محفزات لتحديث updated_at
CREATE TRIGGER handle_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_chat_rooms_updated_at
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER handle_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- دالة إنشاء ملف شخصي تلقائياً عند التسجيل
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, user_id, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'مستخدم جديد'),
    COALESCE(NEW.raw_user_meta_data->>'user_id', 'user' || substr(NEW.id::text, 1, 8)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- محفز لإنشاء الملف الشخصي عند تسجيل مستخدم جديد
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
