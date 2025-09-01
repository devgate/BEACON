import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5000/api' 
    : '/api'
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const chatService = {
  async sendMessage(message, modelId = null, settings = {}) {
    const data = { 
      message,
      settings: {
        use_rag: settings.use_rag !== false, // Default to true
        temperature: settings.temperature || 0.7,
        max_tokens: settings.max_tokens || 2048,
        top_k_documents: settings.top_k_documents || 5,
        ...settings
      }
    };
    
    if (modelId) {
      data.model_id = modelId;
    }
    
    // ChromaDB collection selection for RAG
    if (settings.knowledge_base_id) {
      data.category_id = settings.knowledge_base_id;
      data.collection_name = settings.knowledge_base_id;
    }
    
    console.log('Sending chat request:', {
      message: message.substring(0, 50) + '...',
      model_id: data.model_id,
      use_rag: data.settings.use_rag,
      knowledge_base_id: settings.knowledge_base_id,
      category_id: data.category_id,
      collection_name: data.collection_name
    });
    
    const response = await api.post('/chat', data);
    return response.data;
  }
};

export const bedrockService = {
  async getModels() {
    const response = await api.get('/bedrock/models');
    return response.data;
  },

  async getEmbeddingModels() {
    const response = await api.get('/embedding-models');
    return response.data;
  },

  async getHealth() {
    const response = await api.get('/bedrock/health');
    return response.data;
  }
};

export const chromaService = {
  async getCollections() {
    const response = await api.get('/chroma/collections');
    return response.data;
  },

  async getCollectionStats(collectionId) {
    const response = await api.get(`/chroma/collections/${collectionId}/stats`);
    return response.data;
  }
};

export const documentService = {
  async getDocuments(indexId = null) {
    const params = indexId ? { index_id: indexId } : {};
    const response = await api.get('/documents', { params });
    return response.data;
  },


  async getDocumentsByIndex(indexId) {
    const response = await api.get(`/knowledge/${indexId}/documents`);
    return response.data;
  },

  async uploadDocument(file, indexId = null, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);
    
    if (indexId) formData.append('index_id', indexId);
    
    // Add metadata
    Object.keys(metadata).forEach(key => {
      formData.append(key, metadata[key]);
    });

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large files
    });
    return response.data;
  },

  async uploadToKnowledgeBase(file, indexId, processingOptions = {}) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('index_id', indexId);
    
    // Processing options
    if (processingOptions.embeddingModel) {
      formData.append('embedding_model', processingOptions.embeddingModel);
    }
    if (processingOptions.chunkingStrategy) {
      formData.append('chunking_strategy', processingOptions.chunkingStrategy);
    }
    if (processingOptions.chunkSize) {
      formData.append('chunk_size', processingOptions.chunkSize);
    }

    const response = await api.post('/knowledge/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000,
    });
    return response.data;
  },

  async getDocumentStatus(docId) {
    const response = await api.get(`/documents/${docId}/status`);
    return response.data;
  },

  async getDocumentChunks(docId) {
    const response = await api.get(`/documents/${docId}/chunks`);
    return response.data;
  },

  async deleteDocument(docId) {
    const response = await api.delete(`/documents/${docId}`);
    return response.data;
  },

  async deleteMultipleDocuments(docIds) {
    const response = await api.delete('/documents/bulk', {
      data: { document_ids: docIds }
    });
    return response.data;
  },

  async syncDocuments() {
    const response = await api.post('/documents/sync');
    return response.data;
  },

  async reprocessDocument(docId, options = {}) {
    const response = await api.post(`/documents/${docId}/reprocess`, options);
    return response.data;
  },

  async reprocessKnowledgeBaseChunks(indexId, chunkingSettings) {
    const response = await api.post(`/knowledge/${indexId}/reprocess-chunks`, {
      chunk_strategy: chunkingSettings.strategy,
      chunk_size: chunkingSettings.chunkSize,
      chunk_overlap: chunkingSettings.overlap
    });
    return response.data;
  },

  async getReprocessingStatus(indexId) {
    const response = await api.get(`/knowledge/${indexId}/reprocessing-status`);
    return response.data;
  },

  async getEmbeddingModels() {
    const response = await api.get('/embedding-models');
    return response.data;
  },

  // Knowledge Base Management
  async getKnowledgeBases() {
    const response = await api.get('/knowledge');
    return response.data;
  },

  async createKnowledgeBase(name, id, description = '', settings = {}) {
    const response = await api.post('/knowledge', {
      name,
      id,
      description,
      settings
    });
    return response.data;
  },

  async updateKnowledgeBase(indexId, updates) {
    const response = await api.put(`/knowledge/${indexId}`, updates);
    return response.data;
  },

  async deleteKnowledgeBase(indexId) {
    const response = await api.delete(`/knowledge/${indexId}`);
    return response.data;
  },

  async getKnowledgeBaseSettings(indexId) {
    const response = await api.get(`/knowledge/${indexId}/settings`);
    return response.data;
  },

  async updateKnowledgeBaseSettings(indexId, settings) {
    const response = await api.put(`/knowledge/${indexId}/settings`, settings);
    return response.data;
  }
};

// ChromaDB Collection Service
export const collectionService = {
  async getCollectionStats(collectionId) {
    const response = await api.get(`/chroma/collections/${collectionId}/stats`);
    return response.data;
  },

  async getCollectionList() {
    const response = await api.get('/chroma/collections');
    return response.data;
  }
};

export const weatherService = {
  async getWeather() {
    const response = await api.get('/weather');
    return response.data;
  }
};