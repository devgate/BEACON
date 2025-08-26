import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faFileAlt } from '@fortawesome/free-solid-svg-icons';
import BulkActionsBar from './BulkActionsBar';
import DocumentTable from './DocumentTable';

const FileManager = ({ 
  filteredData,
  selectedDocuments,
  selectedIndexId,
  setShowUploadModal,
  handleSelectDocument,
  handleSelectAllDocuments,
  handleBulkReprocessDocs,
  handleBulkDeleteDocs,
  handleDeleteDocument,
  handleReprocessDocument,
  formatFileSize,
  formatDate,
  setNotification
}) => {
  const handleUploadClick = () => {
    if (!selectedIndexId) {
      setNotification({ 
        message: '먼저 저장소를 선택해주세요.', 
        type: 'error' 
      });
      return;
    }
    setShowUploadModal(true);
  };

  return (
    <div className="file-manager-content">
      {/* Bulk Actions Bar */}
      <BulkActionsBar 
        selectedDocuments={selectedDocuments}
        handleBulkReprocessDocs={handleBulkReprocessDocs}
        handleBulkDeleteDocs={handleBulkDeleteDocs}
      />

      {filteredData.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-content">
            <FontAwesomeIcon icon={faFileAlt} className="empty-icon" />
            <h3>No files uploaded</h3>
            <p>Upload files to your knowledge base to get started.</p>
            <button 
              className="btn-upload-primary"
              onClick={handleUploadClick}
              title={!selectedIndexId ? "Please select a knowledge base first" : "Upload files to selected knowledge base"}
            >
              <FontAwesomeIcon icon={faPlus} />
              Upload Files
            </button>
          </div>
        </div>
      ) : (
        <DocumentTable 
          filteredData={filteredData}
          selectedDocuments={selectedDocuments}
          handleSelectDocument={handleSelectDocument}
          handleSelectAllDocuments={handleSelectAllDocuments}
          handleDeleteDocument={handleDeleteDocument}
          handleReprocessDocument={handleReprocessDocument}
          formatFileSize={formatFileSize}
          formatDate={formatDate}
        />
      )}
    </div>
  );
};

export default FileManager;