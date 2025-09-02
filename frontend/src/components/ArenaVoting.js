import React, { useState, useCallback, useMemo } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faChevronLeft,
  faChevronRight,
  faEquals,
  faVoteYea,
  faCheckCircle,
  faSpinner,
  faTrophy,
  faThumbsUp,
  faHandshake,
  faLightbulb,
  faBalanceScale,
  faAward,
  faHeart,
  faStar
} from '@fortawesome/free-solid-svg-icons';
import './ArenaVoting.css';

const ArenaVoting = React.memo(({ 
  onVote, 
  leftModel, 
  rightModel, 
  voted = false,
  voteChoice = null,
  disabled = false, 
  votingTips = [], 
  voteOptions = null 
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [hoveredVote, setHoveredVote] = useState(null);
  const [selectedVote, setSelectedVote] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Handle vote selection with confirmation
  const handleVoteSelect = useCallback((winner) => {
    if (disabled || isVoting) return;
    
    setSelectedVote(winner);
    setShowConfirmation(true);
  }, [disabled, isVoting]);

  // Confirm and submit vote
  const confirmVote = useCallback(async () => {
    if (!selectedVote || disabled || isVoting) return;

    setIsVoting(true);
    setShowConfirmation(false);
    
    try {
      await onVote(selectedVote);
    } catch (error) {
      console.error('Voting failed:', error);
      setSelectedVote(null);
    } finally {
      setIsVoting(false);
    }
  }, [selectedVote, onVote, disabled, isVoting]);

  // Cancel vote selection
  const cancelVote = useCallback(() => {
    setSelectedVote(null);
    setShowConfirmation(false);
  }, []);

  // Memoized model name formatter
  const getModelDisplayName = useCallback((model) => {
    if (!model) return 'Unknown Model';
    return model.name || model.model_id || 'Unknown Model';
  }, []);

  // Hover event handlers
  const handleVoteHover = useCallback((voteId) => {
    if (!disabled && !isVoting && !showConfirmation) {
      setHoveredVote(voteId);
    }
  }, [disabled, isVoting, showConfirmation]);

  const handleVoteLeave = useCallback(() => {
    setHoveredVote(null);
  }, []);

  // Enhanced vote options with better icons and descriptions
  const enhancedVoteOptions = useMemo(() => {
    if (voteOptions) return voteOptions;
    
    return [
      {
        id: 'left',
        icon: faThumbsUp,
        label: '왼쪽이 더 좋음',
        modelName: getModelDisplayName(leftModel),
        className: 'vote-left',
        color: '#3b82f6',
        description: '정확성, 유용성, 창의성에서 왼쪽 모델이 우수',
        shortName: 'A',
        emoji: '👍'
      },
      {
        id: 'tie',
        icon: faHandshake,
        label: '비슷하거나 동등',
        modelName: '동점',
        className: 'vote-tie',
        color: '#6b7280',
        description: '두 모델의 답변 품질이 비슷함',
        shortName: '=',
        emoji: '🤝'
      },
      {
        id: 'right',
        icon: faAward,
        label: '오른쪽이 더 좋음',
        modelName: getModelDisplayName(rightModel),
        className: 'vote-right',
        color: '#10b981',
        description: '정확성, 유용성, 창의성에서 오른쪽 모델이 우수',
        shortName: 'B',
        emoji: '🏆'
      }
    ];
  }, [voteOptions, leftModel, rightModel, getModelDisplayName]);

  // Enhanced voting tips
  const enhancedVotingTips = useMemo(() => {
    if (votingTips.length > 0) return votingTips;
    
    return [
      {
        icon: faLightbulb,
        text: '정확성, 유용성, 창의성을 고려하여 평가해주세요'
      },
      {
        icon: faBalanceScale,
        text: '공정한 비교를 위해 모델 이름을 보지 말고 내용만 보고 판단해주세요'
      },
      {
        icon: faHeart,
        text: '여러분의 피드백이 AI 모델 개선에 도움이 됩니다'
      }
    ];
  }, [votingTips]);

  // If already voted, show results
  if (voted && voteChoice) {
    const selectedOption = enhancedVoteOptions.find(opt => opt.id === voteChoice);
    return (
      <section className="arena-voting voted" role="group" aria-label="투표 완료">
        <div className="vote-completed">
          <div className="completion-header">
            <div className="completion-icon-wrapper">
              <FontAwesomeIcon icon={faCheckCircle} className="completion-icon" />
              <div className="completion-pulse"></div>
            </div>
            <div className="completion-content">
              <h3>투표가 완료되었습니다!</h3>
              <p>소중한 피드백을 주셔서 감사합니다.</p>
            </div>
          </div>
          
          <div className="selected-vote-result">
            <div className="result-label">선택한 답변:</div>
            <div className="result-option">
              <div className="result-visual">
                <span className="result-emoji">{selectedOption?.emoji}</span>
                <div className="result-icon-wrapper" style={{ '--vote-color': selectedOption?.color }}>
                  <FontAwesomeIcon icon={selectedOption?.icon || faCheckCircle} className="result-icon" />
                </div>
              </div>
              <div className="result-details">
                <div className="result-choice">{selectedOption?.label}</div>
                <div className="result-model">{selectedOption?.modelName}</div>
              </div>
              <div className="result-badge">
                <FontAwesomeIcon icon={faTrophy} />
              </div>
            </div>
          </div>
          
          <div className="vote-appreciation">
            <FontAwesomeIcon icon={faHeart} className="appreciation-icon" />
            <span>여러분의 피드백이 AI 모델 개선에 도움이 됩니다</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="arena-voting" role="group" aria-label="모델 응답 평가">
      {!showConfirmation ? (
        <>
          <header className="voting-header">
            <div className="voting-title">
              <div className="title-icon-wrapper">
                <FontAwesomeIcon icon={faVoteYea} className="voting-icon" aria-hidden="true" />
                <div className="icon-pulse"></div>
              </div>
              <div className="title-content">
                <h3>어떤 답변이 더 나은가요?</h3>
                <p className="voting-subtitle">
                  두 AI 모델의 답변을 비교하고 더 나은 답변을 선택해주세요
                </p>
              </div>
            </div>
            
            <div className="voting-progress">
              <div className="progress-steps">
                <div className="step active">
                  <span className="step-number">1</span>
                  <span className="step-label">답변 비교</span>
                </div>
                <div className="step">
                  <span className="step-number">2</span>
                  <span className="step-label">선택 확인</span>
                </div>
                <div className="step">
                  <span className="step-number">3</span>
                  <span className="step-label">완료</span>
                </div>
              </div>
            </div>
          </header>

          <div className="voting-options" role="radiogroup" aria-label="투표 옵션 선택">
            {enhancedVoteOptions.map((option) => (
              <button
                key={option.id}
                className={`vote-button ${option.className} ${
                  hoveredVote === option.id ? 'hovered' : ''
                } ${
                  selectedVote === option.id ? 'selected' : ''
                }`}
                onClick={() => handleVoteSelect(option.id)}
                onMouseEnter={() => handleVoteHover(option.id)}
                onMouseLeave={handleVoteLeave}
                disabled={disabled || isVoting}
                aria-label={`${option.label} - ${option.modelName}: ${option.description}`}
                role="radio"
                aria-checked={selectedVote === option.id}
                tabIndex={selectedVote === option.id ? 0 : -1}
              >
                <div className="vote-button-inner">
                  <div className="vote-visual">
                    <div className="vote-emoji" aria-hidden="true">
                      {option.emoji}
                    </div>
                    <div className="vote-icon-wrapper" style={{ '--vote-color': option.color }}>
                      {isVoting && selectedVote === option.id ? (
                        <FontAwesomeIcon icon={faSpinner} spin className="vote-loading" />
                      ) : (
                        <FontAwesomeIcon icon={option.icon} className="vote-icon" />
                      )}
                    </div>
                  </div>
                  
                  <div className="vote-content">
                    <div className="vote-header">
                      <div className="vote-label">{option.label}</div>
                      <div className="vote-badge">{option.shortName}</div>
                    </div>
                    <div className="vote-model-name">{option.modelName}</div>
                    <div className="vote-description">{option.description}</div>
                  </div>

                  <div className="vote-indicator" aria-hidden="true">
                    {selectedVote === option.id && (
                      <FontAwesomeIcon icon={faCheckCircle} className="selected-icon" />
                    )}
                  </div>
                </div>

                <div className="vote-ripple"></div>
                <div className="vote-glow"></div>
              </button>
            ))}
          </div>

          <footer className="voting-footer">
            <div className="voting-tips" role="group" aria-label="투표 가이드">
              <h4 className="tips-title">평가 가이드</h4>
              <div className="tips-grid">
                {enhancedVotingTips.map((tip, index) => (
                  <div key={index} className="tip-item">
                    <div className="tip-icon-wrapper">
                      <FontAwesomeIcon icon={tip.icon} className="tip-icon" aria-hidden="true" />
                    </div>
                    <span className="tip-text">{tip.text}</span>
                  </div>
                ))}
              </div>
            </div>

            {disabled && (
              <div className="voting-disabled-notice" role="alert">
                <FontAwesomeIcon icon={faCheckCircle} className="disabled-icon" aria-hidden="true" />
                <span>오류가 발생한 응답에는 투표할 수 없습니다</span>
              </div>
            )}

            {selectedVote && (
              <div className="voting-selection-info">
                <div className="selection-summary">
                  <FontAwesomeIcon icon={faStar} className="selection-icon" />
                  <span>
                    선택됨: <strong>{enhancedVoteOptions.find(opt => opt.id === selectedVote)?.label}</strong>
                  </span>
                </div>
                <div className="selection-actions">
                  <button 
                    className="cancel-btn"
                    onClick={cancelVote}
                    aria-label="선택 취소"
                  >
                    취소
                  </button>
                  <button 
                    className="confirm-btn"
                    onClick={() => setShowConfirmation(true)}
                    aria-label="선택 확인"
                  >
                    확인
                  </button>
                </div>
              </div>
            )}
          </footer>
        </>
      ) : (
        <div className="vote-confirmation-dialog" role="dialog" aria-label="투표 확인">
          <div className="confirmation-content">
            <div className="confirmation-header">
              <FontAwesomeIcon icon={faCheckCircle} className="confirmation-icon" />
              <h3>투표를 확인하시겠습니까?</h3>
            </div>
            
            <div className="confirmation-choice">
              {selectedVote && (
                <div className="selected-option">
                  <div className="option-visual">
                    {enhancedVoteOptions.find(opt => opt.id === selectedVote)?.emoji}
                  </div>
                  <div className="option-details">
                    <div className="option-label">
                      {enhancedVoteOptions.find(opt => opt.id === selectedVote)?.label}
                    </div>
                    <div className="option-model">
                      {enhancedVoteOptions.find(opt => opt.id === selectedVote)?.modelName}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="confirmation-actions">
              <button 
                className="cancel-btn"
                onClick={cancelVote}
                disabled={isVoting}
                aria-label="투표 취소"
              >
                취소
              </button>
              <button 
                className="submit-vote-btn"
                onClick={confirmVote}
                disabled={isVoting}
                aria-label="투표 제출"
              >
                {isVoting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} spin />
                    제출 중...
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faVoteYea} />
                    투표 제출
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
});

// Display name for debugging
ArenaVoting.displayName = 'ArenaVoting';

export default ArenaVoting;