import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faFileAlt, 
  faCog, 
  faEye, 
  faBrain,
  faCut
} from '@fortawesome/free-solid-svg-icons';
import BulkActionsBar from './BulkActionsBar';
import DocumentTable from './DocumentTable';
import EmbeddingConfig from './EmbeddingConfig';
import ChunkingStrategy from './ChunkingStrategy';
import DocumentPreview from './DocumentPreview';
import { documentService } from '../../services/api';
import './EmbeddingConfig.css';
import './ChunkingStrategy.css';
import './DocumentPreview.css';
import './EnhancedFileManager.css';

const EnhancedFileManager = ({ 
  filteredData,
  selectedDocuments,
  selectedIndexId,
  setShowUploadModal,
  handleSelectDocument,
  handleSelectAllDocuments,
  handleBulkReprocessDocs,
  handleBulkDeleteDocs,
  handleDeleteDocument,
  handleReprocessDocument,
  formatFileSize,
  formatDate,
  setNotification,
  configOnly = false
}) => {
  // Configuration panel states
  const [showConfig, setShowConfig] = useState(false);
  const [embeddingConfig, setEmbeddingConfig] = useState(null);
  const [chunkingConfig, setChunkingConfig] = useState(null);
  
  // Document preview states
  const [previewDocument, setPreviewDocument] = useState(null);
  const [previewText, setPreviewText] = useState('');
  
  // UI states
  const [activeConfigTab, setActiveConfigTab] = useState('embedding');

  useEffect(() => {
    // Load saved configurations when knowledge base changes
    loadConfigurations();
    
    // If configOnly mode, always show config panel
    if (configOnly) {
      setShowConfig(true);
    }
  }, [selectedIndexId, configOnly]);

  const loadConfigurations = () => {
    if (selectedIndexId) {
      // Load embedding config
      const savedEmbedding = localStorage.getItem(`embedding_config_${selectedIndexId}`);
      if (savedEmbedding) {
        setEmbeddingConfig(JSON.parse(savedEmbedding));
      } else {
        // Set default embedding config
        setEmbeddingConfig({
          modelId: 'amazon.titan-embed-text-v2:0',
          modelName: 'Titan Embeddings v2',
          dimensions: 512,
          normalize: true,
          provider: 'Amazon'
        });
      }

      // Load chunking config
      const savedChunking = localStorage.getItem(`chunking_config_${selectedIndexId}`);
      if (savedChunking) {
        setChunkingConfig(JSON.parse(savedChunking));
      } else {
        // Set default chunking config
        setChunkingConfig({
          strategy: 'sentence',
          chunkSize: 512,
          overlap: 50,
          strategyName: '문장 기반 (Sentence-based)'
        });
      }
    }
  };

  const handleUploadClick = () => {
    if (!selectedIndexId) {
      setNotification({ 
        message: '먼저 지식 베이스를 선택해주세요.', 
        type: 'error' 
      });
      return;
    }

    // Check if configurations are set
    if (!embeddingConfig || !chunkingConfig) {
      setNotification({
        message: '임베딩 모델과 청킹 전략을 먼저 설정해주세요.',
        type: 'error'
      });
      setShowConfig(true);
      return;
    }

    setShowUploadModal(true);
  };

  const handleDownloadDocument = async (docItem) => {
    // Validate input
    if (!docItem) {
      setNotification({
        message: '다운로드할 문서 정보가 없습니다.',
        type: 'error'
      });
      return;
    }

    const docId = docItem.originalDoc?.id || docItem.id;
    
    // Validate document ID
    if (!docId && docId !== 0) {
      setNotification({
        message: '유효하지 않은 문서 ID입니다.',
        type: 'error'
      });
      return;
    }

    try {
      // Extract file information with proper fallbacks
      const fileName = docItem.original_filename || 
                      docItem.file_name || 
                      docItem.name || 
                      docItem.title || 
                      `document_${docId}`;
      
      console.log('Starting download:', { 
        docId, 
        fileName, 
        docItem: {
          id: docItem.id,
          original_filename: docItem.original_filename,
          file_name: docItem.file_name,
          name: docItem.name,
          title: docItem.title
        }
      });
      
      // Show loading notification
      setNotification({
        message: `${fileName} 다운로드를 시작합니다...`,
        type: 'info'
      });
      
      // Create document object for the service
      const documentToDownload = {
        id: docId,
        title: fileName,
        original_filename: docItem.original_filename,
        file_name: docItem.file_name,
        name: docItem.name
      };
      
      // Use documentService for download
      const result = await documentService.downloadDocument(documentToDownload);
      
      // Show detailed success notification
      const fileSize = result.size ? ` (${Math.round(result.size / 1024)} KB)` : '';
      setNotification({
        message: `${result.filename}${fileSize} 파일이 성공적으로 다운로드되었습니다.`,
        type: 'success'
      });
      
      console.log('Download completed successfully:', result);
      
    } catch (error) {
      console.error('Download failed:', error);
      
      // Provide user-friendly error messages
      let userMessage = error.message;
      
      // Add troubleshooting hints for common issues
      if (error.message.includes('찾을 수 없습니다')) {
        userMessage += ' 파일이 삭제되었거나 이동되었을 수 있습니다.';
      } else if (error.message.includes('서버')) {
        userMessage += ' 잠시 후 다시 시도해 주세요.';
      } else if (error.message.includes('시간이 초과')) {
        userMessage += ' 파일이 큰 경우 시간이 더 걸릴 수 있습니다.';
      }
      
      setNotification({
        message: userMessage,
        type: 'error'
      });
    }
  };

  const handlePreviewDocument = (document) => {
    setPreviewDocument(document);
  };

  const handleClosePreview = () => {
    setPreviewDocument(null);
    setPreviewText('');
  };

  const handleTextExtracted = (text) => {
    setPreviewText(text);
  };

  const handleEmbeddingConfigChange = (config) => {
    setEmbeddingConfig(config);
    
    if (chunkingConfig) {
      setNotification({
        message: '임베딩 모델 설정이 저장되었습니다.',
        type: 'success'
      });
    }
  };

  const handleChunkingConfigChange = (config) => {
    setChunkingConfig(config);
    
    if (embeddingConfig) {
      setNotification({
        message: '청킹 전략 설정이 저장되었습니다.',
        type: 'success'
      });
    }
  };

  const toggleConfigPanel = () => {
    setShowConfig(!showConfig);
    if (!showConfig) {
      loadConfigurations();
    }
  };

  // If configOnly mode, render only the configuration panel
  if (configOnly) {
    return (
      <div className="enhanced-file-manager config-only">
        {/* Configuration Panel */}
        <div className="config-panel">
          <div className="config-tabs">
            <button 
              className={`config-tab ${activeConfigTab === 'embedding' ? 'active' : ''}`}
              onClick={() => setActiveConfigTab('embedding')}
            >
              <FontAwesomeIcon icon={faBrain} />
              임베딩 모델
            </button>
            <button 
              className={`config-tab ${activeConfigTab === 'chunking' ? 'active' : ''}`}
              onClick={() => setActiveConfigTab('chunking')}
            >
              <FontAwesomeIcon icon={faCut} />
              청킹 전략
            </button>
          </div>

          <div className="config-content">
            {activeConfigTab === 'embedding' && (
              <EmbeddingConfig
                selectedModel={embeddingConfig}
                onModelChange={handleEmbeddingConfigChange}
                selectedIndexId={selectedIndexId}
                disabled={!selectedIndexId}
              />
            )}

            {activeConfigTab === 'chunking' && (
              <ChunkingStrategy
                strategy={chunkingConfig}
                onStrategyChange={handleChunkingConfigChange}
                selectedIndexId={selectedIndexId}
                previewText={previewText}
                disabled={!selectedIndexId}
              />
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="enhanced-file-manager">

      {/* Configuration Panel */}
      {showConfig && (
        <div className="config-panel">
          <div className="config-tabs">
            <button 
              className={`config-tab ${activeConfigTab === 'embedding' ? 'active' : ''}`}
              onClick={() => setActiveConfigTab('embedding')}
            >
              <FontAwesomeIcon icon={faBrain} />
              임베딩 모델
            </button>
            <button 
              className={`config-tab ${activeConfigTab === 'chunking' ? 'active' : ''}`}
              onClick={() => setActiveConfigTab('chunking')}
            >
              <FontAwesomeIcon icon={faCut} />
              청킹 전략
            </button>
          </div>

          <div className="config-content">
            {activeConfigTab === 'embedding' && (
              <EmbeddingConfig
                selectedModel={embeddingConfig}
                onModelChange={handleEmbeddingConfigChange}
                selectedIndexId={selectedIndexId}
                disabled={!selectedIndexId}
              />
            )}

            {activeConfigTab === 'chunking' && (
              <ChunkingStrategy
                strategy={chunkingConfig}
                onStrategyChange={handleChunkingConfigChange}
                selectedIndexId={selectedIndexId}
                previewText={previewText}
                disabled={!selectedIndexId}
              />
            )}
          </div>
        </div>
      )}

      {/* File Actions Header */}
      {filteredData.length > 0 && (
        <div className="file-actions-header">
          <button 
            className="btn-upload-secondary"
            onClick={handleUploadClick}
            title={!selectedIndexId ? "지식 베이스를 먼저 선택하세요" : "추가 파일 업로드"}
          >
            <FontAwesomeIcon icon={faPlus} />
            파일 추가
          </button>
        </div>
      )}

      {/* Bulk Actions Bar */}
      <BulkActionsBar 
        selectedDocuments={selectedDocuments}
        handleBulkReprocessDocs={handleBulkReprocessDocs}
        handleBulkDeleteDocs={handleBulkDeleteDocs}
      />

      {/* Document List */}
      {filteredData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-content">
            <FontAwesomeIcon icon={faFileAlt} className="empty-icon" />
            <h3>업로드된 파일이 없습니다</h3>
            <p>지식 베이스에 파일을 업로드하여 시작하세요.</p>
            
            {/* Show configuration hint if not configured */}
            {selectedIndexId && (!embeddingConfig || !chunkingConfig) && (
              <div className="config-hint">
                <p className="hint-text">
                  📝 파일 업로드 전에 임베딩 모델과 청킹 전략을 설정해주세요.
                </p>
                <button 
                  className="btn-config-setup"
                  onClick={() => setShowConfig(true)}
                >
                  <FontAwesomeIcon icon={faCog} />
                  설정하기
                </button>
              </div>
            )}
            
            <button 
              className="btn-upload-primary"
              onClick={handleUploadClick}
              title={!selectedIndexId ? "지식 베이스를 먼저 선택하세요" : "파일 업로드"}
            >
              <FontAwesomeIcon icon={faPlus} />
              파일 업로드
            </button>
          </div>
        </div>
      ) : (
        <DocumentTable 
          filteredData={filteredData}
          selectedDocuments={selectedDocuments}
          handleSelectDocument={handleSelectDocument}
          handleSelectAllDocuments={handleSelectAllDocuments}
          handleDeleteDocument={handleDeleteDocument}
          handleReprocessDocument={handleReprocessDocument}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
          onDownloadDocument={handleDownloadDocument}
        />
      )}

      {/* Document Preview Modal */}
      {previewDocument && (
        <DocumentPreview
          documentId={previewDocument.id}
          documentName={previewDocument.file_name || previewDocument.title}
          onClose={handleClosePreview}
          onTextExtracted={handleTextExtracted}
        />
      )}
    </div>
  );
};

export default EnhancedFileManager;