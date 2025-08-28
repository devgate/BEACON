import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faFileText,
  faSpinner,
  faExclamationTriangle,
  faEllipsisH,
  faBrain
} from '@fortawesome/free-solid-svg-icons';

const ChunkingPreview = ({
  availableDocuments,
  selectedDocument,
  documentText,
  previewChunks,
  loadingPreview,
  chunkingStrategy,
  onDocumentSelect,
  onRefreshPreview,
  getStrategyInsights
}) => {
  return (
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

      <div className="document-selector-wrapper">
        <div className="document-selector-header">
          <label className="document-selector-label">
            미리보기할 문서 선택
          </label>
          {selectedDocument && (
            <button
              onClick={onRefreshPreview}
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
            onDocumentSelect(docId);
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
      </div>

      {selectedDocument && (
        <div className="chunking-preview">
          {loadingPreview ? (
            <div className="flex items-center justify-center p-8">
              <FontAwesomeIcon icon={faSpinner} className="animate-spin text-2xl text-indigo-600 mr-3" />
              <span className="text-gray-600">문서 미리보기 로딩 중...</span>
            </div>
          ) : documentText ? (
            <>
              <div className="preview-stats">
                <div className="stat-item">
                  <span className="stat-label">총 청크 수</span>
                  <span className="stat-value">
                    {previewChunks ? previewChunks.length : 0}개
                  </span>
                </div>
              </div>
              
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

                        <div className="chunk-metadata">
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

                          {chunk.type === 'fixed-size' && chunk.start_word !== undefined && (
                            <div className="metadata-row">
                              <div className="metadata-item">Words: {chunk.start_word + 1}-{chunk.end_word}</div>
                              {chunk.words && (
                                <div className="metadata-item">Length: {chunk.words} words</div>
                              )}
                            </div>
                          )}
                        </div>

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
  );
};

export default ChunkingPreview;