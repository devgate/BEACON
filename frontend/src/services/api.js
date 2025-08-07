import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || (
  process.env.NODE_ENV === 'development' 
    ? 'http://localhost:5001/api' 
    : '/api'
);

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const chatService = {
  async sendMessage(message, categoryId = null, modelId = null, settings = {}) {
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
    if (categoryId) {
      data.category_id = categoryId;
    }
    if (modelId) {
      data.model_id = modelId;
    }
    const response = await api.post('/chat', data);
    return response.data;
  },

  async getCategories() {
    const response = await api.get('/categories');
    return response.data;
  }
};

export const bedrockService = {
  async getModels() {
    const response = await api.get('/bedrock/models');
    return response.data;
  },

  async getHealth() {
    const response = await api.get('/bedrock/health');
    return response.data;
  }
};

export const documentService = {
  async getDocuments() {
    const response = await api.get('/documents');
    return response.data;
  },

  async getDocumentsByCategory(categoryId) {
    const response = await api.get(`/categories/${categoryId}/documents`);
    return response.data;
  },

  async uploadDocument(file, categoryId) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category_id', categoryId);

    const response = await api.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  async deleteDocument(docId) {
    const response = await api.delete(`/documents/${docId}`);
    return response.data;
  },

  async getCategories() {
    const response = await api.get('/categories');
    return response.data;
  },

  async updateCategorySettings(categoryId, settings) {
    const response = await api.put(`/categories/${categoryId}/settings`, settings);
    return response.data;
  },

  async getEmbeddingModels() {
    const response = await api.get('/embedding-models');
    return response.data;
  }
};

export const weatherService = {
  async getWeather() {
    const response = await api.get('/weather');
    return response.data;
  }
};