import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

declare global {
  interface Window {
    PortOne?: {
      requestIssueBillingKey: (params: {
        storeId: string;
        channelKey: string;
        billingKeyMethod: string;
      }) => Promise<{
        code?: string;
        message?: string;
        billingKey?: string;
      }>;
    };
  }
}

export const usePayment = () => {
  const router = useRouter();

  /**
   * 빌링키 발급 및 구독 결제 처리
   */
  const handleSubscribe = async () => {
    try {
      // 1. 로그인된 사용자 확인
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError || !user) {
        alert("로그인이 필요합니다. 로그인 페이지로 이동합니다.");
        router.push("/auth/login");
        return;
      }

      // 2. 환경 변수 확인
      const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID;
      const channelKey = process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY;

      if (!storeId || !channelKey) {
        alert("포트원 설정이 누락되었습니다. 환경 변수를 확인해주세요.");
        return;
      }

      // 3. PortOne SDK 확인
      if (!window.PortOne) {
        alert("포트원 SDK가 로드되지 않았습니다.");
        return;
      }

      // 4. 빌링키 발급 요청
      const issueResponse = await window.PortOne.requestIssueBillingKey({
        storeId,
        channelKey,
        billingKeyMethod: "CARD",
      });

      // 5. 빌링키 발급 실패 처리
      if (issueResponse.code || !issueResponse.billingKey) {
        alert(
          `빌링키 발급에 실패했습니다: ${
            issueResponse.message || "알 수 없는 오류"
          }`
        );
        return;
      }

      // 6. 액세스 토큰 가져오기 (서버 사이드 인증용)
      const { data: { session } } = await supabase.auth.getSession();
      const accessToken = session?.access_token;

      // 7. 빌링키로 결제 API 요청
      console.log("결제 API 요청 시작:", {
        billingKey: issueResponse.billingKey,
        userId: user.id,
        hasToken: !!accessToken,
      });

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // 액세스 토큰이 있으면 헤더에 추가
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const paymentApiResponse = await fetch("/api/payments", {
        method: "POST",
        headers,
        body: JSON.stringify({
          billingKey: issueResponse.billingKey,
          orderName: "IT 매거진 월간 구독",
          amount: 9900,
          customer: {
            id: user.id,
          },
          customData: user.id, // 로그인된 user_id
        }),
      });

      const paymentResult = await paymentApiResponse.json();
      console.log("결제 API 응답:", paymentResult);

      // 7. HTTP 상태 코드 확인
      if (!paymentApiResponse.ok) {
        console.error("결제 API HTTP 오류:", paymentApiResponse.status, paymentResult);
        alert(
          `결제에 실패했습니다: ${
            paymentResult.error || `HTTP ${paymentApiResponse.status} 오류`
          }`
        );
        return;
      }

      // 8. 결제 실패 처리
      if (!paymentResult.success) {
        console.error("결제 실패:", paymentResult);
        alert(
          `결제에 실패했습니다: ${
            paymentResult.error || "알 수 없는 오류"
          }`
        );
        return;
      }

      // 9. 결제 성공 처리
      console.log("결제 성공:", paymentResult);
      alert("구독에 성공하였습니다.");
      router.push("/magazines");
    } catch (error) {
      console.error("구독 처리 중 오류:", error);
      alert("구독 처리 중 오류가 발생했습니다.");
    }
  };

  return {
    handleSubscribe,
  };
};

