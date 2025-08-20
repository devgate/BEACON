import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faFilePdf, faDownload, faTrash, faFolderOpen } from '@fortawesome/free-solid-svg-icons';

const FileManager = ({ documents, onDelete }) => {
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = (docId, filename) => {
    const downloadUrl = `/api/download/${docId}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (documents.length === 0) {
    return (
      <main className="rag-manager-area" style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column', 
        background: '#1a202c', 
        padding: '20px', 
        overflowY: 'auto' 
      }}>
        <div className="manager-header">
          <h1>RAG 문서 관리</h1>
          <p>PDF 파일을 업로드하고 관리하세요</p>
        </div>
        <div className="file-manager-content">
          <div className="empty-file-manager">
            <FontAwesomeIcon icon={faFolderOpen} size="4x" />
            <h3>업로드된 문서가 없습니다</h3>
            <p>PDF 파일을 업로드하여 RAG 시스템을 시작하세요</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="rag-manager-area" style={{ 
      flex: 1, 
      display: 'flex', 
      flexDirection: 'column', 
      background: '#1a202c', 
      padding: '20px', 
      overflowY: 'auto' 
    }}>
      <div className="manager-header">
        <h1>RAG 문서 관리</h1>
        <p>PDF 파일을 업로드하고 관리하세요</p>
      </div>
      
      <div className="file-manager-content">
        {documents.map(doc => (
          <div key={doc.id} className="file-card">
            <div className="file-card-header">
              <div className="file-icon">
                <FontAwesomeIcon icon={faFilePdf} />
              </div>
              <div className="file-info">
                <h3>{doc.title}</h3>
                <p>업로드: {new Date().toLocaleDateString('ko-KR')}</p>
              </div>
            </div>
            
            <div className="file-card-body">
              <div className="file-preview">
                {doc.content ? doc.content.substring(0, 100) + '...' : '내용을 불러올 수 없습니다.'}
              </div>
            </div>
            
            <div className="file-card-footer">
              <div className="file-actions">
                {doc.file_path && (
                  <button 
                    className="action-btn download"
                    onClick={() => handleDownload(doc.id, doc.original_filename || doc.title)}
                  >
                    <FontAwesomeIcon icon={faDownload} /> 다운로드
                  </button>
                )}
                <button 
                  className="action-btn delete"
                  onClick={() => onDelete(doc.id)}
                >
                  <FontAwesomeIcon icon={faTrash} /> 삭제
                </button>
              </div>
              <div className="file-size">
                {formatFileSize(doc.content ? doc.content.length : 0)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
};

export default FileManager;