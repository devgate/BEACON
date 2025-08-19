import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes, faCloudUploadAlt } from '@fortawesome/free-solid-svg-icons';

const UploadModal = ({ 
  showUploadModal, 
  setShowUploadModal, 
  dragOver, 
  handleDragOver, 
  handleDragLeave, 
  handleDrop,
  fileInputRef,
  handleFileInputChange
}) => {
  if (!showUploadModal) return null;

  return (
    <div className="upload-modal-overlay" onClick={() => setShowUploadModal(false)}>
      <div className="upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="upload-modal-header">
          <h2>Upload Documents</h2>
          <button 
            className="upload-modal-close"
            onClick={() => setShowUploadModal(false)}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className="upload-modal-body">
          <div 
            className={`file-upload-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={(e) => {
              handleDrop(e);
              setShowUploadModal(false);
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <FontAwesomeIcon icon={faCloudUploadAlt} className="upload-zone-icon" />
            <div className="upload-zone-text">
              Drag and drop files here or click to browse
            </div>
            <div className="upload-zone-hint">
              Upload multiple files at once
            </div>
            <div className="upload-zone-formats">
              Supported: PDF, DOC, DOCX, TXT, CSV, JSON, MD, RTF
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="file-input-hidden"
              onChange={(e) => {
                handleFileInputChange(e);
                setShowUploadModal(false);
              }}
              accept=".pdf,.doc,.docx,.txt,.csv,.json,.md,.rtf"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default UploadModal;