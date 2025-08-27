import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFilePdf, faDownload, faBrain, faDollarSign, faClock, faFileText, faExternalLinkAlt, faQuoteLeft } from '@fortawesome/free-solid-svg-icons';

const ChatMessage = ({ message }) => {
  // 디버깅을 위한 로깅
  if (message.referencedDocs && message.referencedDocs.length > 0) {
    console.log('Referenced Docs:', message.referencedDocs);
  }

  const formatTime = (date) => {
    return new Date(date).toLocaleTimeString('ko-KR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const handleDownload = (docId, title) => {
    const downloadUrl = `/api/download/${docId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = title;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const showImageModal = (imageUrl, title) => {
    // This would typically open a modal
    window.open(imageUrl, '_blank');
  };

  const handleViewDocument = (doc) => {
    // 문서 상세 보기 - 현재는 콘솔에 로그만 출력
    console.log('Viewing document:', doc);
    alert(`문서 상세 보기: ${doc.title}\n관련도: ${doc.relevance_score ? Math.round(doc.relevance_score * 100) + '%' : 'N/A'}`);
  };

  return (
    <div className={`message ${message.type}`}>
      <div 
        className={`message-content ${message.isLoading ? 'loading' : ''}`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {message.content}
      </div>

      {message.referencedDocs && message.referencedDocs.length > 0 && (
        <div className="referenced-docs-container">
          <div className="referenced-docs-header">
            <div className="docs-icon-wrapper">
              <FontAwesomeIcon icon={faQuoteLeft} className="quote-icon" />
            </div>
            <div className="docs-title-section">
              <h4 className="docs-title">참조된 문서</h4>
              <span className="docs-count">{message.referencedDocs.length}개 문서</span>
            </div>
          </div>
          <div className="referenced-docs-list">
            {message.referencedDocs.map((doc, index) => (
              <div key={doc.id} className="referenced-doc-card">
                <div className="doc-card-header">
                  <div className="doc-icon-wrapper">
                    <FontAwesomeIcon 
                      icon={doc.title?.toLowerCase().includes('.pdf') ? faFilePdf : faFileText} 
                      className="doc-type-icon"
                    />
                  </div>
                  <div className="doc-main-info">
                    <h5 className="doc-title">{doc.title}</h5>
                    <div className="doc-meta">
                      <span className="doc-number">문서 #{index + 1}</span>
                      {doc.relevance_score && (
                        <span className="relevance-score">
                          관련도: {Math.round(doc.relevance_score * 100)}%
                        </span>
                      )}
                    </div>
                  </div>
            
                </div>
                {doc.content_preview && (
                  <div className="doc-preview">
                    <div className="preview-label">문서 미리보기:</div>
                    <div className="preview-text">{doc.content_preview}</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {message.images && message.images.length > 0 && (
        <div className="image-gallery">
          {message.images.map((image, index) => (
            <div key={index} className="image-container">
              <img 
                src={image.url}
                alt={`PDF 이미지 ${index + 1}`}
                className="pdf-image"
                loading="lazy"
                onClick={() => showImageModal(image.url, `${image.filename} (페이지 ${image.page})`)}
              />
              <div className="image-caption">페이지 {image.page}</div>
            </div>
          ))}
        </div>
      )}

      {/* Model and cost information for AI messages */}
      {message.type === 'ai' && !message.isLoading && (message.modelUsed || message.tokensUsed || message.processingTime) && (
        <div className="message-metadata">
          {message.modelUsed && (
            <div className="metadata-item">
              <FontAwesomeIcon icon={faBrain} />
              <span>{message.modelUsed.split('.').pop()}</span>
              {message.ragEnabled !== undefined && (
                <span className={`rag-badge ${message.ragEnabled ? 'rag-enabled' : 'rag-disabled'}`}>
                  {message.ragEnabled ? 'RAG' : 'Chat'}
                </span>
              )}
            </div>
          )}
          
          {message.processingTime && (
            <div className="metadata-item">
              <FontAwesomeIcon icon={faClock} />
              <span>{message.processingTime.toFixed(2)}s</span>
            </div>
          )}

          {message.tokensUsed && (Object.keys(message.tokensUsed).length > 0) && (
            <div className="metadata-item">
              <FontAwesomeIcon icon={faDollarSign} />
              <span>
                {message.tokensUsed.input_tokens || 0}↑/{message.tokensUsed.output_tokens || 0}↓
              </span>
            </div>
          )}

          {message.costEstimate && (Object.keys(message.costEstimate).length > 0) && (
            <div className="metadata-item cost">
              <span>
                ${((message.costEstimate.input_cost || 0) + (message.costEstimate.output_cost || 0)).toFixed(6)}
              </span>
            </div>
          )}
        </div>
      )}

      <div className="message-time">{formatTime(message.timestamp)}</div>
    </div>
  );
};

export default ChatMessage;