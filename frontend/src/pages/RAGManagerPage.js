import React, { useState, useEffect, useRef } from 'react';
import { documentService } from '../services/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { 
  faPlus, 
  faEdit, 
  faTrash, 
  faSearch,
  faFileAlt,
  faDatabase,
  faBrain,
  faChevronDown,
  faChevronRight,
  faFolder,
  faFolderOpen,
  faCheck,
  faRedo,
  faUser,
  faMinus,
  faCloudUploadAlt,
  faTimes,
  faSpinner,
  faCheckCircle,
  faExclamationCircle,
  faSync
} from '@fortawesome/free-solid-svg-icons';
import './RAGManagerPage.css';

const RAGManagerPage = () => {
  const [documents, setDocuments] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [activeTab, setActiveTab] = useState('knowledge');
  const [activeDocTab, setActiveDocTab] = useState('file-manager');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentKnowledgePage, setCurrentKnowledgePage] = useState(1);
  const [expandedMenu, setExpandedMenu] = useState('knowledge');
  const [selectedIndex, setSelectedIndex] = useState('SK쉴더스-고객센터');
  const [selectedIndexId, setSelectedIndexId] = useState('skshieldus_poc_callcenter');
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [selectedDocuments, setSelectedDocuments] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [notification, setNotification] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showNewKBModal, setShowNewKBModal] = useState(false);
  const [showEditKBModal, setShowEditKBModal] = useState(false);
  const [newKBData, setNewKBData] = useState({ name: '', id: '' });
  const [editKBData, setEditKBData] = useState({ name: '', id: '' });
  const fileInputRef = useRef(null);
  const [documentStats, setDocumentStats] = useState({
    total: 0,
    processing: 0,
    completed: 0,
    failed: 0
  });
  
  // Knowledge Builder States
  const [kbSettings, setKbSettings] = useState({
    embeddingModel: 'AWS-titan-embed-text-v2',
    strategy: 'hi_res',
    hiResModelName: 'yolox',
    extractImages: true,
    extractImageBlock: false,
    skipInferTableTypes: '선택해 주세요',
    chunkingStrategy: 'by_title',
    chunkingMode: 'elements',
    maxCharacters: 4096,
    newAfterNChars: 4000,
    combineTextUnderNChars: 2000,
    languages: 'kor+eng',
    titleRegExpression: ''
  });

  // Knowledge Finder States
  const [kfSettings, setKfSettings] = useState({
    fusionAlgorithm: 'RRF',
    reranker: false,
    rerankerEndpoint: '입력해 주세요',
    ragFusion: false,
    queryAugmentationSize: 2,
    hyde: false,
    hydeQuery: 'web_search',
    hybridSearchDebugger: 'None',
    filter: '입력해 주세요',
    ensembleWeight: 0.5,
    minShouldMatch: 0,
    returnDocCount: 3,
    parentDocument: true,
    complexDoc: true,
    asyncMode: true,
    verbose: true
  });

  // AI Master States
  const [aiSettings, setAiSettings] = useState({
    llmModelId: 'Claude 3.7 Sonnet',
    maxTokens: 4092,
    stopSequences: 'Human',
    temperature: 0,
    topK: 250,
    topP: 0.99,
    prompt: '인덱스를 프롬프트를 작성하세요.'
  });
  
  // Process documents for display
  const processedDocuments = documents.map((doc, index) => ({
    id: doc.id || index + 1,
    name: doc.file_name || doc.title || `Document ${index + 1}`,
    size: doc.file_size || (doc.content ? doc.content.length : 0),
    date: doc.uploaded_at || doc.created_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
    status: doc.status || 'Success',
    chunks: doc.chunk_count || Math.floor(Math.random() * 10) + 1, // Calculate actual chunks if available
    originalDoc: doc
  }));

  // Index list with dynamic document counts (now using state with localStorage persistence)
  const getInitialIndexList = () => {
    try {
      const stored = localStorage.getItem('ragManager_indexList');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading stored index list:', error);
    }
    // Default data if nothing stored or error occurs
    return [
      { id: 'skshieldus_test', name: 'test', status: 'active' },
      { id: 'skshieldus_poc_test_jji_p', name: 'SK 쉴더스 - Test -JJI - 비정형(PDF)', status: 'active' },
      { id: 'skshieldus_poc_callcenter', name: 'SK쉴더스-고객센터', status: 'active', selected: true },
      { id: 'skshieldus_poc_v2', name: 'SK 쉴더스 - 비정형(PDF)', status: 'active' }
    ];
  };

  const [indexList, setIndexList] = useState(getInitialIndexList);

  // Get document count for each index
  const getDocumentCount = (indexId) => {
    return documents.filter(doc => doc.index_id === indexId).length;
  };

  // Knowledge List Pagination
  const KNOWLEDGE_ITEMS_PER_PAGE = 5;
  
  // Filter and paginate knowledge list
  const filteredKnowledgeList = indexList.filter(kb => 
    kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    kb.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalKnowledgePages = Math.ceil(filteredKnowledgeList.length / KNOWLEDGE_ITEMS_PER_PAGE);
  const paginatedKnowledgeList = filteredKnowledgeList.slice(
    (currentKnowledgePage - 1) * KNOWLEDGE_ITEMS_PER_PAGE,
    currentKnowledgePage * KNOWLEDGE_ITEMS_PER_PAGE
  );

  const handleKnowledgePageChange = (page) => {
    setCurrentKnowledgePage(page);
  };

  // Save indexList to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('ragManager_indexList', JSON.stringify(indexList));
      // Dispatch custom event to notify other components/pages
      window.dispatchEvent(new CustomEvent('knowledgeListUpdated', { detail: indexList }));
    } catch (error) {
      console.error('Error saving index list:', error);
    }
  }, [indexList]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedIndexId) {
      loadDocumentsByIndex(selectedIndexId);
    }
  }, [selectedIndexId]);

  // Polling for document status updates
  useEffect(() => {
    const interval = setInterval(() => {
      if (documents.some(doc => doc.status === 'Processing')) {
        loadDocumentsByIndex(selectedIndexId);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [documents, selectedIndexId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // Load knowledge bases
      const kbResponse = await documentService.getKnowledgeBases();
      setKnowledgeBases(kbResponse.knowledge_bases || []);
      
      // Load documents for selected index
      if (selectedIndexId) {
        await loadDocumentsByIndex(selectedIndexId);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentsByIndex = async (indexId) => {
    try {
      setLoading(true);
      const response = await documentService.getDocumentsByIndex(indexId);
      const docs = response.documents || [];
      setDocuments(docs);
      
      // Update statistics
      updateDocumentStats(docs);
    } catch (error) {
      console.error('Failed to load documents for index:', error);
      setDocuments([]);
      setDocumentStats({ total: 0, processing: 0, completed: 0, failed: 0 });
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStats = (docs) => {
    const stats = docs.reduce((acc, doc) => {
      acc.total++;
      switch (doc.status?.toLowerCase()) {
        case 'processing':
          acc.processing++;
          break;
        case 'success':
        case 'completed':
          acc.completed++;
          break;
        case 'failed':
        case 'error':
          acc.failed++;
          break;
        default:
          acc.completed++;
      }
      return acc;
    }, { total: 0, processing: 0, completed: 0, failed: 0 });
    
    setDocumentStats(stats);
  };

  const handleFileUpload = async (file) => {
    const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    try {
      // Store file reference for retry functionality
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { 
          fileName: file.name, 
          progress: 0, 
          status: 'uploading',
          file: file,
          size: file.size
        }
      }));

      // Validate file
      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      // Update progress - validation complete
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 10, status: 'uploading' }
      }));

      if (!selectedIndexId) {
        throw new Error('Please select a knowledge base first');
      }

      // Prepare processing options from Knowledge Builder settings
      const processingOptions = {
        embeddingModel: kbSettings.embeddingModel,
        chunkingStrategy: kbSettings.chunkingStrategy,
        chunkSize: kbSettings.maxCharacters,
        chunkOverlap: kbSettings.overlap,
        extractImages: kbSettings.extractImages,
        preserveMetadata: kbSettings.preserveMetadata
      };

      // Update progress - preparing upload
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 25, status: 'uploading' }
      }));

      // Simulate upload progress (in real implementation, use XMLHttpRequest for progress)
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[uploadId];
          if (current && current.progress < 90 && current.status === 'uploading') {
            return {
              ...prev,
              [uploadId]: { ...current, progress: Math.min(current.progress + 15, 90) }
            };
          }
          return prev;
        });
      }, 500);

      // Actual upload
      const result = await documentService.uploadToKnowledgeBase(
        file, 
        selectedIndexId, 
        processingOptions
      );

      clearInterval(progressInterval);

      // Upload complete
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { 
          ...prev[uploadId], 
          progress: 100, 
          status: 'success',
          docId: result.document_id
        }
      }));

      // Refresh document list
      await loadDocumentsByIndex(selectedIndexId);
      
      setNotification({ 
        message: `File "${file.name}" uploaded and processed successfully`, 
        type: 'success' 
      });
      
      // Auto-clear successful uploads after delay
      setTimeout(() => {
        setUploadProgress(prev => {
          const updated = { ...prev };
          if (updated[uploadId]?.status === 'success') {
            delete updated[uploadId];
          }
          return updated;
        });
      }, 5000);

    } catch (error) {
      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { 
          ...prev[uploadId],
          progress: 0, 
          status: 'error', 
          error: error.message 
        }
      }));
      setNotification({ 
        message: `Failed to upload "${file.name}": ${error.message}`, 
        type: 'error' 
      });
    }
  };

  // File validation function
  const validateFile = (file) => {
    const maxSize = 50 * 1024 * 1024; // 50MB
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/csv',
      'application/json',
      'text/markdown',
      'application/rtf'
    ];

    if (file.size > maxSize) {
      return 'File size must be less than 50MB';
    }

    if (!allowedTypes.includes(file.type)) {
      return 'Unsupported file type. Please upload PDF, TXT, DOC, DOCX, CSV, JSON, MD, or RTF files.';
    }

    return null;
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    handleMultipleFiles(files);
  };

  // Handle multiple file uploads
  const handleMultipleFiles = async (files) => {
    for (const file of files) {
      await handleFileUpload(file);
    }
  };

  // File input change handler
  const handleFileInputChange = (e) => {
    const files = Array.from(e.target.files);
    handleMultipleFiles(files);
    e.target.value = ''; // Reset input
  };

  // Clear completed uploads
  const clearCompletedUploads = () => {
    const activeUploads = Object.fromEntries(
      Object.entries(uploadProgress).filter(([_, upload]) => 
        upload.status === 'uploading'
      )
    );
    setUploadProgress(activeUploads);
  };

  // Cancel upload
  const cancelUpload = (uploadId) => {
    setUploadProgress(prev => {
      const updated = { ...prev };
      delete updated[uploadId];
      return updated;
    });
  };

  // Retry upload
  const retryUpload = async (uploadId) => {
    const upload = uploadProgress[uploadId];
    if (upload && upload.file) {
      await handleFileUpload(upload.file);
      cancelUpload(uploadId);
    }
  };

  // Bulk document actions
  const handleSelectDocument = (docId) => {
    setSelectedDocuments(prev => 
      prev.includes(docId) 
        ? prev.filter(id => id !== docId)
        : [...prev, docId]
    );
  };

  const handleSelectAllDocuments = () => {
    if (selectedDocuments.length === documents.length) {
      setSelectedDocuments([]);
    } else {
      setSelectedDocuments(documents.map(doc => doc.id));
    }
  };

  const handleBulkDeleteDocs = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      await documentService.deleteMultipleDocuments(selectedDocuments);
      await loadDocumentsByIndex(selectedIndexId);
      setSelectedDocuments([]);
      setNotification({ message: `${selectedDocuments.length} documents deleted successfully`, type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to delete documents', type: 'error' });
    }
  };

  const handleBulkReprocessDocs = async () => {
    if (selectedDocuments.length === 0) return;
    
    try {
      for (const docId of selectedDocuments) {
        await documentService.reprocessDocument(docId, kbSettings);
      }
      setNotification({ message: `${selectedDocuments.length} documents queued for reprocessing`, type: 'success' });
      setSelectedDocuments([]);
    } catch (error) {
      setNotification({ message: 'Failed to reprocess documents', type: 'error' });
    }
  };

  // Notification auto-clear
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => {
        setNotification(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const handleBulkUpload = async (files) => {
    const uploadPromises = files.map(file => handleFileUpload(file));
    
    try {
      await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Some files failed to upload:', error);
      // Individual file errors are already handled in handleFileUpload
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('정말로 이 파일을 삭제하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      await documentService.deleteDocument(docId);
      await loadDocumentsByIndex(selectedIndexId);
      
      // Remove from selected documents if it was selected
      setSelectedDocuments(prev => prev.filter(id => id !== docId));
    } catch (error) {
      console.error('Failed to delete document:', error);
      alert('파일 삭제에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };


  const handleReprocessDocument = async (docId) => {
    if (!window.confirm('이 파일을 다시 처리하시겠습니까?')) {
      return;
    }

    try {
      setLoading(true);
      const processingOptions = {
        embeddingModel: kbSettings.embeddingModel,
        chunkingStrategy: kbSettings.chunkingStrategy,
        chunkSize: kbSettings.maxCharacters,
        extractImages: kbSettings.extractImages
      };
      
      await documentService.reprocessDocument(docId, processingOptions);
      await loadDocumentsByIndex(selectedIndexId);
    } catch (error) {
      console.error('Failed to reprocess document:', error);
      alert('파일 재처리에 실패했습니다: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle New Knowledge Base
  const handleNewKB = () => {
    setNewKBData({ name: '', id: '' });
    setShowNewKBModal(true);
  };

  const handleSaveNewKB = async () => {
    if (!newKBData.name.trim() || !newKBData.id.trim()) {
      alert('저장소 이름과 ID를 모두 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      // Here you would typically call an API to create the knowledge base
      // await documentService.createKnowledgeBase(newKBData.name, newKBData.id);
      
      // For now, add to the local list immediately
      const newKB = {
        id: newKBData.id,
        name: newKBData.name,
        status: 'active'
      };
      setIndexList(prev => [...prev, newKB]);
      
      console.log('Creating new knowledge base:', newKBData);
      
      setShowNewKBModal(false);
      setNewKBData({ name: '', id: '' });
      setNotification({ message: '새 저장소가 생성되었습니다.', type: 'success' });
    } catch (error) {
      console.error('Failed to create knowledge base:', error);
      setNotification({ message: '저장소 생성에 실패했습니다: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Edit Knowledge Base
  const handleEditKB = () => {
    const selectedKB = indexList.find(index => index.id === selectedIndexId);
    if (!selectedKB) {
      alert('수정할 저장소를 선택해주세요.');
      return;
    }
    
    setEditKBData({ name: selectedKB.name, id: selectedKB.id });
    setShowEditKBModal(true);
  };

  const handleSaveEditKB = async () => {
    if (!editKBData.name.trim()) {
      alert('저장소 이름을 입력해주세요.');
      return;
    }

    try {
      setLoading(true);
      // Here you would typically call an API to update the knowledge base
      // await documentService.updateKnowledgeBase(editKBData.id, { name: editKBData.name });
      
      // Update the local list immediately
      setIndexList(prev => prev.map(kb => 
        kb.id === editKBData.id 
          ? { ...kb, name: editKBData.name }
          : kb
      ));
      
      // Update selected index name if this is the currently selected one
      if (selectedIndexId === editKBData.id) {
        setSelectedIndex(editKBData.name);
      }
      
      console.log('Updating knowledge base:', editKBData);
      
      setShowEditKBModal(false);
      setEditKBData({ name: '', id: '' });
      setNotification({ message: '저장소 정보가 수정되었습니다.', type: 'success' });
    } catch (error) {
      console.error('Failed to update knowledge base:', error);
      setNotification({ message: '저장소 수정에 실패했습니다: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Handle Delete Knowledge Base
  const handleDeleteKB = async () => {
    const selectedKB = indexList.find(index => index.id === selectedIndexId);
    if (!selectedKB) {
      alert('삭제할 저장소를 선택해주세요.');
      return;
    }

    // Check if there are documents in this knowledge base
    const documentCount = getDocumentCount(selectedIndexId);
    if (documentCount > 0) {
      alert('문서가 있는 저장소는 삭제할 수 없습니다. 먼저 모든 문서를 삭제해주세요.');
      return;
    }

    if (!window.confirm(`"${selectedKB.name}" 저장소를 정말로 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
      return;
    }

    try {
      setLoading(true);
      // Here you would typically call an API to delete the knowledge base
      // await documentService.deleteKnowledgeBase(selectedIndexId);
      
      // Remove from the local list immediately
      setIndexList(prev => prev.filter(kb => kb.id !== selectedIndexId));
      
      // Reset selection to first remaining item or default
      const remainingKBs = indexList.filter(kb => kb.id !== selectedIndexId);
      if (remainingKBs.length > 0) {
        setSelectedIndexId(remainingKBs[0].id);
        setSelectedIndex(remainingKBs[0].name);
      } else {
        // If no knowledge bases left, reset to defaults
        setSelectedIndexId('');
        setSelectedIndex('');
        setDocuments([]);
      }
      
      console.log('Deleting knowledge base:', selectedKB);
      
      setNotification({ message: '저장소가 삭제되었습니다.', type: 'success' });
    } catch (error) {
      console.error('Failed to delete knowledge base:', error);
      setNotification({ message: '저장소 삭제에 실패했습니다: ' + error.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const toggleMenu = (menu) => {
    setExpandedMenu(expandedMenu === menu ? null : menu);
  };


  const filteredData = processedDocuments.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toISOString().slice(0, 16).replace('T', ' ');
    } catch (error) {
      return dateString || new Date().toISOString().slice(0, 16).replace('T', ' ');
    }
  };

  // Render content based on active document tab
  const renderDocumentContent = () => {
    switch(activeDocTab) {
      case 'knowledge-builder':
        return (
          <div className="knowledge-builder-content">
            <div className="kb-header">
              <span className="kb-title">
                <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
              </span>
              <button className="btn-save-kb">Save</button>
            </div>

            <div className="kb-sections">
              {/* Embedding Section */}
              <div className="kb-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>Embedding</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Embedding Model</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.embeddingModel}
                      onChange={(e) => setKbSettings({...kbSettings, embeddingModel: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Partition Section */}
              <div className="kb-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>Partition</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Strategy</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.strategy}
                      onChange={(e) => setKbSettings({...kbSettings, strategy: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Hi Res Model Name</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.hiResModelName}
                      onChange={(e) => setKbSettings({...kbSettings, hiResModelName: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Extract Images</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kbSettings.extractImages}
                        onChange={(e) => setKbSettings({...kbSettings, extractImages: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Extract Image Block to Payload</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kbSettings.extractImageBlock}
                        onChange={(e) => setKbSettings({...kbSettings, extractImageBlock: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Skip Infer Table Types</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.skipInferTableTypes}
                      onChange={(e) => setKbSettings({...kbSettings, skipInferTableTypes: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* Chunking Section */}
              <div className="kb-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>Chunking</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Chunking Strategy</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.chunkingStrategy}
                      onChange={(e) => setKbSettings({...kbSettings, chunkingStrategy: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Chunking Mode</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.chunkingMode}
                      onChange={(e) => setKbSettings({...kbSettings, chunkingMode: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Characters</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kbSettings.maxCharacters}
                        onChange={(e) => setKbSettings({...kbSettings, maxCharacters: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKbSettings({...kbSettings, maxCharacters: kbSettings.maxCharacters - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKbSettings({...kbSettings, maxCharacters: kbSettings.maxCharacters + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>New After N Chars</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kbSettings.newAfterNChars}
                        onChange={(e) => setKbSettings({...kbSettings, newAfterNChars: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKbSettings({...kbSettings, newAfterNChars: kbSettings.newAfterNChars - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKbSettings({...kbSettings, newAfterNChars: kbSettings.newAfterNChars + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Combine Text Under N Chars</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kbSettings.combineTextUnderNChars}
                        onChange={(e) => setKbSettings({...kbSettings, combineTextUnderNChars: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKbSettings({...kbSettings, combineTextUnderNChars: kbSettings.combineTextUnderNChars - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKbSettings({...kbSettings, combineTextUnderNChars: kbSettings.combineTextUnderNChars + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Languages</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kbSettings.languages}
                      onChange={(e) => setKbSettings({...kbSettings, languages: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Title Reg-Expression</label>
                    <textarea 
                      className="form-textarea"
                      placeholder="Chunking Strategy에서 by_title(reg-expression)를 선택하세요."
                      value={kbSettings.titleRegExpression}
                      onChange={(e) => setKbSettings({...kbSettings, titleRegExpression: e.target.value})}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'knowledge-finder':
        return (
          <div className="knowledge-finder-content">
            <div className="kf-header">
              <span className="kf-title">
                <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
              </span>
              <button className="btn-save-kf">Save</button>
            </div>

            <div className="kf-sections">
              {/* Rank Fusion Section */}
              <div className="kf-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>Rank Fusion</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Fusion Algorithm</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kfSettings.fusionAlgorithm}
                      onChange={(e) => setKfSettings({...kfSettings, fusionAlgorithm: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Reranker</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.reranker}
                        onChange={(e) => setKfSettings({...kfSettings, reranker: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Reranker Endpoint</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kfSettings.rerankerEndpoint}
                      onChange={(e) => setKfSettings({...kfSettings, rerankerEndpoint: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* RAG-Fusion Section */}
              <div className="kf-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>RAG-Fusion</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Rag Fusion</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.ragFusion}
                        onChange={(e) => setKfSettings({...kfSettings, ragFusion: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Query Augmentation Size</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kfSettings.queryAugmentationSize}
                        onChange={(e) => setKfSettings({...kfSettings, queryAugmentationSize: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKfSettings({...kfSettings, queryAugmentationSize: kfSettings.queryAugmentationSize - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKfSettings({...kfSettings, queryAugmentationSize: kfSettings.queryAugmentationSize + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* HyDE Section */}
              <div className="kf-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>HyDE</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Hyde</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.hyde}
                        onChange={(e) => setKfSettings({...kfSettings, hyde: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Hyde Query</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kfSettings.hydeQuery}
                      onChange={(e) => setKfSettings({...kfSettings, hydeQuery: e.target.value})}
                    />
                  </div>
                </div>
              </div>

              {/* ETC Section */}
              <div className="kf-section">
                <div className="section-toggle">
                  <FontAwesomeIcon icon={faChevronDown} />
                  <span>ETC</span>
                </div>
                <div className="section-content">
                  <div className="form-group">
                    <label>Hybrid Search Debugger</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kfSettings.hybridSearchDebugger}
                      onChange={(e) => setKfSettings({...kfSettings, hybridSearchDebugger: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Filter</label>
                    <input 
                      type="text" 
                      className="form-input"
                      value={kfSettings.filter}
                      onChange={(e) => setKfSettings({...kfSettings, filter: e.target.value})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Ensemble Weight</label>
                    <input 
                      type="range" 
                      className="form-range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={kfSettings.ensembleWeight}
                      onChange={(e) => setKfSettings({...kfSettings, ensembleWeight: parseFloat(e.target.value)})}
                    />
                  </div>
                  <div className="form-group">
                    <label>Minimum Should Match</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kfSettings.minShouldMatch}
                        onChange={(e) => setKfSettings({...kfSettings, minShouldMatch: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKfSettings({...kfSettings, minShouldMatch: kfSettings.minShouldMatch - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKfSettings({...kfSettings, minShouldMatch: kfSettings.minShouldMatch + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Return Doc. Count (K)</label>
                    <div className="input-with-controls">
                      <input 
                        type="number" 
                        className="form-input"
                        value={kfSettings.returnDocCount}
                        onChange={(e) => setKfSettings({...kfSettings, returnDocCount: parseInt(e.target.value)})}
                      />
                      <div className="input-controls">
                        <button onClick={() => setKfSettings({...kfSettings, returnDocCount: kfSettings.returnDocCount - 1})}>
                          <FontAwesomeIcon icon={faMinus} />
                        </button>
                        <button onClick={() => setKfSettings({...kfSettings, returnDocCount: kfSettings.returnDocCount + 1})}>
                          <FontAwesomeIcon icon={faPlus} />
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Parent Document</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.parentDocument}
                        onChange={(e) => setKfSettings({...kfSettings, parentDocument: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Complex Doc.</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.complexDoc}
                        onChange={(e) => setKfSettings({...kfSettings, complexDoc: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Async Mode</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.asyncMode}
                        onChange={(e) => setKfSettings({...kfSettings, asyncMode: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                  <div className="form-group">
                    <label>Verbose</label>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={kfSettings.verbose}
                        onChange={(e) => setKfSettings({...kfSettings, verbose: e.target.checked})}
                      />
                      <span className="toggle-slider"></span>
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 'ai-master':
        return (
          <div className="ai-master-content">
            <div className="ai-header">
              <span className="ai-title">
                <FontAwesomeIcon icon={faDatabase} /> {selectedIndex}
              </span>
              <button className="btn-save-ai">Save</button>
            </div>

            <div className="ai-form">
              <div className="form-group">
                <label>LLM Model ID</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={aiSettings.llmModelId}
                  onChange={(e) => setAiSettings({...aiSettings, llmModelId: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Max Tokens</label>
                <div className="input-with-controls">
                  <input 
                    type="number" 
                    className="form-input"
                    value={aiSettings.maxTokens}
                    onChange={(e) => setAiSettings({...aiSettings, maxTokens: parseInt(e.target.value)})}
                  />
                  <div className="input-controls">
                    <button onClick={() => setAiSettings({...aiSettings, maxTokens: aiSettings.maxTokens - 1})}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button onClick={() => setAiSettings({...aiSettings, maxTokens: aiSettings.maxTokens + 1})}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Stop Sequences</label>
                <input 
                  type="text" 
                  className="form-input"
                  value={aiSettings.stopSequences}
                  onChange={(e) => setAiSettings({...aiSettings, stopSequences: e.target.value})}
                />
              </div>
              <div className="form-group">
                <label>Temperature</label>
                <div className="input-with-controls">
                  <input 
                    type="number" 
                    className="form-input"
                    value={aiSettings.temperature}
                    step="0.1"
                    onChange={(e) => setAiSettings({...aiSettings, temperature: parseFloat(e.target.value)})}
                  />
                  <div className="input-controls">
                    <button onClick={() => setAiSettings({...aiSettings, temperature: Math.max(0, aiSettings.temperature - 0.1)})}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button onClick={() => setAiSettings({...aiSettings, temperature: aiSettings.temperature + 0.1})}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Top K</label>
                <div className="input-with-controls">
                  <input 
                    type="number" 
                    className="form-input"
                    value={aiSettings.topK}
                    onChange={(e) => setAiSettings({...aiSettings, topK: parseInt(e.target.value)})}
                  />
                  <div className="input-controls">
                    <button onClick={() => setAiSettings({...aiSettings, topK: aiSettings.topK - 1})}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button onClick={() => setAiSettings({...aiSettings, topK: aiSettings.topK + 1})}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>Top P</label>
                <div className="input-with-controls">
                  <input 
                    type="number" 
                    className="form-input"
                    value={aiSettings.topP}
                    step="0.01"
                    onChange={(e) => setAiSettings({...aiSettings, topP: parseFloat(e.target.value)})}
                  />
                  <div className="input-controls">
                    <button onClick={() => setAiSettings({...aiSettings, topP: Math.max(0, aiSettings.topP - 0.01)})}>
                      <FontAwesomeIcon icon={faMinus} />
                    </button>
                    <button onClick={() => setAiSettings({...aiSettings, topP: Math.min(1, aiSettings.topP + 0.01)})}>
                      <FontAwesomeIcon icon={faPlus} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="form-group">
                <label>인덱스 프롬프트</label>
                <textarea 
                  className="form-textarea prompt-textarea"
                  value={aiSettings.prompt}
                  onChange={(e) => setAiSettings({...aiSettings, prompt: e.target.value})}
                />
              </div>
              <div className="prompt-action">
                <button className="btn-prompt-submit">프롬프트 테스트 조회</button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <div className="file-manager-content">
            {/* Add Document Button */}
            <div className="file-manager-header">
              <button 
                className="btn-add-document"
                onClick={() => setShowUploadModal(true)}
              >
                <FontAwesomeIcon icon={faPlus} /> Add Document
              </button>
            </div>

            {/* Upload Progress Section */}
            {Object.keys(uploadProgress).length > 0 && (
              <div className="upload-progress-section">
                <div className="upload-progress-header">
                  <div className="upload-progress-title">
                    <FontAwesomeIcon icon={faCloudUploadAlt} />
                    Upload Progress ({Object.keys(uploadProgress).length})
                  </div>
                  <button 
                    className="btn-clear-uploads"
                    onClick={clearCompletedUploads}
                    title="Clear completed uploads"
                  >
                    Clear
                  </button>
                </div>
                <div className="upload-items">
                  {Object.entries(uploadProgress).map(([uploadId, upload]) => (
                    <div key={uploadId} className="upload-item">
                      <FontAwesomeIcon 
                        icon={
                          upload.status === 'uploading' ? faSpinner :
                          upload.status === 'success' ? faCheckCircle :
                          faExclamationCircle
                        }
                        className={`upload-item-icon ${upload.status}`}
                      />
                      <div className="upload-item-info">
                        <div className="upload-item-name" title={upload.fileName}>
                          {upload.fileName}
                        </div>
                        <div className="upload-item-status">
                          {upload.status === 'uploading' ? `Uploading... ${upload.progress}%` :
                           upload.status === 'success' ? 'Upload completed' :
                           upload.error || 'Upload failed'}\n                        </div>
                      </div>
                      {upload.status === 'uploading' && (
                        <div className="upload-progress-bar">
                          <div 
                            className="upload-progress-fill" 
                            style={{ width: `${upload.progress}%` }}
                          />
                        </div>
                      )}
                      <div className="upload-item-actions">
                        {upload.status === 'uploading' && (
                          <button 
                            className="btn-upload-cancel"
                            onClick={() => cancelUpload(uploadId)}
                            title="Cancel upload"
                          >
                            <FontAwesomeIcon icon={faTimes} />
                          </button>
                        )}
                        {upload.status === 'error' && (
                          <button 
                            className="btn-upload-retry"
                            onClick={() => retryUpload(uploadId)}
                            title="Retry upload"
                          >
                            <FontAwesomeIcon icon={faSync} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bulk Actions Bar */}
            {selectedDocuments.length > 0 && (
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
            )}

            {filteredData.length === 0 && Object.keys(uploadProgress).length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-content">
                  <FontAwesomeIcon icon={faFileAlt} className="empty-icon" />
                  <h3>No files uploaded</h3>
                  <p>Upload files to your knowledge base to get started.</p>
                  <button 
                    className="btn-upload-primary"
                    onClick={() => setShowUploadModal(true)}
                  >
                    <FontAwesomeIcon icon={faPlus} />
                    Upload Files
                  </button>
                </div>
              </div>
            ) : filteredData.length > 0 && (
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
            )}
          </div>
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

            {/* Indexed Document */}
            <div className="menu-item">
              <button 
                className="menu-toggle"
                onClick={() => toggleMenu('indexed')}
              >
                <FontAwesomeIcon icon={expandedMenu === 'indexed' ? faChevronDown : faChevronRight} />
                <span>Indexed Document</span>
              </button>
            </div>

            {/* OpenSearch Query */}
            <div className="menu-item">
              <button 
                className="menu-toggle"
                onClick={() => toggleMenu('opensearch')}
              >
                <FontAwesomeIcon icon={expandedMenu === 'opensearch' ? faChevronDown : faChevronRight} />
                <span>OpenSearch Query</span>
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
          <div className="index-list-section">
            <div className="section-header">
              <div className="section-title">
                <FontAwesomeIcon icon={faDatabase} />
                Knowledge List
              </div>
              <div className="section-header-controls">
                <input 
                  type="text"
                  placeholder="인덱스세요"
                  className="search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
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
                  {paginatedKnowledgeList.map((index, idx) => {
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

          {/* Document List Section */}
          <div className="document-list-section">
            <div className="section-header">
              <span className="section-title">
                <FontAwesomeIcon icon={faFileAlt} /> {selectedIndex}
              </span>
              <input 
                type="text"
                placeholder="입력하세요"
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="document-tabs">
              <button 
                className={`doc-tab ${activeDocTab === 'file-manager' ? 'active' : ''}`}
                onClick={() => setActiveDocTab('file-manager')}
              >
                File Manager
              </button>
           
              <button 
                className={`doc-tab ${activeDocTab === 'knowledge-builder' ? 'active' : ''}`}
                onClick={() => setActiveDocTab('knowledge-builder')}
              >
                Knowledge Builder
              </button>
              <button 
                className={`doc-tab ${activeDocTab === 'knowledge-finder' ? 'active' : ''}`}
                onClick={() => setActiveDocTab('knowledge-finder')}
              >
                Knowledge Finder
              </button>
              <button 
                className={`doc-tab ${activeDocTab === 'ai-master' ? 'active' : ''}`}
                onClick={() => setActiveDocTab('ai-master')}
              >
                AI Master
              </button>
             
            </div>

            {renderDocumentContent()}

            {/* Pagination - Only show for file-manager */}
            {activeDocTab === 'file-manager' && (
              <div className="pagination">
                <button className="page-btn">&lt;</button>
                <button className="page-num active">1</button>
                <button className="page-num">2</button>
                <button className="page-btn">&gt;</button>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Notification */}
      {notification && (
        <div 
          className={`notification ${notification.type}`}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '12px 16px',
            borderRadius: '6px',
            color: 'white',
            backgroundColor: notification.type === 'success' ? '#10b981' : '#ef4444',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
          }}
        >
          {notification.message}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
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
      )}

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
    </div>
  );
};

export default RAGManagerPage;