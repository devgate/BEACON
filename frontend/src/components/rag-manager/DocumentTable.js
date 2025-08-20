import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTrash, faSync } from '@fortawesome/free-solid-svg-icons';

const DocumentTable = ({ 
  filteredData, 
  selectedDocuments, 
  handleSelectDocument, 
  handleSelectAllDocuments,
  handleDeleteDocument,
  handleReprocessDocument,
  formatFileSize,
  formatDate 
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
            <th>File Name</th>
            <th>File Size</th>
            <th>Modified</th>
            <th>Status</th>
            <th>Chunks</th>
            <th>Actions</th>
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
              <td className="file-name" title={doc.name}>{doc.name}</td>
              <td>{typeof doc.size === 'number' ? formatFileSize(doc.size) : doc.size}</td>
              <td>{formatDate(doc.date)}</td>
              <td>
                <span className={`status-badge ${doc.status.toLowerCase()}`}>{doc.status}</span>
              </td>
              <td>{doc.chunks}</td>
              <td>
                <button 
                  className="btn-delete"
                  onClick={() => handleDeleteDocument(doc.originalDoc?.id || doc.id)}
                  title="Delete file"
                  style={{ marginRight: '4px' }}
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
                <button 
                  className="btn-delete"
                  onClick={() => handleReprocessDocument(doc.originalDoc?.id || doc.id)}
                  title="Reprocess file"
                  style={{ borderColor: '#00d4ff', color: '#00d4ff' }}
                >
                  <FontAwesomeIcon icon={faSync} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DocumentTable;