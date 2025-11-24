import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase";
import { cookies } from "next/headers";

/**
 * POST /api/payments
 * PortOne v2를 사용한 빌링키 기반 정기결제 API
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { billingKey, orderName, amount, customer, customData } = body;

    // 1-1. 필수 데이터 검증
    if (!billingKey || !orderName || !amount || !customer?.id || !customData) {
      return NextResponse.json(
        { success: false, error: "필수 데이터가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 2. 인가 - 로그인된 사용자 확인 (가장 간단한 방식)
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "인증되지 않은 사용자입니다." },
        { status: 401 }
      );
    }

    // 3. 결제 가능 여부 검증 - 인가된 user_id === customData
    if (user.id !== customData) {
      return NextResponse.json(
        { success: false, error: "결제 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 4. 환경 변수 확인
    const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
    if (!PORTONE_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "PORTONE_API_SECRET이 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 5. 고유한 paymentId 생성 (타임스탬프 + 랜덤)
    const paymentId = `payment_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 9)}`;

    // 6. PortOne API로 빌링키 결제 요청
    const paymentResponse = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(
        paymentId
      )}/billing-key`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${PORTONE_API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          billingKey,
          orderName,
          customer: {
            id: customer.id,
          },
          amount: {
            total: amount,
          },
          customData: customData,
          currency: "KRW",
        }),
      }
    );

    // 7. PortOne 응답 확인
    const paymentResult = await paymentResponse.json();

    if (!paymentResponse.ok) {
      console.error("PortOne 결제 실패:", paymentResult);
      return NextResponse.json(
        {
          success: false,
          error: "결제 처리 중 오류가 발생했습니다.",
          details: paymentResult,
        },
        { status: paymentResponse.status }
      );
    }

    // 8. 성공 응답 반환 (DB에 저장하지 않음)
    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("API 처리 중 오류:", error);
    return NextResponse.json(
      {
        success: false,
        error: "서버 오류가 발생했습니다.",
      },
      { status: 500 }
    );
  }
}

