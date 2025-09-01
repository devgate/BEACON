import { useState, useEffect, useRef } from 'react';
import { documentService } from '../services/api';

/**
 * Custom hook for real-time reprocessing status tracking
 * Polls the backend for progress updates during document reprocessing
 */
export const useReprocessingStatus = (indexId, isActive) => {
  const [status, setStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const intervalRef = useRef(null);
  const timeoutRef = useRef(null);

  // Polling configuration
  const POLL_INTERVAL = 2000; // 2 seconds
  const MAX_POLLING_TIME = 300000; // 5 minutes maximum
  const POLL_TIMEOUT = 10000; // 10 seconds for each API call

  const fetchStatus = async () => {
    if (!indexId) return;

    try {
      const response = await documentService.getReprocessingStatus(indexId);
      setStatus(response);
      setError(null);

      // Stop polling if reprocessing is complete
      if (response.overall_status === 'Completed' || response.overall_status === 'Failed') {
        stopPolling();
        return response;
      }

      return response;
    } catch (err) {
      console.error('Failed to fetch reprocessing status:', err);
      setError(err.message);
      
      // Don't stop polling on error, just log it
      // The error might be temporary (network issue, etc.)
      return null;
    }
  };

  const startPolling = () => {
    if (intervalRef.current || !indexId) return;

    console.log(`Starting reprocessing status polling for KB ${indexId}`);
    setIsPolling(true);
    setError(null);

    // Fetch initial status immediately
    fetchStatus();

    // Set up polling interval
    intervalRef.current = setInterval(fetchStatus, POLL_INTERVAL);

    // Set up timeout to stop polling after maximum time
    timeoutRef.current = setTimeout(() => {
      console.log(`Polling timeout reached for KB ${indexId}`);
      stopPolling();
    }, MAX_POLLING_TIME);
  };

  const stopPolling = () => {
    console.log(`Stopping reprocessing status polling for KB ${indexId}`);
    
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setIsPolling(false);
  };

  const restartPolling = () => {
    stopPolling();
    if (isActive) {
      // Small delay before restarting
      setTimeout(startPolling, 1000);
    }
  };

  // Effect to handle polling activation/deactivation
  useEffect(() => {
    if (isActive && indexId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isActive, indexId]);

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  // Helper function to get overall progress
  const getOverallProgress = () => {
    if (!status) return 0;
    return status.overall_progress || 0;
  };

  // Helper function to check if any documents are actively processing
  const hasActiveReprocessing = () => {
    if (!status || !status.documents) return false;
    return status.documents.some(doc => doc.status === 'Reprocessing');
  };

  // Helper function to get processing summary
  const getProcessingSummary = () => {
    if (!status) return null;

    return {
      total: status.total_documents || 0,
      completed: status.completed_documents || 0,
      failed: status.failed_documents || 0,
      processing: status.processing_documents || 0,
      overallProgress: status.overall_progress || 0,
      averageProgress: status.average_processing_progress || 0,
      overallStatus: status.overall_status || 'Unknown'
    };
  };

  // Helper function to get documents with progress details
  const getDocumentsWithProgress = () => {
    if (!status || !status.documents) return [];
    return status.documents.map(doc => ({
      ...doc,
      displayProgress: doc.reprocessing_progress || 0,
      displayStage: doc.reprocessing_stage || 'Ready',
      isActivelyProcessing: doc.status === 'Reprocessing'
    }));
  };

  return {
    status,
    isPolling,
    error,
    
    // Control functions
    startPolling,
    stopPolling,
    restartPolling,
    fetchStatus,
    
    // Helper functions
    getOverallProgress,
    hasActiveReprocessing,
    getProcessingSummary,
    getDocumentsWithProgress,
    
    // Status flags
    isActive: isPolling,
    hasError: !!error,
    isComplete: status?.overall_status === 'Completed',
    isFailed: status?.overall_status === 'Failed'
  };
};

export default useReprocessingStatus;