/**
 * توليد معرف فريد للمستخدم
 * يتكون من أحرف وأرقام عشوائية
 */
export const generateUserId = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * التحقق من صحة المعرف الفريد
 */
export const validateUserId = (userId: string): boolean => {
  const regex = /^[a-z0-9]{6,12}$/;
  return regex.test(userId);
};

/**
 * تنسيق المعرف الفريد للعرض
 */
export const formatUserId = (userId: string): string => {
  return `@${userId}`;
};
