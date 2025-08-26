import { useEffect } from 'react';
import { documentService } from '../services/api';

export const useRAGHandlers = (ragManager) => {
  const {
    selectedIndexId,
    selectedDocuments,
    setSelectedDocuments,
    kbSettings,
    loading,
    setLoading,
    setNotification,
    loadDocumentsByIndex,
    loadAllDocuments,
    loadInitialData,
    indexList,
    setSelectedIndex,
    setSelectedIndexId,
    setDocuments,
    setShowNewKBModal,
    setNewKBData,
    setShowEditKBModal,
    setEditKBData,
    newKBData,
    editKBData,
    uploadProgress,
    setUploadProgress,
    handleFileUpload,
    dragOver,
    setDragOver
  } = ragManager;
  // Dispatch event when indexList changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('knowledgeListUpdated', { detail: indexList }));
  }, [indexList]);

  // Notification auto-clear
  useEffect(() => {
    // This will be handled in the main component
  }, []);

  // File handling
  const handleMultipleFiles = async (files) => {
    // Check if a knowledge base is selected before processing files
    if (!selectedIndexId) {
      setNotification({ 
        message: '먼저 저장소를 선택해주세요.', 
        type: 'error' 
      });
      return;
    }
    
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleMultipleFiles(files);
    e.target.value = '';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleMultipleFiles(files);
  };

  // Upload progress management
  const clearCompletedUploads = () => {
    const activeUploads = Object.fromEntries(
      Object.entries(uploadProgress).filter(([_, upload]) => 
        upload.status === 'uploading'
      )
    );
    setUploadProgress(activeUploads);
  };

  const cancelUpload = (uploadId) => {
    setUploadProgress(prev => {
      const updated = { ...prev };
      delete updated[uploadId];
      return updated;
    });
  };

  const retryUpload = async (uploadId) => {
    const upload = uploadProgress[uploadId];
    if (upload && upload.file) {
      await handleFileUpload(upload.file);
      cancelUpload(uploadId);
    }
  };

  // Document selection handlers
  const handleSelectDocument = (docId) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllDocuments = () => {
    // This needs to be handled in the component with access to filteredData
  };

  // Bulk operations
  const handleBulkDeleteDocs = async () => {
    if (selectedDocuments.length === 0) return;
    
    if (!window.confirm(`정말로 ${selectedDocuments.length}개의 파일을 삭제하시겠습니까?`)) {
      return;
    }
    
    try {
      setLoading(true);
      const deletedCount = selectedDocuments.length;
      await documentService.deleteMultipleDocuments(selectedDocuments);
      
      setDocuments(prevDocs => prevDocs.filter(doc => !selectedDocuments.includes(doc.id)));
      setSelectedDocuments([]);
      await loadAllDocuments();
      
      setNotification({ 
        message: `${deletedCount}개의 파일이 성공적으로 삭제되었습니다.`, 
        type: 'success' 
      });
    } catch (error) {
      const errorMessage = error?.response?.data?.message || error?.message || '파일 삭제에 실패했습니다';
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
      await loadAllDocuments();
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReprocessDocs = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      for (const docId of selectedDocuments) {
        await documentService.reprocessDocument(docId, kbSettings);
      }
      setNotification({ 
        message: `${selectedDocuments.length} documents queued for reprocessing`, 
        type: 'success' 
      });
      setSelectedDocuments([]);
    } catch (error) {
      setNotification({ 
        message: 'Failed to reprocess documents', 
        type: 'error' 
      });
    }
  };

  // Single document operations
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('정말로 이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const result = await documentService.deleteDocument(docId);
      
      // 삭제 성공 여부와 관계없이 UI 업데이트
      setDocuments(prevDocs => prevDocs.filter(doc => doc.id !== docId));
      setSelectedDocuments(prev => prev.filter(id => id !== docId));
      
      // 성공 메시지 표시
      setNotification({ 
        message: '파일이 성공적으로 삭제되었습니다.', 
        type: 'success' 
      });
      
      // 데이터 다시 로드
      setTimeout(() => {
        loadAllDocuments();
      }, 500);
    } catch (error) {
      console.error('Failed to delete document:', error);
      
      // 에러 메시지 안전하게 처리
      let errorMessage = '파일 삭제에 실패했습니다';
      if (error && error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error && error.message) {
        errorMessage = error.message;
      }
      
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
      
      // 에러 발생 시에도 데이터 다시 로드
      setTimeout(() => {
        loadAllDocuments();
      }, 500);
    } finally {
      setLoading(false);
    }
  };

  const handleReprocessDocument = async (docId) => {
    if (!window.confirm('이 파일을 다시 처리하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const processingOptions = {
        embeddingModel: kbSettings.embeddingModel,
        chunkingStrategy: kbSettings.chunkingStrategy,
        chunkSize: kbSettings.maxCharacters,
        extractImages: kbSettings.extractImages
      };
      
      await documentService.reprocessDocument(docId, processingOptions);
      await loadDocumentsByIndex(selectedIndexId);
      setNotification({ 
        message: '파일이 성공적으로 재처리되었습니다.', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to reprocess document:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '파일 재처리에 실패했습니다';
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Knowledge Base operations
  const handleNewKB = () => {
    setNewKBData({ name: '', id: '' });
    setShowNewKBModal(true);
  };

  const handleSaveNewKB = async () => {
    if (!newKBData.name.trim() || !newKBData.id.trim()) {
      setNotification({ 
        message: '저장소 이름과 ID를 모두 입력해주세요.', 
        type: 'error' 
      });
      return;
    }

    try {
      setLoading(true);
      const response = await documentService.createKnowledgeBase(newKBData.name, newKBData.id);
      
      // 성공적으로 생성되면 UI 업데이트
      await loadInitialData();
      setShowNewKBModal(false);
      setNewKBData({ name: '', id: '' });
      setNotification({ message: '새 저장소가 생성되었습니다.', type: 'success' });
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '저장소 생성에 실패했습니다';
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditKB = () => {
    const selectedKB = indexList.find(index => index.id === selectedIndexId);
    if (!selectedKB) {
      setNotification({ 
        message: '수정할 저장소를 선택해주세요.', 
        type: 'error' 
      });
      return;
    }
    
    setEditKBData({ name: selectedKB.name, id: selectedKB.id });
    setShowEditKBModal(true);
  };

  const handleSaveEditKB = async () => {
    if (!editKBData.name.trim()) {
      setNotification({ 
        message: '저장소 이름을 입력해주세요.', 
        type: 'error' 
      });
      return;
    }

    try {
      setLoading(true);
      const response = await documentService.updateKnowledgeBase(
        editKBData.id, 
        { name: editKBData.name }
      );
      
      // 성공적으로 수정되면 UI 업데이트
      await loadInitialData();
      
      if (selectedIndexId === editKBData.id) {
        setSelectedIndex(editKBData.name);
      }
      
      setShowEditKBModal(false);
      setEditKBData({ name: '', id: '' });
      setNotification({ 
        message: '저장소 정보가 수정되었습니다.', 
        type: 'success' 
      });
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
      const errorMessage = error?.response?.data?.message || error?.message || '저장소 수정에 실패했습니다';
      setNotification({ 
        message: errorMessage, 
        type: 'error' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteKB = async () => {
    const selectedKB = indexList.find(index => index.id === selectedIndexId);
    if (!selectedKB) {
      setNotification({ 
        message: '삭제할 저장소를 선택해주세요.', 
        type: 'error' 
      });
      return;
    }

    if (!window.confirm(`"${selectedKB.name}" 저장소를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      setLoading(true);
      const currentSelectedId = selectedIndexId; // Store current ID before async operations
      
      await documentService.deleteKnowledgeBase(currentSelectedId);
      
      // 성공적으로 삭제되면 UI 업데이트
      await loadInitialData();
      
      // loadInitialData가 완료된 후, setIndexList을 통해 업데이트된 상태를 확인
      // 대신 직접 서버에서 최신 데이터를 가져와서 처리
      try {
        const kbResponse = await documentService.getKnowledgeBases();
        const remainingKBs = kbResponse.knowledge_bases || [];
        
        if (remainingKBs.length > 0) {
          const defaultKB = remainingKBs.find(kb => kb.id !== currentSelectedId) || remainingKBs[0];
          setSelectedIndexId(defaultKB.id);
          setSelectedIndex(defaultKB.name);
        } else {
          setSelectedIndexId('');
          setSelectedIndex('');
          setDocuments([]);
        }
      } catch (refreshError) {
        console.warn('Could not refresh KB list after deletion:', refreshError);
        // 최소한의 정리
        setSelectedIndexId('');
        setSelectedIndex('');
        setDocuments([]);
      }
      
      // Use console.log and basic alert instead of React notification to avoid rendering issues
      console.log('Knowledge base deleted successfully');
      // Temporarily use alert for user feedback until React notification issue is resolved
      alert('저장소가 삭제되었습니다.');
      
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      
      // 에러 메시지 안전하게 처리
      let errorMessage = '저장소 삭제에 실패했습니다';
      if (error && error.response && error.response.data) {
        if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        }
      } else if (error && error.message) {
        errorMessage = error.message;
      }
      
      // Safely call setNotification to avoid React rendering issues
      try {
        setNotification({ 
          message: errorMessage, 
          type: 'error' 
        });
      } catch (notificationError) {
        console.warn('Could not show error notification:', notificationError);
      }
    } finally {
      setLoading(false);
    }
  };

  // Knowledge Base Settings handler
  const handleKBSettingsChange = async (settings) => {
    try {
      // In a real application, this would make an API call to save the settings
      // For now, we're just using localStorage as shown in the KnowledgeBaseSettings component
      
      // Optionally trigger a notification or update
      console.log('Knowledge base settings updated:', settings);
      
      // You could also trigger a reload of documents if needed
      if (selectedIndexId) {
        await loadDocumentsByIndex(selectedIndexId);
      }
      
      return true;
    } catch (error) {
      console.error('Failed to save KB settings:', error);
      setNotification({
        message: '설정 저장에 실패했습니다.',
        type: 'error'
      });
      return false;
    }
  };

  // Utility functions
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16).replace('T', ' ');
    } catch (error) {
      return dateString || new Date().toISOString().slice(0, 16).replace('T', ' ');
    }
  };

  return {
    handleMultipleFiles,
    handleFileInputChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    clearCompletedUploads,
    cancelUpload,
    retryUpload,
    handleSelectDocument,
    handleSelectAllDocuments,
    handleBulkDeleteDocs,
    handleBulkReprocessDocs,
    handleDeleteDocument,
    handleReprocessDocument,
    handleNewKB,
    handleSaveNewKB,
    handleEditKB,
    handleSaveEditKB,
    handleDeleteKB,
    handleKBSettingsChange,
    formatFileSize,
    formatDate
  };
};