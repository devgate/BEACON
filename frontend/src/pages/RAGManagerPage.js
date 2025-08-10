import React, { useState, useEffect } from 'react';
import CategoryList from '../components/CategoryList';
import FileManager from '../components/FileManager';
import UploadModal from '../components/UploadModal';
import SettingsPanel from '../components/SettingsPanel';
import { documentService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus } from '@fortawesome/free-solid-svg-icons';

const RAGManagerPage = () => {
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [filter, setFilter] = useState('all');
  const [stats, setStats] = useState({ totalDocs: 0, totalSize: '0 MB' });

  useEffect(() => {
    loadDocuments();
    loadCategories();
  }, []);

  useEffect(() => {
    updateStats();
  }, [documents]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = async () => {
    try {
      const data = await documentService.getDocuments();
      setDocuments(data);
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const loadCategories = async () => {
    try {
      const data = await documentService.getCategories();
      setCategories(data);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const updateStats = () => {
    const totalDocs = documents.length;
    const totalSize = documents.reduce((sum, doc) => sum + (doc.content?.length || 0), 0);
    setStats({
      totalDocs,
      totalSize: formatFileSize(totalSize)
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleCategorySelect = async (categoryId) => {
    setSelectedCategoryId(categoryId);
    
    if (categoryId === 'all') {
      await loadDocuments();
    } else {
      try {
        const data = await documentService.getDocumentsByCategory(categoryId);
        setDocuments(data);
      } catch (error) {
        console.error('Failed to load category documents:', error);
      }
    }
  };

  const handleFileUpload = async (file, categoryId) => {
    try {
      await documentService.uploadDocument(file, categoryId);
      await loadDocuments();
      await loadCategories();
      setShowUploadModal(false);
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('정말로 이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      await documentService.deleteDocument(docId);
      await loadDocuments();
      await loadCategories();
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const handleCategorySettings = (category) => {
    setSelectedCategory(category);
    setShowSettings(true);
  };

  const handleSaveSettings = async (categoryId, settings) => {
    try {
      await documentService.updateCategorySettings(categoryId, settings);
      await loadCategories();
      setShowSettings(false);
    } catch (error) {
      console.error('Failed to save settings:', error);
      throw error;
    }
  };

  const filteredDocuments = documents.filter(doc => {
    switch (filter) {
      case 'recent':
        // Filter for recent documents (e.g., last 7 days)
        return true;
      case 'large':
        // Filter for large documents
        return doc.content && doc.content.length > 10000;
      default:
        return true;
    }
  });

  return (
    <div className="page-container" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="main-container" style={{ 
        display: 'flex', 
        height: 'calc(100vh - 60px)', 
        overflow: 'hidden' 
      }}>
        <aside className="sidebar" style={{ 
          width: '280px',
          background: '#2d3748',
          borderRight: '1px solid #4a5568',
          padding: '20px',
          overflowY: 'auto',
          height: '100%',
          flexShrink: 0,
          position: 'relative',
          display: 'block'
        }}>
          <div className="sidebar-section" style={{
            flex: 'none',
            overflow: 'visible'
          }}>
            <h3>문서 카테고리</h3>
            <CategoryList 
              categories={categories}
              selectedCategoryId={selectedCategoryId}
              onSelectCategory={handleCategorySelect}
              onSettings={handleCategorySettings}
              showSettings={true}
            />
          </div>

          <div className="sidebar-section">
            <h3>파일 업로드</h3>
            <button 
              className="upload-trigger-btn"
              onClick={() => setShowUploadModal(true)}
            >
              <FontAwesomeIcon icon={faPlus} />
              <span>새 파일 업로드</span>
            </button>
          </div>

          <div className="sidebar-section">
            <h3>파일 필터</h3>
            <div className="filter-options">
              <button 
                className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                전체
              </button>
              <button 
                className={`filter-btn ${filter === 'recent' ? 'active' : ''}`}
                onClick={() => setFilter('recent')}
              >
                최근
              </button>
              <button 
                className={`filter-btn ${filter === 'large' ? 'active' : ''}`}
                onClick={() => setFilter('large')}
              >
                대용량
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3>통계</h3>
            <div className="stats-info">
              <div className="stat-item" title={`업로드된 총 문서 수: ${stats.totalDocs}개`}>
                <span className="stat-label">총 문서:</span>
                <span className="stat-value">{stats.totalDocs}개</span>
              </div>
              <div className="stat-item" title={`전체 문서의 총 용량: ${stats.totalSize}`}>
                <span className="stat-label">총 용량:</span>
                <span className="stat-value">{stats.totalSize}</span>
              </div>
            </div>
          </div>
        </aside>

        {!showSettings ? (
          <FileManager 
            documents={filteredDocuments}
            onDelete={handleDeleteDocument}
          />
        ) : (
          <SettingsPanel
            category={selectedCategory}
            onClose={() => setShowSettings(false)}
            onSave={handleSaveSettings}
          />
        )}
      </div>

      {showUploadModal && (
        <UploadModal
          categories={categories}
          onUpload={handleFileUpload}
          onClose={() => setShowUploadModal(false)}
        />
      )}
    </div>
  );
};

export default RAGManagerPage;