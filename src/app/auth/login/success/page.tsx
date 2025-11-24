'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginSuccessPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        // URL의 hash fragment에서 인증 정보 처리
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');

        if (accessToken && refreshToken) {
          // Supabase 세션 설정
          const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('세션 설정 오류:', sessionError);
            // 세션 설정 실패 시 로그인 페이지로 리다이렉트
            router.push('/auth/login');
            return;
          }

          if (sessionData.session) {
            // 세션이 성공적으로 설정됨
            // 메인페이지로 이동
            router.push('/magazines');
            return;
          }
        }

        // hash fragment가 없는 경우, 기존 세션 확인
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('세션 조회 오류:', error);
          router.push('/auth/login');
          return;
        }

        if (session) {
          // 세션이 이미 존재하는 경우
          router.push('/magazines');
          return;
        }

        // 세션이 없는 경우, 인증 상태 변경을 대기
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === 'SIGNED_IN' && session) {
            // 로그인 성공
            router.push('/magazines');
          } else if (event === 'SIGNED_OUT') {
            // 로그아웃
            router.push('/auth/login');
          }
        });

        // 일정 시간 후에도 세션이 없으면 로그인 페이지로 리다이렉트
        const timeout = setTimeout(() => {
          subscription.unsubscribe();
          router.push('/auth/login');
        }, 10000); // 10초 대기

        return () => {
          clearTimeout(timeout);
          subscription.unsubscribe();
        };
      } catch (error) {
        console.error('로그인 처리 오류:', error);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, [router]);

  return (
    <div className="magazine-login-container">
      <div className="magazine-login-box">
        <div className="magazine-login-icon-container">
          <div className="magazine-login-icon">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
          </div>
        </div>

        <div className="magazine-login-header">
          <h1>로그인 처리 중...</h1>
          <p className="magazine-login-subtitle">
            {isLoading ? '세션을 설정하고 있습니다. 잠시만 기다려주세요.' : '로그인 페이지로 이동합니다.'}
          </p>
        </div>

        {isLoading && (
          <div className="flex justify-center mt-8">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          </div>
        )}
      </div>
    </div>
  );
}

