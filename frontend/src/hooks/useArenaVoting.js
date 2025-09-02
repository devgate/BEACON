import { useState, useCallback, useMemo } from 'react';

/**
 * Custom hook for handling Arena voting functionality
 * Manages voting state, validation, and user interactions
 */
export const useArenaVoting = ({ 
  currentComparison,
  onVote,
  disabled = false 
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [hoveredVote, setHoveredVote] = useState(null);
  const [voteError, setVoteError] = useState(null);

  /**
   * Handle vote submission with error handling
   */
  const handleVote = useCallback(async (winner) => {
    if (disabled || isVoting || !currentComparison) return;

    setIsVoting(true);
    setVoteError(null);
    
    try {
      await onVote(winner);
    } catch (error) {
      console.error('Voting failed:', error);
      setVoteError('투표 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsVoting(false);
    }
  }, [disabled, isVoting, currentComparison, onVote]);

  /**
   * Handle vote hover state
   */
  const handleVoteHover = useCallback((voteId) => {
    if (!disabled && !isVoting) {
      setHoveredVote(voteId);
    }
  }, [disabled, isVoting]);

  /**
   * Handle vote hover leave
   */
  const handleVoteLeave = useCallback(() => {
    setHoveredVote(null);
  }, []);

  /**
   * Clear vote error
   */
  const clearVoteError = useCallback(() => {
    setVoteError(null);
  }, []);

  /**
   * Check if voting is available
   */
  const canVote = useMemo(() => {
    return currentComparison && 
           !currentComparison.voted && 
           !disabled && 
           !isVoting && 
           !currentComparison.error;
  }, [currentComparison, disabled, isVoting]);

  /**
   * Get voting button state for a specific option
   */
  const getButtonState = useCallback((voteId) => {
    return {
      isHovered: hoveredVote === voteId,
      isDisabled: disabled || isVoting || !canVote,
      isLoading: isVoting,
      isSelected: currentComparison?.voteChoice === voteId
    };
  }, [hoveredVote, disabled, isVoting, canVote, currentComparison]);

  /**
   * Get vote options with model information
   */
  const getVoteOptions = useCallback((leftModel, rightModel) => {
    const getModelDisplayName = (model) => {
      if (!model) return 'Unknown Model';
      return model.name || model.model_id || 'Unknown Model';
    };

    return [
      {
        id: 'left',
        label: '왼쪽이 더 좋음',
        modelName: getModelDisplayName(leftModel),
        shortName: 'Model A',
        className: 'vote-left',
        color: '#3b82f6',
        ariaLabel: `왼쪽 모델 선택: ${getModelDisplayName(leftModel)}`
      },
      {
        id: 'tie',
        label: '비슷함',
        modelName: '동점',
        shortName: 'Tie',
        className: 'vote-tie',
        color: '#6b7280',
        ariaLabel: '동점으로 선택'
      },
      {
        id: 'right',
        label: '오른쪽이 더 좋음',
        modelName: getModelDisplayName(rightModel),
        shortName: 'Model B',
        className: 'vote-right',
        color: '#10b981',
        ariaLabel: `오른쪽 모델 선택: ${getModelDisplayName(rightModel)}`
      }
    ];
  }, []);

  /**
   * Get voting statistics if available
   */
  const getVotingStats = useCallback(() => {
    // TODO: Implement when backend provides statistics
    return null;
  }, []);

  /**
   * Generate voting tips based on current comparison
   */
  const getVotingTips = useCallback(() => {
    const baseTips = [
      {
        icon: '💡',
        text: '정확성, 유용성, 창의성을 고려하여 평가해주세요'
      },
      {
        icon: '⚖️',
        text: '공정한 비교를 위해 모델 이름을 보지 말고 내용으로만 판단해보세요'
      }
    ];

    // Add contextual tips based on comparison
    if (currentComparison?.error) {
      return [
        ...baseTips,
        {
          icon: '⚠️',
          text: '오류가 발생한 응답에는 투표할 수 없습니다'
        }
      ];
    }

    if (currentComparison?.voted) {
      return [
        {
          icon: '✅',
          text: '투표가 완료되었습니다. 새로운 비교를 시작해보세요'
        }
      ];
    }

    return baseTips;
  }, [currentComparison]);

  return {
    // State
    isVoting,
    hoveredVote,
    voteError,
    canVote,

    // Actions
    handleVote,
    handleVoteHover,
    handleVoteLeave,
    clearVoteError,

    // Computed values
    getButtonState,
    getVoteOptions,
    getVotingStats,
    getVotingTips
  };
};

export default useArenaVoting;