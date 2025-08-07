import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faFilePdf, faDownload, faBrain, faDollarSign, faClock } from '@fortawesome/free-solid-svg-icons';

const ChatMessage = ({ message }) => {
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

  return (
    <div className={`message ${message.type}`}>
      <div 
        className={`message-content ${message.isLoading ? 'loading' : ''}`}
        style={{ whiteSpace: 'pre-wrap' }}
      >
        {message.content}
      </div>

      {message.referencedDocs && message.referencedDocs.length > 0 && (
        <div className="referenced-docs">
          <div className="referenced-docs-title">
            <FontAwesomeIcon icon={faFileAlt} />
            참조된 문서:
          </div>
          {message.referencedDocs.map(doc => (
            <div key={doc.id} className="referenced-doc-item">
              <FontAwesomeIcon icon={faFilePdf} />
              <span className="doc-title">{doc.title}</span>
              {doc.has_file && (
                <button 
                  className="download-btn"
                  onClick={() => handleDownload(doc.id, doc.title)}
                  title="파일 다운로드"
                >
                  <FontAwesomeIcon icon={faDownload} />
                </button>
              )}
            </div>
          ))}
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