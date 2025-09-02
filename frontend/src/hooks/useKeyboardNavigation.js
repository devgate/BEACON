import { useEffect, useCallback } from 'react';

/**
 * Custom hook for keyboard navigation and shortcuts
 * Provides accessibility and power user features
 */
export const useKeyboardNavigation = ({
  onSendMessage,
  onNewComparison,
  onVoteLeft,
  onVoteRight,
  onVoteTie,
  onToggleHistory,
  canSend = false,
  canVote = false
}) => {

  /**
   * Handle keyboard shortcuts
   */
  const handleKeyDown = useCallback((event) => {
    // Don't trigger shortcuts if user is typing in input fields
    if (event.target.tagName === 'INPUT' || 
        event.target.tagName === 'TEXTAREA' ||
        event.target.isContentEditable) {
      return;
    }

    const { key, ctrlKey, metaKey, shiftKey, altKey } = event;
    const isModifierPressed = ctrlKey || metaKey;

    switch (key) {
      // Send message: Ctrl/Cmd + Enter
      case 'Enter':
        if (isModifierPressed && canSend) {
          event.preventDefault();
          onSendMessage();
        }
        break;

      // New comparison: Ctrl/Cmd + N
      case 'n':
      case 'N':
        if (isModifierPressed) {
          event.preventDefault();
          onNewComparison();
        }
        break;

      // Vote left: 1 or Left Arrow
      case '1':
      case 'ArrowLeft':
        if (canVote && !isModifierPressed) {
          event.preventDefault();
          onVoteLeft();
        }
        break;

      // Vote right: 3 or Right Arrow
      case '3':
      case 'ArrowRight':
        if (canVote && !isModifierPressed) {
          event.preventDefault();
          onVoteRight();
        }
        break;

      // Vote tie: 2 or Space
      case '2':
      case ' ':
        if (canVote && !isModifierPressed) {
          event.preventDefault();
          onVoteTie();
        }
        break;

      // Toggle history: Ctrl/Cmd + H
      case 'h':
      case 'H':
        if (isModifierPressed && onToggleHistory) {
          event.preventDefault();
          onToggleHistory();
        }
        break;

      // Focus input: /
      case '/':
        if (!isModifierPressed) {
          event.preventDefault();
          const input = document.querySelector('.arena-input');
          if (input) {
            input.focus();
          }
        }
        break;

      default:
        break;
    }
  }, [
    onSendMessage,
    onNewComparison,
    onVoteLeft,
    onVoteRight,
    onVoteTie,
    onToggleHistory,
    canSend,
    canVote
  ]);

  // Register keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /**
   * Get keyboard shortcuts help text
   */
  const getShortcuts = useCallback(() => {
    return [
      { keys: ['Ctrl', 'Enter'], description: '메시지 전송', available: canSend },
      { keys: ['Ctrl', 'N'], description: '새 비교 시작', available: true },
      { keys: ['1', '←'], description: '왼쪽 모델에 투표', available: canVote },
      { keys: ['2', 'Space'], description: '동점으로 투표', available: canVote },
      { keys: ['3', '→'], description: '오른쪽 모델에 투표', available: canVote },
      { keys: ['Ctrl', 'H'], description: '히스토리 토글', available: true },
      { keys: ['/'], description: '입력 창 포커스', available: true }
    ];
  }, [canSend, canVote]);

  /**
   * Focus management utility
   */
  const focusElement = useCallback((selector) => {
    const element = document.querySelector(selector);
    if (element) {
      element.focus();
    }
  }, []);

  /**
   * Focus input field
   */
  const focusInput = useCallback(() => {
    focusElement('.arena-input');
  }, [focusElement]);

  /**
   * Focus first focusable voting button
   */
  const focusVoting = useCallback(() => {
    focusElement('.vote-button:not(:disabled)');
  }, [focusElement]);

  return {
    getShortcuts,
    focusElement,
    focusInput,
    focusVoting
  };
};

export default useKeyboardNavigation;