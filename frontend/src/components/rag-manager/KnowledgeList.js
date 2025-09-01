import React, { useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faTrashAlt, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { chromaService } from '../../services/api';

const KnowledgeList = ({
  searchQuery,
  setSearchQuery,
  handleNewKB,
  handleEditKB,
  handleDeleteKB,
  selectedIndexId,
  getDocumentCount,
  paginatedKnowledgeList,
  filteredKnowledgeList,
  setSelectedIndex,
  setSelectedIndexId,
  setSelectedDocuments,
  totalKnowledgePages,
  currentKnowledgePage,
  handleKnowledgePageChange
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const handleClearAllCollections = async () => {
    setShowConfirmModal(true);
  };

  const confirmClearCollections = async () => {
    setIsDeleting(true);
    try {
      const response = await chromaService.clearAllCollections();
      if (response.success) {
        alert('ChromaDB의 모든 컬렉션이 성공적으로 삭제되었습니다.');
        // Refresh the knowledge bases list
        window.location.reload();
      } else {
        alert('컬렉션 삭제 중 오류가 발생했습니다: ' + (response.message || '알 수 없는 오류'));
      }
    } catch (error) {
      console.error('Failed to clear ChromaDB collections:', error);
      alert('컬렉션 삭제 중 오류가 발생했습니다: ' + error.message);
    } finally {
      setIsDeleting(false);
      setShowConfirmModal(false);
    }
  };

  return (
    <div className="index-list-section">
      <div className="section-header">
        <div className="section-title">
          <FontAwesomeIcon icon={faDatabase} />
          Knowledge List
        </div>
        <div className="section-header-controls">
          <div className="knowledge-actions">
            <button className="btn-new" onClick={handleNewKB}>New</button>
            <button className="btn-edit" onClick={handleEditKB}>Edit</button>
            {selectedIndexId && getDocumentCount(selectedIndexId) === 0 && (
              <button className="btn-delete" onClick={handleDeleteKB}>Delete</button>
            )}
            <button 
              className="btn-clear-all" 
              onClick={handleClearAllCollections}
              disabled={isDeleting}
              style={{
                backgroundColor: '#dc3545',
                color: 'white',
                marginLeft: '10px',
                padding: '5px 10px',
                border: 'none',
                borderRadius: '4px',
                cursor: isDeleting ? 'not-allowed' : 'pointer',
                opacity: isDeleting ? 0.6 : 1
              }}
              title="ChromaDB의 모든 컬렉션 삭제"
            >
              <FontAwesomeIcon icon={faTrashAlt} style={{ marginRight: '5px' }} />
              {isDeleting ? '삭제 중...' : 'Clear All ChromaDB'}
            </button>
          </div>
        </div>
      </div>

      <div className="index-table">
        <table>
          <thead>
            <tr>
              <th width="50"></th>
              <th width="60">No</th>
              <th>Index Name</th>
              <th width="200">Index ID</th>
              <th width="80">Documents</th>
            </tr>
          </thead>
          <tbody>
            {paginatedKnowledgeList.map((index) => {
              const globalIndex = filteredKnowledgeList.findIndex(kb => kb.id === index.id);
              return (
                <tr 
                  key={index.id}
                  className={selectedIndexId === index.id ? 'selected' : ''}
                  onClick={() => {
                    setSelectedIndex(index.name);
                    setSelectedIndexId(index.id);
                    setSelectedDocuments([]);
                  }}
                  style={{ cursor: 'pointer' }}
                >
                  <td>
                    <input 
                      type="radio" 
                      name="index" 
                      checked={selectedIndexId === index.id} 
                      readOnly 
                    />
                  </td>
                  <td>{filteredKnowledgeList.length - globalIndex}</td>
                  <td>{index.name}</td>
                  <td>{index.id}</td>
                  <td>
                    <span className="document-count">
                      {getDocumentCount(index.id)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Knowledge List Pagination */}
      {totalKnowledgePages > 1 && (
        <div className="knowledge-pagination">
          <button 
            className="page-btn"
            onClick={() => handleKnowledgePageChange(currentKnowledgePage - 1)}
            disabled={currentKnowledgePage === 1}
          >
            &lt;
          </button>
          {Array.from({ length: totalKnowledgePages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              className={`page-num ${currentKnowledgePage === page ? 'active' : ''}`}
              onClick={() => handleKnowledgePageChange(page)}
            >
              {page}
            </button>
          ))}
          <button 
            className="page-btn"
            onClick={() => handleKnowledgePageChange(currentKnowledgePage + 1)}
            disabled={currentKnowledgePage === totalKnowledgePages}
          >
            &gt;
          </button>
        </div>
      )}

      {/* Confirmation Modal - Dark Theme */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
            backdropFilter: 'blur(16px)',
            padding: '35px',
            borderRadius: '16px',
            maxWidth: '500px',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '25px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(220, 38, 38, 0.2) 100%)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: '16px'
              }}>
                <FontAwesomeIcon 
                  icon={faExclamationTriangle} 
                  style={{ color: '#ef4444', fontSize: '24px' }}
                />
              </div>
              <div>
                <h3 style={{ 
                  margin: 0, 
                  color: '#f1f5f9',
                  fontSize: '20px',
                  fontWeight: '600'
                }}>
                  ChromaDB 컬렉션 삭제
                </h3>
                <p style={{ 
                  margin: '4px 0 0 0', 
                  color: '#94a3b8',
                  fontSize: '14px'
                }}>
                  이 작업은 되돌릴 수 없습니다
                </p>
              </div>
            </div>
            
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '25px'
            }}>
              <p style={{ 
                margin: 0,
                lineHeight: '1.6',
                color: '#e2e8f0',
                fontSize: '15px'
              }}>
                ChromaDB의 <strong style={{ color: '#f8fafc' }}>모든 컬렉션</strong>이 삭제됩니다.<br />
                <span style={{ color: '#fbbf24', fontSize: '14px' }}>
                  ⚠️ 모든 벡터 데이터가 영구적으로 삭제되며 복구할 수 없습니다.
                </span>
              </p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  padding: '10px 24px',
                  background: 'rgba(71, 85, 105, 0.3)',
                  color: '#e2e8f0',
                  border: '1px solid rgba(71, 85, 105, 0.5)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '15px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(4px)'
                }}
                onMouseEnter={(e) => {
                  e.target.style.background = 'rgba(71, 85, 105, 0.5)';
                  e.target.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.background = 'rgba(71, 85, 105, 0.3)';
                  e.target.style.transform = 'translateY(0)';
                }}
              >
                취소
              </button>
              <button
                onClick={confirmClearCollections}
                disabled={isDeleting}
                style={{
                  padding: '10px 24px',
                  background: isDeleting 
                    ? 'rgba(239, 68, 68, 0.3)' 
                    : 'linear-gradient(135deg, rgba(239, 68, 68, 0.8) 0%, rgba(220, 38, 38, 0.8) 100%)',
                  color: '#fef2f2',
                  border: '1px solid rgba(239, 68, 68, 0.5)',
                  borderRadius: '8px',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  fontSize: '15px',
                  fontWeight: '600',
                  opacity: isDeleting ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(4px)',
                  boxShadow: isDeleting ? 'none' : '0 4px 6px -1px rgba(239, 68, 68, 0.3)'
                }}
                onMouseEnter={(e) => {
                  if (!isDeleting) {
                    e.target.style.transform = 'translateY(-1px)';
                    e.target.style.boxShadow = '0 8px 12px -3px rgba(239, 68, 68, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isDeleting) {
                    e.target.style.transform = 'translateY(0)';
                    e.target.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.3)';
                  }
                }}
              >
                {isDeleting ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      display: 'inline-block',
                      width: '14px',
                      height: '14px',
                      border: '2px solid #fef2f2',
                      borderTopColor: 'transparent',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }}></span>
                    삭제 중...
                  </span>
                ) : (
                  '삭제 확인'
                )}
              </button>
            </div>
          </div>
          
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      )}
    </div>
  );
};

export default KnowledgeList;