import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSync, faDownload } from '@fortawesome/free-solid-svg-icons';
import './EnhancedFileManager.css';

const DocumentTable = ({ 
  filteredData, 
  selectedDocuments, 
  handleSelectDocument, 
  handleSelectAllDocuments,
  handleDeleteDocument,
  handleReprocessDocument,
  formatFileSize,
  formatDate,
  onDownloadDocument
}) => {
  return (
    <div className="document-table">
      <table>
        <thead>
          <tr>
            <th>
              <input 
                type="checkbox" 
                onChange={handleSelectAllDocuments}
                checked={selectedDocuments.length === filteredData.length && filteredData.length > 0}
              />
            </th>
            <th>No</th>
            <th>상태</th>
            <th>파일 이름</th>
            <th>파일 크기</th>
            <th>마지막 수정</th>
            <th>청크</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.map((doc, idx) => (
            <tr key={doc.id} className={selectedDocuments.includes(doc.id) ? 'selected' : ''}>
              <td>
                <input 
                  type="checkbox" 
                  checked={selectedDocuments.includes(doc.id)}
                  onChange={() => handleSelectDocument(doc.id)}
                />
              </td>
              <td>{filteredData.length - idx}</td>
              <td>
                <span className={`document-status ${
                  doc.status === 'Processing' ? 'status-processing' :
                  doc.status === 'Success' || doc.status === 'Completed' || !doc.status ? 'status-completed' :
                  doc.status === 'Failed' || doc.status === 'Error' ? 'status-failed' :
                  'status-pending'
                }`}>
                  {doc.status === 'Processing' ? 'Processing' :
                   doc.status === 'Success' || doc.status === 'Completed' ? 'Completed' :
                   doc.status === 'Failed' || doc.status === 'Error' ? 'Failed' :
                   doc.status || 'Completed'}
                </span>
              </td>
              <td className="file-name" title={doc.name}>{doc.name}</td>
              <td>{typeof doc.size === 'number' ? formatFileSize(doc.size) : doc.size}</td>
              <td>{formatDate(doc.date)}</td>
              <td>{doc.chunks}</td>
              <td>
                <div className="document-actions">
                  {/* {onDownloadDocument && (
                    <button 
                      className="action-btn download"
                      onClick={() => onDownloadDocument(doc)}
                      title="Download document"
                    >
                      <FontAwesomeIcon icon={faDownload} />
                    </button>
                  )} */}
                  <button 
                    className="action-btn reprocess"
                    onClick={() => handleReprocessDocument(doc.originalDoc?.id || doc.id)}
                    title="Reprocess file"
                  >
                    <FontAwesomeIcon icon={faSync} />
                  </button>
                  <button 
                    className="action-btn delete"
                    onClick={() => handleDeleteDocument(doc.originalDoc?.id || doc.id)}
                    title="Delete file"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DocumentTable;