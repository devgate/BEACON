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
  },

  async clearAllCollections() {
    const response = await api.post('/chroma/clear');
    return response.data;
  },

  async resetAllCollections() {
    const response = await api.post('/chroma/reset');
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
  },

  async downloadDocument(doc) {
    // Validate input
    if (!doc || (!doc.id && doc.id !== 0)) {
      throw new Error('유효하지 않은 문서 정보입니다.');
    }

    const docId = doc.id;
    const filename = doc.original_filename || 
                    doc.file_name || 
                    doc.title || 
                    doc.name || 
                    `document_${docId}`;

    try {
      console.log(`Downloading document ID: ${docId}, filename: ${filename}`);
      
      const response = await api.get(`/download/${docId}`, {
        responseType: 'blob', // Essential for file downloads
        timeout: 30000, // 30 second timeout for downloads
      });

      // Validate response
      if (!response.data || response.data.size === 0) {
        throw new Error('다운로드된 파일이 비어있습니다.');
      }

      // Create blob link for download
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      
      // Create temporary download link
      const link = document.createElement('a');
      link.href = url;
      link.style.display = 'none';
      
      // Set download filename with proper extension
      let downloadFilename = filename;
      if (!downloadFilename.includes('.')) {
        // Add default extension if none exists
        const contentType = response.headers['content-type'] || '';
        if (contentType.includes('pdf')) {
          downloadFilename += '.pdf';
        } else if (contentType.includes('text')) {
          downloadFilename += '.txt';
        } else {
          downloadFilename += '.pdf'; // Default fallback
        }
      }
      
      link.setAttribute('download', downloadFilename);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }, 100);
      
      console.log(`Successfully downloaded: ${downloadFilename}`);
      return { 
        success: true, 
        filename: downloadFilename,
        size: blob.size 
      };
      
    } catch (error) {
      console.error('Download failed:', error);
      
      // Enhanced error handling with detailed messages
      let errorMessage = '파일 다운로드에 실패했습니다.';
      let errorDetails = '';
      
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        errorMessage = '다운로드 시간이 초과되었습니다.';
        errorDetails = '파일이 너무 크거나 네트워크 연결이 느립니다. 잠시 후 다시 시도해주세요.';
      } else if (error.response) {
        const status = error.response.status;
        let serverError = '';
        
        // Try to extract server error message
        try {
          if (error.response.data instanceof Blob) {
            const text = await error.response.data.text();
            const errorData = JSON.parse(text);
            serverError = errorData.error || errorData.details || '';
          } else if (typeof error.response.data === 'object') {
            serverError = error.response.data.error || error.response.data.details || '';
          }
        } catch (parseError) {
          console.warn('Could not parse server error response:', parseError);
        }
        
        if (status === 404) {
          errorMessage = '파일을 찾을 수 없습니다.';
          errorDetails = '파일이 삭제되었거나 이동되었을 수 있습니다. 관리자에게 문의하세요.';
        } else if (status === 403) {
          errorMessage = '파일에 접근할 권한이 없습니다.';
          errorDetails = '관리자에게 권한을 요청하세요.';
        } else if (status >= 500) {
          errorMessage = '서버 오류로 다운로드에 실패했습니다.';
          errorDetails = '잠시 후 다시 시도하거나 관리자에게 문의하세요.';
        } else if (serverError) {
          errorMessage = serverError;
        }
      } else if (error.request) {
        errorMessage = '서버에 연결할 수 없습니다.';
        errorDetails = '네트워크 연결을 확인하고 다시 시도해주세요.';
      } else if (error.message.includes('비어있습니다')) {
        errorMessage = '다운로드할 파일 데이터를 받을 수 없습니다.';
        errorDetails = '서버에서 올바른 파일을 전송하지 못했습니다.';
      }
      
      const fullErrorMsg = errorDetails ? `${errorMessage} ${errorDetails}` : errorMessage;
      console.error('Final download error:', fullErrorMsg);
      throw new Error(fullErrorMsg);
    }
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

// Arena Service for Model Comparison
export const arenaService = {
  async sendMessage(arenaRequest) {
    const { message, leftModel, rightModel, settings = {} } = arenaRequest;
    
    console.log('Sending arena request:', {
      message: message.substring(0, 50) + '...',
      model_a: leftModel,
      model_b: rightModel,
      settings: settings
    });

    try {
      // Update data to match backend API format
      const apiData = {
        message,
        model_a: leftModel,
        model_b: rightModel,
        settings
      };

      const response = await api.post('/arena/chat', apiData);
      
      // Transform response to match expected frontend format
      return {
        arena_id: response.data.arena_id,
        leftResponse: {
          content: response.data.responses.model_a.text,
          model_used: response.data.responses.model_a.model_id,
          processing_time: response.data.responses.model_a.response_time,
          tokens_used: response.data.responses.model_a.tokens_used.input_tokens + response.data.responses.model_a.tokens_used.output_tokens,
          cost_estimate: response.data.responses.model_a.cost_estimate.total,
          error: !!response.data.responses.model_a.error
        },
        rightResponse: {
          content: response.data.responses.model_b.text,
          model_used: response.data.responses.model_b.model_id,
          processing_time: response.data.responses.model_b.response_time,
          tokens_used: response.data.responses.model_b.tokens_used.input_tokens + response.data.responses.model_b.tokens_used.output_tokens,
          cost_estimate: response.data.responses.model_b.cost_estimate.total,
          error: !!response.data.responses.model_b.error
        }
      };
    } catch (error) {
      console.error('Arena request failed:', error);
      throw error;
    }
  },

  // TODO: 투표 기능 추후 구현
  // async vote(voteData) {
  //   const { comparisonId, winner, message, leftModel, rightModel } = voteData;
    
  //   const data = {
  //     arena_id: comparisonId,
  //     winner: winner === 'left' ? 'model_a' : winner === 'right' ? 'model_b' : 'tie',
  //     reason: message || '',
  //     user_id: 'anonymous'  // Could be replaced with actual user ID when auth is implemented
  //   };

  //   console.log('Recording vote:', {
  //     arena_id: comparisonId,
  //     winner: data.winner,
  //     left_model: leftModel,
  //     right_model: rightModel
  //   });

  //   try {
  //     const response = await api.post('/arena/vote', data);
  //     return response.data;
  //   } catch (error) {
  //     console.error('Vote recording failed:', error);
  //     throw error;
  //   }
  // },

  async getHistory(limit = 10) {
    try {
      const response = await api.get(`/arena/history?limit=${limit}`);
      return response.data;
    } catch (error) {
      console.error('Failed to get arena history:', error);
      return {
        comparisons: []
        // votes: [] // TODO: 투표 기능 추후 구현
      };
    }
  },

  async getStats() {
    try {
      const response = await api.get('/arena/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to get arena stats:', error);
      return {
        // total_votes: 0, // TODO: 투표 기능 추후 구현
        model_wins: {},
        // tie_rate: 0.0, // TODO: 투표 기능 추후 구현
        total_comparisons: 0
      };
    }
  }
};

export const awsAgentService = {
  async sendAgentMessage(message, config = {}) {
    const data = {
      message,
      agent_id: config.agent_id,
      agent_alias_id: config.agent_alias_id,
      session_id: config.session_id
    };
    
    console.log('Sending AWS Agent request:', {
      message: message.substring(0, 50) + '...',
      agent_id: data.agent_id,
      session_id: data.session_id
    });
    
    const response = await api.post('/aws-agent/chat', data);
    return response.data;
  },
  
  async getAvailableAgents() {
    const response = await api.get('/aws-agent/agents');
    return response.data;
  }
};