import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";

/**
 * POST /api/payments/cancel
 * PortOne v2를 사용한 결제 취소 API
 */
export async function POST(request: NextRequest) {
  try {
    // 1. 요청 데이터 파싱
    const body = await request.json();
    const { transactionKey } = body;

    // 1-1. 필수 데이터 검증
    if (!transactionKey) {
      return NextResponse.json(
        { success: false, error: "transactionKey가 누락되었습니다." },
        { status: 400 }
      );
    }

    // 1-2. 환경 변수 확인
    const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET;
    if (!PORTONE_API_SECRET) {
      return NextResponse.json(
        { success: false, error: "PORTONE_API_SECRET이 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 2. 인가 - API 요청자 검증 (Authorization 헤더 방식)
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: "인증 토큰이 필요합니다." },
        { status: 401 }
      );
    }

    const accessToken = authHeader.replace('Bearer ', '');

    // 2-1. Supabase 클라이언트 생성 및 사용자 인증 확인
    const supabase = createServiceClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    
    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "유효하지 않은 인증 정보입니다." },
        { status: 401 }
      );
    }

    // 3. 취소 가능 여부 검증
    // 3-1. payment 테이블 목록 조회
    const { data: payments, error: paymentError } = await supabase
      .from('payment')
      .select('*')
      .eq('user_id', user.id)
      .eq('transactionKey', transactionKey);

    if (paymentError) {
      console.error("Payment 조회 오류:", paymentError);
      return NextResponse.json(
        { success: false, error: "결제 정보 조회 중 오류가 발생했습니다." },
        { status: 500 }
      );
    }

    // 3-2. 조회 결과 없는 경우, 에러 처리
    if (!payments || payments.length === 0) {
      return NextResponse.json(
        { success: false, error: "취소할 수 있는 결제 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 4. PortOne API로 결제 취소 요청
    console.log("결제 취소 요청:", transactionKey);
    const cancelResponse = await fetch(
      `https://api.portone.io/payments/${transactionKey}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `PortOne ${PORTONE_API_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reason: "취소 사유 없음",
        }),
      }
    );

    // 5. PortOne 응답 확인
    const cancelResult = await cancelResponse.json();

    if (!cancelResponse.ok) {
      console.error("PortOne 결제 취소 실패:", cancelResult);
      return NextResponse.json(
        {
          success: false,
          error: "결제 취소 처리 중 오류가 발생했습니다.",
          details: cancelResult,
        },
        { status: cancelResponse.status }
      );
    }

    console.log("결제 취소 성공:", cancelResult);

    // 6. 성공 응답 반환 (DB에 저장하지 않음)
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

