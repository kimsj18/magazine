"use client"

import { useRouter } from "next/navigation";
import { usePaymentCancel } from "./hooks/index.payment.cancel.hook";
import { usePaymentStatus } from "./hooks/index.payment.status.hook";
import { useProfile } from "./hooks/index.profile.hook";

function GlossaryMagazinesMypage() {
  const router = useRouter();
  const { cancelPayment, isLoading } = usePaymentCancel();
  const { paymentStatus, isLoading: isStatusLoading, error, refetch } = usePaymentStatus();
  const { profile, isLoading: isProfileLoading, error: profileError } = useProfile();

  const handleBackToList = () => {
    router.push('/magazines');
  };

  const handleSubscribe = () => {
    // 구독하기 버튼 클릭 시 결제 페이지로 이동
    router.push('/payments');
  };

  const handleCancelSubscription = async () => {
    if (!confirm("구독을 취소하시겠습니까?")) {
      return;
    }

    // transactionKey가 없는 경우 처리
    if (!paymentStatus.transactionKey) {
      alert("결제 정보를 찾을 수 없습니다.");
      return;
    }

    // 포트원 결제 취소 API 호출
    const result = await cancelPayment(paymentStatus.transactionKey);
    
    // 성공 시 결제 상태 다시 조회
    if (result.success) {
      refetch();
    } else if (result.error) {
      alert(`구독 취소 실패: ${result.error}`);
    }
  };

  const isSubscribed = paymentStatus.isSubscribed;

  return (
    <div className="mypage-wrapper">
      <button className="mypage-back-btn" onClick={handleBackToList}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12.5 15L7.5 10L12.5 5" />
        </svg>
        목록으로
      </button>

      <div className="mypage-header">
        <h1>IT 매거진 구독</h1>
        <p className="mypage-header-desc">프리미엄 콘텐츠를 제한 없이 이용하세요</p>
      </div>

      <div className="mypage-grid">
        {/* 프로필 카드 */}
        <div className="mypage-profile-card">
          {isProfileLoading ? (
            <div className="mypage-profile-loading" style={{ padding: '2rem', textAlign: 'center' }}>
              프로필을 불러오는 중...
            </div>
          ) : profileError ? (
            <div className="mypage-profile-error" style={{ color: 'red', padding: '1rem' }}>
              프로필 오류: {profileError}
            </div>
          ) : profile ? (
            <>
              {profile.profileImage ? (
                <img 
                  src={profile.profileImage} 
                  alt={profile.nickname}
                  className="mypage-avatar"
                />
              ) : (
                <div className="mypage-avatar-placeholder">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                  </svg>
                </div>
              )}
              <h2 className="mypage-name">{profile.nickname}</h2>
              <p className="mypage-bio-text">{profile.email}</p>
              <div className="mypage-join-date">가입일 {profile.joinDate}</div>
            </>
          ) : (
            <div className="mypage-profile-empty" style={{ padding: '2rem', textAlign: 'center' }}>
              프로필 정보를 찾을 수 없습니다
            </div>
          )}
        </div>

        {/* 구독 플랜 카드 */}
        <div className={`mypage-subscription-card ${isSubscribed ? 'active' : ''}`}>
          <div className="mypage-subscription-header">
            <h3 className="mypage-card-title">구독 플랜</h3>
            {isStatusLoading ? (
              <span className="mypage-badge-active">로딩중...</span>
            ) : isSubscribed ? (
              <span className="mypage-badge-active">{paymentStatus.statusMessage}</span>
            ) : null}
          </div>

          {error && (
            <div className="mypage-error-message" style={{ color: 'red', padding: '1rem' }}>
              오류: {error}
            </div>
          )}

          {isStatusLoading ? (
            <div className="mypage-subscription-loading" style={{ padding: '2rem', textAlign: 'center' }}>
              결제 상태를 확인하는 중...
            </div>
          ) : isSubscribed ? (
            <div className="mypage-subscription-active">
              <div className="mypage-plan-name">IT Magazine Premium</div>
              <div className="mypage-plan-features">
                <div className="mypage-feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.3337 4L6.00033 11.3333L2.66699 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>모든 프리미엄 콘텐츠 무제한 이용</span>
                </div>
                <div className="mypage-feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.3337 4L6.00033 11.3333L2.66699 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>매주 새로운 IT 트렌드 리포트</span>
                </div>
                <div className="mypage-feature-item">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M13.3337 4L6.00033 11.3333L2.66699 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span>광고 없는 깔끔한 읽기 환경</span>
                </div>
              </div>
              <button 
                className="mypage-cancel-btn"
                onClick={handleCancelSubscription}
                disabled={isLoading}
              >
                {isLoading ? "처리중..." : "구독 취소"}
              </button>
            </div>
          ) : (
            <div className="mypage-subscription-inactive">
              <div className="mypage-unsubscribed-message">
                구독하고 프리미엄 콘텐츠를 즐겨보세요
              </div>
              <div className="mypage-plan-preview">
                <div className="mypage-preview-item">✓ 모든 프리미엄 콘텐츠</div>
                <div className="mypage-preview-item">✓ 매주 트렌드 리포트</div>
                <div className="mypage-preview-item">✓ 광고 없는 환경</div>
              </div>
              <button 
                className="mypage-subscribe-btn"
                onClick={handleSubscribe}
              >
                지금 구독하기
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlossaryMagazinesMypage;
