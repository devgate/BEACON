# BEACON Project - Coding Standards & Guidelines

## 🎯 Project Overview
**BEACON**: Enterprise RAG (Retrieval-Augmented Generation) Platform for intelligent document processing and knowledge management.

### Tech Stack
- **Backend**: Python Flask + AWS Bedrock + ChromaDB
- **Frontend**: React + Tailwind CSS  
- **Infrastructure**: Docker + AWS (EC2, ALB, DynamoDB, S3) + Terraform
- **AI Models**: Claude 3 (Haiku, Sonnet, Opus), Titan Embeddings

### Directory-Specific Documentation
- **[Backend](./backend/claude.md)** - Flask API, services, storage layers
- **[Frontend](./frontend/claude.md)** - React components, state management, UI/UX
- **[Deploy](./deploy/claude.md)** - Deployment scripts, Docker configurations  
- **[Infrastructure](./infra/claude.md)** - Terraform modules, AWS resources

---

## 📋 Coding Standards

### Python Code Standards (Backend)
#### File Organization
```python
# app.py - Flask application factory pattern
def create_app():
    app = Flask(__name__)
    # Configuration
    # Service initialization  
    # Blueprint registration
    return app

# API modules (/api) - Blueprint pattern
from flask import Blueprint
api_bp = Blueprint('api_name', __name__, url_prefix='/api')

# Services (/services) - Service layer pattern
class ServiceName:
    def __init__(self, dependencies):
        self.dependency = dependencies
    
    def method(self, params):
        # Business logic implementation
        return result
```

#### Code Conventions
- **PEP 8 Compliance**: 4 spaces, line length 88 chars
- **Type Hints**: Use for all function parameters and returns
- **Docstrings**: Google style for all functions and classes
- **Error Handling**: Explicit try/except with logging
- **Import Organization**: stdlib → third-party → local

```python
from typing import Dict, List, Optional
import logging

def process_document(
    file_path: str, 
    category_id: int,
    options: Optional[Dict] = None
) -> Dict[str, Any]:
    """
    Process uploaded document for RAG integration.
    
    Args:
        file_path: Path to uploaded file
        category_id: Document category identifier
        options: Additional processing options
        
    Returns:
        Processing result with metadata
        
    Raises:
        ProcessingError: If document processing fails
    """
    logger = logging.getLogger(__name__)
    try:
        # Implementation
        return {"status": "success", "document_id": doc_id}
    except Exception as e:
        logger.error(f"Document processing failed: {e}")
        raise ProcessingError(f"Failed to process {file_path}")
```

### JavaScript/React Standards (Frontend)
#### Component Structure
```javascript
// Functional components with hooks
import React, { useState, useEffect } from 'react';

const ComponentName = ({ prop1, prop2 }) => {
  // State declarations
  const [state, setState] = useState(initialValue);
  
  // Effect hooks
  useEffect(() => {
    // Side effects
  }, [dependencies]);
  
  // Event handlers
  const handleEvent = (event) => {
    // Event logic
  };
  
  // Render
  return (
    <div className="component-container">
      {/* JSX */}
    </div>
  );
};

export default ComponentName;
```

#### Code Conventions
- **ES6+ Features**: Arrow functions, destructuring, template literals
- **Component Naming**: PascalCase for components, camelCase for functions
- **State Management**: React hooks for local state, Context for global state
- **API Calls**: Async/await pattern in service layer
- **Error Boundaries**: Wrap components with error handling

```javascript
// API service pattern
const apiService = {
  async fetchData(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`API call failed: ${endpoint}`, error);
      throw error;
    }
  }
};
```

### Infrastructure as Code (Terraform)
#### Module Structure
```hcl
# modules/service/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Variables
variable "environment" {
  description = "Environment name (dev/prod)"
  type        = string
  validation {
    condition     = contains(["dev", "prod"], var.environment)
    error_message = "Environment must be dev or prod."
  }
}

# Resources with consistent naming
resource "aws_instance" "app_server" {
  count                  = var.instance_count
  ami                    = var.ami_id
  instance_type         = var.instance_type
  subnet_id             = var.subnet_ids[count.index % length(var.subnet_ids)]
  vpc_security_group_ids = [aws_security_group.app_sg.id]
  
  tags = {
    Name        = "${var.project_name}-${var.environment}-app-${count.index + 1}"
    Environment = var.environment
    Project     = var.project_name
  }
}
```

#### Conventions
- **Naming**: `{project}-{environment}-{service}`
- **Tagging**: Consistent tags for all resources
- **Variables**: Type validation and descriptions
- **Outputs**: All important resource attributes
- **State Management**: Remote state with locking

---

## 🔧 Development Workflow

### Git Standards
```bash
# Branch naming
feature/add-knowledge-base-ui
fix/document-upload-validation
hotfix/security-patch-bedrock

# Commit messages (Conventional Commits)
feat: add knowledge base management UI
fix: resolve document upload timeout issue  
docs: update API documentation
refactor: extract document processor service
```

### Code Review Process
1. **Pre-commit hooks**: Linting, type checking, tests
2. **Branch protection**: Require PR review + tests pass
3. **Review checklist**:
   - [ ] Code follows established patterns
   - [ ] Tests included for new functionality
   - [ ] Documentation updated
   - [ ] Security considerations addressed
   - [ ] Performance implications considered

### Testing Strategy
```python
# Backend - pytest
def test_document_upload_success():
    """Test successful document upload and processing."""
    client = test_client()
    with open('test_document.pdf', 'rb') as f:
        response = client.post('/api/upload', data={'file': f})
    
    assert response.status_code == 200
    assert 'document_id' in response.json
    assert response.json['processing']['chunks_created'] > 0

# Frontend - Jest/React Testing Library
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ChatPage from './ChatPage';

test('should send message and display response', async () => {
  render(<ChatPage />);
  
  const input = screen.getByPlaceholderText('메시지를 입력하세요...');
  fireEvent.change(input, { target: { value: 'Test message' } });
  fireEvent.click(screen.getByText('전송'));
  
  await waitFor(() => {
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });
});
```

---

## 🔒 Security Guidelines

### Backend Security
```python
# Input validation
from werkzeug.utils import secure_filename
from flask import request
import re

def validate_file_upload(file):
    """Validate uploaded file for security."""
    if not file or file.filename == '':
        raise ValueError("No file selected")
    
    # Secure filename
    filename = secure_filename(file.filename)
    
    # File type validation
    if not filename.lower().endswith('.pdf'):
        raise ValueError("Only PDF files allowed")
    
    # File size check
    if len(file.read()) > 16 * 1024 * 1024:
        raise ValueError("File too large (max 16MB)")
    
    file.seek(0)  # Reset file pointer
    return filename
```

### AWS Security Best Practices
- **IAM Roles**: Use IAM roles instead of access keys
- **Least Privilege**: Minimal required permissions
- **Encryption**: Enable encryption at rest and in transit
- **VPC**: Private subnets for backend services
- **Security Groups**: Restrictive inbound rules

### Frontend Security
```javascript
// XSS Prevention
const sanitizeInput = (input) => {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// CSRF Protection
const apiCall = async (endpoint, data) => {
  const token = document.querySelector('meta[name="csrf-token"]').content;
  
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': token
    },
    body: JSON.stringify(data)
  });
};
```

---

## 📊 Performance Standards

### Backend Performance
- **API Response Time**: < 500ms for document queries
- **Upload Processing**: < 30s for 10MB PDF files
- **Embedding Generation**: < 5s per document chunk
- **Memory Usage**: < 512MB per worker process
- **Database Queries**: < 100ms for vector searches

### Frontend Performance
- **Initial Load**: < 3s on 3G network
- **Bundle Size**: < 500KB initial, < 2MB total
- **React Performance**: Avoid unnecessary re-renders
- **Image Optimization**: Lazy loading, WebP format
- **Caching Strategy**: Service worker for offline support

### Infrastructure Performance
```hcl
# Auto Scaling Configuration
resource "aws_autoscaling_group" "app_asg" {
  target_group_arns = [aws_lb_target_group.app_tg.arn]
  
  # Performance-based scaling
  min_size = var.min_instances
  max_size = var.max_instances
  
  tag {
    key                 = "Performance-Tier"
    value              = var.performance_tier
    propagate_at_launch = true
  }
}
```

---

## 🚀 Core Features

### 1. RAG Chat System
#### 1.1 Chat Interface (`/api/chat`)
```python
# Request
{
  "message": "사용자 질문",
  "category_id": 1,
  "model_id": "anthropic.claude-3-sonnet",
  "settings": {
    "temperature": 0.7,
    "max_tokens": 2048,
    "use_rag": true,
    "top_k_documents": 5
  }
}

# Key Features
- RAG-based contextual responses
- Multi-model support (Claude variants)
- Token usage & cost tracking
- Source document attribution
- Confidence scoring
```

#### 1.2 Model Management
- **Available Models**: Claude 3 Haiku, Sonnet, Opus
- **Embedding Model**: Amazon Titan Text Embeddings v1 (1536 dimensions)
- **Cross-Region Inference**: Automatic failover support

### 2. Document Processing Pipeline
#### 2.1 Upload & Processing (`/api/upload`)
```python
# Processing Steps
1. PDF Upload → PyPDF2 text extraction
2. Image Generation → pdf2image (150 DPI)
3. Text Chunking → Category-optimized strategy
4. Embedding Generation → Titan Embeddings
5. Vector Storage → ChromaDB + DynamoDB

# Chunking Strategies by Category
- Financial: 512 tokens, 50 overlap, sentence-based
- Legal: 1024 tokens, 100 overlap, section-based
- Technical: 768 tokens, 75 overlap, paragraph-based
```

#### 2.2 Document Management
- **CRUD Operations**: Upload, retrieve, delete
- **Batch Processing**: Multi-file upload support
- **Status Tracking**: Processing, ready, failed states
- **File Storage**: Local filesystem + S3 backup

### 3. Knowledge Base Management
#### 3.1 Knowledge Builder
```javascript
// Features
- Create knowledge bases from documents
- Configure chunking strategies
- Set embedding parameters
- Manage document collections
```

#### 3.2 Knowledge Finder
```javascript
// Capabilities
- Semantic search across documents
- Similarity threshold configuration
- Multi-index search
- Result ranking & filtering
```

#### 3.3 AI Master
```javascript
// Functions
- Model configuration per knowledge base
- Response generation settings
- Prompt template management
- Performance optimization
```

### 4. Vector Storage System
#### 4.1 ChromaDB Integration
```python
# Configuration
persist_directory: 'chroma_data'
collection_name: 'beacon_documents'
distance_metric: 'cosine'

# Operations
- add_documents(texts, metadatas, ids)
- similarity_search(query, k=5)
- delete_documents(ids)
```

#### 4.2 DynamoDB Fallback
```python
# Tables
- {env}-beacon-vectors: Document embeddings
- {env}-beacon-sessions: Chat history
- {env}-beacon-usage: Token usage tracking
```

---

## 🔧 Development Workflows

### Local Development Setup
```bash
# 1. Start development environment
./dev-start.sh

# 2. Access services
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api

# 3. Hot reload enabled for both frontend and backend
```

### Docker Development
```yaml
# docker-compose.dev.yml
services:
  backend:
    volumes:
      - ./backend:/app  # Hot reload
    environment:
      - FLASK_DEBUG=1
      - AWS_ACCESS_KEY_ID=${AWS_ACCESS_KEY_ID}
      - AWS_SECRET_ACCESS_KEY=${AWS_SECRET_ACCESS_KEY}
      
  frontend:
    volumes:
      - ./frontend:/app  # Hot reload
    environment:
      - REACT_APP_API_URL=http://localhost:5000/api
```

### Common Development Tasks
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python app.py

# Frontend
cd frontend
npm install
npm start

# Testing
cd deploy/dev/local
./test.sh
```

---

## 🌐 API Reference

### Core Endpoints
#### Chat & RAG
- `POST /api/chat` - RAG-based chat
- `GET /api/chat/history` - Chat history

#### Document Management  
- `POST /api/upload` - Upload PDF
- `GET /api/documents` - List documents
- `DELETE /api/documents/{id}` - Delete document
- `GET /api/download/{id}` - Download PDF

#### Category Management
- `GET /api/categories` - List categories
- `POST /api/categories` - Create category
- `PUT /api/categories/{id}/settings` - Update settings

#### Knowledge Base
- `GET /api/knowledge-bases` - List KBs
- `POST /api/knowledge-bases` - Create KB
- `DELETE /api/knowledge-bases/{id}` - Delete KB

#### Bedrock Services
- `GET /api/bedrock/models` - Available models
- `GET /api/bedrock/health` - Service health

---

## 🏗️ Infrastructure

### AWS Resources
#### Compute & Networking
```hcl
# EC2 Instances
- Frontend: t3.medium (Nginx + React)
- Backend: t3.medium (Flask + Gunicorn)

# Load Balancers
- ALB with HTTPS termination
- Target groups for blue-green deployment

# Networking
- VPC with public/private subnets
- NAT Gateway for private subnet access
- Security groups with IP whitelisting
```

#### Storage & Database
```hcl
# DynamoDB Tables
- beacon-vectors: Document embeddings
- beacon-sessions: User sessions
- beacon-usage: Usage metrics

# S3 Buckets
- beacon-documents: PDF storage
- beacon-state: Terraform state
```

### Deployment
#### Production Deployment
```bash
# 1. Build and push Docker images
cd backend && ./build.sh
cd frontend && ./build.sh

# 2. Deploy infrastructure
cd infra/terraform
terraform plan -var-file=environments/prod.tfvars
terraform apply -var-file=environments/prod.tfvars

# 3. Deploy application
cd deploy/prod
./deploy.sh
```

#### Environment Variables
```bash
# Backend
BEDROCK_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
DYNAMODB_VECTORS_TABLE=prod-beacon-vectors
CHROMA_DATA_DIR=/app/chroma_data

# Frontend
REACT_APP_API_URL=https://api.beacon.example.com
```

---

## 🔐 Security & Monitoring

### Security Features
- HTTPS/TLS encryption
- AWS IAM role-based access
- IP whitelisting via security groups
- Input validation & sanitization
- Rate limiting on API endpoints

### Monitoring & Logging
- CloudWatch logs for application logs
- ALB access logs to S3
- DynamoDB metrics & alarms
- Cost tracking via usage tables

---

## 📝 Configuration Files

### Backend Configuration
```python
# app.py key configurations
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
UPLOAD_FOLDER = 'uploads'
CORS_ORIGINS = ['http://localhost:3000']

# RAG Settings
DEFAULT_CHUNK_SIZE = 512
DEFAULT_CHUNK_OVERLAP = 50
DEFAULT_TOP_K = 5
```

### Frontend Configuration
```javascript
// API Service Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
const REQUEST_TIMEOUT = 30000;
const MAX_FILE_SIZE = 16 * 1024 * 1024;
```

---

## 🧪 Testing & Quality

### API Testing
```bash
# Health check
curl http://localhost:5000/api/health

# Upload document
curl -X POST http://localhost:5000/api/upload \
  -F "file=@document.pdf" \
  -F "category_id=1"

# Chat query
curl -X POST http://localhost:5000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "질문", "use_rag": true}'
```

### Frontend Testing
```javascript
// Component testing
npm test

// E2E testing  
npm run cypress:open
```

---

## 🚨 Common Issues & Solutions

### Issue: Bedrock Connection Failed
```python
# Solution: Check AWS credentials
export AWS_ACCESS_KEY_ID=xxx
export AWS_SECRET_ACCESS_KEY=xxx
export BEDROCK_REGION=ap-northeast-2
```

### Issue: ChromaDB Persistence
```python
# Solution: Ensure volume mount
volumes:
  - ./chroma_data:/app/chroma_data
```

### Issue: CORS Errors
```python
# Solution: Update CORS configuration
CORS(app, origins=['http://localhost:3000', 'https://frontend.domain'])
```

---

## 📚 Key Dependencies

### Backend
```txt
Flask==2.3.3
flask-cors==4.0.0
boto3==1.28.57 # AWS SDK
chromadb==0.4.18
PyPDF2==3.0.1
pdf2image==1.16.3
Pillow==10.0.0
```

### Frontend
```json
{
  "react": "^18.2.0",
  "axios": "^1.5.0",
  "@fortawesome/react-fontawesome": "^0.2.0",
  "tailwindcss": "^3.3.3"
}
```

---

## 🔄 Version History
- **v1.0.0** - Initial RAG implementation with DynamoDB
- **v1.1.0** - ChromaDB integration for enhanced vector search
- **v1.2.0** - Multi-model support (Claude 3 variants)
- **v1.3.0** - Knowledge Base management UI
- **v1.4.0** - Current - Enhanced document processing pipeline

---

## 📧 Contact & Support
- **Repository**: BEACON on GitHub
- **Documentation**: `/docs` directory
- **API Reference**: `/backend/API-REFERENCE.md`