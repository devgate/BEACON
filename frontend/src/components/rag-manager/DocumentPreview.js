import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFileAlt, faImage, faExpand, faCompress, faSpinner, faTimes } from '@fortawesome/free-solid-svg-icons';

const DocumentPreview = ({ 
  documentId, 
  documentName,
  onClose,
  onTextExtracted 
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewData, setPreviewData] = useState({
    text: '',
    images: [],
    metadata: {}
  });
  const [activeTab, setActiveTab] = useState('text');
  const [fullScreen, setFullScreen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);

  useEffect(() => {
    loadDocumentPreview();
  }, [documentId]);

  const loadDocumentPreview = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch document preview from backend
      const response = await fetch(`/api/documents/${documentId}/preview`);
      
      if (!response.ok) {
        throw new Error('Failed to load document preview');
      }

      const data = await response.json();
      
      setPreviewData({
        text: data.text_content || '',
        images: data.images || [],
        metadata: data.metadata || {}
      });

      // Pass extracted text to parent for chunking preview
      if (onTextExtracted && data.text_content) {
        onTextExtracted(data.text_content);
      }

    } catch (err) {
      console.error('Error loading preview:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImageClick = (image) => {
    setSelectedImage(image);
  };

  const closeImageModal = () => {
    setSelectedImage(null);
  };

  const toggleFullScreen = () => {
    setFullScreen(!fullScreen);
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="document-preview loading">
        <div className="loading-content">
          <FontAwesomeIcon icon={faSpinner} spin className="loading-icon" />
          <p>문서를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="document-preview error">
        <div className="error-content">
          <p className="error-message">⚠️ {error}</p>
          <button onClick={loadDocumentPreview} className="btn-retry">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`document-preview ${fullScreen ? 'fullscreen' : ''}`}>
      <div className="preview-header">
        <div className="header-info">
          <FontAwesomeIcon icon={faFileAlt} className="file-icon" />
          <span className="file-name">{documentName}</span>
        </div>
        <div className="header-actions">
          <button 
            onClick={toggleFullScreen} 
            className="btn-fullscreen"
            title={fullScreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            <FontAwesomeIcon icon={fullScreen ? faCompress : faExpand} />
          </button>
          <button onClick={onClose} className="btn-close" title="Close preview">
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
      </div>

      <div className="preview-tabs">
        <button 
          className={`tab ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          <FontAwesomeIcon icon={faFileAlt} />
          텍스트 ({previewData.text.length} chars)
        </button>
        {previewData.images.length > 0 && (
          <button 
            className={`tab ${activeTab === 'images' ? 'active' : ''}`}
            onClick={() => setActiveTab('images')}
          >
            <FontAwesomeIcon icon={faImage} />
            이미지 ({previewData.images.length})
          </button>
        )}
        <button 
          className={`tab ${activeTab === 'metadata' ? 'active' : ''}`}
          onClick={() => setActiveTab('metadata')}
        >
          메타데이터
        </button>
      </div>

      <div className="preview-content">
        {activeTab === 'text' && (
          <div className="text-preview">
            <div className="text-stats">
              <span>총 {previewData.text.split(/\s+/).length} 단어</span>
              <span>•</span>
              <span>{previewData.text.split('\n').length} 줄</span>
              <span>•</span>
              <span>{previewData.text.split(/[.!?]+/).length} 문장</span>
            </div>
            <pre className="text-content">{previewData.text}</pre>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="images-preview">
            <div className="images-grid">
              {previewData.images.map((image, idx) => (
                <div 
                  key={idx} 
                  className="image-item"
                  onClick={() => handleImageClick(image)}
                >
                  <img 
                    src={image.url} 
                    alt={`Page ${image.page}`}
                    loading="lazy"
                  />
                  <div className="image-info">
                    <span>Page {image.page}</span>
                    <span>{image.filename}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="metadata-preview">
            <table className="metadata-table">
              <tbody>
                <tr>
                  <td className="meta-label">파일명</td>
                  <td className="meta-value">{documentName}</td>
                </tr>
                <tr>
                  <td className="meta-label">문서 ID</td>
                  <td className="meta-value">{documentId}</td>
                </tr>
                {previewData.metadata.file_size && (
                  <tr>
                    <td className="meta-label">파일 크기</td>
                    <td className="meta-value">{formatFileSize(previewData.metadata.file_size)}</td>
                  </tr>
                )}
                {previewData.metadata.total_pages && (
                  <tr>
                    <td className="meta-label">총 페이지</td>
                    <td className="meta-value">{previewData.metadata.total_pages}</td>
                  </tr>
                )}
                {previewData.metadata.total_chunks && (
                  <tr>
                    <td className="meta-label">청크 수</td>
                    <td className="meta-value">{previewData.metadata.total_chunks}</td>
                  </tr>
                )}
                {previewData.metadata.total_tokens && (
                  <tr>
                    <td className="meta-label">토큰 수</td>
                    <td className="meta-value">{previewData.metadata.total_tokens.toLocaleString()}</td>
                  </tr>
                )}
                {previewData.metadata.processed_at && (
                  <tr>
                    <td className="meta-label">처리 일시</td>
                    <td className="meta-value">
                      {new Date(previewData.metadata.processed_at).toLocaleString('ko-KR')}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="image-modal" onClick={closeImageModal}>
          <div className="modal-content">
            <img 
              src={selectedImage.url} 
              alt={`Page ${selectedImage.page}`}
              onClick={(e) => e.stopPropagation()}
            />
            <button className="modal-close" onClick={closeImageModal}>
              <FontAwesomeIcon icon={faTimes} />
            </button>
            <div className="modal-info">
              Page {selectedImage.page} - {selectedImage.filename}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;