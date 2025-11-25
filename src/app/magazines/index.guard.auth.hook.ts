'use client';

import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * 로그인 액션GUARD Hook
 * 로그인 여부를 검사하고, 비로그인시 알림을 띄우고 작업을 중단합니다.
 */
export const useGuardAuth = () => {
  /**
   * 로그인 여부를 검사하고, 비로그인시 알림을 띄우고 작업을 중단합니다.
   * @param action 로그인 상태일 때 실행할 액션 함수
   * @returns guard된 액션 함수
   */
  const guardAction = useCallback(async <T extends (...args: unknown[]) => unknown>(
    action: T
  ): Promise<ReturnType<T> | void> => {
    try {
      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('인증 상태 확인 오류:', sessionError);
        alert('로그인 후 이용 가능합니다');
        return;
      }

      // 로그인 여부 확인
      if (!session?.user) {
        alert('로그인 후 이용 가능합니다');
        return;
      }

      // 로그인 상태일 때 액션 실행
      return (await action()) as ReturnType<T>;
    } catch (err) {
      console.error('Guard 인증 오류:', err);
      alert('로그인 후 이용 가능합니다');
    }
  }, []);

  /**
   * 로그인 여부를 검사하고, 비로그인시 알림을 띄우고 작업을 중단합니다.
   * 액션 함수가 없는 경우 (단순 체크만 필요한 경우)
   * @param onAuthenticated 로그인 상태일 때 실행할 콜백 함수
   */
  const checkAuthAndExecute = useCallback(async (
    onAuthenticated: () => void | Promise<void>
  ) => {
    try {
      // 현재 세션 확인
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('인증 상태 확인 오류:', sessionError);
        alert('로그인 후 이용 가능합니다');
        return;
      }

      // 로그인 여부 확인
      if (!session?.user) {
        alert('로그인 후 이용 가능합니다');
        return;
      }

      // 로그인 상태일 때 액션 실행
      await onAuthenticated();
    } catch (err) {
      console.error('Guard 인증 오류:', err);
      alert('로그인 후 이용 가능합니다');
    }
  }, []);

  return {
    guardAction,
    checkAuthAndExecute,
  };
};

