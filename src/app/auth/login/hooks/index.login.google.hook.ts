'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useGoogleLogin = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);

      // 현재 호스트를 기반으로 리다이렉트 URL 생성
      const redirectTo = `${window.location.origin}/auth/login/success`;

      // Supabase 구글 로그인 API 호출
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectTo,
        },
      });

      if (signInError) {
        throw signInError;
      }

      // signInWithOAuth는 자동으로 리다이렉트되므로 여기서 추가 작업 불필요
    } catch (err) {
      console.error('구글 로그인 오류:', err);
      setError(err instanceof Error ? err.message : '구글 로그인에 실패했습니다.');
      setLoading(false);
    }
  };

  return {
    handleGoogleLogin,
    loading,
    error,
  };
};

