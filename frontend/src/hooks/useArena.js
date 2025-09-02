import { useState, useEffect, useCallback, useMemo } from 'react';
import { arenaService, bedrockService } from '../services/api';

/**
 * Custom hook for managing Arena page state and core functionality
 * Provides centralized state management with performance optimizations
 */
export const useArena = () => {
  // Core state
  const [leftModel, setLeftModel] = useState(null);
  const [rightModel, setRightModel] = useState(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentComparison, setCurrentComparison] = useState(null);
  const [bedrockHealth, setBedrockHealth] = useState(null);
  const [comparisonHistory, setComparisonHistory] = useState([]);
  const [inputError, setInputError] = useState('');

  // UI state
  const [showHistory, setShowHistory] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);

  /**
   * Load Bedrock health status
   */
  const loadBedrockHealth = useCallback(async () => {
    try {
      const health = await bedrockService.getHealth();
      setBedrockHealth(health);
    } catch (error) {
      console.error('Failed to load Bedrock health:', error);
      setBedrockHealth({ status: 'unavailable' });
    }
  }, []);

  /**
   * Load comparison history
   */
  const loadComparisonHistory = useCallback(async () => {
    try {
      // TODO: Implement when backend is ready
      // const history = await arenaService.getHistory();
      // setComparisonHistory(history.comparisons || []);
      
      // Mock history for now
      setComparisonHistory([]);
    } catch (error) {
      console.error('Failed to load comparison history:', error);
      setComparisonHistory([]);
    }
  }, []);

  /**
   * Clear current error and reset input validation
   */
  const clearError = useCallback(() => {
    setInputError('');
  }, []);

  /**
   * Update current message with validation
   */
  const updateMessage = useCallback((message) => {
    setCurrentMessage(message);
    if (inputError) {
      setInputError('');
    }
  }, [inputError]);

  /**
   * Select left model with validation
   */
  const selectLeftModel = useCallback((model) => {
    setLeftModel(model);
    clearError();
  }, [clearError]);

  /**
   * Select right model with validation
   */
  const selectRightModel = useCallback((model) => {
    setRightModel(model);
    clearError();
  }, [clearError]);

  /**
   * Reset Arena to initial state for new comparison
   */
  const resetArena = useCallback(() => {
    setCurrentComparison(null);
    setCurrentMessage('');
    clearError();
  }, [clearError]);

  /**
   * Add comparison to history
   */
  const addToHistory = useCallback((comparison) => {
    setComparisonHistory(prev => [comparison, ...prev.slice(0, 9)]);
  }, []);

  // Computed values with memoization
  const isReadyToSend = useMemo(() => {
    return leftModel && 
           rightModel && 
           leftModel.model_id !== rightModel.model_id && 
           currentMessage.trim();
  }, [leftModel, rightModel, currentMessage]);

  const hasError = useMemo(() => {
    return !!inputError;
  }, [inputError]);

  const canVote = useMemo(() => {
    return currentComparison && 
           !currentComparison.voted && 
           !isLoading && 
           !currentComparison.error;
  }, [currentComparison, isLoading]);

  const arenaStatus = useMemo(() => {
    if (isLoading) return 'loading';
    if (currentComparison?.error) return 'error';
    if (currentComparison && !currentComparison.voted) return 'ready-to-vote';
    if (currentComparison?.voted) return 'completed';
    return 'idle';
  }, [isLoading, currentComparison]);

  // Initialize on mount
  useEffect(() => {
    loadBedrockHealth();
    loadComparisonHistory();
  }, [loadBedrockHealth, loadComparisonHistory]);

  return {
    // State
    leftModel,
    rightModel,
    currentMessage,
    isLoading,
    currentComparison,
    bedrockHealth,
    comparisonHistory,
    inputError,
    showHistory,
    showAdvancedSettings,

    // Actions
    selectLeftModel,
    selectRightModel,
    updateMessage,
    clearError,
    resetArena,
    addToHistory,
    loadBedrockHealth,
    loadComparisonHistory,
    setIsLoading,
    setCurrentComparison,
    setShowHistory,
    setShowAdvancedSettings,

    // Computed values
    isReadyToSend,
    hasError,
    canVote,
    arenaStatus
  };
};

export default useArena;