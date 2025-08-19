import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faSync, faTrash } from '@fortawesome/free-solid-svg-icons';

const BulkActionsBar = ({ selectedDocuments, handleBulkReprocessDocs, handleBulkDeleteDocs }) => {
  if (selectedDocuments.length === 0) return null;

  return (
    <div className="bulk-actions-bar">
      <div className="bulk-actions-info">
        {selectedDocuments.length} document{selectedDocuments.length > 1 ? 's' : ''} selected
      </div>
      <div className="bulk-actions-buttons">
        <button 
          className="btn-bulk-reprocess"
          onClick={handleBulkReprocessDocs}
        >
          <FontAwesomeIcon icon={faSync} /> Reprocess
        </button>
        <button 
          className="btn-bulk-delete"
          onClick={handleBulkDeleteDocs}
        >
          <FontAwesomeIcon icon={faTrash} /> Delete
        </button>
      </div>
    </div>
  );
};

export default BulkActionsBar;