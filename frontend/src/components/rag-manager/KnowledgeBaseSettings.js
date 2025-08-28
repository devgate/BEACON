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

        // Load current collection settings if available
        if (response.stats.metadata) {
          loadSettingsFromCollectionMetadata(response.stats.metadata);
        } else {
          // Set default to sentence-based strategy (first in array)
          setChunkingStrategy(chunkingStrategies[0]); // Sentence-based is now first
          setChunkSize(chunkingStrategies[0].defaultSize);
          setChunkOverlap(chunkingStrategies[0].defaultOverlap);
        }
      }
    } catch (error) {
      console.error('Failed to load collection metadata:', error);
      setCollectionMetadata(null);
      setCurrentChunkCount(0);
      // Still set default to sentence-based even on error
      setChunkingStrategy(chunkingStrategies[0]);
      setChunkSize(chunkingStrategies[0].defaultSize);
      setChunkOverlap(chunkingStrategies[0].defaultOverlap);
    } finally {
      setLoadingMetadata(false);
    }
  };

  // Load settings from collection metadata
  const loadSettingsFromCollectionMetadata = (metadata) => {
    console.log('Loading settings from collection metadata:', metadata);
    
    // Load current chunk size from collection if available
    const loadedChunkSize = metadata.chunk_size || 512;
    const loadedChunkOverlap = metadata.chunk_overlap || 50;
    const loadedStrategyId = metadata.chunking_strategy || 'sentence';
    
    // Find the strategy based on what's actually stored in ChromaDB
    let strategy = chunkingStrategies.find(s => s.id === loadedStrategyId);
    
    // If the actual stored strategy is found, use it regardless of size range
    if (strategy) {
      console.log(`Using actual stored strategy: ${strategy.id} for chunk size ${loadedChunkSize}`);
      
      // If chunk size exceeds strategy's normal range, we need to extend the strategy temporarily
      if (loadedChunkSize > strategy.sizeRange.max) {
        console.log(`Extending strategy range from ${strategy.sizeRange.max} to ${loadedChunkSize} for stored data`);
        // Create a temporary extended strategy for display purposes
        strategy = {
          ...strategy,
          sizeRange: {
            ...strategy.sizeRange,
            max: Math.max(strategy.sizeRange.max, loadedChunkSize)
          }
        };
      }
    } else {
      // Only fallback to compatible strategy if the stored strategy doesn't exist
      console.log(`Strategy ${loadedStrategyId} not found, finding compatible strategy for chunk size ${loadedChunkSize}`);
      strategy = chunkingStrategies.find(s => 
        loadedChunkSize >= s.sizeRange.min && loadedChunkSize <= s.sizeRange.max
      );
      
      // If no compatible strategy found, use paragraph-based (has largest range)
      if (!strategy) {
        console.log('No compatible strategy found, using paragraph-based with extended range');
        strategy = chunkingStrategies.find(s => s.id === 'paragraph') || chunkingStrategies[0];
      }
    }
    
    // Update all states synchronously
    setChunkSize(loadedChunkSize);
    setChunkOverlap(loadedChunkOverlap);
    setChunkingStrategy(strategy);
    
    // Don't set hasChanges since we're loading current settings
    setHasChanges(false);
    
    console.log('Settings loaded and applied:', {
      chunk_size: loadedChunkSize,
      chunk_overlap: loadedChunkOverlap,
      original_strategy: loadedStrategyId,
      applied_strategy: strategy.id,
      strategy_name: strategy.name,
      strategy_range: strategy.sizeRange,
      total_tokens: metadata.total_tokens
    });
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
  const handleDocumentSelect = async (documentId) => {
    console.log('Document selected for preview:', documentId);
    if (documentId) {
      setSelectedDocument(documentId);
      
      // Get actual stored chunk count from ChromaDB first
      try {
        const response = await fetch(`http://localhost:5000/api/chroma/document/${documentId}`);
        const docInfo = await response.json();
        
        if (docInfo.success && docInfo.document_info) {
          const actualChunkCount = docInfo.document_info.chunk_count || 0;
          console.log(`Document ${documentId} has ${actualChunkCount} actual chunks in ChromaDB`);
          
          // Get actual chunk contents from ChromaDB
          try {
            const chunksResponse = await fetch(`http://localhost:5000/api/chroma/document/${documentId}/chunks`);
            const chunksData = await chunksResponse.json();
            
            if (chunksData.success && chunksData.chunks) {
              const actualChunks = chunksData.chunks.map((chunkText, i) => ({
                id: i,
                text: chunkText,
                size: `${chunkText.length} chars`,
                actualChunk: true,
                chunkIndex: i + 1,
                totalChunks: chunksData.chunk_count
              }));
              
              setPreviewChunks(actualChunks);
              setDocumentText(chunksData.chunks.join('\n\n--- 청크 구분 ---\n\n'));
              
              console.log(`Loaded ${actualChunks.length} actual chunks from ChromaDB for ${documentId}`);
              return;
            }
          } catch (chunksError) {
            console.error('Failed to fetch actual chunks:', chunksError);
          }
          
          // Fallback: Create preview chunks showing the actual count
          const actualChunks = Array.from({length: actualChunkCount}, (_, i) => ({
            id: i,
            text: `실제 저장된 청크 ${i + 1}/${actualChunkCount} (내용 로딩 실패)`,
            size: 'varies',
            actualChunk: true
          }));
          
          setPreviewChunks(actualChunks);
          return;
        } else {
          console.log('No ChromaDB info available, falling back to text simulation');
          fetchDocumentText(documentId);
        }
      } catch (error) {
        console.error('Failed to get actual chunk count:', error);
        fetchDocumentText(documentId);
      }
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
      // Reset to defaults when no KB selected - use fixed-size strategy
      setEmbeddingModel(null);
      const fixedSizeStrategy = chunkingStrategies.find(s => s.id === 'fixed') || chunkingStrategies[0];
      setChunkingStrategy(fixedSizeStrategy);
      setChunkSize(fixedSizeStrategy.defaultSize);
      setChunkOverlap(fixedSizeStrategy.defaultOverlap);
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
      // Set defaults for new knowledge base - use sentence-based strategy
      const recommendedModel = embeddingModels.find(m => m.recommended) || embeddingModels[0];
      setEmbeddingModel(recommendedModel);
      
      const sentenceStrategy = chunkingStrategies.find(s => s.id === 'sentence') || chunkingStrategies[0];
      setChunkingStrategy(sentenceStrategy);
      setChunkSize(sentenceStrategy.defaultSize);
      setChunkOverlap(sentenceStrategy.defaultOverlap);
      setNormalize(true);
    }
    
    setHasChanges(false);
  };

  // Re-load settings when models are fetched
  useEffect(() => {
    if (embeddingModels.length > 0 && selectedIndexId) {
      // Only load localStorage settings if we don't have collection metadata
      if (!collectionMetadata || !collectionMetadata.metadata) {
        console.log('Loading localStorage settings - no collection metadata available');
        loadSettings();
      } else {
        console.log('Skipping localStorage settings - collection metadata already loaded');
        // Just set the embedding model but don't override chunking settings
        const recommendedModel = embeddingModels.find(m => m.recommended) || embeddingModels[0];
        if (recommendedModel && !embeddingModel) {
          setEmbeddingModel(recommendedModel);
        }
      }
    }
  }, [embeddingModels, collectionMetadata]);

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
      
      // Reset to sentence-based strategy (default)
      const sentenceStrategy = chunkingStrategies.find(s => s.id === 'sentence') || chunkingStrategies[0];
      setChunkingStrategy(sentenceStrategy);
      setChunkSize(sentenceStrategy.defaultSize);
      setChunkOverlap(sentenceStrategy.defaultOverlap);
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
                    ) : selectedDocument ? (
                      `선택 문서: ${(() => {
                        if (previewChunks.length > 0) {
                          return `${previewChunks.length}개 청크`;
                        } else if (documentText && documentText.trim()) {
                          const estimatedTextLength = countTokens(documentText);
                          const effectiveChunkSize = chunkSize - chunkOverlap;
                          const estimatedChunks = Math.max(1, Math.ceil(estimatedTextLength / effectiveChunkSize));
                          return `약 ${estimatedChunks}개 청크 예상`;
                        }
                        return '미리보기 필요';
                      })()}`
                    ) : (
                      `현재 컬렉션: ${currentChunkCount.toLocaleString()}개 청크`
                    )}
                  </div>
                  <div className="summary-meta">
                    {(() => {
                      if (selectedDocument) {
                        // 선택된 문서가 있는 경우: 문서별 청킹 정보 표시
                        const docName = availableDocuments.find(doc => doc.id.toString() === selectedDocument.toString())?.file_name || 'Unknown';
                        
                        return (
                          <>
                            <span className="meta-item">
                              문서: {docName.length > 20 ? `${docName.substring(0, 20)}...` : docName}
                            </span>
                            {documentText && (
                              <span className="meta-item">
                                텍스트: {countTokens(documentText).toLocaleString()} 토큰
                              </span>
                            )}
                            {previewChunks.length > 0 && (
                              <span className="meta-item success">
                                미리보기 완료
                              </span>
                            )}
                          </>
                        );
                      } else {
                        // 컬렉션 전체 정보 표시 - 개별 문서 청킹 시뮬레이션 기반 계산
                        let estimatedChunks = 0;
                        
                        // 개별 문서들의 실제 청킹 시뮬레이션 결과를 합산하여 계산
                        if (availableDocuments && availableDocuments.length > 0) {
                          console.log('Calculating per-document chunk estimates with actual chunking service:', {
                            documentsCount: availableDocuments.length,
                            currentSettings: { chunkSize, chunkOverlap, strategy: chunkingStrategy?.id },
                            collectionCurrentChunks: currentChunkCount
                          });
                          
                          // 각 문서에 대해 실제 청킹 서비스를 사용한 시뮬레이션 수행
                          for (const doc of availableDocuments) {
                            try {
                              // 문서의 실제 텍스트 가져오기 (캐시된 documentText 사용 또는 API 호출)
                              let docText = '';
                              
                              // 현재 선택된 문서와 같으면 이미 로딩된 텍스트 사용
                              if (selectedDocument && selectedDocument.toString() === doc.id.toString() && documentText) {
                                docText = documentText;
                              } else {
                                // API에서 문서 텍스트 가져오기 (실제 구현에서는 캐싱 필요)
                                console.log(`Need to fetch text for document ${doc.file_name} (id: ${doc.id})`);
                                // 임시로 추정된 텍스트 길이 사용 (실제 텍스트를 가져올 수 없는 경우)
                                const docChunkCount = doc.chunk_count || 1;
                                const collectionChunkSize = collectionMetadata?.metadata?.chunk_size || 512;
                                const collectionOverlap = collectionMetadata?.metadata?.chunk_overlap || 50;
                                const collectionEffectiveChunkSize = Math.max(1, collectionChunkSize - collectionOverlap);
                                const estimatedDocTokens = docChunkCount * collectionEffectiveChunkSize;
                                
                                // 임시 텍스트 생성 (실제 토큰 수에 기반한 더미 텍스트)
                                const wordsPerToken = 0.75; // 대략적인 토큰-단어 비율
                                const estimatedWords = Math.ceil(estimatedDocTokens * wordsPerToken);
                                docText = Array(estimatedWords).fill('word').join(' ');
                              }
                              
                              // 실제 청킹 서비스를 사용하여 예상 청크 수 계산
                              if (docText && chunkingStrategy) {
                                const chunks = generatePreviewChunks(docText, chunkingStrategy, chunkSize, chunkOverlap);
                                const docEstimatedChunks = chunks.length;
                                
                                console.log(`Document ${doc.file_name} actual chunking simulation:`, {
                                  original_chunks: doc.chunk_count || 0,
                                  text_length: docText.length,
                                  simulated_chunks: docEstimatedChunks,
                                  strategy: chunkingStrategy.id,
                                  chunk_size: chunkSize,
                                  overlap: chunkOverlap
                                });
                                
                                estimatedChunks += docEstimatedChunks;
                              }
                            } catch (error) {
                              console.error(`Failed to simulate chunking for document ${doc.file_name}:`, error);
                              // 실패한 경우 기존 수학적 계산으로 폴백
                              const docChunkCount = doc.chunk_count || 1;
                              const collectionChunkSize = collectionMetadata?.metadata?.chunk_size || 512;
                              const collectionOverlap = collectionMetadata?.metadata?.chunk_overlap || 50;
                              const collectionEffectiveChunkSize = Math.max(1, collectionChunkSize - collectionOverlap);
                              const estimatedDocTokens = docChunkCount * collectionEffectiveChunkSize;
                              const newEffectiveChunkSize = Math.max(1, chunkSize - chunkOverlap);
                              const docEstimatedChunks = Math.max(1, Math.ceil(estimatedDocTokens / newEffectiveChunkSize));
                              estimatedChunks += docEstimatedChunks;
                            }
                          }
                        } else if (collectionMetadata && collectionMetadata.total_tokens) {
                          // 문서 목록이 없는 경우 전체 토큰 기반 계산 (백업)
                          const effectiveChunkSize = Math.max(1, chunkSize - chunkOverlap);
                          estimatedChunks = Math.max(1, Math.ceil(collectionMetadata.total_tokens / effectiveChunkSize));
                        } else if (currentChunkCount > 0) {
                          // 메타데이터가 없는 경우 현재 청크 수 기반으로 추정
                          const currentAvgChunkSize = 512; // 기존 설정 추정값
                          const newEffectiveChunkSize = Math.max(1, chunkSize - chunkOverlap);
                          const sizeRatio = currentAvgChunkSize / newEffectiveChunkSize;
                          estimatedChunks = Math.max(1, Math.ceil(currentChunkCount * sizeRatio));
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
                      }
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