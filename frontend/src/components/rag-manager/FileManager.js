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
  formatDate
}) => {
  return (
    <div className="file-manager-content">
      {/* Add Document Button - Only show when files exist */}
      {filteredData.length > 0 && (
        <div className="file-manager-header">
          <button 
            className="btn-add-document"
            onClick={() => setShowUploadModal(true)}
            disabled={!selectedIndexId}
            title={!selectedIndexId ? "Please select a knowledge base first" : "Add document to selected knowledge base"}
          >
            <FontAwesomeIcon icon={faPlus} /> Add Document
          </button>
        </div>
      )}

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
              onClick={() => setShowUploadModal(true)}
              disabled={!selectedIndexId}
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