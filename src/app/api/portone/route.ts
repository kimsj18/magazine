import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import axios from 'axios';

// 포트원 API 설정
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET || '';
const PORTONE_API_BASE = 'https://api.portone.io';

// Supabase 클라이언트 생성 함수
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase 환경 변수가 설정되지 않았습니다.');
  }
  
  return createClient(supabaseUrl, supabaseServiceKey);
}

// 타입 정의
interface WebhookPayload {
  payment_id: string;
  status: 'Paid' | 'Cancelled';
}

interface PortonePayment {
  id: string;
  amount: {
    total: number;
  };
  orderName: string;
  billingKey?: string;
  customer: {
    id: string;
  };
  customData?: string;
  scheduleId?: string;
}

interface PaymentScheduleItem {
  id: string;
  paymentId: string;
  [key: string]: unknown;
}

export async function POST(request: NextRequest) {
  try {
    // 환경 변수 검증
    if (!PORTONE_API_SECRET) {
      throw new Error('PORTONE_API_SECRET 환경 변수가 설정되지 않았습니다.');
    }
    
    const supabase = getSupabaseClient();
    
    // 1. 웹훅 페이로드 파싱
    const payload: WebhookPayload = await request.json();
    console.log('포트원 웹훅 수신:', payload);

    const paymentId = payload.payment_id;

    // 2. 포트원에서 결제 정보 조회
    console.log('결제 정보 조회 중:', paymentId);
    const paymentResponse = await fetch(`${PORTONE_API_BASE}/payments/${paymentId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `PortOne ${PORTONE_API_SECRET}`,
      },
    });

    if (!paymentResponse.ok) {
      const errorText = await paymentResponse.text();
      console.error('포트원 결제 정보 조회 실패:', errorText);
      throw new Error(`포트원 결제 정보 조회 실패: ${paymentResponse.status}`);
    }

    const paymentData: PortonePayment = await paymentResponse.json();
    console.log('결제 정보 조회 성공:', paymentData);

    // 3. 상태에 따른 처리 분기
    if (payload.status === 'Paid') {
      // === Paid 시나리오 ===
      // 3-1. 날짜 계산
      const now = new Date();
      const startAt = now.toISOString();
      
      const endAt = new Date(now);
      endAt.setDate(endAt.getDate() + 30);
      
      const endGraceAt = new Date(now);
      endGraceAt.setDate(endGraceAt.getDate() + 31);
      
      // next_schedule_at: end_at + 1일 오전 10시~11시 사이 임의 시각
      const nextScheduleAt = new Date(endAt);
      nextScheduleAt.setDate(nextScheduleAt.getDate() + 1);
      nextScheduleAt.setHours(10, Math.floor(Math.random() * 60), 0, 0); // 10시 00분 ~ 10시 59분
      
      const nextScheduleId = randomUUID();

      // 3-2. Supabase payment 테이블에 저장
      console.log('Supabase에 결제 정보 저장 중...');
      const { data: paymentRecord, error: insertError } = await supabase
        .from('payment')
        .insert({
          transaction_key: paymentId,
          amount: paymentData.amount.total,
          status: 'Paid',
          start_at: startAt,
          end_at: endAt.toISOString(),
          end_grace_at: endGraceAt.toISOString(),
          next_schedule_at: nextScheduleAt.toISOString(),
          next_schedule_id: nextScheduleId,
          user_id: paymentData.customData,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Supabase 저장 실패:', insertError);
        throw new Error(`Supabase 저장 실패: ${insertError.message}`);
      }

      console.log('Supabase 저장 성공:', paymentRecord);

      // 3-3. billingKey가 있는 경우에만 다음 달 구독 예약
      if (paymentData.billingKey) {
        console.log('다음 달 구독 예약 중...');
        
        const scheduleResponse = await fetch(
          `${PORTONE_API_BASE}/payments/${nextScheduleId}/schedule`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `PortOne ${PORTONE_API_SECRET}`,
            },
            body: JSON.stringify({
              payment: {
                billingKey: paymentData.billingKey,
                orderName: paymentData.orderName,
                customer: {
                  id: paymentData.customer.id,
                },
                amount: {
                  total: paymentData.amount.total,
                },
                customData: paymentData.customData,
                currency: 'KRW',
              },
              timeToPay: nextScheduleAt.toISOString(),
            }),
          }
        );

        if (!scheduleResponse.ok) {
          const errorText = await scheduleResponse.text();
          console.error('포트원 스케줄 등록 실패:', errorText);
          // 스케줄 등록 실패는 로그만 남기고 성공 응답 반환 (결제 저장은 성공했으므로)
        } else {
          console.log('다음 달 구독 예약 성공');
        }
      } else {
        console.log('billingKey가 없어 구독 예약을 건너뜁니다.');
      }

      // 성공 응답
      return NextResponse.json({ 
        success: true,
        message: '결제 완료 처리 완료',
        payment: paymentRecord
      });

    } else if (payload.status === 'Cancelled') {
      // === Cancelled 시나리오 ===
      // 3-1. Supabase에서 기존 결제 정보 조회
      console.log('Supabase에서 기존 결제 정보 조회 중...');
      const { data: existingPayment, error: selectError } = await supabase
        .from('payment')
        .select('*')
        .eq('transaction_key', paymentId)
        .eq('status', 'Paid')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (selectError || !existingPayment) {
        console.error('기존 결제 정보 조회 실패:', selectError);
        throw new Error('취소할 결제 정보를 찾을 수 없습니다.');
      }

      console.log('기존 결제 정보 조회 성공:', existingPayment);

      // 3-2. Supabase payment 테이블에 취소 레코드 저장
      console.log('Supabase에 취소 정보 저장 중...');
      const { data: cancelRecord, error: cancelInsertError } = await supabase
        .from('payment')
        .insert({
          transaction_key: existingPayment.transaction_key,
          amount: -existingPayment.amount, // 음수로 저장
          status: 'Cancel',
          start_at: existingPayment.start_at,
          end_at: existingPayment.end_at,
          end_grace_at: existingPayment.end_grace_at,
          next_schedule_at: existingPayment.next_schedule_at,
          next_schedule_id: existingPayment.next_schedule_id,
          user_id: existingPayment.user_id,
        })
        .select()
        .single();

      if (cancelInsertError) {
        console.error('Supabase 취소 정보 저장 실패:', cancelInsertError);
        throw new Error(`Supabase 취소 정보 저장 실패: ${cancelInsertError.message}`);
      }

      console.log('Supabase 취소 정보 저장 성공:', cancelRecord);

      // 3-3. 포트원에 다음 달 구독 예약 취소
      if (existingPayment.next_schedule_id && paymentData.billingKey) {
        console.log('다음 달 구독 예약 취소 중...');
        
        // 3-3-1. 예약된 결제정보 조회
        // next_schedule_at의 전후 1일 범위로 필터링
        const nextScheduleAt = new Date(existingPayment.next_schedule_at);
        const fromDate = new Date(nextScheduleAt);
        fromDate.setDate(fromDate.getDate() - 1);
        const untilDate = new Date(nextScheduleAt);
        untilDate.setDate(untilDate.getDate() + 1);

        console.log('예약된 결제정보 조회 중:', {
          billingKey: paymentData.billingKey,
          from: fromDate.toISOString(),
          until: untilDate.toISOString()
        });

        // axios 사용: GET + body 지원 (표준은 아니지만 포트원 API 스펙)
        try {
          const schedulesResponse = await axios.get(
            `${PORTONE_API_BASE}/payment-schedules`,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `PortOne ${PORTONE_API_SECRET}`,
              },
              data: {
                filter: {
                  billingKey: paymentData.billingKey,
                  from: fromDate.toISOString(),
                  until: untilDate.toISOString(),
                }
              }
            }
          );

          const schedulesData = schedulesResponse.data;
          console.log('예약 정보 조회 성공:', schedulesData);
          
          // 3-3-2. items를 순회하여 schedule 객체의 id 추출
          const scheduleToCancel = schedulesData.items?.find(
            (item: PaymentScheduleItem) => item.paymentId === existingPayment.next_schedule_id
          );

          if (scheduleToCancel) {
            console.log('취소할 스케줄 발견:', scheduleToCancel.id);
            
            // 3-3-3. 포트원에 다음달 구독예약 취소
            const deleteScheduleResponse = await fetch(
              `${PORTONE_API_BASE}/payment-schedules`,
              {
                method: 'DELETE',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: `PortOne ${PORTONE_API_SECRET}`,
                },
                body: JSON.stringify({
                  scheduleIds: [scheduleToCancel.id],
                }),
              }
            );

            if (!deleteScheduleResponse.ok) {
              const errorText = await deleteScheduleResponse.text();
              console.error('포트원 스케줄 취소 실패:', errorText);
              // 스케줄 취소 실패는 로그만 남기고 성공 응답 반환 (취소 저장은 성공했으므로)
            } else {
              console.log('다음 달 구독 예약 취소 성공');
            }
          } else {
            console.log('취소할 스케줄을 찾을 수 없습니다.');
          }
        } catch (error) {
          console.error('포트원 예약 정보 조회 실패:', error);
          // 조회 실패는 로그만 남기고 계속 진행
        }
      } else {
        console.log('next_schedule_id 또는 billingKey가 없어 구독 예약 취소를 건너뜁니다.');
      }

      // 성공 응답
      return NextResponse.json({ 
        success: true,
        message: '결제 취소 처리 완료',
        payment: cancelRecord
      });

    } else {
      console.log('처리하지 않는 상태:', payload.status);
      return NextResponse.json({ success: true });
    }

  } catch (error) {
    console.error('웹훅 처리 중 오류 발생:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : '알 수 없는 오류' 
      },
      { status: 500 }
    );
  }
}

