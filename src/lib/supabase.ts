import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// 환경 변수 가져오기 (빌드 타임에는 기본값 사용)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';

// Lazy 초기화를 위한 클라이언트 (빌드 타임 에러 방지)
let _supabaseClient: ReturnType<typeof createSupabaseClient> | null = null;

function getSupabaseClient() {
  if (!_supabaseClient) {
    // 런타임에 환경 변수가 없으면 기본값 사용 (클라이언트 사이드에서만)
    const url = typeof window !== 'undefined' 
      ? (process.env.NEXT_PUBLIC_SUPABASE_URL || supabaseUrl)
      : (process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co');
    const key = typeof window !== 'undefined'
      ? (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || supabaseAnonKey)
      : (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key');
    
    _supabaseClient = createSupabaseClient(url, key);
  }
  return _supabaseClient;
}

// 기존 코드와의 호환성을 위한 export
export const supabase = new Proxy({} as ReturnType<typeof createSupabaseClient>, {
  get(_target, prop) {
    const client = getSupabaseClient();
    const value = (client as unknown as Record<string, unknown>)[prop as string];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

export function createClient(cookieStore: ReturnType<typeof cookies>) {
  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}

// 서비스 롤 키를 사용하는 클라이언트 생성 함수
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!url || !serviceKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  
  return createSupabaseClient(url, serviceKey);
}

export interface Magazine {
  id?: string;
  category: string;
  title: string;
  description: string;
  content: string;
  tags: string[] | null;
  image_url?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  id?: string;
  user_id: string;
  transactionKey: string;
  amount: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

