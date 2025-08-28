import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faCut, 
  faCog,
  faDatabase,
  faExclamationCircle,
  faCheckCircle,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { bedrockService, documentService, collectionService } from '../../services/api';
import { 
  chunkingStrategies, 
  generatePreviewChunks, 
  getStrategyInsights, 
  countTokens 
} from '../../services/chunkingService';
import EmbeddingModelSelector from './EmbeddingModelSelector';
import ChunkingStrategyConfig from './ChunkingStrategyConfig';
import ChunkingPreview from './ChunkingPreview';
import './KnowledgeBaseSettings.css';

const KnowledgeBaseSettings = ({ 
  selectedIndexId,
  selectedIndex,
  onSettingsChange,
  setNotification
}) => {
  // State for embedding models from API
  const [embeddingModels, setEmbeddingModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(true);
  const [modelsFetchError, setModelsFetchError] = useState(null);

  // State for document chunking preview
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [previewChunks, setPreviewChunks] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // State for collection metadata
  const [collectionMetadata, setCollectionMetadata] = useState(null);
  const [currentChunkCount, setCurrentChunkCount] = useState(0);
  const [loadingMetadata, setLoadingMetadata] = useState(false);


  // State management
  const [embeddingModel, setEmbeddingModel] = useState(null);
  const [chunkingStrategy, setChunkingStrategy] = useState(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [normalize, setNormalize] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch embedding models and collection metadata from APIs
  useEffect(() => {
    fetchEmbeddingModels();
    if (selectedIndexId) {
      fetchAvailableDocuments();
      loadCollectionMetadata();
    }
  }, []);

  // Fetch documents and metadata when KB changes
  useEffect(() => {
    if (selectedIndexId) {
      fetchAvailableDocuments();
      loadCollectionMetadata();
    } else {
      setAvailableDocuments([]);
      setSelectedDocument(null);
      setDocumentText('');
      setPreviewChunks([]);
      setCollectionMetadata(null);
      setCurrentChunkCount(0);
    }
  }, [selectedIndexId]);


  const fetchEmbeddingModels = async () => {
    setLoadingModels(true);
    setModelsFetchError(null);
    
    try {
      // Use the bedrockService to fetch models
      const data = await bedrockService.getEmbeddingModels();
      
      if (data.models && data.models.length > 0) {
        // Process and format models from API
        const formattedModels = data.models.map(model => {
          const baseModel = {
            id: model.id,
            name: model.name,
            provider: model.provider || model.providerName,
            dimensions: model.dimensions || model.defaultDimension,
            cost: model.cost,
            language: model.language,
            status: model.status || 'ACTIVE',
            recommended: model.recommended || false,
            maxTokens: model.maxTokens || 8000
          };
          
          // 사용자 친화적 포맷 적용
          return formatModelData(baseModel);
        });
        
        setEmbeddingModels(formattedModels);
        
        setNotification({
          message: `AWS Bedrock에서 ${formattedModels.length}개 임베딩 모델을 성공적으로 로드했습니다`,
          type: 'success'
        });
      } else {
        // No models available from API
        setEmbeddingModels([]);
        setModelsFetchError('AWS Bedrock에서 사용 가능한 임베딩 모델이 없습니다');
        setNotification({
          message: 'AWS Bedrock에서 임베딩 모델을 찾을 수 없습니다',
          type: 'warning'
        });
      }
    } catch (error) {
      console.error('Failed to fetch embedding models:', error);
      let errorMessage = 'AWS Bedrock에서 임베딩 모델을 로드하는데 실패했습니다';
      
      // Provide more specific error messages
      if (error.message.includes('Network Error')) {
        errorMessage = '백엔드 API에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.';
      } else if (error.message.includes('404')) {
        errorMessage = '임베딩 모델 API 엔드포인트를 찾을 수 없습니다.';
      } else if (error.message.includes('500')) {
        errorMessage = '모델을 가져오는 중 백엔드 서버 오류가 발생했습니다.';
      } else if (error.message) {
        errorMessage = `오류: ${error.message}`;
      }
      
      setModelsFetchError(errorMessage);
      setEmbeddingModels([]);
      setNotification({
        message: 'AWS Bedrock 연결에 실패했습니다. 네트워크 상태를 확인해주세요.',
        type: 'error'
      });
    } finally {
      setLoadingModels(false);
    }
  };

  // Load collection metadata to show current state
  const loadCollectionMetadata = async () => {
    if (!selectedIndexId) return;
    
    try {
      setLoadingMetadata(true);
      
      const response = await collectionService.getCollectionStats(selectedIndexId);
      
      if (response.success && response.stats) {
        setCollectionMetadata(response.stats);
        setCurrentChunkCount(response.stats.total_chunks || 0);
        
        console.log('Collection metadata loaded:', {
          collection_id: selectedIndexId,
          total_chunks: response.stats.total_chunks || 0,
          embedding_model: response.stats.metadata?.embedding_model_id
        });
      }
    } catch (error) {
      console.error('Failed to load collection metadata:', error);
      setCollectionMetadata(null);
      setCurrentChunkCount(0);
    } finally {
      setLoadingMetadata(false);
    }
  };


  const fetchAvailableDocuments = async () => {
    try {
      // Use full URL to bypass proxy issues during development
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : '';
      
      // If selectedIndexId is present, fetch documents for that knowledge base
      let endpoint = `${baseUrl}/api/documents`;
      if (selectedIndexId) {
        // Try to fetch documents for specific knowledge base first
        endpoint = `${baseUrl}/api/knowledge-bases/${selectedIndexId}/documents`;
      }
      
      const response = await fetch(endpoint);
      
      // If KB-specific endpoint fails, fall back to all documents
      if (!response.ok && selectedIndexId) {
        console.log('Knowledge base specific endpoint not available, fetching all documents');
        const fallbackResponse = await fetch(`${baseUrl}/api/documents`);
        if (!fallbackResponse.ok) {
          throw new Error(`HTTP ${fallbackResponse.status}: ${fallbackResponse.statusText}`);
        }
        const fallbackData = await fallbackResponse.json();
        const documents = fallbackData.documents || (Array.isArray(fallbackData) ? fallbackData : []);
        
        // Filter documents by knowledge_base_id if selectedIndexId is present
        const filteredDocs = selectedIndexId 
          ? documents.filter(doc => doc.knowledge_base_id == selectedIndexId || doc.category_id == selectedIndexId)
          : documents;
        
        const readyDocuments = filteredDocs.filter(doc => {
          // Accept documents with ready status or no status field (which means ready)
          const hasValidStatus = !doc.status || 
            ['Ready', 'Success', 'ready', 'success', 'completed', 'processed', 'Processing'].includes(doc.status);
          const hasFileName = doc.file_name || doc.title;
          return hasValidStatus && hasFileName;
        }).slice(0, 10);
        
        setAvailableDocuments(readyDocuments);
        return;
      }
      
      const data = await response.json();
      
      // Handle API response format (object with documents array)
      const documents = data.documents || (Array.isArray(data) ? data : []);
      
      // Filter documents by knowledge_base_id if selectedIndexId is present
      const filteredDocs = selectedIndexId 
        ? documents.filter(doc => doc.knowledge_base_id == selectedIndexId || doc.category_id == selectedIndexId)
        : documents;
      
      // Filter for ready documents only - support multiple status values or no status
      const readyDocuments = filteredDocs.filter(doc => {
        // Accept documents with ready status or no status field (which means ready)
        const hasValidStatus = !doc.status || 
          ['Ready', 'Success', 'ready', 'success', 'completed', 'processed', 'Processing'].includes(doc.status);
        const hasFileName = doc.file_name || doc.title;
        return hasValidStatus && hasFileName;
      }).slice(0, 10); // Limit to 10 documents for performance
      
      setAvailableDocuments(readyDocuments);
      console.log(`Loaded ${readyDocuments.length} documents for Knowledge Base ${selectedIndexId}`);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
      setAvailableDocuments([]);
    }
  };

  const fetchDocumentText = async (documentId) => {
    setLoadingPreview(true);
    try {
      // Use full URL to bypass proxy issues during development
      const baseUrl = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : '';
      
      // Try document preview API first
      let documentText = '';
      let selectedDoc = null;
      
      try {
        const previewResponse = await fetch(`${baseUrl}/api/documents/${documentId}/preview`);
        if (previewResponse.ok) {
          const previewData = await previewResponse.json();
          documentText = previewData.text_content || '';
          selectedDoc = {
            id: documentId,
            title: previewData.metadata?.file_name || 'Unknown Document',
            file_name: previewData.metadata?.file_name
          };
          
          console.log('Document preview loaded successfully:', {
            id: documentId,
            title: selectedDoc.title,
            contentLength: documentText.length,
            hasImages: previewData.images?.length || 0
          });
        }
      } catch (previewError) {
        console.warn('Document preview API failed, falling back to documents list:', previewError);
      }
      
      // Fallback: Get document from documents list
      if (!documentText || !selectedDoc) {
        const response = await fetch(`${baseUrl}/api/documents`);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const documents = data.documents || (Array.isArray(data) ? data : []);
        selectedDoc = documents.find(doc => doc.id.toString() === documentId.toString());
        
        if (!selectedDoc) {
          throw new Error('Document not found');
        }
        
        // Try to get actual document content from multiple sources
        documentText = selectedDoc.content || 
                      selectedDoc.text || 
                      selectedDoc.extracted_text ||
                      selectedDoc.raw_content;
        
        // If no cached content, fetch from preview API
        if (!documentText || documentText.trim().length === 0) {
          console.log('No cached content found, fetching from preview API...');
          try {
            const previewResponse = await fetch(`/api/documents/${selectedDoc.id}/preview`);
            if (previewResponse.ok) {
              const previewData = await previewResponse.json();
              documentText = previewData.text_content || '';
              console.log('Fetched document content from preview API:', documentText.length, 'characters');
            } else {
              console.error('Preview API failed:', previewResponse.status, previewResponse.statusText);
              throw new Error(`Preview API returned ${previewResponse.status}`);
            }
          } catch (apiError) {
            console.error('Failed to fetch document preview:', apiError);
            throw new Error(`문서 내용을 불러올 수 없습니다: ${apiError.message}`);
          }
        }
      }
      
      // Ensure we have valid text content
      if (!documentText || documentText.trim().length === 0) {
        throw new Error('이 문서에서 텍스트 내용을 찾을 수 없습니다. 파일이 손상되었거나 텍스트를 포함하지 않을 수 있습니다.');
      }
      
      setDocumentText(documentText);
      
      console.log('Final document loaded:', {
        id: selectedDoc.id,
        title: selectedDoc.title || selectedDoc.file_name,
        contentLength: documentText.length,
        hasRealContent: !documentText.includes('샘플 문서 내용입니다')
      });
      
      // Generate preview chunks based on current settings
      const strategy = chunkingStrategy || chunkingStrategies[0];
      if (strategy) {
        const chunks = generatePreviewChunks(documentText, strategy, chunkSize, chunkOverlap);
        setPreviewChunks(chunks.slice(0, 10));
        if (!chunkingStrategy) {
          setChunkingStrategy(strategy);
          setChunkSize(strategy.defaultSize);
          setChunkOverlap(strategy.defaultOverlap);
        }
      }
    } catch (error) {
      console.error('Failed to fetch document text:', error);
      setNotification({
        message: `문서 콘텐츠 로딩 실패: ${error.message}`,
        type: 'error'
      });
      setDocumentText('');
      setPreviewChunks([]);
    } finally {
      setLoadingPreview(false);
    }
  };

  // Generate preview chunks using chunking service
  const handleGeneratePreviewChunks = (text, strategy, size, overlap) => {
    console.log('handleGeneratePreviewChunks called:', {
      textLength: text?.length || 0,
      strategyId: strategy?.id || 'none',
      size,
      overlap
    });

    if (!text || !strategy) {
      console.warn('Missing text or strategy for chunking preview');
      setPreviewChunks([]);
      return;
    }

    try {
      const chunks = generatePreviewChunks(text, strategy, size, overlap);
      setPreviewChunks(chunks.slice(0, 10));
    } catch (error) {
      console.error('Error generating preview chunks:', error);
      setPreviewChunks([]);
      setNotification({
        message: `청킹 생성 중 오류 발생: ${error.message}`,
        type: 'error'
      });
    }
  };

  // Handler for document selection in preview
  const handleDocumentSelect = (documentId) => {
    console.log('Document selected for preview:', documentId);
    if (documentId) {
      setSelectedDocument(documentId);
      fetchDocumentText(documentId);
    } else {
      setSelectedDocument(null);
      setDocumentText('');
      setPreviewChunks([]);
    }
  };

  // Handler for refreshing preview
  const handleRefreshPreview = () => {
    if (selectedDocument) {
      console.log('Refreshing preview for document:', selectedDocument);
      fetchDocumentText(selectedDocument);
    }
  };

  // Format model data for display
  const formatModelData = (model) => {
    return {
      ...model,
      formattedCost: model.cost ? `$${model.cost}` : null,
      formattedDimensions: Array.isArray(model.dimensions) 
        ? model.dimensions.map(d => `${d.toLocaleString()}D`).join(', ')
        : `${model.dimensions}D`
    };
  };







  // Regenerate chunks when strategy or parameters change
  useEffect(() => {
    console.log('useEffect triggered for chunking preview:', {
      hasDocumentText: !!documentText,
      hasChunkingStrategy: !!chunkingStrategy,
      chunkSize,
      chunkOverlap,
      strategyId: chunkingStrategy?.id
    });
    
    if (documentText && chunkingStrategy) {
      console.log('Regenerating chunks due to parameter change');
      handleGeneratePreviewChunks(documentText, chunkingStrategy, chunkSize, chunkOverlap);
    } else {
      console.log('Skipping chunk generation:', {
        documentText: !!documentText,
        chunkingStrategy: !!chunkingStrategy
      });
    }
  }, [chunkingStrategy, chunkSize, chunkOverlap, documentText]);

  // Load settings when knowledge base changes
  useEffect(() => {
    if (selectedIndexId) {
      loadSettings();
    } else {
      // Reset to defaults when no KB selected
      setEmbeddingModel(null);
      setChunkingStrategy(null);
      setChunkSize(512);
      setChunkOverlap(50);
      setNormalize(true);
      setHasChanges(false);
    }
  }, [selectedIndexId]);

  const loadSettings = () => {
    if (!selectedIndexId || embeddingModels.length === 0) return;

    // Load from localStorage (in production, this would be an API call)
    const savedSettings = localStorage.getItem(`kb_settings_${selectedIndexId}`);
    
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      
      // Load embedding model
      const model = embeddingModels.find(m => m.id === settings.embeddingModelId);
      setEmbeddingModel(model || embeddingModels.find(m => m.recommended) || embeddingModels[0]);
      
      // Load chunking strategy
      const strategy = chunkingStrategies.find(s => s.id === settings.chunkingStrategyId);
      setChunkingStrategy(strategy || chunkingStrategies[0]);
      
      // Load parameters
      setChunkSize(settings.chunkSize || 512);
      setChunkOverlap(settings.chunkOverlap || 50);
      setNormalize(settings.normalize !== false);
    } else {
      // Set defaults for new knowledge base
      const recommendedModel = embeddingModels.find(m => m.recommended) || embeddingModels[0];
      setEmbeddingModel(recommendedModel);
      setChunkingStrategy(chunkingStrategies[0]); // Sentence-based as default
      setChunkSize(512);
      setChunkOverlap(50);
      setNormalize(true);
    }
    
    setHasChanges(false);
  };

  // Re-load settings when models are fetched
  useEffect(() => {
    if (embeddingModels.length > 0 && selectedIndexId) {
      loadSettings();
    }
  }, [embeddingModels]);

  const handleEmbeddingModelChange = (modelId) => {
    const model = embeddingModels.find(m => m.id === modelId);
    if (model) {
      setEmbeddingModel(model);
      setHasChanges(true);
    }
  };

  const handleChunkingStrategyChange = (strategyId) => {
    console.log('Changing chunking strategy to:', strategyId);
    const strategy = chunkingStrategies.find(s => s.id === strategyId);
    if (strategy) {
      setChunkingStrategy(strategy);
      // Update size and overlap to strategy defaults
      setChunkSize(strategy.defaultSize);
      setChunkOverlap(strategy.defaultOverlap);
      setHasChanges(true);
      
      console.log('Strategy changed:', {
        id: strategy.id,
        name: strategy.name,
        defaultSize: strategy.defaultSize,
        defaultOverlap: strategy.defaultOverlap
      });
    }
  };

  const handleChunkSizeChange = (value) => {
    const numValue = parseInt(value) || 0;
    if (chunkingStrategy) {
      const clampedValue = Math.max(
        chunkingStrategy.sizeRange.min,
        Math.min(chunkingStrategy.sizeRange.max, numValue)
      );
      
      console.log('Chunk size changing from', chunkSize, 'to', clampedValue);
      setChunkSize(clampedValue);
      setHasChanges(true);
      
      if (documentText && chunkingStrategy) {
        setTimeout(() => {
          console.log('Force regenerating chunks after chunk size change');
          handleGeneratePreviewChunks(documentText, chunkingStrategy, clampedValue, chunkOverlap);
        }, 0);
      }
    }
  };

  const handleChunkOverlapChange = (value) => {
    const numValue = parseInt(value) || 0;
    // Overlap should be less than chunk size
    const maxOverlap = Math.floor(chunkSize * 0.5);
    const clampedValue = Math.max(0, Math.min(maxOverlap, numValue));
    
    console.log('Chunk overlap changing from', chunkOverlap, 'to', clampedValue);
    setChunkOverlap(clampedValue);
    setHasChanges(true);
    
    if (documentText && chunkingStrategy) {
      setTimeout(() => {
        console.log('Force regenerating chunks after overlap change');
        handleGeneratePreviewChunks(documentText, chunkingStrategy, chunkSize, clampedValue);
      }, 0);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedIndexId || !embeddingModel || !chunkingStrategy) {
      setNotification({
        message: '모든 설정을 선택해주세요.',
        type: 'error'
      });
      return;
    }

    setIsSaving(true);

    try {
      // Prepare settings object
      const settings = {
        embeddingModelId: embeddingModel.id,
        chunkingStrategyId: chunkingStrategy.id,
        chunkSize,
        chunkOverlap,
        normalize,
        knowledgeBaseId: selectedIndexId,
        timestamp: new Date().toISOString()
      };

      // Save to localStorage (in production, this would be an API call)
      localStorage.setItem(`kb_settings_${selectedIndexId}`, JSON.stringify(settings));

      // Notify parent component
      if (onSettingsChange) {
        onSettingsChange(settings);
      }

      setHasChanges(false);
      setNotification({
        message: '설정이 성공적으로 저장되었습니다.',
        type: 'success'
      });

    } catch (error) {
      console.error('Failed to save settings:', error);
      setNotification({
        message: '설정 저장에 실패했습니다.',
        type: 'error'
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('설정을 기본값으로 초기화하시겠습니까?')) {
      // Reset to recommended model or first available model
      const recommendedModel = embeddingModels.find(m => m.recommended) || embeddingModels[0];
      if (recommendedModel) {
        setEmbeddingModel(recommendedModel);
      }
      setChunkingStrategy(chunkingStrategies[0]);
      setChunkSize(512);
      setChunkOverlap(50);
      setNormalize(true);
      setHasChanges(true);
    }
  };


  if (!selectedIndexId) {
    return (
      <div className="kb-settings-container">
        <div className="no-kb-selected">
          <FontAwesomeIcon icon={faDatabase} className="no-kb-icon" />
          <h3>지식 베이스를 선택하세요</h3>
          <p>임베딩 모델과 청킹 전략을 설정하려면 먼저 지식 베이스를 선택해야 합니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kb-settings-container">
      {hasChanges && (
        <div className="unsaved-changes-banner">
          <FontAwesomeIcon icon={faExclamationCircle} />
          <span>저장되지 않은 변경사항이 있습니다</span>
        </div>
      )}

      <div className="settings-content">
        {/* Embedding Model Section */}
        <div className="settings-section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faBrain} /> 임베딩 모델
            </h3>
            <p className="section-description">
              문서를 벡터로 변환하는 모델을 선택합니다. 검색 품질에 직접적인 영향을 미칩니다.
            </p>
          </div>

          <EmbeddingModelSelector
            embeddingModels={embeddingModels}
            selectedModel={embeddingModel}
            loadingModels={loadingModels}
            modelsFetchError={modelsFetchError}
            onModelChange={handleEmbeddingModelChange}
            onRetryFetch={fetchEmbeddingModels}
          />
        </div>

        <ChunkingStrategyConfig
          chunkingStrategies={chunkingStrategies}
          selectedStrategy={chunkingStrategy}
          chunkSize={chunkSize}
          chunkOverlap={chunkOverlap}
          onStrategyChange={handleChunkingStrategyChange}
          onChunkSizeChange={handleChunkSizeChange}
          onChunkOverlapChange={handleChunkOverlapChange}
          selectedDocument={selectedDocument}
          loadingPreview={loadingPreview}
          setNotification={setNotification}
        />

        <ChunkingPreview
          availableDocuments={availableDocuments}
          selectedDocument={selectedDocument}
          documentText={documentText}
          previewChunks={previewChunks}
          loadingPreview={loadingPreview}
          chunkingStrategy={chunkingStrategy}
          onDocumentSelect={handleDocumentSelect}
          onRefreshPreview={handleRefreshPreview}
          getStrategyInsights={getStrategyInsights}
        />

        {/* Settings Summary */}
        {embeddingModel && chunkingStrategy && (
          <div className="settings-summary">
            <h3>현재 설정 요약</h3>
            <div className="summary-content">
              <div className="summary-item">
                <div className="summary-icon-wrapper">
                  <FontAwesomeIcon icon={faBrain} className="summary-icon" />
                </div>
                <div className="summary-details">
                  <div className="summary-title">임베딩 모델</div>
                  <div className="summary-value">{embeddingModel.name}</div>
                  <div className="summary-meta">
                    <span className="meta-item">{embeddingModel.formattedDimensions || 
                      (Array.isArray(embeddingModel.dimensions) ? 
                        embeddingModel.dimensions.map(d => `${d.toLocaleString()}D`).join(', ') : 
                        `${embeddingModel.dimensions}D`)}</span>
                    <span className="meta-item">{embeddingModel.provider}</span>
                    {embeddingModel.formattedCost && (
                      <span className="meta-item cost">{embeddingModel.formattedCost}</span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="summary-item">
                <div className="summary-icon-wrapper">
                  <FontAwesomeIcon icon={faCut} className="summary-icon" />
                </div>
                <div className="summary-details">
                  <div className="summary-title">청킹 전략</div>
                  <div className="summary-value">{chunkingStrategy.name}</div>
                  <div className="summary-meta">
                    <span className="meta-item">크기: {chunkSize.toLocaleString()}토큰</span>
                    <span className="meta-item">오버랩: {chunkOverlap.toLocaleString()}토큰</span>
                  </div>
                </div>
              </div>
              
              <div className="summary-item">
                <div className="summary-icon-wrapper">
                  <FontAwesomeIcon icon={faChartLine} className="summary-icon" />
                </div>
                <div className="summary-details">
                  <div className="summary-title">청킹 현황</div>
                  <div className="summary-value">
                    {loadingMetadata ? (
                      '로딩 중...'
                    ) : (
                      `현재 컬렉션: ${currentChunkCount.toLocaleString()}개 청크`
                    )}
                  </div>
                  <div className="summary-meta">
                    {(() => {
                      // 새 설정으로 예상되는 청크 수 계산
                      let estimatedChunks = 0;
                      
                      if (previewChunks.length > 0) {
                        estimatedChunks = previewChunks.length;
                      } else if (documentText && documentText.trim()) {
                        const estimatedTextLength = countTokens(documentText);
                        const effectiveChunkSize = chunkSize - chunkOverlap;
                        estimatedChunks = Math.max(1, Math.ceil(estimatedTextLength / effectiveChunkSize));
                      }
                      
                      const chunkDifference = estimatedChunks - currentChunkCount;
                      
                      return (
                        <>
                          {estimatedChunks > 0 && (
                            <span className="meta-item">
                              새 설정 예상: {estimatedChunks.toLocaleString()}개 청크
                            </span>
                          )}
                          {chunkDifference !== 0 && estimatedChunks > 0 && (
                            <span className={`meta-item ${chunkDifference > 0 ? 'increase' : 'decrease'}`}>
                              {chunkDifference > 0 ? '+' : ''}{chunkDifference.toLocaleString()}개 변화
                            </span>
                          )}
                          {currentChunkCount === 0 && !loadingMetadata && (
                            <span className="meta-item warning">
                              컬렉션이 비어있음
                            </span>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="settings-actions">
          <button
            className="btn-reset"
            onClick={handleResetSettings}
            disabled={isSaving}
          >
            기본값으로 초기화
          </button>
          <button
            className={`btn-save ${hasChanges ? 'has-changes' : ''}`}
            onClick={handleSaveSettings}
            disabled={!hasChanges || isSaving || !embeddingModel || !chunkingStrategy}
          >
            {isSaving ? (
              <>저장 중...</>
            ) : hasChanges ? (
              <>
                <FontAwesomeIcon icon={faCheckCircle} /> 설정 저장
              </>
            ) : (
              <>저장됨</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default KnowledgeBaseSettings;