import React, { useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDatabase, faFileAlt, faUser } from '@fortawesome/free-solid-svg-icons';
import { useRAGManager } from '../hooks/useRAGManager';
import { useRAGHandlers } from '../hooks/useRAGHandlers';
import KnowledgeBuilder from '../components/rag-manager/KnowledgeBuilder';
import KnowledgeFinder from '../components/rag-manager/KnowledgeFinder';
import AIMaster from '../components/rag-manager/AIMaster';
import FileManager from '../components/rag-manager/FileManager';
import KnowledgeList from '../components/rag-manager/KnowledgeList';
import UploadModal from '../components/rag-manager/UploadModal';
import KnowledgeBaseModals from '../components/rag-manager/KnowledgeBaseModals';
import './RAGManagerPage.css';

const RAGManagerPage = () => {
  // Use custom hooks for state and handlers
  const ragManager = useRAGManager();
  const ragHandlers = useRAGHandlers(ragManager);

  // Initialize data and set up polling
  useEffect(() => {
    ragManager.loadInitialData();
  }, []);

  useEffect(() => {
    if (ragManager.selectedIndexId) {
      ragManager.loadDocumentsByIndex(ragManager.selectedIndexId);
    }
  }, [ragManager.selectedIndexId]);

  // Polling for document status updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (ragManager.documents.some(doc => doc.status === 'Processing')) {
        ragManager.loadAllDocuments();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [ragManager.documents]);

  // Auto-clear notifications
  useEffect(() => {
    if (ragManager.notification) {
      const timer = setTimeout(() => {
        ragManager.setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [ragManager.notification]);

  // Handle select all documents (needs access to filteredData)
  const handleSelectAllDocuments = () => {
    if (ragManager.selectedDocuments.length === ragManager.filteredData.length) {
      ragManager.setSelectedDocuments([]);
    } else {
      ragManager.setSelectedDocuments(ragManager.filteredData.map(doc => doc.id));
    }
  };


  // Render content based on active document tab
  const renderDocumentContent = () => {
    switch(ragManager.activeDocTab) {
      case 'knowledge-builder':
        return (
          <KnowledgeBuilder 
            selectedIndex={ragManager.selectedIndex}
            kbSettings={ragManager.kbSettings}
            setKbSettings={ragManager.setKbSettings}
          />
        );

      case 'knowledge-finder':
        return (
          <KnowledgeFinder 
            selectedIndex={ragManager.selectedIndex}
            kfSettings={ragManager.kfSettings}
            setKfSettings={ragManager.setKfSettings}
          />
        );

      case 'ai-master':
        return (
          <AIMaster 
            selectedIndex={ragManager.selectedIndex}
            aiSettings={ragManager.aiSettings}
            setAiSettings={ragManager.setAiSettings}
          />
        );

      default:
        return (
          <FileManager 
            filteredData={ragManager.filteredData}
            selectedDocuments={ragManager.selectedDocuments}
            selectedIndexId={ragManager.selectedIndexId}
            setShowUploadModal={ragManager.setShowUploadModal}
            handleSelectDocument={ragHandlers.handleSelectDocument}
            handleSelectAllDocuments={handleSelectAllDocuments}
            handleBulkReprocessDocs={ragHandlers.handleBulkReprocessDocs}
            handleBulkDeleteDocs={ragHandlers.handleBulkDeleteDocs}
            handleDeleteDocument={ragHandlers.handleDeleteDocument}
            handleReprocessDocument={ragHandlers.handleReprocessDocument}
            formatFileSize={ragHandlers.formatFileSize}
            formatDate={ragHandlers.formatDate}
          />
        );
    }
  };

  return (
    <div className="rag-manager-container">
      {/* Top Navigation */}
      <div className="top-navigation">
        <div className="nav-tabs">
          <button className="nav-tab">AIR Studio Chat</button>
          <button className="nav-tab active">RAG Manager</button>
        </div>
        <div className="user-section">
          <FontAwesomeIcon icon={faUser} />
          <span>안녕하세요, SK 쉴더스 이드민님</span>
        </div>
      </div>

      <div className="rag-content-wrapper">
        {/* Left Sidebar - Removed dropdown */}
        <aside className="rag-sidebar">
          <nav className="sidebar-menu">
            {/* Knowledge Manager */}
            <div className="menu-item">
              <button className="menu-toggle">
                <FontAwesomeIcon icon={faDatabase} />
                <span>Knowledge Manager</span>
              </button>
            </div>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="rag-main-content">
          <div className="content-header">
            <h1>Knowledge Manager</h1>
          </div>

          {/* Index List Section */}
          <KnowledgeList 
            searchQuery={ragManager.searchQuery}
            setSearchQuery={ragManager.setSearchQuery}
            handleNewKB={ragHandlers.handleNewKB}
            handleEditKB={ragHandlers.handleEditKB}
            handleDeleteKB={ragHandlers.handleDeleteKB}
            selectedIndexId={ragManager.selectedIndexId}
            getDocumentCount={ragManager.getDocumentCount}
            paginatedKnowledgeList={ragManager.paginatedKnowledgeList}
            filteredKnowledgeList={ragManager.filteredKnowledgeList}
            setSelectedIndex={ragManager.setSelectedIndex}
            setSelectedIndexId={ragManager.setSelectedIndexId}
            setSelectedDocuments={ragManager.setSelectedDocuments}
            totalKnowledgePages={ragManager.totalKnowledgePages}
            currentKnowledgePage={ragManager.currentKnowledgePage}
            handleKnowledgePageChange={ragManager.handleKnowledgePageChange}
          />

          {/* Document List Section */}
          <div className="document-list-section">
            <div className="section-header">
              <span className="section-title">
                <FontAwesomeIcon icon={faFileAlt} /> {ragManager.selectedIndex}
              </span>
              <input 
                type="text"
                placeholder="입력하세요"
                className="search-input"
                value={ragManager.searchQuery}
                onChange={(e) => ragManager.setSearchQuery(e.target.value)}
              />
            </div>

            <div className="document-tabs">
              <button 
                className={`doc-tab ${ragManager.activeDocTab === 'file-manager' ? 'active' : ''}`}
                onClick={() => ragManager.setActiveDocTab('file-manager')}
              >
                File Manager
              </button>
            </div>

            {renderDocumentContent()}
          </div>
        </main>
      </div>

      {/* Notification removed to prevent "h is not a function" error */}

      {/* Upload Modal */}
      <UploadModal 
        showUploadModal={ragManager.showUploadModal}
        setShowUploadModal={ragManager.setShowUploadModal}
        dragOver={ragManager.dragOver}
        handleDragOver={ragHandlers.handleDragOver}
        handleDragLeave={ragHandlers.handleDragLeave}
        handleDrop={ragHandlers.handleDrop}
        fileInputRef={ragManager.fileInputRef}
        handleFileInputChange={ragHandlers.handleFileInputChange}
        selectedIndexId={ragManager.selectedIndexId}
        selectedIndex={ragManager.selectedIndex}
      />

      {/* Knowledge Base Modals */}
      <KnowledgeBaseModals 
        showNewKBModal={ragManager.showNewKBModal}
        setShowNewKBModal={ragManager.setShowNewKBModal}
        showEditKBModal={ragManager.showEditKBModal}
        setShowEditKBModal={ragManager.setShowEditKBModal}
        newKBData={ragManager.newKBData}
        setNewKBData={ragManager.setNewKBData}
        editKBData={ragManager.editKBData}
        setEditKBData={ragManager.setEditKBData}
        handleSaveNewKB={ragHandlers.handleSaveNewKB}
        handleSaveEditKB={ragHandlers.handleSaveEditKB}
        loading={ragManager.loading}
      />
    </div>
  );
};

export default RAGManagerPage;