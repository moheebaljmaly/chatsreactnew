/*
# [Fix Database Schema & Idempotency]
This script ensures the entire database schema is correctly set up and handles potential conflicts from previous migration attempts. It drops and recreates the user profile trigger to resolve the "trigger already exists" error.

## Query Description: This operation will reset parts of the database structure related to user profiles and chat. It first attempts to safely drop existing triggers and functions to prevent conflicts, then recreates all necessary tables, functions, and triggers. No user data (profiles, messages) will be lost if it already exists.

## Metadata:
- Schema-Category: "Structural"
- Impact-Level: "Medium"
- Requires-Backup: false
- Reversible: false

## Structure Details:
- Tables: profiles, chat_rooms, chat_participants, messages
- Functions: handle_new_user, update_updated_at_column, is_chat_participant
- Triggers: on_auth_user_created, on_profile_update, on_chat_room_update, on_participant_update, on_message_update

## Security Implications:
- RLS Status: Enabled for all tables.
- Policy Changes: Yes, policies for SELECT, INSERT, UPDATE are defined.
- Auth Requirements: Policies are based on authenticated user IDs.

## Performance Impact:
- Indexes: Added on foreign keys and frequently queried columns.
- Triggers: Used for automatic profile creation and timestamp updates.
- Estimated Impact: Low. Improves data integrity and query performance.
*/

-- 1. General purpose trigger function to update 'updated_at' columns
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

-- 2. Drop conflicting trigger and function if they exist to prevent errors
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user;

-- 3. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  user_id text NOT NULL UNIQUE,
  name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.profiles IS 'User profile information, linked to authentication.';

-- Add trigger for updated_at on profiles
DROP TRIGGER IF EXISTS on_profile_update ON public.profiles;
CREATE TRIGGER on_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Add Policies for profiles
DROP POLICY IF EXISTS "Allow authenticated users to view profiles" ON public.profiles;
CREATE POLICY "Allow authenticated users to view profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Allow users to insert their own profile" ON public.profiles;
CREATE POLICY "Allow users to insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Allow users to update their own profile" ON public.profiles;
CREATE POLICY "Allow users to update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, name, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'user_id',
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger to call the function
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Create CHAT_ROOMS table
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.chat_rooms IS 'Represents a single chat conversation.';

-- Add trigger for updated_at on chat_rooms
DROP TRIGGER IF EXISTS on_chat_room_update ON public.chat_rooms;
CREATE TRIGGER on_chat_room_update
  BEFORE UPDATE ON public.chat_rooms
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Enable RLS for chat_rooms
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;

-- 6. Create CHAT_PARTICIPANTS table
CREATE TABLE IF NOT EXISTS public.chat_participants (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    chat_room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(chat_room_id, user_id)
);
COMMENT ON TABLE public.chat_participants IS 'Links users to chat rooms.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants(user_id);

-- Add trigger for updated_at on chat_participants
DROP TRIGGER IF EXISTS on_participant_update ON public.chat_participants;
CREATE TRIGGER on_participant_update
  BEFORE UPDATE ON public.chat_participants
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Enable RLS for chat_participants
ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- 7. Create MESSAGES table
CREATE TABLE IF NOT EXISTS public.messages (
    id bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    chat_room_id uuid NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    content text NOT NULL,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
COMMENT ON TABLE public.messages IS 'Stores individual chat messages.';

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_messages_chat_room_id ON public.messages(chat_room_id);

-- Add trigger for updated_at on messages
DROP TRIGGER IF EXISTS on_message_update ON public.messages;
CREATE TRIGGER on_message_update
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE PROCEDURE public.update_updated_at_column();

-- Enable RLS for messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 8. Policies for chat tables
-- Helper function to check if a user is a participant in a chat room
CREATE OR REPLACE FUNCTION public.is_chat_participant(p_chat_room_id uuid, p_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.chat_participants
    WHERE chat_room_id = p_chat_room_id AND user_id = p_user_id
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Policies for chat_rooms
DROP POLICY IF EXISTS "Allow participants to see their chat rooms" ON public.chat_rooms;
CREATE POLICY "Allow participants to see their chat rooms" ON public.chat_rooms
  FOR SELECT USING (public.is_chat_participant(id, auth.uid()));

DROP POLICY IF EXISTS "Allow authenticated users to create chat rooms" ON public.chat_rooms;
CREATE POLICY "Allow authenticated users to create chat rooms" ON public.chat_rooms
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for chat_participants
DROP POLICY IF EXISTS "Allow participants to see their own participation" ON public.chat_participants;
CREATE POLICY "Allow participants to see their own participation" ON public.chat_participants
  FOR SELECT USING (public.is_chat_participant(chat_room_id, auth.uid()));

DROP POLICY IF EXISTS "Allow users to be added to chats" ON public.chat_participants;
CREATE POLICY "Allow users to be added to chats" ON public.chat_participants
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policies for messages
DROP POLICY IF EXISTS "Allow participants to see messages in their chats" ON public.messages;
CREATE POLICY "Allow participants to see messages in their chats" ON public.messages
  FOR SELECT USING (public.is_chat_participant(chat_room_id, auth.uid()));

DROP POLICY IF EXISTS "Allow participants to send messages in their chats" ON public.messages;
CREATE POLICY "Allow participants to send messages in their chats" ON public.messages
  FOR INSERT WITH CHECK (public.is_chat_participant(chat_room_id, auth.uid()) AND auth.uid() = user_id);

-- 9. Enable realtime on messages table
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime;
COMMIT;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
