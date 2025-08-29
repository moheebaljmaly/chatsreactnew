/*
          # [Operation Name] Fix Function Search Path
          [This script hardens the security of existing database functions by explicitly setting their `search_path`. This mitigates a security warning where a function's execution could be hijacked by malicious schemas if the search path is mutable.]

          ## Query Description: [This operation will safely drop and recreate three functions: `handle_new_user`, `update_updated_at_column`, and `update_chat_room_updated_at`. By adding `SET search_path = public` to each function, we ensure they always execute in the expected schema context, preventing potential hijacking attacks. No data will be lost, and this change is fully reversible by redeploying the previous migration version.]
          
          ## Metadata:
          - Schema-Category: "Security"
          - Impact-Level: "Low"
          - Requires-Backup: false
          - Reversible: true
          
          ## Structure Details:
          - Functions being modified:
            - `public.handle_new_user()`
            - `public.update_updated_at_column()`
            - `public.update_chat_room_updated_at()`
          
          ## Security Implications:
          - RLS Status: [Enabled]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          - Fixes "Function Search Path Mutable" warning.
          
          ## Performance Impact:
          - Indexes: [No change]
          - Triggers: [No change]
          - Estimated Impact: [Negligible. Function performance remains the same.]
          */

-- Drop and recreate the handle_new_user function with a fixed search_path
DROP FUNCTION IF EXISTS public.handle_new_user();
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  SET search_path = public;
  INSERT INTO public.profiles (id, name, user_id, email, avatar_url)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'user_id',
    new.email,
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$;

-- Drop and recreate the update_updated_at_column function with a fixed search_path
DROP FUNCTION IF EXISTS public.update_updated_at_column();
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    SET search_path = public;
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Drop and recreate the update_chat_room_updated_at function with a fixed search_path
DROP FUNCTION IF EXISTS public.update_chat_room_updated_at();
CREATE OR REPLACE FUNCTION public.update_chat_room_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  SET search_path = public;
  UPDATE chat_rooms
  SET updated_at = NOW()
  WHERE id = NEW.chat_room_id;
  RETURN NEW;
END;
$$;

-- Re-assign the trigger for creating a new user profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
