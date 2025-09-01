import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faCut, 
  faRuler, 
  faLayerGroup, 
  faEye, 
  faBrain, 
  faInfoCircle,
  faFileAlt,
  faUpload,
  faDownload,
  faChartBar,
  faRefresh,
  faMagic,
  faPlay,
  faStop,
  faCopy,
  faExpand
} from '@fortawesome/free-solid-svg-icons';
import { chunkBySentence, chunkByParagraph, chunkByFixedSize, chunkBySemantic } from '../../services/chunkingService';
import { documentService } from '../../services/api';

const ChunkingStrategy = ({ 
  strategy, 
  onStrategyChange, 
  selectedIndexId,
  previewText = null,
  disabled = false,
  onTabSwitch = null
}) => {
  // Available chunking strategies
  const strategies = [
    {
      id: 'sentence',
      name: '문장 기반 (Sentence-based)',
      icon: faCut,
      description: '문장 단위로 텍스트를 분할합니다',
      params: {
        chunkSize: { min: 100, max: 2000, default: 512, step: 50 },
        overlap: { min: 0, max: 200, default: 50, step: 10 }
      }
    },
    {
      id: 'paragraph',
      name: '단락 기반 (Paragraph-based)', 
      icon: faLayerGroup,
      description: '단락 단위로 텍스트를 분할합니다',
      params: {
        chunkSize: { min: 200, max: 3000, default: 1024, step: 100 },
        overlap: { min: 0, max: 300, default: 100, step: 20 }
      }
    },
    {
      id: 'fixed',
      name: '고정 크기 (Fixed-size)',
      icon: faRuler,
      description: '고정된 토큰 수로 분할합니다',
      params: {
        chunkSize: { min: 100, max: 2000, default: 768, step: 50 },
        overlap: { min: 0, max: 200, default: 75, step: 10 }
      }
    },
    {
      id: 'semantic',
      name: '의미 기반 (Semantic)',
      icon: faBrain,
      description: '의미적 경계를 기준으로 분할합니다',
      params: {
        chunkSize: { min: 200, max: 2000, default: 1000, step: 100 },
        overlap: { min: 0, max: 150, default: 50, step: 10 }
      }
    }
  ];

  const [selectedStrategy, setSelectedStrategy] = useState(strategy?.id || 'sentence');
  const [chunkSize, setChunkSize] = useState(512);
  const [overlap, setOverlap] = useState(50);
  const [showPreview, setShowPreview] = useState(false);
  const [previewChunks, setPreviewChunks] = useState([]);
  const [availableDocuments, setAvailableDocuments] = useState([]);
  const [selectedDocument, setSelectedDocument] = useState(null);
  const [documentText, setDocumentText] = useState('');
  const [loadingDocument, setLoadingDocument] = useState(false);
  const [chunkingMetrics, setChunkingMetrics] = useState(null);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [isRealTimePreview, setIsRealTimePreview] = useState(true);
  const [previewMode, setPreviewMode] = useState('sample'); // 'sample' | 'document'
  const [isProcessing, setIsProcessing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load saved configuration and available documents
  useEffect(() => {
    console.log('🚀 ChunkingStrategy useEffect triggered. selectedIndexId:', selectedIndexId);
    console.log('🔍 ChunkingStrategy component is mounted and running!');
    
    if (selectedIndexId) {
      const savedConfig = localStorage.getItem(`chunking_config_${selectedIndexId}`);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        setSelectedStrategy(config.strategy);
        setChunkSize(config.chunkSize);
        setOverlap(config.overlap);
        setHasChanges(false); // Reset changes flag when loading saved config
        console.log('⚙️ Loaded saved config:', config);
      }
    }
    
    // Always load available documents for testing (regardless of selectedIndexId)
    console.log('🔄 About to call loadAvailableDocuments...');
    loadAvailableDocuments();
  }, [selectedIndexId]);

  // Track changes to strategy, size, or overlap
  useEffect(() => {
    if (selectedIndexId) {
      const savedConfig = localStorage.getItem(`chunking_config_${selectedIndexId}`);
      if (savedConfig) {
        const config = JSON.parse(savedConfig);
        const hasConfigChanges = (
          config.strategy !== selectedStrategy ||
          config.chunkSize !== chunkSize ||
          config.overlap !== overlap
        );
        setHasChanges(hasConfigChanges);
      } else {
        // If no saved config, consider any non-default values as changes
        const defaultStrategy = 'sentence';
        const defaultChunkSize = 512;
        const defaultOverlap = 50;
        const hasConfigChanges = (
          selectedStrategy !== defaultStrategy ||
          chunkSize !== defaultChunkSize ||
          overlap !== defaultOverlap
        );
        setHasChanges(hasConfigChanges);
      }
    }
  }, [selectedStrategy, chunkSize, overlap, selectedIndexId]);

  // Add additional useEffect to load documents on component mount
  useEffect(() => {
    console.log('🎯 Component mounted, loading documents...');
    loadAvailableDocuments();
  }, []); // Empty dependency array means this runs only once on mount

  // Generate preview chunks
  useEffect(() => {
    if (showPreview) {
      if (previewMode === 'document' && documentText) {
        generatePreviewChunks(documentText);
      } else if (previewMode === 'sample' && previewText) {
        generatePreviewChunks(previewText);
      }
    }
  }, [previewText, documentText, selectedStrategy, chunkSize, overlap, showPreview, previewMode]);

  // Real-time preview updates
  useEffect(() => {
    if (isRealTimePreview && showPreview) {
      const debounceTimer = setTimeout(() => {
        if (previewMode === 'document' && documentText) {
          generatePreviewChunks(documentText);
        } else if (previewMode === 'sample' && previewText) {
          generatePreviewChunks(previewText);
        }
      }, 300); // 300ms debounce
      
      return () => clearTimeout(debounceTimer);
    }
  }, [chunkSize, overlap, selectedStrategy, isRealTimePreview, showPreview, previewMode, documentText, previewText]);

  const loadAvailableDocuments = async () => {
    console.log('🔄 Starting to load available documents...'); // Debug log
    
    try {
      const response = await fetch('/api/documents');
      console.log('📡 API Response status:', response.status, response.ok); // Debug log
      
      if (response.ok) {
        const data = await response.json();
        console.log('📄 Raw documents from API:', data); // Debug log
        console.log('📄 API Response type:', typeof data, 'Array?', Array.isArray(data)); // Debug log
        
        // Handle different response formats - API returns object with documents array
        const documentsArray = data.documents || (Array.isArray(data) ? data : []);
        console.log('📋 Processed documents array (length: ' + documentsArray.length + '):', documentsArray); // Debug log
        
        // More lenient filtering for all document types
        const processedDocs = documentsArray.filter(doc => {
          // Check all possible filename fields
          const fileName = doc.title || doc.file_name || doc.filename || doc.name || '';
          const hasFileName = fileName.length > 0;
          
          // Support more file types for testing
          const isSupportedFile = hasFileName && (
            fileName.toLowerCase().endsWith('.pdf') || 
            fileName.toLowerCase().endsWith('.txt') ||
            fileName.toLowerCase().endsWith('.doc') ||
            fileName.toLowerCase().endsWith('.docx') ||
            fileName.toLowerCase().endsWith('.md')
          );
          
          // Support all positive status values
          const hasValidStatus = !doc.status || 
            ['Ready', 'ready', 'processed', 'Success', 'success', 'completed', 'done', 'finished', 'ok'].includes(doc.status);
          
          const passes = isSupportedFile && hasValidStatus;
          
          console.log('🔍 Document filter check:', {
            id: doc.id,
            fileName,
            status: doc.status,
            hasFileName,
            isSupportedFile,
            hasValidStatus,
            passes,
            fullDoc: doc
          }); // Debug log
          
          return passes;
        });
        
        console.log('✅ Filtered processedDocs (final count: ' + processedDocs.length + '):', processedDocs); // Debug log
        
        // Force add a document if API returns documents but filtering removes them (for debugging)
        if (documentsArray.length > 0 && processedDocs.length === 0) {
          console.log('⚠️ Documents exist but all filtered out, adding first document anyway for testing...');
          const testDoc = { ...documentsArray[0] };
          // Ensure it has a valid title
          if (!testDoc.title && !testDoc.file_name && !testDoc.filename) {
            testDoc.title = testDoc.name || documentsArray[0].title || `Document_${testDoc.id}`;
          }
          // Ensure we mark it as available for testing
          testDoc.status = testDoc.status || 'Ready';
          processedDocs.push(testDoc);
        }
        
        setAvailableDocuments(processedDocs);
        console.log('📊 Final availableDocuments set:', processedDocs);
        
      } else {
        console.error('❌ API response not OK:', response.status, response.statusText);
        setAvailableDocuments([]);
      }
    } catch (error) {
      console.error('💥 Failed to load documents:', error);
      setAvailableDocuments([]);
    }
  };

  const loadDocumentContent = async (documentId) => {
    try {
      setLoadingDocument(true);
      console.log('Loading document content for ID:', documentId); // Debug log
      
      const response = await fetch(`/api/documents/${documentId}/preview`);
      console.log('Document preview response:', response.status); // Debug log
      
      if (response.ok) {
        const data = await response.json();
        console.log('Document preview data:', data); // Debug log
        
        const textContent = data.text_content || data.textContent || '';
        
        if (!textContent || textContent.trim().length === 0) {
          throw new Error('문서에서 텍스트 내용을 찾을 수 없습니다. 파일이 손상되었거나 텍스트를 포함하지 않을 수 있습니다.');
        }
        
        setDocumentText(textContent);
        
        // Find the document in available documents with flexible ID matching
        const foundDoc = availableDocuments.find(doc => 
          (doc.id && doc.id == documentId) || 
          (doc.document_id && doc.document_id == documentId)
        );
        
        console.log('Found document:', foundDoc); // Debug log
        setSelectedDocument(foundDoc || { id: documentId });
        setPreviewMode('document');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error loading document:', error);
      alert(`문서 내용을 불러오는데 실패했습니다: ${error.message}`);
    } finally {
      setLoadingDocument(false);
    }
  };

  const generatePreviewChunks = (inputText) => {
    if (!inputText) return;

    const startTime = performance.now();
    let chunks = [];
    const maxPreviewLength = showFullPreview ? inputText.length : Math.min(inputText.length, 10000);
    const text = inputText.substring(0, maxPreviewLength);

    switch (selectedStrategy) {
      case 'sentence':
        chunks = chunkBySentence(text, chunkSize, overlap);
        break;
      case 'paragraph':
        chunks = chunkByParagraph(text, chunkSize, overlap);
        break;
      case 'fixed':
        chunks = chunkByFixedSize(text, chunkSize, overlap);
        break;
      case 'semantic':
        chunks = chunkBySemantic(text, chunkSize, overlap);
        break;
      default:
        chunks = chunkBySentence(text, chunkSize, overlap);
    }

    const endTime = performance.now();
    const processingTime = endTime - startTime;

    // Calculate metrics
    const metrics = {
      totalChunks: chunks.length,
      averageChunkSize: chunks.length > 0 ? Math.round(chunks.reduce((sum, chunk) => sum + chunk.length, 0) / chunks.length) : 0,
      minChunkSize: chunks.length > 0 ? Math.min(...chunks.map(chunk => chunk.length)) : 0,
      maxChunkSize: chunks.length > 0 ? Math.max(...chunks.map(chunk => chunk.length)) : 0,
      totalCharacters: text.length,
      processingTime: Math.round(processingTime * 100) / 100,
      estimatedTokens: Math.ceil(text.length / 4), // Rough estimate
      overlapEfficiency: overlap > 0 ? ((chunks.length - 1) * overlap / text.length * 100).toFixed(1) : 0
    };

    setChunkingMetrics(metrics);
    setPreviewChunks(showFullPreview ? chunks : chunks.slice(0, 8)); // Show first 8 chunks by default
  };





  const handleStrategySelect = (strategyId) => {
    const strategy = strategies.find(s => s.id === strategyId);
    setSelectedStrategy(strategyId);
    
    // Set default values for the strategy
    setChunkSize(strategy.params.chunkSize.default);
    setOverlap(strategy.params.overlap.default);
    
    updateConfig(strategyId, strategy.params.chunkSize.default, strategy.params.overlap.default);
  };

  const updateConfig = (strategyId, size, overlapValue) => {
    const config = {
      strategy: strategyId,
      chunkSize: size,
      overlap: overlapValue,
      strategyName: strategies.find(s => s.id === strategyId)?.name
    };

    onStrategyChange(config);

    // Save configuration
    if (selectedIndexId) {
      localStorage.setItem(`chunking_config_${selectedIndexId}`, JSON.stringify(config));
    }
  };

  const copyChunkToClipboard = async (chunk, index) => {
    try {
      await navigator.clipboard.writeText(chunk);
      alert(`Chunk #${index + 1} copied to clipboard!`);
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = chunk;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      alert(`Chunk #${index + 1} copied to clipboard!`);
    }
  };

  const exportChunks = () => {
    const documentName = selectedDocument?.title || selectedDocument?.file_name || selectedDocument?.filename || 'sample_text';
    const exportData = {
      strategy: selectedStrategy,
      chunkSize: chunkSize,
      overlap: overlap,
      metrics: chunkingMetrics,
      chunks: previewChunks,
      documentName: documentName,
      previewMode: previewMode,
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chunking-preview-${selectedStrategy}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const resetPreview = () => {
    setSelectedDocument(null);
    setDocumentText('');
    setPreviewMode('sample');
    setPreviewChunks([]);
    setChunkingMetrics(null);
    setShowFullPreview(false);
  };

  const handleApplyStrategy = async () => {
    if (!selectedIndexId) {
      alert('지식 베이스를 선택해주세요.');
      return;
    }
    
    if (!hasChanges) {
      alert('변경된 설정이 없습니다.');
      return;
    }

    // 확인 다이얼로그 없이 바로 적용
    try {
      setIsProcessing(true);

      console.log('Applying chunking strategy:', {
        strategy: selectedStrategy,
        chunkSize: chunkSize,
        overlap: overlap
      });

      // Call the reprocess API
      const response = await documentService.reprocessKnowledgeBaseChunks(selectedIndexId, {
        strategy: selectedStrategy,
        chunkSize: chunkSize,
        overlap: overlap
      });

      console.log('Reprocess response:', response);

      // Save the new configuration
      updateConfig(selectedStrategy, chunkSize, overlap);
      setHasChanges(false);

      // Switch to File Manager tab to show progress
      if (onTabSwitch) {
        onTabSwitch('file-manager');
      }

      // Show success message
      alert(`${response.processed_count}개 문서가 성공적으로 재처리되었습니다.`);

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('documentsReprocessed', {
        detail: {
          indexId: selectedIndexId,
          processedCount: response.processed_count,
          failedCount: response.failed_count,
          totalChunks: response.total_chunks
        }
      }));

    } catch (error) {
      console.error('Failed to reprocess documents:', error);
      alert(`문서 재처리 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };


  const currentStrategy = strategies.find(s => s.id === selectedStrategy);

  return (
    <div className="chunking-strategy-container">
      <div className="config-header">
        <h3>
          <FontAwesomeIcon icon={faCut} className="header-icon" />
          청킹 전략 설정
        </h3>
        <div className="header-controls">
          <button 
            className="btn-preview"
            onClick={() => setShowPreview(!showPreview)}
            title={showPreview ? "Hide preview" : "Show preview"}
          >
            <FontAwesomeIcon icon={showPreview ? faStop : faPlay} />
            {showPreview ? '숨기기' : '미리보기'}
          </button>
          {showPreview && (
            <button 
              className="btn-realtime"
              onClick={() => setIsRealTimePreview(!isRealTimePreview)}
              title={`${isRealTimePreview ? 'Disable' : 'Enable'} real-time preview`}
            >
              <FontAwesomeIcon icon={isRealTimePreview ? faMagic : faRefresh} />
              {isRealTimePreview ? '실시간' : '수동'}
            </button>
          )}
        </div>
      </div>

      <div className="strategy-selector">
        <label className="config-label">분할 전략 선택</label>
        <div className="strategy-grid">
          {strategies.map(strat => (
            <div
              key={strat.id}
              className={`strategy-card ${selectedStrategy === strat.id ? 'selected' : ''} ${disabled ? 'disabled' : ''}`}
              onClick={() => !disabled && handleStrategySelect(strat.id)}
            >
              <div className="strategy-header">
                <FontAwesomeIcon icon={strat.icon} className="strategy-icon" />
                <span className="strategy-name">{strat.name}</span>
              </div>
              <div className="strategy-description">{strat.description}</div>
            </div>
          ))}
        </div>
      </div>

      {currentStrategy && (
        <div className="params-config">
          <div className="param-group">
            <label className="param-label">
              청크 크기 (Chunk Size): <strong>{chunkSize} tokens</strong>
            </label>
            <input
              type="range"
              min={currentStrategy.params.chunkSize.min}
              max={currentStrategy.params.chunkSize.max}
              step={currentStrategy.params.chunkSize.step}
              value={chunkSize}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setChunkSize(value);
                updateConfig(selectedStrategy, value, overlap);
              }}
              disabled={disabled}
              className="range-slider"
            />
            <div className="range-labels">
              <span>{currentStrategy.params.chunkSize.min}</span>
              <span>{currentStrategy.params.chunkSize.max}</span>
            </div>
          </div>

          <div className="param-group">
            <label className="param-label">
              오버랩 크기 (Overlap): <strong>{overlap} tokens</strong>
            </label>
            <input
              type="range"
              min={currentStrategy.params.overlap.min}
              max={currentStrategy.params.overlap.max}
              step={currentStrategy.params.overlap.step}
              value={overlap}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                setOverlap(value);
                updateConfig(selectedStrategy, chunkSize, value);
              }}
              disabled={disabled}
              className="range-slider"
            />
            <div className="range-labels">
              <span>{currentStrategy.params.overlap.min}</span>
              <span>{currentStrategy.params.overlap.max}</span>
            </div>
          </div>
        </div>
      )}


      {/* Document Selection for Testing */}
      {showPreview && (
        <div className="document-selection">
          <div className="selection-header">
            <h4>
              <FontAwesomeIcon icon={faFileAlt} className="header-icon" />
              테스트 문서 선택
            </h4>
            <div className="selection-controls">
              <button 
                className={`mode-btn ${previewMode === 'sample' ? 'active' : ''}`}
                onClick={() => setPreviewMode('sample')}
                title="Use sample text"
              >
                샘플 텍스트
              </button>
              <button 
                className={`mode-btn ${previewMode === 'document' ? 'active' : ''}`}
                onClick={() => setPreviewMode('document')}
                title="Use uploaded document"
                disabled={availableDocuments.length === 0}
              >
                업로드된 파일 ({availableDocuments.length})
                {availableDocuments.length === 0 && ' - 없음'}
              </button>
            </div>
          </div>

          {previewMode === 'document' && (
            <div className="document-picker">
              <div className="debug-info" style={{padding: '8px', background: '#1a202c', borderRadius: '4px', marginBottom: '12px', fontSize: '11px', color: '#a0aec0', border: '1px solid #2d3748'}}>
                <div style={{fontWeight: 'bold', marginBottom: '4px', color: '#e2e8f0'}}>🔧 디버그 정보</div>
                <div>📊 찾은 문서 수: <span style={{color: availableDocuments.length > 0 ? '#48bb78' : '#f56565', fontWeight: 'bold'}}>{availableDocuments.length}</span></div>
                <div>📡 API 상태: {availableDocuments.length > 0 ? '✅ 로드 성공' : '❌ 문서 없음 또는 필터링됨'}</div>
                <div>🎯 Preview 모드: <span style={{color: '#63b3ed'}}>{previewMode}</span></div>
                <div style={{display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap'}}>
                  <button 
                    onClick={loadAvailableDocuments}
                    style={{padding: '2px 6px', fontSize: '10px', background: '#4a5568', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer'}}
                  >
                    🔄 새로고침
                  </button>
                  <button 
                    onClick={() => console.log('Current state:', { availableDocuments, selectedDocument, documentText: documentText.length })}
                    style={{padding: '2px 6px', fontSize: '10px', background: '#553c9a', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer'}}
                  >
                    📋 상태 출력
                  </button>
                  <button 
                    onClick={async () => {
                      try {
                        const resp = await fetch('/api/documents');
                        const data = await resp.json();
                        console.log('🧪 Direct API test:', data);
                        alert(`API 직접 호출 결과: ${data.length}개 문서`);
                      } catch (e) {
                        console.error('API 오류:', e);
                        alert('API 호출 실패: ' + e.message);
                      }
                    }}
                    style={{padding: '2px 6px', fontSize: '10px', background: '#e53e3e', color: 'white', border: 'none', borderRadius: '2px', cursor: 'pointer'}}
                  >
                    🧪 API 테스트
                  </button>
                </div>
              </div>
              {availableDocuments.length === 0 ? (
                <div className="no-documents">
                  <FontAwesomeIcon icon={faUpload} className="upload-icon" />
                  <p>지원되는 문서가 없습니다.</p>
                  <p className="hint">PDF, TXT, DOC, DOCX 파일을 업로드해주세요.</p>
                  <p className="hint" style={{fontSize: '10px', marginTop: '8px', color: '#718096'}}>
                    브라우저 개발자 도구(F12) → Console 탭에서 API 응답을 확인하세요.
                  </p>
                </div>
              ) : (
                <div className="document-list">
                  {availableDocuments.map(doc => {
                    // Use the actual field structure from backend API
                    const fileName = doc.title || doc.file_name || doc.filename || 'Unknown Document';
                    const fileSize = doc.file_size || doc.size;
                    const docId = doc.id || doc.document_id;
                    
                    return (
                      <div 
                        key={docId}
                        className={`document-item ${selectedDocument?.id === docId ? 'selected' : ''}`}
                        onClick={() => loadDocumentContent(docId)}
                      >
                        <div className="document-info">
                          <FontAwesomeIcon icon={faFileAlt} className="file-icon" />
                          <span className="file-name">{fileName}</span>
                          <span className="file-size">
                            {fileSize ? `${Math.round(fileSize / 1024)} KB` : ''}
                          </span>
                        </div>
                        {selectedDocument?.id === docId && (
                          <FontAwesomeIcon icon={faPlay} className="selected-icon" />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {loadingDocument && (
                <div className="loading-indicator">
                  <FontAwesomeIcon icon={faRefresh} spin />
                  <span>문서 내용을 불러오는 중...</span>
                </div>
              )}
            </div>
          )}

          {selectedDocument && (
            <div className="document-summary">
              <div className="summary-item">
                <strong>선택된 문서:</strong> {selectedDocument.title || selectedDocument.file_name || selectedDocument.filename || 'Unknown Document'}
              </div>
              <div className="summary-item">
                <strong>텍스트 길이:</strong> {documentText.length.toLocaleString()} characters
              </div>
              <div className="summary-item">
                <strong>예상 토큰:</strong> ~{Math.ceil(documentText.length / 4).toLocaleString()} tokens
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chunking Metrics */}
      {showPreview && chunkingMetrics && (
        <div className="chunking-metrics">
          <div className="metrics-header">
            <h4>
              <FontAwesomeIcon icon={faChartBar} className="header-icon" />
              청킹 분석 결과
            </h4>
            <div className="metrics-controls">
              <button 
                className="btn-export"
                onClick={exportChunks}
                title="Export chunks as JSON"
              >
                <FontAwesomeIcon icon={faDownload} />
                내보내기
              </button>
              <button 
                className="btn-reset"
                onClick={resetPreview}
                title="Reset preview"
              >
                <FontAwesomeIcon icon={faRefresh} />
                초기화
              </button>
            </div>
          </div>
          
          <div className="metrics-grid">
            <div className="metric-item">
              <span className="metric-label">총 청크 수</span>
              <span className="metric-value">{chunkingMetrics.totalChunks}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">평균 청크 크기</span>
              <span className="metric-value">{chunkingMetrics.averageChunkSize} chars</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">최소/최대 크기</span>
              <span className="metric-value">{chunkingMetrics.minChunkSize} / {chunkingMetrics.maxChunkSize}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">처리 시간</span>
              <span className="metric-value">{chunkingMetrics.processingTime}ms</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">예상 토큰</span>
              <span className="metric-value">{chunkingMetrics.estimatedTokens.toLocaleString()}</span>
            </div>
            <div className="metric-item">
              <span className="metric-label">오버랩 효율</span>
              <span className="metric-value">{chunkingMetrics.overlapEfficiency}%</span>
            </div>
          </div>
        </div>
      )}

      {showPreview && previewChunks.length > 0 && (
        <div className="chunks-preview">
          <div className="preview-header">
            <h4>청크 미리보기</h4>
            <div className="preview-controls">
              <button 
                className="btn-toggle-view"
                onClick={() => setShowFullPreview(!showFullPreview)}
                title={showFullPreview ? 'Show limited preview' : 'Show full preview'}
              >
                <FontAwesomeIcon icon={faExpand} />
                {showFullPreview ? '간략히' : '전체보기'}
              </button>
              <span className="chunk-count">
                {showFullPreview ? previewChunks.length : Math.min(previewChunks.length, 8)}개 표시
                {!showFullPreview && previewChunks.length > 8 && ` / 총 ${chunkingMetrics?.totalChunks || previewChunks.length}개`}
              </span>
            </div>
          </div>
          
          <div className="preview-chunks">
            {previewChunks.map((chunk, idx) => (
              <div key={idx} className="preview-chunk">
                <div className="chunk-header">
                  <div className="chunk-info">
                    <span className="chunk-number">Chunk #{idx + 1}</span>
                    <span className="chunk-size">{chunk.length} chars</span>
                    <span className="chunk-tokens">~{Math.ceil(chunk.length / 4)} tokens</span>
                  </div>
                  <div className="chunk-actions">
                    <button 
                      className="btn-copy"
                      onClick={() => copyChunkToClipboard(chunk, idx)}
                      title="Copy chunk to clipboard"
                    >
                      <FontAwesomeIcon icon={faCopy} />
                    </button>
                  </div>
                </div>
                <div className="chunk-content">
                  {chunk.length > 300 ? chunk.substring(0, 300) + '...' : chunk}
                </div>
                {chunk.length > 300 && (
                  <div className="chunk-full" style={{display: 'none'}}>
                    {chunk}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {!isRealTimePreview && (
            <div className="manual-refresh">
              <button 
                className="btn-refresh"
                onClick={() => {
                  if (previewMode === 'document' && documentText) {
                    generatePreviewChunks(documentText);
                  } else if (previewMode === 'sample' && previewText) {
                    generatePreviewChunks(previewText);
                  }
                }}
              >
                <FontAwesomeIcon icon={faRefresh} />
                미리보기 새로고침
              </button>
            </div>
          )}
        </div>
      )}

      <div className="strategy-info">
        <div className="info-item">
          <FontAwesomeIcon icon={faInfoCircle} className="info-icon" />
          <span>청크 크기와 오버랩은 검색 정확도와 처리 속도에 영향을 미칩니다</span>
        </div>
      </div>

      {/* Apply Strategy Button */}
      {selectedIndexId && (
        <div className="apply-strategy-section">
          <div className="apply-info">
            {hasChanges ? (
              <span className="changes-indicator">⚠️ 변경된 설정이 있습니다</span>
            ) : (
              <span className="no-changes-indicator">✅ 설정이 저장되어 있습니다</span>
            )}
          </div>
          <button
            className={`apply-strategy-btn ${hasChanges ? 'has-changes' : 'no-changes'}`}
            onClick={handleApplyStrategy}
            disabled={isProcessing || !hasChanges}
          >
            {isProcessing ? (
              <>
                <FontAwesomeIcon icon={faRefresh} spin className="btn-icon" />
                재처리 중...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faMagic} className="btn-icon" />
                청킹 전략 적용
              </>
            )}
          </button>
        </div>
      )}

    </div>
  );
};

export default ChunkingStrategy;