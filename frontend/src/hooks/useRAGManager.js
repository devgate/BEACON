import { useState, useEffect, useRef, useMemo } from 'react';
import { documentService } from '../services/api';

export const useRAGManager = () => {
  // State management
  const [documents, setDocuments] = useState([]);
  const [knowledgeBases, setKnowledgeBases] = useState([]);
  const [activeTab, setActiveTab] = useState('knowledge');
  const [activeDocTab, setActiveDocTab] = useState('file-manager');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [currentKnowledgePage, setCurrentKnowledgePage] = useState(1);
  const [expandedMenu, setExpandedMenu] = useState('knowledge');
  const [selectedIndex, setSelectedIndex] = useState('');
  const [selectedIndexId, setSelectedIndexId] = useState('');
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

  // Index list from server
  const [indexList, setIndexList] = useState([]);

  // Process documents for display
  const processedDocuments = documents.map((doc, index) => ({
    id: doc.id || index + 1,
    name: doc.file_name || doc.title || `Document ${index + 1}`,
    size: doc.file_size || (doc.content ? doc.content.length : 0),
    date: doc.uploaded_at || doc.created_at || new Date().toISOString().slice(0, 16).replace('T', ' '),
    status: doc.status || 'Success',
    chunks: doc.chunk_count || Math.floor(Math.random() * 10) + 1,
    index_id: doc.index_id,
    originalDoc: doc
  }));

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

  // Filter documents by selected index and search query
  const filteredData = useMemo(() => {
    if (!selectedIndexId) {
      return processedDocuments.filter(doc => 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    const filtered = processedDocuments.filter(doc => {
      const matchesIndex = doc.index_id === selectedIndexId;
      const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesIndex && matchesSearch;
    });
    
    return filtered;
  }, [processedDocuments, selectedIndexId, searchQuery]);

  // Data loading functions
  const loadInitialData = async () => {
    setLoading(true);
    try {
      const kbResponse = await documentService.getKnowledgeBases();
      const knowledgeBases = kbResponse.knowledge_bases || [];
      setKnowledgeBases(knowledgeBases);
      
      const indexes = knowledgeBases.map(kb => ({
        id: kb.id,
        name: kb.name,
        status: kb.status || 'active',
        description: kb.description
      }));
      setIndexList(indexes);
      
      if (indexes.length > 0 && !selectedIndexId) {
        const defaultIndex = indexes.find(idx => idx.id === 'skshieldus_poc_callcenter') || indexes[0];
        setSelectedIndexId(defaultIndex.id);
        setSelectedIndex(defaultIndex.name);
      }
      
      await loadAllDocuments();
    } catch (error) {
      console.error('Failed to load initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllDocuments = async () => {
    try {
      const allDocs = [];
      
      const kbResponse = await documentService.getKnowledgeBases();
      const knowledgeBases = kbResponse.knowledge_bases || [];
      
      for (const kb of knowledgeBases) {
        try {
          const response = await documentService.getDocumentsByIndex(kb.id);
          const docs = response.documents || [];
          allDocs.push(...docs);
        } catch (error) {
          console.error(`Failed to load documents for index ${kb.id}:`, error);
        }
      }
      
      setDocuments(allDocs);
      
      if (selectedIndexId) {
        const currentIndexDocs = allDocs.filter(doc => doc.index_id === selectedIndexId);
        updateDocumentStats(currentIndexDocs);
      }
    } catch (error) {
      console.error('Failed to load all documents:', error);
      setDocuments([]);
      setDocumentStats({ total: 0, processing: 0, completed: 0, failed: 0 });
    }
  };

  const loadDocumentsByIndex = async (indexId) => {
    try {
      setLoading(true);
      const currentIndexDocs = documents.filter(doc => doc.index_id === indexId);
      updateDocumentStats(currentIndexDocs);
      
      if (currentIndexDocs.length === 0) {
        const response = await documentService.getDocumentsByIndex(indexId);
        const docs = response.documents || [];
        
        setDocuments(prevDocs => {
          const filteredPrevDocs = prevDocs.filter(doc => doc.index_id !== indexId);
          return [...filteredPrevDocs, ...docs];
        });
        
        updateDocumentStats(docs);
      }
    } catch (error) {
      console.error('Failed to load documents for index:', error);
      updateDocumentStats([]);
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

  // File operations
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

  const handleFileUpload = async (file) => {
    const uploadId = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    
    try {
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

      const validationError = validateFile(file);
      if (validationError) {
        throw new Error(validationError);
      }

      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 10, status: 'uploading' }
      }));

      if (!selectedIndexId) {
        throw new Error('Please select a knowledge base first');
      }

      const processingOptions = {
        embeddingModel: kbSettings.embeddingModel,
        chunkingStrategy: kbSettings.chunkingStrategy,
        chunkSize: kbSettings.maxCharacters,
        chunkOverlap: kbSettings.overlap,
        extractImages: kbSettings.extractImages,
        preserveMetadata: kbSettings.preserveMetadata
      };

      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { ...prev[uploadId], progress: 25, status: 'uploading' }
      }));

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

      const result = await documentService.uploadToKnowledgeBase(
        file, 
        selectedIndexId, 
        processingOptions
      );

      clearInterval(progressInterval);

      setUploadProgress(prev => ({
        ...prev,
        [uploadId]: { 
          ...prev[uploadId], 
          progress: 100, 
          status: 'success',
          docId: result.document_id
        }
      }));

      await loadDocumentsByIndex(selectedIndexId);
      
      setNotification({ 
        message: `File "${file.name}" uploaded and processed successfully`, 
        type: 'success' 
      });
      
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

  return {
    // State
    documents,
    knowledgeBases,
    activeTab,
    setActiveTab,
    activeDocTab,
    setActiveDocTab,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    currentKnowledgePage,
    setCurrentKnowledgePage,
    expandedMenu,
    setExpandedMenu,
    selectedIndex,
    setSelectedIndex,
    selectedIndexId,
    setSelectedIndexId,
    loading,
    setLoading,
    uploadProgress,
    setUploadProgress,
    selectedDocuments,
    setSelectedDocuments,
    dragOver,
    setDragOver,
    notification,
    setNotification,
    showUploadModal,
    setShowUploadModal,
    showNewKBModal,
    setShowNewKBModal,
    showEditKBModal,
    setShowEditKBModal,
    newKBData,
    setNewKBData,
    editKBData,
    setEditKBData,
    fileInputRef,
    documentStats,
    setDocumentStats,
    kbSettings,
    setKbSettings,
    kfSettings,
    setKfSettings,
    aiSettings,
    setAiSettings,
    indexList,
    setIndexList,
    
    // Computed values
    processedDocuments,
    filteredKnowledgeList,
    totalKnowledgePages,
    paginatedKnowledgeList,
    filteredData,
    
    // Functions
    getDocumentCount,
    handleKnowledgePageChange,
    loadInitialData,
    loadAllDocuments,
    loadDocumentsByIndex,
    updateDocumentStats,
    validateFile,
    handleFileUpload
  };
};