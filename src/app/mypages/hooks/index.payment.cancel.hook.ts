import { useRouter } from "next/navigation";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * 구독 취소 Hook
 * 포트원 v2 결제 취소 API를 호출하고 결과를 처리합니다.
 */
export function usePaymentCancel() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 구독 취소 함수
   * @param transactionKey - 포트원 거래 키
   */
  const cancelPayment = async (transactionKey: string) => {
    try {
      setIsLoading(true);
      setError(null);

      // 0. 인증 토큰 가져오기
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error("인증이 필요합니다. 다시 로그인해주세요.");
      }

      // 1. 구독 취소 API 호출
      const response = await fetch("/api/payments/cancel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          transactionKey,
        }),
      });

      const data = await response.json();

      // 2. 응답 처리
      if (!data.success) {
        throw new Error(data.error || "구독 취소에 실패했습니다.");
      }

      // 3. 성공 시 처리
      alert("구독이 취소되었습니다.");
      router.push("/magazines");
      
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다.";
      setError(errorMessage);
      console.error("구독 취소 오류:", err);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  return {
    cancelPayment,
    isLoading,
    error,
  };
}

