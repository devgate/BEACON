import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';

const KnowledgeBaseModals = ({
  showNewKBModal,
  setShowNewKBModal,
  showEditKBModal,
  setShowEditKBModal,
  newKBData,
  setNewKBData,
  editKBData,
  setEditKBData,
  handleSaveNewKB,
  handleSaveEditKB,
  loading
}) => {
  return (
    <>
      {/* New Knowledge Base Modal */}
      {showNewKBModal && (
        <div className="kb-modal-overlay" onClick={() => setShowNewKBModal(false)}>
          <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>저장소 신규 등록</h2>
              <button 
                className="kb-modal-close"
                onClick={() => setShowNewKBModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="kb-modal-body">
              <div className="form-group">
                <label htmlFor="newKBName">Index Name</label>
                <input
                  id="newKBName"
                  type="text"
                  className="form-input"
                  value={newKBData.name}
                  onChange={(e) => setNewKBData({...newKBData, name: e.target.value})}
                  placeholder="저장소 이름을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="newKBId">Index ID</label>
                <input
                  id="newKBId"
                  type="text"
                  className="form-input"
                  value={newKBData.id}
                  onChange={(e) => setNewKBData({...newKBData, id: e.target.value})}
                  placeholder="저장소 ID를 입력하세요"
                />
              </div>
            </div>
            <div className="kb-modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setShowNewKBModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-save"
                onClick={handleSaveNewKB}
                disabled={loading}
              >
                {loading ? '생성 중...' : '생성'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Knowledge Base Modal */}
      {showEditKBModal && (
        <div className="kb-modal-overlay" onClick={() => setShowEditKBModal(false)}>
          <div className="kb-modal" onClick={(e) => e.stopPropagation()}>
            <div className="kb-modal-header">
              <h2>저장소 정보 수정</h2>
              <button 
                className="kb-modal-close"
                onClick={() => setShowEditKBModal(false)}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <div className="kb-modal-body">
              <div className="form-group">
                <label htmlFor="editKBName">Index Name</label>
                <input
                  id="editKBName"
                  type="text"
                  className="form-input"
                  value={editKBData.name}
                  onChange={(e) => setEditKBData({...editKBData, name: e.target.value})}
                  placeholder="저장소 이름을 입력하세요"
                />
              </div>
              <div className="form-group">
                <label htmlFor="editKBId">Index ID</label>
                <input
                  id="editKBId"
                  type="text"
                  className="form-input"
                  value={editKBData.id}
                  disabled
                  placeholder="저장소 ID (수정 불가)"
                />
              </div>
            </div>
            <div className="kb-modal-footer">
              <button 
                className="btn-cancel"
                onClick={() => setShowEditKBModal(false)}
              >
                취소
              </button>
              <button 
                className="btn-save"
                onClick={handleSaveEditKB}
                disabled={loading}
              >
                {loading ? '수정 중...' : '수정'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default KnowledgeBaseModals;