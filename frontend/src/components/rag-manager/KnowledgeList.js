import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase } from '@fortawesome/free-solid-svg-icons';

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
    </div>
  );
};

export default KnowledgeList;