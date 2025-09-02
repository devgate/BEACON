import { useCallback } from 'react';
import { arenaService } from '../services/api';

/**
 * Custom hook for handling Arena comparison operations
 * Manages the core comparison logic between two AI models
 */
export const useArenaComparison = ({
  leftModel,
  rightModel,
  setIsLoading,
  setCurrentComparison,
  clearError,
  addToHistory
}) => {

  /**
   * Validate comparison input
   */
  const validateComparison = useCallback((message) => {
    if (!message.trim()) {
      return '메시지를 입력해주세요';
    }

    if (!leftModel || !rightModel) {
      return '두 개의 모델을 모두 선택해주세요';
    }

    if (leftModel.model_id === rightModel.model_id) {
      return '서로 다른 모델을 선택해주세요';
    }

    return null;
  }, [leftModel, rightModel]);

  /**
   * Send message to both models for comparison
   */
  const sendMessage = useCallback(async (message, settings = {}) => {
    const validationError = validateComparison(message);
    if (validationError) {
      throw new Error(validationError);
    }

    clearError();
    setIsLoading(true);

    const startTime = Date.now();

    try {
      // Send message to both models simultaneously
      const response = await arenaService.sendMessage({
        message,
        leftModel: leftModel.model_id,
        rightModel: rightModel.model_id,
        settings: {
          temperature: 0.7,
          max_tokens: 2048,
          ...settings
        }
      });

      const endTime = Date.now();

      const comparison = {
        id: Date.now(),
        message,
        leftModel,
        rightModel,
        leftResponse: response.leftResponse,
        rightResponse: response.rightResponse,
        timestamp: new Date(),
        totalTime: endTime - startTime,
        voted: false
      };

      setCurrentComparison(comparison);
      return comparison;

    } catch (error) {
      console.error('Failed to get arena responses:', error);
      
      // Create error comparison
      const errorComparison = {
        id: Date.now(),
        message,
        leftModel,
        rightModel,
        leftResponse: {
          content: '죄송합니다. 응답을 생성하는데 오류가 발생했습니다.',
          error: true,
          processing_time: 0,
          tokens_used: 0,
          cost_estimate: 0
        },
        rightResponse: {
          content: '죄송합니다. 응답을 생성하는데 오류가 발생했습니다.',
          error: true,
          processing_time: 0,
          tokens_used: 0,
          cost_estimate: 0
        },
        timestamp: new Date(),
        totalTime: 0,
        voted: false,
        error: true
      };

      setCurrentComparison(errorComparison);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [leftModel, rightModel, validateComparison, clearError, setIsLoading, setCurrentComparison]);

  /**
   * Vote on comparison result
   */
  const vote = useCallback(async (comparison, winner) => {
    if (!comparison || comparison.voted) {
      throw new Error('Invalid comparison or already voted');
    }

    try {
      await arenaService.vote({
        comparisonId: comparison.id,
        winner: winner, // 'left', 'right', 'tie'
        message: comparison.message,
        leftModel: comparison.leftModel.model_id,
        rightModel: comparison.rightModel.model_id
      });

      // Update comparison as voted
      const updatedComparison = {
        ...comparison,
        voted: true,
        voteChoice: winner
      };

      setCurrentComparison(updatedComparison);
      addToHistory(updatedComparison);

      return updatedComparison;
    } catch (error) {
      console.error('Failed to record vote:', error);
      throw error;
    }
  }, [setCurrentComparison, addToHistory]);

  /**
   * Get comparison performance metrics
   */
  const getPerformanceMetrics = useCallback((comparison) => {
    if (!comparison) return null;

    const leftResponse = comparison.leftResponse;
    const rightResponse = comparison.rightResponse;

    return {
      speedComparison: {
        left: leftResponse.processing_time || 0,
        right: rightResponse.processing_time || 0,
        winner: leftResponse.processing_time < rightResponse.processing_time ? 'left' : 'right'
      },
      tokenComparison: {
        left: leftResponse.tokens_used || 0,
        right: rightResponse.tokens_used || 0,
        winner: leftResponse.tokens_used < rightResponse.tokens_used ? 'left' : 'right'
      },
      costComparison: {
        left: leftResponse.cost_estimate || 0,
        right: rightResponse.cost_estimate || 0,
        winner: leftResponse.cost_estimate < rightResponse.cost_estimate ? 'left' : 'right'
      },
      overallTime: comparison.totalTime || 0
    };
  }, []);

  return {
    sendMessage,
    vote,
    validateComparison,
    getPerformanceMetrics
  };
};

export default useArenaComparison;