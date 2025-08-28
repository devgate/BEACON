import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faBrain, 
  faCut, 
  faCog,
  faDatabase,
  faExclamationCircle,
  faCheckCircle,
  faInfoCircle,
  faSpinner,
  faFileText,
  faEllipsisH,
  faExclamationTriangle,
  faListOl,
  faChartLine
} from '@fortawesome/free-solid-svg-icons';
import { bedrockService, documentService } from '../../services/api';
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
  const [expandedSpecs, setExpandedSpecs] = useState({}); // 각 모델의 spec 확장 상태

  // Chunking Strategies
  const chunkingStrategies = [
    {
      id: 'sentence',
      name: '문장 기반 (Sentence-based)',
      description: '문장 단위로 텍스트를 분할하는 기본 전략',
      defaultSize: 512,
      defaultOverlap: 50,
      sizeRange: { min: 256, max: 2048 },
      features: ['문맥 보존', '자연스러운 분할', '빠른 처리']
    },
    {
      id: 'fixed',
      name: '고정 크기 (Fixed Size)',
      description: '일정한 토큰 수로 균등하게 분할',
      defaultSize: 1024,
      defaultOverlap: 100,
      sizeRange: { min: 512, max: 4096 },
      features: ['예측 가능한 크기', '균등 분할', '효율적 저장']
    },
    {
      id: 'paragraph',
      name: '단락 기반 (Paragraph-based)',
      description: '단락 단위로 문서를 분할하는 전략',
      defaultSize: 768,
      defaultOverlap: 75,
      sizeRange: { min: 512, max: 3072 },
      features: ['논리적 구조 유지', '문단 보존', '중간 크기 청크']
    },
    {
      id: 'semantic',
      name: '의미 기반 (Semantic)',
      description: '내용의 의미적 경계를 고려한 지능형 분할',
      defaultSize: 1024,
      defaultOverlap: 128,
      sizeRange: { min: 512, max: 2048 },
      features: ['문맥 최적화', '의미 보존', '고품질 검색']
    },
    {
      id: 'sliding',
      name: '슬라이딩 윈도우 (Sliding Window)',
      description: '겹치는 구간으로 연속적 분할',
      defaultSize: 512,
      defaultOverlap: 256,
      sizeRange: { min: 256, max: 1536 },
      features: ['높은 중첩', '정보 손실 최소화', '세밀한 검색']
    }
  ];

  // State management
  const [embeddingModel, setEmbeddingModel] = useState(null);
  const [chunkingStrategy, setChunkingStrategy] = useState(null);
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [normalize, setNormalize] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Fetch embedding models from AWS Bedrock API
  useEffect(() => {
    fetchEmbeddingModels();
    if (selectedIndexId) {
      fetchAvailableDocuments();
    }
  }, []);

  // Fetch documents when KB changes
  useEffect(() => {
    if (selectedIndexId) {
      fetchAvailableDocuments();
    } else {
      setAvailableDocuments([]);
      setSelectedDocument(null);
      setDocumentText('');
      setPreviewChunks([]);
    }
  }, [selectedIndexId]);

  // 사용자 친화적 데이터 포맷팅 함수
  const formatModelData = (model) => {
    // 차원 정보 포맷팅
    const formatDimensions = (dims) => {
      if (Array.isArray(dims)) {
        return dims.map(d => `${d.toLocaleString()}D`).join(', ');
      }
      return typeof dims === 'number' ? `${dims.toLocaleString()}D` : dims;
    };

    // 비용 정보 포맷팅
    const formatCost = (cost) => {
      if (!cost) return null;
      if (typeof cost === 'string') return cost;
      if (typeof cost === 'number') return `$${cost.toFixed(4)}/1K tokens`;
      return cost;
    };

    // 최대 토큰 포맷팅
    const formatMaxTokens = (tokens) => {
      if (!tokens) return null;
      if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
      if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
      return tokens.toString();
    };

    return {
      ...model,
      formattedDimensions: formatDimensions(model.dimensions),
      formattedCost: formatCost(model.cost),
      formattedMaxTokens: formatMaxTokens(model.maxTokens)
    };
  };

  // Spec 확장/축소 토글 함수
  const toggleSpecExpansion = (e, modelId, specType) => {
    e.stopPropagation(); // 이벤트 버블링 방지
    const key = `${modelId}-${specType}`;
    setExpandedSpecs(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

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
      const strategy = chunkingStrategy || chunkingStrategies[0]; // 기본 전략 사용
      if (strategy) {
        generatePreviewChunks(documentText, strategy, chunkSize, chunkOverlap);
        // 전략이 설정되지 않았다면 기본값으로 설정
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

  // Enhanced chunking algorithms with sophisticated implementations
  const generatePreviewChunks = (text, strategy, size, overlap) => {
    console.log('generatePreviewChunks called:', {
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

    let chunks = [];

    try {
      switch (strategy.id) {
        case 'sentence':
          chunks = chunkBySentence(text, size, overlap);
          break;
        case 'paragraph':
          chunks = chunkByParagraph(text, size, overlap);
          break;
        case 'semantic':
          chunks = chunkBySemantic(text, size, overlap);
          break;
        case 'sliding':
          chunks = chunkBySlidingWindow(text, size, overlap);
          break;
        case 'fixed':
        default:
          chunks = chunkByFixedSize(text, size, overlap);
          break;
      }

      console.log('Generated chunks:', {
        totalChunks: chunks.length,
        strategyUsed: strategy.id,
        previewChunks: Math.min(chunks.length, 10),
        targetSize: size,
        targetOverlap: overlap,
        actualTokens: chunks.map(c => c.tokens),
        avgTokens: chunks.length > 0 ? Math.round(chunks.reduce((sum, c) => sum + c.tokens, 0) / chunks.length) : 0
      });

      setPreviewChunks(chunks.slice(0, 10)); // Show first 10 chunks
    } catch (error) {
      console.error('Error generating preview chunks:', error, {
        strategy: strategy.id,
        textLength: text.length,
        size,
        overlap
      });
      setPreviewChunks([]);
      
      // 사용자에게 에러 알림
      setNotification({
        message: `청킹 생성 중 오류 발생: ${error.message}`,
        type: 'error'
      });
    }
  };

  const chunkByFixedSize = (text, size, overlap) => {
    const chunks = [];
    const words = text.split(/\s+/);
    let currentPosition = 0;
    
    while (currentPosition < words.length) {
      let currentChunk = '';
      let currentTokens = 0;
      let wordsInChunk = 0;
      let chunkStartPosition = currentPosition;
      
      // 토큰 수가 size에 도달할 때까지 단어를 추가
      while (currentPosition < words.length && currentTokens < size) {
        const nextWord = words[currentPosition];
        const nextWordTokens = countTokens(nextWord);
        
        // 다음 단어를 추가했을 때 크기를 초과하지 않는지 확인
        if (currentTokens + nextWordTokens <= size) {
          currentChunk += (currentChunk ? ' ' : '') + nextWord;
          currentTokens += nextWordTokens;
          wordsInChunk++;
          currentPosition++;
        } else {
          break;
        }
      }
      
      if (currentChunk.trim()) {
        chunks.push({
          id: chunks.length + 1,
          text: currentChunk.trim(),
          tokens: currentTokens,
          words: wordsInChunk,
          start_word: chunkStartPosition,
          end_word: currentPosition,
          type: 'fixed-size'
        });
      }
      
      // 오버랩 처리: 현재 위치에서 오버랩만큼 뒤로 이동
      if (overlap > 0 && chunks.length > 0) {
        // 오버랩 토큰 수만큼 단어 수를 역산
        let overlapWords = Math.floor(wordsInChunk * (overlap / currentTokens));
        overlapWords = Math.max(1, Math.min(overlapWords, wordsInChunk - 1));
        currentPosition = Math.max(chunkStartPosition + 1, currentPosition - overlapWords);
      }
      
      // 무한 루프 방지
      if (currentPosition <= chunkStartPosition) {
        currentPosition = chunkStartPosition + 1;
      }
    }
    
    return chunks;
  };

  const chunkBySentence = (text, size, overlap) => {
    // Enhanced sentence splitting with better boundary detection
    const sentences = splitIntoSentences(text);
    const chunks = [];
    let currentChunk = '';
    let sentenceIndices = [];
    let currentTokens = 0;

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const sentenceTokens = countTokens(sentence);
      
      // Check if adding this sentence would exceed chunk size
      if (currentTokens + sentenceTokens > size && currentChunk) {
        chunks.push({
          id: chunks.length + 1,
          text: currentChunk.trim(),
          tokens: currentTokens,
          sentences: sentenceIndices.length,
          sentence_range: `${sentenceIndices[0] + 1}-${sentenceIndices[sentenceIndices.length - 1] + 1}`,
          type: 'sentence-boundary',
          completeness: calculateSentenceCompleteness(currentChunk)
        });
        
        // Handle overlap by including some previous sentences
        const overlapSentences = Math.min(
          Math.floor(overlap / (currentTokens / sentenceIndices.length)), 
          sentenceIndices.length - 1
        );
        
        if (overlapSentences > 0) {
          const overlapStart = sentenceIndices.length - overlapSentences;
          currentChunk = sentenceIndices.slice(overlapStart).map(idx => sentences[idx]).join(' ') + ' ' + sentence;
          sentenceIndices = sentenceIndices.slice(overlapStart).concat([i]);
          currentTokens = countTokens(currentChunk);
        } else {
          currentChunk = sentence;
          sentenceIndices = [i];
          currentTokens = sentenceTokens;
        }
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        sentenceIndices.push(i);
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: currentTokens,
        sentences: sentenceIndices.length,
        sentence_range: `${sentenceIndices[0] + 1}-${sentenceIndices[sentenceIndices.length - 1] + 1}`,
        type: 'sentence-boundary',
        completeness: calculateSentenceCompleteness(currentChunk)
      });
    }

    return chunks;
  };

  const chunkByParagraph = (text, size, overlap) => {
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
    const chunks = [];
    let currentChunk = '';
    let paragraphIndices = [];
    let currentTokens = 0;

    for (let i = 0; i < paragraphs.length; i++) {
      const paragraph = paragraphs[i].trim();
      const paragraphTokens = countTokens(paragraph);
      
      if (currentTokens + paragraphTokens > size && currentChunk) {
        chunks.push({
          id: chunks.length + 1,
          text: currentChunk.trim(),
          tokens: currentTokens,
          paragraphs: paragraphIndices.length,
          paragraph_range: `${paragraphIndices[0] + 1}-${paragraphIndices[paragraphIndices.length - 1] + 1}`,
          type: 'paragraph-boundary',
          coherence: calculateParagraphCoherence(currentChunk)
        });
        
        // Handle overlap
        const overlapTokens = Math.min(overlap, currentTokens);
        const overlapParas = Math.floor(overlapTokens / (currentTokens / paragraphIndices.length));
        
        if (overlapParas > 0) {
          const overlapStart = Math.max(0, paragraphIndices.length - overlapParas);
          currentChunk = paragraphIndices.slice(overlapStart).map(idx => paragraphs[idx]).join('\n\n') + '\n\n' + paragraph;
          paragraphIndices = paragraphIndices.slice(overlapStart).concat([i]);
          currentTokens = countTokens(currentChunk);
        } else {
          currentChunk = paragraph;
          paragraphIndices = [i];
          currentTokens = paragraphTokens;
        }
      } else {
        currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        paragraphIndices.push(i);
        currentTokens += paragraphTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: currentTokens,
        paragraphs: paragraphIndices.length,
        paragraph_range: `${paragraphIndices[0] + 1}-${paragraphIndices[paragraphIndices.length - 1] + 1}`,
        type: 'paragraph-boundary',
        coherence: calculateParagraphCoherence(currentChunk)
      });
    }

    return chunks;
  };

  const chunkBySemantic = (text, size, overlap) => {
    // Advanced semantic chunking with topic coherence detection
    const sentences = splitIntoSentences(text);
    const chunks = [];
    let currentChunk = '';
    let currentTokens = 0;
    let sentenceBuffer = [];

    for (let i = 0; i < sentences.length; i++) {
      const sentence = sentences[i].trim();
      const sentenceTokens = countTokens(sentence);
      
      sentenceBuffer.push({ text: sentence, tokens: sentenceTokens, index: i });
      
      if (currentTokens + sentenceTokens > size && currentChunk) {
        // Find optimal break point based on semantic similarity
        const breakPoint = findSemanticBreakPoint(sentenceBuffer, size);
        
        const chunkSentences = sentenceBuffer.slice(0, breakPoint);
        const chunkContent = chunkSentences.map(s => s.text).join(' ');
        
        chunks.push({
          id: chunks.length + 1,
          text: chunkContent.trim(),
          tokens: countTokens(chunkContent),
          sentences: chunkSentences.length,
          type: 'semantic',
          coherence_score: calculateSemanticCoherence(chunkContent),
          topic_keywords: extractTopicKeywords(chunkContent),
          semantic_density: calculateSemanticDensity(chunkContent)
        });
        
        // Handle overlap with semantic awareness
        const overlapSize = Math.min(overlap, Math.floor(chunkSentences.length / 2));
        sentenceBuffer = sentenceBuffer.slice(breakPoint - overlapSize);
        currentChunk = sentenceBuffer.map(s => s.text).join(' ');
        currentTokens = countTokens(currentChunk);
      } else {
        currentChunk += (currentChunk ? ' ' : '') + sentence;
        currentTokens += sentenceTokens;
      }
    }

    if (currentChunk.trim()) {
      chunks.push({
        id: chunks.length + 1,
        text: currentChunk.trim(),
        tokens: currentTokens,
        sentences: sentenceBuffer.length,
        type: 'semantic',
        coherence_score: calculateSemanticCoherence(currentChunk),
        topic_keywords: extractTopicKeywords(currentChunk),
        semantic_density: calculateSemanticDensity(currentChunk)
      });
    }

    return chunks;
  };

  const chunkBySlidingWindow = (text, size, overlap) => {
    const words = text.split(/\s+/);
    const chunks = [];
    let currentPosition = 0;
    
    while (currentPosition < words.length) {
      let currentChunk = '';
      let currentTokens = 0;
      let wordsInChunk = 0;
      let startPosition = currentPosition;
      
      // 토큰 수가 size에 도달할 때까지 단어를 추가
      while (currentPosition < words.length && currentTokens < size) {
        const nextWord = words[currentPosition];
        const nextWordTokens = countTokens(nextWord);
        
        if (currentTokens + nextWordTokens <= size) {
          currentChunk += (currentChunk ? ' ' : '') + nextWord;
          currentTokens += nextWordTokens;
          wordsInChunk++;
          currentPosition++;
        } else {
          break;
        }
      }
      
      // 최소 크기 체크 (전체 크기의 30% 이상)
      if (currentChunk.trim() && currentTokens >= Math.floor(size * 0.3)) {
        // 오버랩 토큰 계산
        let actualOverlapTokens = 0;
        if (chunks.length > 0 && overlap > 0) {
          const prevChunk = chunks[chunks.length - 1];
          const overlapText = findOverlapText(prevChunk.text, currentChunk);
          actualOverlapTokens = countTokens(overlapText);
        }
        
        chunks.push({
          id: chunks.length + 1,
          text: currentChunk.trim(),
          tokens: currentTokens,
          words: wordsInChunk,
          start_word: startPosition,
          end_word: currentPosition,
          overlap_tokens: actualOverlapTokens,
          overlap_percentage: actualOverlapTokens > 0 ? Math.round((actualOverlapTokens / currentTokens) * 100) : 0,
          type: 'sliding-window',
          window_position: `${startPosition + 1}-${currentPosition}/${words.length}`,
          completeness: currentTokens >= size ? 1.0 : currentTokens / size
        });
      }
      
      // 다음 윈도우 위치 계산 (토큰 기반)
      if (overlap > 0 && currentTokens > overlap) {
        // 오버랩 토큰만큼 뒤로 이동
        let targetOverlapTokens = Math.min(overlap, Math.floor(currentTokens * 0.8));
        let overlapWords = Math.floor(wordsInChunk * (targetOverlapTokens / currentTokens));
        overlapWords = Math.max(1, Math.min(overlapWords, wordsInChunk - 1));
        
        currentPosition = Math.max(startPosition + 1, currentPosition - overlapWords);
      } else {
        // 오버랩이 없거나 작은 경우, 현재 청크 크기의 절반만큼 전진
        let stepWords = Math.max(1, Math.floor(wordsInChunk / 2));
        currentPosition = startPosition + stepWords;
      }
      
      // 무한 루프 방지
      if (currentPosition <= startPosition) {
        currentPosition = startPosition + 1;
      }
    }

    return chunks;
  };

  // Helper functions for enhanced chunking
  
  const findOverlapText = (prevText, currentText) => {
    // 이전 청크와 현재 청크의 겹치는 부분 찾기
    const prevWords = prevText.split(/\s+/);
    const currentWords = currentText.split(/\s+/);
    
    let overlapLength = 0;
    for (let i = 1; i <= Math.min(prevWords.length, currentWords.length); i++) {
      const prevSuffix = prevWords.slice(-i).join(' ');
      const currentPrefix = currentWords.slice(0, i).join(' ');
      if (prevSuffix === currentPrefix) {
        overlapLength = i;
      }
    }
    
    return overlapLength > 0 ? currentWords.slice(0, overlapLength).join(' ') : '';
  };

  const splitIntoSentences = (text) => {
    // Improved sentence splitting that handles abbreviations and edge cases
    return text
      .replace(/([.!?])\s*(?=[A-Z])/g, '$1|SENTENCE_BREAK|')
      .replace(/([.!?])\s*$/g, '$1|SENTENCE_BREAK|')
      .split('|SENTENCE_BREAK|')
      .filter(s => s.trim().length > 0)
      .map(s => s.trim());
  };

  const calculateSentenceCompleteness = (text) => {
    const sentences = splitIntoSentences(text);
    const completeSentences = sentences.filter(s => /[.!?]$/.test(s.trim())).length;
    return sentences.length > 0 ? completeSentences / sentences.length : 0;
  };

  const calculateParagraphCoherence = (text) => {
    // Simple coherence measure based on repeated words and phrases
    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const uniqueWords = new Set(words);
    const repetitionRatio = words.length > 0 ? (words.length - uniqueWords.size) / words.length : 0;
    return Math.min(1.0, repetitionRatio * 3); // Normalize and cap at 1.0
  };

  const findSemanticBreakPoint = (sentenceBuffer, targetSize) => {
    // Simple heuristic: find natural break point near target size
    let bestBreak = Math.floor(sentenceBuffer.length / 2);
    let currentTokens = 0;
    
    for (let i = 0; i < sentenceBuffer.length; i++) {
      currentTokens += sentenceBuffer[i].tokens;
      if (currentTokens >= targetSize * 0.8) {
        bestBreak = i + 1;
        break;
      }
    }
    
    return Math.min(bestBreak, sentenceBuffer.length);
  };

  const calculateSemanticCoherence = (text) => {
    // Simple coherence based on keyword repetition and sentence structure
    const words = text.toLowerCase().match(/\b\w{3,}\b/g) || [];
    const wordFreq = {};
    words.forEach(word => wordFreq[word] = (wordFreq[word] || 0) + 1);
    
    const repeatedWords = Object.values(wordFreq).filter(freq => freq > 1).length;
    return Math.min(1.0, (repeatedWords / Math.max(1, Object.keys(wordFreq).length)) * 2);
  };

  const extractTopicKeywords = (text) => {
    // Extract potential topic keywords (simplified)
    const words = text.toLowerCase().match(/\b\w{4,}\b/g) || [];
    const wordFreq = {};
    
    words.forEach(word => {
      if (!isStopWord(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([word]) => word);
  };

  const calculateSemanticDensity = (text) => {
    // Measure of information density
    const sentences = splitIntoSentences(text);
    const avgWordsPerSentence = sentences.reduce((sum, s) => 
      sum + (s.match(/\b\w+\b/g) || []).length, 0) / Math.max(1, sentences.length);
    
    return Math.min(1.0, avgWordsPerSentence / 20); // Normalize based on expected average
  };

  const isStopWord = (word) => {
    const stopWords = new Set([
      'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'i', 'it', 'for', 
      'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at', 'this', 'but', 'his', 
      'by', 'from', 'they', 'she', 'or', 'an', 'will', 'my', 'one', 'all', 'would', 
      'there', 'their', 'what', 'so', 'up', 'out', 'if', 'about', 'who', 'get', 
      'which', 'go', 'me', 'when', 'make', 'can', 'like', 'time', 'no', 'just', 
      'him', 'know', 'take', 'people', 'into', 'year', 'your', 'good', 'some', 
      'could', 'them', 'see', 'other', 'than', 'then', 'now', 'look', 'only', 
      'come', 'its', 'over', 'think', 'also', 'back', 'after', 'use', 'two', 
      'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 
      'because', 'any', 'these', 'give', 'day', 'most', 'us'
    ]);
    return stopWords.has(word.toLowerCase());
  };

  // Enhanced token counting with more accurate estimation
  const countTokens = (text) => {
    // More accurate token estimation considering:
    // - Average English word length
    // - Punctuation and spaces
    // - Special characters
    const words = text.match(/\b\w+\b/g) || [];
    const punctuation = text.match(/[.,;:!?()-]/g) || [];
    const numbers = text.match(/\b\d+\b/g) || [];
    
    // Base token count from words
    let tokenCount = words.length;
    
    // Add tokens for punctuation (roughly 1 token per 2-3 punctuation marks)
    tokenCount += Math.ceil(punctuation.length / 2.5);
    
    // Numbers often tokenize differently
    tokenCount += Math.floor(numbers.length * 0.7);
    
    // Account for subword tokenization (longer words often split)
    const longWords = words.filter(w => w.length > 6).length;
    tokenCount += Math.floor(longWords * 0.3);
    
    return Math.max(1, Math.round(tokenCount));
  };

  // Helper function for chunk type styling
  const getChunkTypeColor = (type) => {
    switch (type) {
      case 'sentence-boundary':
        return 'border-green-400 bg-green-50';
      case 'paragraph-boundary':
        return 'border-blue-400 bg-blue-50';
      case 'semantic':
        return 'border-purple-400 bg-purple-50';
      case 'sliding-window':
        return 'border-yellow-400 bg-yellow-50';
      case 'fixed-size':
        return 'border-indigo-400 bg-indigo-50';
      default:
        return 'border-gray-400 bg-gray-50';
    }
  };

  // Calculate average quality score across chunks
  const calculateAverageQuality = (chunks) => {
    if (!chunks || chunks.length === 0) return 0;

    let totalQuality = 0;
    let qualityCount = 0;

    chunks.forEach(chunk => {
      let chunkQuality = 0;
      let metrics = 0;

      // Include completeness if available
      if (chunk.completeness !== undefined) {
        chunkQuality += chunk.completeness;
        metrics++;
      }

      // Include coherence scores
      if (chunk.coherence !== undefined) {
        chunkQuality += chunk.coherence;
        metrics++;
      }
      if (chunk.coherence_score !== undefined) {
        chunkQuality += chunk.coherence_score;
        metrics++;
      }

      // Include semantic density for semantic chunks
      if (chunk.semantic_density !== undefined) {
        chunkQuality += chunk.semantic_density;
        metrics++;
      }

      // Token consistency score (closer to target size is better)
      if (chunk.tokens && chunkSize) {
        const tokenRatio = Math.min(chunk.tokens / chunkSize, chunkSize / chunk.tokens);
        chunkQuality += tokenRatio;
        metrics++;
      }

      if (metrics > 0) {
        totalQuality += chunkQuality / metrics;
        qualityCount++;
      }
    });

    return qualityCount > 0 ? totalQuality / qualityCount : 0;
  };

  // Generate strategy-specific insights
  const getStrategyInsights = (chunks, strategy) => {
    if (!chunks || !strategy) return [];

    const insights = [];

    // Basic statistics
    const avgTokens = chunks.reduce((sum, c) => sum + (c.tokens || 0), 0) / chunks.length;
    const tokenVariance = chunks.reduce((sum, c) => sum + Math.pow((c.tokens || 0) - avgTokens, 2), 0) / chunks.length;
    const consistency = Math.max(0, 1 - (Math.sqrt(tokenVariance) / avgTokens));

    // Strategy-specific analysis
    switch (strategy.id) {
      case 'sentence':
        const avgSentences = chunks
          .filter(c => c.sentences)
          .reduce((sum, c) => sum + c.sentences, 0) / chunks.filter(c => c.sentences).length;
        
        const avgCompleteness = chunks
          .filter(c => c.completeness !== undefined)
          .reduce((sum, c) => sum + c.completeness, 0) / chunks.filter(c => c.completeness !== undefined).length;

        insights.push(`청크당 평균 ${Math.round(avgSentences)}개 문장`);
        insights.push(`${Math.round(avgCompleteness * 100)}% 문장 경계 보존율`);
        if (consistency > 0.8) {
          insights.push(`청크 간 일관성 우수 (${Math.round(consistency * 100)}%)`);
        } else if (consistency > 0.6) {
          insights.push(`양호한 일관성, 일부 크기 변동 (${Math.round(consistency * 100)}%)`);
        } else {
          insights.push(`크기 변동 많음 - 매개변수 조정 권장 (${Math.round(consistency * 100)}%)`);
        }
        break;

      case 'paragraph':
        const avgParagraphs = chunks
          .filter(c => c.paragraphs)
          .reduce((sum, c) => sum + c.paragraphs, 0) / chunks.filter(c => c.paragraphs).length;
        
        const avgParagraphCoherence = chunks
          .filter(c => c.coherence !== undefined)
          .reduce((sum, c) => sum + c.coherence, 0) / chunks.filter(c => c.coherence !== undefined).length;

        insights.push(`청크당 평균 ${Math.round(avgParagraphs)}개 단락`);
        insights.push(`${Math.round(avgParagraphCoherence * 100)}% 내용 일관성 점수`);
        insights.push(`명확한 단락 구조를 가진 문서에 적합`);
        break;

      case 'semantic':
        const avgSemanticCoherence = chunks
          .filter(c => c.coherence_score !== undefined)
          .reduce((sum, c) => sum + c.coherence_score, 0) / chunks.filter(c => c.coherence_score !== undefined).length;
        
        const avgDensity = chunks
          .filter(c => c.semantic_density !== undefined)
          .reduce((sum, c) => sum + c.semantic_density, 0) / chunks.filter(c => c.semantic_density !== undefined).length;

        insights.push(`${Math.round(avgSemanticCoherence * 100)}% 의미적 일관성 점수`);
        insights.push(`${Math.round(avgDensity * 100)}% 정보 밀도`);
        
        // Count unique keywords
        const allKeywords = chunks.flatMap(c => c.topic_keywords || []);
        const uniqueKeywords = new Set(allKeywords);
        insights.push(`${uniqueKeywords.size}개의 고유 주제 키워드 식별`);
        break;

      case 'sliding':
        const avgOverlap = chunks
          .filter(c => c.overlap_percentage !== undefined && c.overlap_percentage > 0)
          .reduce((sum, c) => sum + c.overlap_percentage, 0) / chunks.filter(c => c.overlap_percentage !== undefined && c.overlap_percentage > 0).length;

        insights.push(`인접 청크 간 평균 ${Math.round(avgOverlap)}% 중첩`);
        insights.push(`${chunks.length}개의 겹치는 창으로 정보 보존 최대화`);
        insights.push(`포괄적 범위와 문맥 보존에 이상적`);
        break;

      case 'fixed':
        insights.push(`청크당 일관된 ${Math.round(avgTokens)}개 토큰 (±${Math.round(Math.sqrt(tokenVariance))})`);
        insights.push(`예측 가능한 크기로 효율적 처리 및 저장 가능`);
        if (consistency > 0.9) {
          insights.push(`우수한 균등성 - 일괄 처리에 최적`);
        } else {
          insights.push(`단어 경계로 인한 일부 변동 - 예상된 동작`);
        }
        break;

      default:
        insights.push(`${chunks.length}개 청크 생성, 평균 ${Math.round(avgTokens)}개 토큰`);
        insights.push(`토큰 일관성: ${Math.round(consistency * 100)}%`);
    }

    // 일반 권장사항
    if (chunks.length < 3) {
      insights.push('⚠️ 청크 수가 매우 적음 - 더 세밀한 분할을 위해 청크 크기 축소 고려');
    } else if (chunks.length > 20) {
      insights.push('ℹ️ 많은 작은 청크들 - 효율성을 위해 크기 증가 고려');
    } else {
      insights.push(`✓ 효과적인 검색을 위한 적절한 청크 수 (${chunks.length}개)`);
    }

    return insights;
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
      generatePreviewChunks(documentText, chunkingStrategy, chunkSize, chunkOverlap);
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
      
      // 상태 업데이트 후 청킹 미리보기 강제 실행
      if (documentText && chunkingStrategy) {
        setTimeout(() => {
          console.log('Force regenerating chunks after chunk size change');
          generatePreviewChunks(documentText, chunkingStrategy, clampedValue, chunkOverlap);
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
    
    // 상태 업데이트 후 청킹 미리보기 강제 실행
    if (documentText && chunkingStrategy) {
      setTimeout(() => {
        console.log('Force regenerating chunks after overlap change');
        generatePreviewChunks(documentText, chunkingStrategy, chunkSize, clampedValue);
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

          {loadingModels ? (
            <div className="model-loading">
              <FontAwesomeIcon icon={faSpinner} className="fa-spin" />
              <span>AWS Bedrock에서 모델을 불러오는 중...</span>
            </div>
          ) : modelsFetchError || embeddingModels.length === 0 ? (
            <div className="model-error">
              <FontAwesomeIcon icon={faExclamationCircle} />
              <span>{modelsFetchError || 'AWS Bedrock에서 사용 가능한 임베딩 모델이 없습니다'}</span>
              <button onClick={fetchEmbeddingModels} className="retry-btn">
                다시 시도
              </button>
            </div>
          ) : (
            <div className="model-selection">
              {embeddingModels.map(model => (
                <div 
                  key={model.id}
                  className={`model-card ${embeddingModel?.id === model.id ? 'selected' : ''} ${model.status !== 'ACTIVE' ? 'disabled' : ''}`}
                  onClick={() => model.status === 'ACTIVE' && handleEmbeddingModelChange(model.id)}
                >
                  {model.recommended && (
                    <div className="recommended-badge">추천</div>
                  )}
                  {model.status !== 'ACTIVE' && (
                    <div className="status-badge">사용 불가</div>
                  )}
                  <div className="model-header">
                    <h4>{model.name}</h4>
                    <span className="provider">{model.provider}</span>
                  </div>
                  <div className="model-specs">
                    <div 
                      className="spec-item dimensions clickable"
                      onClick={(e) => toggleSpecExpansion(e, model.id, 'dimensions')}
                      title="클릭하여 전체 내용 보기"
                    >
                      <div className="spec-label">차원</div>
                      <div className="spec-value">
                        {expandedSpecs[`${model.id}-dimensions`] 
                          ? model.formattedDimensions 
                          : model.formattedDimensions.length > 6 
                            ? `${model.formattedDimensions.substring(0, 6)}...` 
                            : model.formattedDimensions}
                      </div>
                    </div>
                    {model.formattedCost && (
                      <div 
                        className="spec-item cost clickable"
                        onClick={(e) => toggleSpecExpansion(e, model.id, 'cost')}
                        title="클릭하여 전체 내용 보기"
                      >
                        <div className="spec-label">비용</div>
                        <div className="spec-value">
                          {expandedSpecs[`${model.id}-cost`]
                            ? model.formattedCost
                            : model.formattedCost.length > 8 
                              ? `${model.formattedCost.substring(0, 8)}...` 
                              : model.formattedCost}
                        </div>
                      </div>
                    )}
                    {model.formattedMaxTokens && (
                      <div className="spec-item tokens">
                        <div className="spec-label">최대 토큰</div>
                        <div className="spec-value">{model.formattedMaxTokens}</div>
                      </div>
                    )}
                  </div>
                  
                  {/* 차원 상세 정보 패널 */}
                  {expandedSpecs[`${model.id}-dimensions`] && (
                    <div className="model-details-panel">
                      <div className="model-details">
                        <div className="detail-section">
                          <h5 className="detail-section-title">차원 정보</h5>
                          <div className="detail-item">
                            <span className="detail-label">사용 가능한 차원:</span>
                            <div className="detail-value">
                              {Array.isArray(model.dimensions) 
                                ? model.dimensions.map(dim => (
                                    <span key={dim} className="dimension-badge">{dim.toLocaleString()}D</span>
                                  ))
                                : <span className="dimension-badge">{model.dimensions?.toLocaleString()}D</span>
                              }
                            </div>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">벡터 크기:</span>
                            <span className="detail-value">
                              {Array.isArray(model.dimensions) 
                                ? `${Math.min(...model.dimensions).toLocaleString()} ~ ${Math.max(...model.dimensions).toLocaleString()} 차원`
                                : `${model.dimensions?.toLocaleString()} 차원 고정`
                              }
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">권장 사용:</span>
                            <span className="detail-value">
                              {Array.isArray(model.dimensions) 
                                ? "256D (빠른 처리), 512D (균형), 1024D (높은 정확도)"
                                : "고정 차원으로 일관된 성능 보장"
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* 비용 상세 정보 패널 */}
                  {expandedSpecs[`${model.id}-cost`] && (
                    <div className="model-details-panel">
                      <div className="model-details">
                        <div className="detail-section">
                          <h5 className="detail-section-title">비용 세부정보</h5>
                          <div className="detail-item">
                            <span className="detail-label">토큰당 비용:</span>
                            <span className="detail-value cost-highlight">{model.formattedCost || model.cost}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">최대 토큰:</span>
                            <span className="detail-value">{model.maxTokens?.toLocaleString()}</span>
                          </div>
                          {model.id === 'amazon.titan-embed-image-v1' && (
                            <div className="detail-item">
                              <span className="detail-label">이미지 처리:</span>
                              <span className="detail-value">이미지당 $0.0008</span>
                            </div>
                          )}
                          <div className="detail-item">
                            <span className="detail-label">예상 월 비용:</span>
                            <span className="detail-value">
                              {model.id === 'amazon.titan-embed-text-v2:0' 
                                ? "100만 토큰당 $0.02 (v1 대비 80% 절약)"
                                : model.id === 'amazon.titan-embed-text-v1'
                                ? "100만 토큰당 $0.10"
                                : "사용량에 따라 산정"
                              }
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">비용 효율성:</span>
                            <span className="detail-value">
                              {model.id === 'amazon.titan-embed-text-v2:0' 
                                ? "⭐⭐⭐⭐⭐ 매우 우수"
                                : model.id === 'amazon.titan-embed-text-v1'
                                ? "⭐⭐⭐ 보통"
                                : "⭐⭐⭐⭐ 좋음"
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {embeddingModel && (
            <div className="model-options">
              <label className="checkbox-label">
              </label>
            </div>
          )}
        </div>

        {/* Chunking Strategy Section */}
        <div className="settings-section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faCut} /> 청킹 전략
            </h3>
            <p className="section-description">
              문서를 작은 단위로 분할하는 방법을 설정합니다. 검색 정확도와 성능에 영향을 미칩니다.
            </p>
          </div>

          <div className="strategy-selection">
            <select
              value={chunkingStrategy?.id || ''}
              onChange={(e) => handleChunkingStrategyChange(e.target.value)}
              className="strategy-select"
            >
              <option value="">전략 선택...</option>
              {chunkingStrategies.map(strategy => (
                <option key={strategy.id} value={strategy.id}>
                  {strategy.name}
                </option>
              ))}
            </select>
          </div>

          {chunkingStrategy && (
            <>
              <div className="strategy-info">
                <p className="strategy-description">{chunkingStrategy.description}</p>
                <div className="strategy-features">
                  {chunkingStrategy.features.map((feature, idx) => (
                    <span key={idx} className="feature-tag">{feature}</span>
                  ))}
                </div>
              </div>

              <div className="chunking-params">
                <div className="param-group">
                  <label>
                    청크 크기 (토큰)
                    <FontAwesomeIcon 
                      icon={faInfoCircle} 
                      className="info-icon"
                      title="각 청크의 최대 토큰 수"
                    />
                  </label>
                  <div className="param-input-group">
                    <input
                      type="range"
                      min={chunkingStrategy.sizeRange.min}
                      max={chunkingStrategy.sizeRange.max}
                      value={chunkSize}
                      onChange={(e) => handleChunkSizeChange(e.target.value)}
                      onInput={(e) => handleChunkSizeChange(e.target.value)}
                      className="param-slider"
                    />
                    <input
                      type="number"
                      value={chunkSize}
                      onChange={(e) => handleChunkSizeChange(e.target.value)}
                      className="param-number"
                      min={chunkingStrategy.sizeRange.min}
                      max={chunkingStrategy.sizeRange.max}
                    />
                  </div>
                  <div className="param-hint">
                    범위: {chunkingStrategy.sizeRange.min} - {chunkingStrategy.sizeRange.max}
                  </div>
                </div>

                <div className="param-group">
                  <label>
                    오버랩 크기 (토큰)
                    <FontAwesomeIcon 
                      icon={faInfoCircle} 
                      className="info-icon"
                      title="인접 청크 간 중첩되는 토큰 수"
                    />
                  </label>
                  <div className="param-input-group">
                    <input
                      type="range"
                      min={0}
                      max={Math.floor(chunkSize * 0.5)}
                      value={chunkOverlap}
                      onChange={(e) => handleChunkOverlapChange(e.target.value)}
                      onInput={(e) => handleChunkOverlapChange(e.target.value)}
                      className="param-slider"
                    />
                    <input
                      type="number"
                      value={chunkOverlap}
                      onChange={(e) => handleChunkOverlapChange(e.target.value)}
                      className="param-number"
                      min={0}
                      max={Math.floor(chunkSize * 0.5)}
                    />
                  </div>
                  <div className="param-hint">
                    최대: {Math.floor(chunkSize * 0.5)} (청크 크기의 50%)
                  </div>
                </div>
              </div>

            </>
          )}
        </div>

        {/* Document Chunking Preview */}
        <div className="settings-section">
          <div className="section-header">
            <h3>
              <FontAwesomeIcon icon={faFileText} />
               청킹 미리보기
            </h3>
            <div className="section-description">
              현재 전략 설정에 따라 어떻게 분할되는지 미리 보려면 문서를 선택하세요.
            </div>
          </div>

          {/* Enhanced Document Selector */}
          <div className="document-selector-wrapper">
            <div className="document-selector-header">
              <label className="document-selector-label">
                미리보기할 문서 선택
              </label>
              {selectedDocument && (
                <button
                  onClick={() => {
                    if (selectedDocument) {
                      setLoadingPreview(true);
                      fetchDocumentText(selectedDocument);
                    }
                  }}
                  className="refresh-preview-btn"
                  disabled={loadingPreview}
                >
                  <FontAwesomeIcon 
                    icon={faSpinner} 
                    className={loadingPreview ? 'animate-spin' : ''} 
                  />
                  {loadingPreview ? 'Updating...' : 'Refresh'}
                </button>
              )}
            </div>
            <select
              value={selectedDocument || ''}
              onChange={(e) => {
                const docId = e.target.value || null;
                setSelectedDocument(docId);
                if (docId) {
                  fetchDocumentText(docId);
                } else {
                  setDocumentText('');
                  setPreviewChunks([]);
                }
              }}
              className="enhanced-document-select"
              disabled={availableDocuments.length === 0}
            >
              <option value="">
                {availableDocuments.length === 0 ? '사용 가능한 문서 없음' : '문서를 선택하세요...'}
              </option>
              {availableDocuments.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.title || doc.file_name} • {doc.status}
                </option>
              ))}
            </select>
            
            {/* Enhanced Quick Strategy Test */}
            {selectedDocument && !loadingPreview && (
              <div className="strategy-quick-test">
                <div className="strategy-test-label">Quick Strategy Test:</div>
                <div className="strategy-test-buttons">
                  {chunkingStrategies.map(strategy => (
                    <button
                      key={strategy.id}
                      onClick={() => {
                        handleChunkingStrategyChange(strategy.id);
                        setNotification({
                          message: `Testing with ${strategy.name}`,
                          type: 'info'
                        });
                      }}
                      className={`strategy-test-btn ${
                        chunkingStrategy?.id === strategy.id ? 'active' : ''
                      }`}
                    >
                      {strategy.name.split(' ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Preview Area */}
          {selectedDocument && (
            <div className="chunking-preview">
              {loadingPreview ? (
                <div className="flex items-center justify-center p-8">
                  <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-indigo-600 mr-3" />
                  <span className="text-gray-600">문서 미리보기 로딩 중...</span>
                </div>
              ) : documentText ? (
                <>
                  {/* 향상된 미리보기 통계 */}
                  <div className="preview-stats">
                    <div className="stat-item">
                      <span className="stat-label">총 청크 수</span>
                      <span className="stat-value">
                        {previewChunks ? previewChunks.length : 0}개
                      </span>
                    </div>
       
        
                  </div>
                  
                  {/* 전략 분석 카드 */}
                  {previewChunks && previewChunks.length > 0 && (
                    <div className="strategy-analysis-card">
                      <div className="strategy-analysis-title">
                        <FontAwesomeIcon icon={faBrain} />
                        전략 분석
                      </div>
                      <div className="strategy-insights">
                        {getStrategyInsights(previewChunks, chunkingStrategy).map((insight, i) => (
                          <div key={i} className="strategy-insight">
                            <span className="strategy-insight-bullet">•</span>
                            <span>{insight}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 향상된 청킹 콘텐츠 미리보기 */}
                  {previewChunks && previewChunks.length > 0 && (
                    <div className="chunked-content-container">
                      <div className="chunked-content-title">
                        <FontAwesomeIcon icon={faFileText} />
                        청킹된 콘텐츠 미리보기 
                        <span className="chunk-count-badge">{previewChunks.length}</span>
                      </div>
                      
                      <div className="chunks-container">
                        {previewChunks.slice(0, 10).map((chunk, index) => (
                          <div key={index} className={`chunk-item ${chunk.type?.replace('_', '-')}`}>
                            {/* Enhanced Chunk Header */}
                            <div className="chunk-header">
                              <div className="chunk-title-section">
                                <span className="chunk-id">#{chunk.id || index + 1}</span>
                                <span className={`chunk-type-tag ${chunk.type?.replace('_', '-')}`}>
                                  {chunk.type?.replace('-', ' ').replace('_', ' ') || 'standard'}
                                </span>
                              </div>
                              <div className="chunk-stats">
                                <div className="chunk-stat">
                                  {chunk.tokens || 0} tokens
                                </div>
                                {chunk.words && (
                                  <div className="chunk-stat">
                                    {chunk.words} words
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Enhanced Metadata */}
                            <div className="chunk-metadata">
                              {/* Sentence-based metadata */}
                              {chunk.type === 'sentence-boundary' && (
                                <div className="metadata-row">
                                  {chunk.sentences && (
                                    <div className="metadata-item">
                                      <FontAwesomeIcon icon={faFileText} className="metadata-icon" />
                                      <span>{chunk.sentences} sentences</span>
                                    </div>
                                  )}
                                  {chunk.sentence_range && (
                                    <div className="metadata-item">Range: {chunk.sentence_range}</div>
                                  )}
                                  {chunk.completeness !== undefined && (
                                    <div className="metadata-item">
                                      Completeness: {Math.round(chunk.completeness * 100)}%
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Paragraph-based metadata */}
                              {chunk.type === 'paragraph-boundary' && (
                                <div className="metadata-row">
                                  {chunk.paragraphs && (
                                    <div className="metadata-item">
                                      <FontAwesomeIcon icon={faFileText} className="metadata-icon" />
                                      <span>{chunk.paragraphs} paragraphs</span>
                                    </div>
                                  )}
                                  {chunk.paragraph_range && (
                                    <div className="metadata-item">Range: {chunk.paragraph_range}</div>
                                  )}
                                  {chunk.coherence !== undefined && (
                                    <div className="metadata-item">
                                      Coherence: {Math.round(chunk.coherence * 100)}%
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Semantic metadata */}
                              {chunk.type === 'semantic' && (
                                <>
                                  <div className="metadata-row">
                                    {chunk.coherence_score !== undefined && (
                                      <div className="metadata-item">
                                        Coherence: {Math.round(chunk.coherence_score * 100)}%
                                      </div>
                                    )}
                                    {chunk.semantic_density !== undefined && (
                                      <div className="metadata-item">
                                        Density: {Math.round(chunk.semantic_density * 100)}%
                                      </div>
                                    )}
                                  </div>
                                  {chunk.topic_keywords && chunk.topic_keywords.length > 0 && (
                                    <div className="topic-keywords">
                                      <span className="text-xs text-gray-500 mr-2">Keywords:</span>
                                      {chunk.topic_keywords.slice(0, 3).map((keyword, i) => (
                                        <span key={i} className="keyword-tag">
                                          {keyword}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </>
                              )}

                              {/* Sliding window metadata */}
                              {chunk.type === 'sliding-window' && (
                                <div className="metadata-row">
                                  {chunk.window_position && (
                                    <div className="metadata-item">Position: {chunk.window_position}</div>
                                  )}
                                  {chunk.overlap_percentage !== undefined && chunk.overlap_percentage > 0 && (
                                    <div className="metadata-item">Overlap: {chunk.overlap_percentage}%</div>
                                  )}
                                  {chunk.completeness !== undefined && (
                                    <div className="metadata-item">
                                      Completeness: {Math.round(chunk.completeness * 100)}%
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Fixed size metadata */}
                              {chunk.type === 'fixed-size' && chunk.start_word !== undefined && (
                                <div className="metadata-row">
                                  <div className="metadata-item">Words: {chunk.start_word + 1}-{chunk.end_word}</div>
                                  {chunk.words && (
                                    <div className="metadata-item">Length: {chunk.words} words</div>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Enhanced Chunk Content */}
                            <div className="chunk-content-wrapper">
                              <div className="chunk-content">
                                {chunk.text ? (
                                  chunk.text.length > 300 ? 
                                    `${chunk.text.substring(0, 300)}...` : 
                                    chunk.text
                                ) : (
                                  <div className="text-gray-500 italic text-center p-4">
                                    <div className="text-sm mb-1">청크 #{chunk.id || index + 1}</div>
                                    <div className="text-xs">콘텐츠를 불러올 수 없습니다</div>
                                    <div className="text-xs mt-1">
                                      토큰: {chunk.tokens || 0} | 타입: {chunk.type || 'unknown'}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Enhanced Quality indicators */}
                                <div className="quality-indicators">
                                  {chunk.completeness !== undefined && (
                                    <div className={`quality-dot ${
                                      chunk.completeness > 0.8 ? 'completeness-high' :
                                      chunk.completeness > 0.5 ? 'completeness-medium' : 'completeness-low'
                                    }`} title={`Completeness: ${Math.round(chunk.completeness * 100)}%`} />
                                  )}
                                  
                                  {(chunk.coherence !== undefined || chunk.coherence_score !== undefined) && (
                                    <div className={`quality-dot ${
                                      (chunk.coherence || chunk.coherence_score) > 0.7 ? 'coherence-high' :
                                      (chunk.coherence || chunk.coherence_score) > 0.4 ? 'coherence-medium' : 'coherence-low'
                                    }`} title={`Coherence: ${Math.round(((chunk.coherence || chunk.coherence_score) || 0) * 100)}%`} />
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                        
                        {previewChunks.length > 10 && (
                          <div className="more-chunks-indicator">
                            <FontAwesomeIcon icon={faEllipsisH} className="more-chunks-icon" />
                            <div className="more-chunks-text">
                              총 {previewChunks.length}개 청크 중 처음 10개 표시
                            </div>
                            <div className="more-chunks-detail">
                              모든 청크는 고급 지표를 포함: 토큰 수, 일관성 점수, 품질 지표
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="text-2xl mb-2" />
                  <p>문서 내용 로딩 실패</p>
                </div>
              )}
            </div>
          )}

          {/* Empty State when no document is selected */}
          {!selectedDocument && (
            <div className="chunking-preview">
              <div className="chunking-preview-empty">
                <FontAwesomeIcon icon={faFileText} className="text-4xl text-gray-400 mb-4" />
                <h4 className="text-lg font-medium text-gray-600 mb-2">문서를 선택하여 청킹 미리보기를 확인하세요</h4>
                <p className="text-gray-500 text-sm">
                  위의 문서 선택기에서 문서를 선택하면 현재 청킹 전략으로 어떻게 분할되는지 미리 볼 수 있습니다.
                </p>
              </div>
            </div>
          )}
        </div>

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
                  <div className="summary-title">예상 결과</div>
                  <div className="summary-value">
                    {(() => {
                      // 현재 설정 기준으로 예상 청크 수 계산
                      if (previewChunks.length > 0) {
                        return `${previewChunks.length}개 청크`;
                      }
                      
                      // 미리보기가 없을 때는 현재 설정으로 추정
                      let estimatedTextLength = documentText && documentText.trim() ? 
                        countTokens(documentText) : 
                        selectedDocument ? 3000 : 2000;
                      
                      const effectiveChunkSize = chunkSize - chunkOverlap;
                      const estimatedChunks = Math.max(1, Math.ceil(estimatedTextLength / effectiveChunkSize));
                      
                      return `약 ${estimatedChunks}개 청크`;
                    })()}
                  </div>
                  <div className="summary-meta">
                    <span className="meta-item">
                      실제 청크: {previewChunks.length > 0 ? `${previewChunks.length}개` : '미리보기 필요'}
                    </span>
                    {previewChunks.length > 0 && (
                      <span className="meta-item success">
                        미리보기 완료
                      </span>
                    )}
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