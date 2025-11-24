import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Payment 테이블 타입 정의
 */
interface Payment {
  id: number;
  user_id: string;
  transaction_key: string;
  amount: number;
  status: "Paid" | "Cancel";
  start_at: string;
  end_at: string;
  end_grace_at: string;
  next_schedule_at: string;
  next_schedule_id: string;
  created_at: string;
}

/**
 * 결제 상태 조회 결과 타입
 */
export interface PaymentStatus {
  isSubscribed: boolean;
  statusMessage: "구독중" | "Free";
  transactionKey?: string;
}

/**
 * 결제 상태 조회 Hook
 * payment 테이블에서 활성 구독 상태를 조회합니다.
 */
export function usePaymentStatus() {
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>({
    isSubscribed: false,
    statusMessage: "Free",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 결제 상태 조회 함수
   */
  const fetchPaymentStatus = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // 1-1. 로그인된 사용자 정보 확인
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        throw new Error(`사용자 정보를 가져올 수 없습니다: ${userError.message}`);
      }

      if (!user) {
        throw new Error('로그인이 필요합니다');
      }

      // 1-2. payment 테이블에서 내 결제 정보만 필터링하여 조회
      const { data: payments, error: fetchError } = await supabase
        .from("payment")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw new Error(`데이터 조회 실패: ${fetchError.message}`);
      }

      if (!payments || payments.length === 0) {
        // 결제 내역이 없는 경우
        setPaymentStatus({
          isSubscribed: false,
          statusMessage: "Free",
        });
        return;
      }

      // 2. transaction_key로 그룹화하고 각 그룹에서 created_at 최신 1건씩 추출
      const groupedByTransactionKey = (payments as Payment[]).reduce<Record<string, Payment>>(
        (acc: Record<string, Payment>, payment: Payment) => {
          const key = payment.transaction_key;
          if (!acc[key] || new Date(payment.created_at) > new Date(acc[key].created_at)) {
            acc[key] = payment;
          }
          return acc;
        },
        {}
      );

      // 3. 그룹화된 결과를 배열로 변환
      const latestPayments: Payment[] = Object.values(groupedByTransactionKey);

      // 4. 현재 시각 계산
      const now = new Date();

      // 5. 조회 조건 적용: status === "Paid" && start_at <= 현재시각 <= end_grace_at
      const activeSubscriptions: Payment[] = latestPayments.filter((payment) => {
        if (payment.status !== "Paid") {
          return false;
        }

        const startAt = new Date(payment.start_at);
        const endGraceAt = new Date(payment.end_grace_at);

        return startAt <= now && now <= endGraceAt;
      });

      // 6. 조회 결과에 따른 상태 설정
      if (activeSubscriptions.length > 0) {
        // 조회 결과 1건 이상: 구독중
        const firstSubscription = activeSubscriptions[0] as Payment;
        setPaymentStatus({
          isSubscribed: true,
          statusMessage: "구독중",
          transactionKey: firstSubscription.transaction_key,
        });
      } else {
        // 조회 결과 0건: Free
        setPaymentStatus({
          isSubscribed: false,
          statusMessage: "Free",
        });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("결제 상태 조회 오류:", err);
    } finally {
      setIsLoading(false);
    }
  };

  // 컴포넌트 마운트 시 결제 상태 조회
  useEffect(() => {
    fetchPaymentStatus();
  }, []);

  return {
    paymentStatus,
    isLoading,
    error,
    refetch: fetchPaymentStatus,
  };
}

