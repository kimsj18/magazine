'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export const useLoginLogoutStatus = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 로그인 상태 조회
  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);

      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        setUser(session.user);
        
        // 사용자 프로필 정보 설정
        const profile: UserProfile = {
          id: session.user.id,
          email: session.user.email || '',
          name: session.user.user_metadata?.full_name || 
                session.user.user_metadata?.name || 
                session.user.email?.split('@')[0] || 
                '사용자',
          avatar_url: session.user.user_metadata?.avatar_url || 
                     session.user.user_metadata?.picture
        };
        
        setUserProfile(profile);
      } else {
        setUser(null);
        setUserProfile(null);
      }
    } catch (err) {
      console.error('인증 상태 확인 오류:', err);
      setError(err instanceof Error ? err.message : '인증 상태 확인에 실패했습니다.');
      setUser(null);
      setUserProfile(null);
    } finally {
      setLoading(false);
    }
  };

  // 로그아웃 처리
  const handleLogout = async () => {
    try {
      setError(null);
      
      const { error: signOutError } = await supabase.auth.signOut();
      
      if (signOutError) {
        throw signOutError;
      }

      // 상태 초기화
      setUser(null);
      setUserProfile(null);
      
      // 로그인 페이지로 이동
      router.push('/auth/login');
    } catch (err) {
      console.error('로그아웃 오류:', err);
      setError(err instanceof Error ? err.message : '로그아웃에 실패했습니다.');
    }
  };

  // 로그인 페이지로 이동
  const handleLogin = () => {
    router.push('/auth/login');
  };

  // 마이페이지로 이동
  const handleMyPage = () => {
    router.push('/mypages');
  };

  // 컴포넌트 마운트 시 인증 상태 확인
  useEffect(() => {
    checkAuthStatus();

    // 인증 상태 변화 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
          
          const profile: UserProfile = {
            id: session.user.id,
            email: session.user.email || '',
            name: session.user.user_metadata?.full_name || 
                  session.user.user_metadata?.name || 
                  session.user.email?.split('@')[0] || 
                  '사용자',
            avatar_url: session.user.user_metadata?.avatar_url || 
                       session.user.user_metadata?.picture
          };
          
          setUserProfile(profile);
          setLoading(false);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return {
    user,
    userProfile,
    loading,
    error,
    isLoggedIn: !!user,
    handleLogin,
    handleLogout,
    handleMyPage,
    checkAuthStatus,
  };
};
