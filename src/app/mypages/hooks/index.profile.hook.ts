"use client"

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export interface UserProfile {
  profileImage: string;
  nickname: string;
  email: string;
  joinDate: string;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 현재 로그인된 사용자 정보 가져오기
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error(`사용자 정보를 가져올 수 없습니다: ${userError.message}`);
      }

      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 사용자 프로필 정보 구성
      const userProfile: UserProfile = {
        profileImage: user.user_metadata?.avatar_url || user.user_metadata?.picture || '',
        nickname: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '사용자',
        email: user.email || '',
        joinDate: user.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: '2-digit'
        }).replace(/\./g, '.') : ''
      };

      setProfile(userProfile);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '프로필을 불러오는 중 오류가 발생했습니다';
      setError(errorMessage);
      console.error('Profile fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile
  };
};
