# BEACON Backend - Flask API Documentation

## 🏗️ Architecture Overview

**BEACON Backend**: Python Flask API with modular architecture supporting RAG functionality through AWS Bedrock and ChromaDB integration.

### Core Components
- **Flask Application Factory** (`app.py`)
- **API Layer** (`/api`) - RESTful endpoints with Blueprint pattern
- **Service Layer** (`/services`) - Business logic and external integrations
- **Storage Layer** (`/storage`) - Vector databases and persistence
- **Core Utilities** (`/core`) - Document processing and utilities

---

## 📁 Backend Structure

```
backend/
├── app.py                      # Flask application factory
├── requirements.txt            # Python dependencies
├── Dockerfile / Dockerfile.dev # Container configurations
│
├── api/                        # RESTful API endpoints
│   ├── __init__.py
│   ├── misc.py                # System endpoints (/health, /info)
│   ├── chat.py                # Chat & RAG endpoints
│   ├── documents.py           # Document CRUD operations
│   ├── categories.py          # Category management
│   ├── knowledge.py           # Knowledge base operations
│   ├── bedrock.py             # Bedrock model endpoints
│   └── chroma.py              # ChromaDB vector operations
│
├── services/                   # Business logic layer
│   ├── __init__.py
│   ├── bedrock_service.py     # AWS Bedrock integration
│   └── rag_engine.py          # RAG orchestration
│
├── storage/                    # Data persistence layer
│   ├── __init__.py
│   ├── chroma_service.py      # ChromaDB vector store
│   └── vector_store.py        # DynamoDB vector storage (legacy)
│
├── core/                       # Core utilities
│   ├── __init__.py
│   └── document_processor.py  # PDF processing & chunking
│
├── static/                     # Static assets
│   └── images/                # Extracted document images
│
├── templates/                  # Jinja2 templates (if needed)
├── uploads/                    # Uploaded PDF files
├── chroma_data/               # ChromaDB persistence
└── venv/                      # Virtual environment
```

---

## 🔧 Key Services

### 1. Flask Application Factory (`app.py`)
```python
def create_app():
    """Create and configure Flask application with modular services."""
    app = Flask(__name__)
    
    # Configuration
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB
    app.config['UPLOAD_FOLDER'] = 'uploads'
    
    # CORS configuration
    CORS(app, origins=['http://localhost:3000', 'http://localhost:8080'])
    
    # Initialize services
    app_context = initialize_services()
    
    # Register blueprints
    register_blueprints(app, app_context)
    
    return app

def initialize_services():
    """Initialize all backend services with dependency injection."""
    context = {}
    
    # AWS Bedrock Service
    bedrock_service = create_bedrock_service({
        'BEDROCK_REGION': os.getenv('BEDROCK_REGION', 'ap-northeast-2'),
        'AWS_PROFILE': os.getenv('AWS_PROFILE')  # Optional
    })
    context['bedrock_service'] = bedrock_service
    
    # Vector Storage (ChromaDB + DynamoDB fallback)
    if ENHANCED_PROCESSING_AVAILABLE:
        chroma_service = ChromaService(
            persist_directory=os.getenv('CHROMA_DATA_DIR', 'chroma_data')
        )
        context['chroma_service'] = chroma_service
        context['CHROMA_ENABLED'] = True
    
    # Legacy DynamoDB vector store
    vector_store = create_vector_store(
        table_name=os.getenv('DYNAMODB_VECTORS_TABLE', 'prod-beacon-vectors')
    )
    context['vector_store'] = vector_store
    
    # RAG Engine
    rag_engine = create_rag_engine(bedrock_service, vector_store)
    context['rag_engine'] = rag_engine
    
    return context
```

### 2. Bedrock Service (`services/bedrock_service.py`)
```python
class BedrockService:
    """AWS Bedrock integration for LLM and embedding operations."""
    
    def __init__(self, region_name: str, aws_profile: Optional[str] = None):
        self.region_name = region_name
        session = boto3.Session(profile_name=aws_profile) if aws_profile else boto3.Session()
        self.bedrock_runtime = session.client('bedrock-runtime', region_name=region_name)
        self.bedrock = session.client('bedrock', region_name=region_name)
        
    def generate_embedding(self, text: str) -> List[float]:
        """Generate embedding using Amazon Titan Text Embeddings."""
        try:
            body = json.dumps({"inputText": text[:8000]})  # Truncate if needed
            response = self.bedrock_runtime.invoke_model(
                modelId='amazon.titan-embed-text-v1',
                body=body,
                contentType='application/json'
            )
            
            result = json.loads(response['body'].read())
            return result['embedding']  # 1536 dimensions
            
        except Exception as e:
            logger.error(f"Embedding generation failed: {e}")
            return [0.0] * 1536  # Return zero vector as fallback
    
    def generate_response(self, prompt: str, model_id: str, **kwargs) -> Dict:
        """Generate text response using Claude models."""
        try:
            # Model-specific body formatting
            if 'claude' in model_id:
                body = json.dumps({
                    "anthropic_version": "bedrock-2023-05-31",
                    "max_tokens": kwargs.get('max_tokens', 2048),
                    "temperature": kwargs.get('temperature', 0.7),
                    "messages": [{"role": "user", "content": prompt}]
                })
            
            response = self.bedrock_runtime.invoke_model(
                modelId=model_id,
                body=body,
                contentType='application/json'
            )
            
            result = json.loads(response['body'].read())
            
            # Extract response based on model
            if 'claude' in model_id:
                content = result['content'][0]['text']
                tokens_used = {
                    'input_tokens': result.get('usage', {}).get('input_tokens', 0),
                    'output_tokens': result.get('usage', {}).get('output_tokens', 0)
                }
            
            return {
                'response': content,
                'model_used': model_id,
                'tokens_used': tokens_used
            }
            
        except Exception as e:
            logger.error(f"Response generation failed: {e}")
            raise BedrockError(f"Failed to generate response: {e}")
```

### 3. ChromaDB Service (`storage/chroma_service.py`)
```python
class ChromaService:
    """ChromaDB vector database service for document embeddings."""
    
    def __init__(self, persist_directory: str = "chroma_data"):
        self.client = chromadb.PersistentClient(path=persist_directory)
        self.collection_name = "beacon_documents"
        self.collection = self._get_or_create_collection()
        
    def _get_or_create_collection(self):
        """Get existing collection or create new one."""
        try:
            return self.client.get_collection(self.collection_name)
        except Exception:
            return self.client.create_collection(
                name=self.collection_name,
                metadata={"description": "BEACON document embeddings"}
            )
    
    def add_documents(self, 
                     texts: List[str], 
                     embeddings: List[List[float]], 
                     metadatas: List[Dict],
                     ids: List[str]):
        """Add documents with embeddings to ChromaDB."""
        try:
            self.collection.add(
                documents=texts,
                embeddings=embeddings,
                metadatas=metadatas,
                ids=ids
            )
            logger.info(f"Added {len(texts)} documents to ChromaDB")
            
        except Exception as e:
            logger.error(f"Failed to add documents to ChromaDB: {e}")
            raise ChromaError(f"Document addition failed: {e}")
    
    def similarity_search(self, 
                         query_embedding: List[float], 
                         k: int = 5,
                         where: Optional[Dict] = None) -> List[Dict]:
        """Perform similarity search in ChromaDB."""
        try:
            results = self.collection.query(
                query_embeddings=[query_embedding],
                n_results=k,
                where=where,
                include=['documents', 'metadatas', 'distances']
            )
            
            # Format results for consistency with other storage systems
            formatted_results = []
            for i in range(len(results['documents'][0])):
                formatted_results.append({
                    'text': results['documents'][0][i],
                    'metadata': results['metadatas'][0][i],
                    'distance': results['distances'][0][i],
                    'similarity_score': 1 - results['distances'][0][i]  # Convert distance to similarity
                })
            
            return formatted_results
            
        except Exception as e:
            logger.error(f"ChromaDB similarity search failed: {e}")
            return []
```

### 4. RAG Engine (`services/rag_engine.py`)
```python
class RAGEngine:
    """RAG (Retrieval-Augmented Generation) orchestration engine."""
    
    def __init__(self, bedrock_service: BedrockService, vector_store):
        self.bedrock_service = bedrock_service
        self.vector_store = vector_store
        
    def process_query(self, 
                     query: str, 
                     category_id: Optional[int] = None,
                     top_k: int = 5,
                     model_id: str = "anthropic.claude-3-haiku-20240307-v1:0") -> Dict:
        """Process RAG query with context retrieval and response generation."""
        
        try:
            # 1. Generate query embedding
            query_embedding = self.bedrock_service.generate_embedding(query)
            
            # 2. Retrieve relevant context
            context_filter = {'category_id': category_id} if category_id else None
            
            if hasattr(self.vector_store, 'similarity_search'):
                # Use ChromaDB
                similar_docs = self.vector_store.similarity_search(
                    query_embedding, k=top_k, where=context_filter
                )
            else:
                # Use DynamoDB fallback
                similar_docs = self.vector_store.search(
                    query_embedding, limit=top_k, category_id=category_id
                )
            
            # 3. Build context from retrieved documents
            context_texts = []
            referenced_docs = []
            
            for doc in similar_docs[:top_k]:
                context_texts.append(doc['text'])
                referenced_docs.append({
                    'id': doc['metadata'].get('document_id'),
                    'title': doc['metadata'].get('title', 'Unknown'),
                    'relevance_score': doc.get('similarity_score', 0.0)
                })
            
            # 4. Construct RAG prompt
            context = "\n\n".join(context_texts)
            rag_prompt = f"""
다음 문서들을 참고하여 질문에 답해주세요:

[참고 문서]
{context}

[질문]
{query}

[답변 지침]
- 제공된 문서 내용을 기반으로 정확하게 답변해주세요
- 문서에서 찾을 수 없는 내용은 "제공된 문서에 해당 정보가 없습니다"라고 말해주세요
- 답변의 근거가 되는 부분을 명시해주세요
"""
            
            # 5. Generate response
            response_data = self.bedrock_service.generate_response(
                prompt=rag_prompt,
                model_id=model_id,
                max_tokens=2048,
                temperature=0.7
            )
            
            # 6. Calculate confidence score based on relevance
            avg_relevance = sum(doc.get('similarity_score', 0) for doc in similar_docs[:3]) / min(3, len(similar_docs))
            confidence_score = min(avg_relevance * 1.2, 1.0)  # Boost confidence slightly
            
            # 7. Return comprehensive result
            return {
                **response_data,
                'referenced_docs': referenced_docs,
                'confidence_score': confidence_score,
                'rag_enabled': True,
                'context_docs_count': len(similar_docs)
            }
            
        except Exception as e:
            logger.error(f"RAG processing failed: {e}")
            raise RAGError(f"RAG query processing failed: {e}")
```

### 5. Document Processor (`core/document_processor.py`)
```python
class DocumentProcessor:
    """Process PDF documents for RAG integration."""
    
    def __init__(self):
        self.supported_formats = ['.pdf']
        
    def process_document(self, 
                        file_path: str, 
                        category_id: int,
                        chunk_size: int = 512,
                        chunk_overlap: int = 50) -> Dict:
        """Process PDF document into chunks with embeddings."""
        
        try:
            # 1. Extract text from PDF
            text_content = self._extract_text_from_pdf(file_path)
            
            # 2. Extract images from PDF pages
            image_paths = self._extract_images_from_pdf(file_path)
            
            # 3. Chunk text based on category strategy
            chunks = self._chunk_text(
                text_content, 
                chunk_size=chunk_size, 
                overlap=chunk_overlap
            )
            
            # 4. Generate document metadata
            doc_metadata = {
                'file_path': file_path,
                'category_id': category_id,
                'total_chunks': len(chunks),
                'total_tokens': sum(len(chunk.split()) for chunk in chunks),
                'image_count': len(image_paths),
                'processed_at': datetime.utcnow().isoformat()
            }
            
            return {
                'text_content': text_content,
                'chunks': chunks,
                'images': image_paths,
                'metadata': doc_metadata
            }
            
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            raise ProcessingError(f"Failed to process document {file_path}: {e}")
    
    def _extract_text_from_pdf(self, file_path: str) -> str:
        """Extract text content from PDF using PyPDF2."""
        try:
            text_content = ""
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    if page_text.strip():
                        text_content += f"\n[Page {page_num + 1}]\n{page_text}\n"
            
            return text_content.strip()
            
        except Exception as e:
            raise ProcessingError(f"Text extraction failed: {e}")
    
    def _extract_images_from_pdf(self, file_path: str) -> List[str]:
        """Extract images from PDF pages using pdf2image."""
        try:
            # Create images directory for this document
            doc_name = os.path.splitext(os.path.basename(file_path))[0]
            image_dir = f"static/images/{doc_name}"
            os.makedirs(image_dir, exist_ok=True)
            
            # Convert PDF pages to images
            pages = convert_from_path(file_path, dpi=150, fmt='PNG')
            image_paths = []
            
            for i, page in enumerate(pages):
                image_path = f"{image_dir}/page_{i + 1}.png"
                page.save(image_path, 'PNG')
                image_paths.append({
                    'page': i + 1,
                    'url': f"/{image_path}",
                    'filename': f"page_{i + 1}.png"
                })
            
            return image_paths
            
        except Exception as e:
            logger.warning(f"Image extraction failed: {e}")
            return []  # Continue without images if extraction fails
    
    def _chunk_text(self, text: str, chunk_size: int, overlap: int) -> List[str]:
        """Split text into chunks with specified size and overlap."""
        sentences = text.split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            # Check if adding this sentence would exceed chunk size
            test_chunk = current_chunk + sentence + ". "
            
            if len(test_chunk.split()) > chunk_size and current_chunk:
                # Save current chunk and start new one with overlap
                chunks.append(current_chunk.strip())
                
                # Create overlap by keeping last few sentences
                overlap_sentences = current_chunk.split('. ')[-overlap//10:]  # Rough approximation
                current_chunk = '. '.join(overlap_sentences) + ". " + sentence + ". "
            else:
                current_chunk += sentence + ". "
        
        # Add final chunk
        if current_chunk.strip():
            chunks.append(current_chunk.strip())
        
        return chunks
```

---

## 🔌 API Endpoints

### Chat & RAG
```python
# /api/chat - POST
@chat_bp.route('/chat', methods=['POST'])
def chat():
    """Process chat message with RAG support."""
    data = request.get_json()
    
    message = data.get('message')
    category_id = data.get('category_id')
    model_id = data.get('model_id', 'anthropic.claude-3-haiku-20240307-v1:0')
    settings = data.get('settings', {})
    
    use_rag = settings.get('use_rag', True)
    top_k = settings.get('top_k_documents', 5)
    
    if use_rag and RAG_ENABLED:
        result = rag_engine.process_query(
            query=message,
            category_id=category_id,
            top_k=top_k,
            model_id=model_id
        )
    else:
        # Direct Bedrock call without RAG
        result = bedrock_service.generate_response(
            prompt=message,
            model_id=model_id,
            **settings
        )
        result['rag_enabled'] = False
    
    return jsonify(result)
```

### Document Management
```python
# /api/upload - POST  
@documents_bp.route('/upload', methods=['POST'])
def upload_document():
    """Upload and process PDF document."""
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    category_id = request.form.get('category_id', 4, type=int)
    
    if file and file.filename.lower().endswith('.pdf'):
        # Save file
        filename = secure_filename(file.filename)
        timestamp = int(time.time())
        unique_filename = f"{timestamp}_{filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        try:
            # Process document
            if ENHANCED_PROCESSING_AVAILABLE:
                result = document_processor.process_document(file_path, category_id)
                
                # Generate embeddings for chunks
                embeddings = generate_embeddings(result['chunks'])
                
                # Store in ChromaDB
                chunk_ids = [f"{timestamp}_{i}" for i in range(len(result['chunks']))]
                metadatas = [{
                    'document_id': timestamp,
                    'chunk_index': i,
                    'category_id': category_id,
                    'title': filename
                } for i in range(len(result['chunks']))]
                
                chroma_service.add_documents(
                    texts=result['chunks'],
                    embeddings=embeddings,
                    metadatas=metadatas,
                    ids=chunk_ids
                )
                
                return jsonify({
                    'success': True,
                    'message': f'{filename} 파일이 성공적으로 업로드되었습니다.',
                    'document': {
                        'id': timestamp,
                        'title': filename,
                        'preview': result['text_content'][:500] + '...'
                    },
                    'processing': {
                        'chunks_created': len(result['chunks']),
                        'embeddings_generated': len(embeddings),
                        'total_tokens': result['metadata']['total_tokens']
                    },
                    'rag_enabled': True
                })
                
        except Exception as e:
            logger.error(f"Document processing failed: {e}")
            return jsonify({'error': 'Document processing failed'}), 500
    
    return jsonify({'error': 'Invalid file format'}), 400
```

---

## 🚀 Environment Configuration

### Development Environment
```bash
# .env file
FLASK_ENV=development
FLASK_DEBUG=1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
BEDROCK_REGION=ap-northeast-2
DYNAMODB_VECTORS_TABLE=dev-beacon-vectors
CHROMA_DATA_DIR=./chroma_data
```

### Production Environment
```python
# Production configuration
class ProductionConfig:
    FLASK_ENV = 'production'
    DEBUG = False
    TESTING = False
    
    # AWS Configuration
    AWS_REGION = os.getenv('AWS_REGION', 'ap-northeast-2')
    DYNAMODB_VECTORS_TABLE = os.getenv('DYNAMODB_VECTORS_TABLE')
    
    # Application Settings
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
    UPLOAD_FOLDER = '/app/uploads'
    CHROMA_DATA_DIR = '/app/chroma_data'
    
    # Security
    SECRET_KEY = os.getenv('SECRET_KEY')
    CORS_ORIGINS = [
        'https://beacon.example.com',
        'https://api.beacon.example.com'
    ]
```

---

## 🔍 Testing

### Unit Tests
```python
# test_bedrock_service.py
import pytest
from services.bedrock_service import BedrockService

def test_embedding_generation():
    """Test embedding generation functionality."""
    service = BedrockService('ap-northeast-2')
    
    text = "This is a test document."
    embedding = service.generate_embedding(text)
    
    assert len(embedding) == 1536  # Titan embedding dimensions
    assert all(isinstance(x, (int, float)) for x in embedding)

def test_response_generation():
    """Test Claude response generation."""
    service = BedrockService('ap-northeast-2')
    
    result = service.generate_response(
        prompt="What is the capital of France?",
        model_id="anthropic.claude-3-haiku-20240307-v1:0"
    )
    
    assert 'response' in result
    assert 'tokens_used' in result
    assert result['model_used'] == "anthropic.claude-3-haiku-20240307-v1:0"
```

### Integration Tests
```python
# test_rag_integration.py
import pytest
from services.rag_engine import RAGEngine

def test_rag_query_processing():
    """Test full RAG pipeline."""
    # Setup test document
    test_doc = "Paris is the capital and largest city of France."
    
    # Add to vector store
    embedding = bedrock_service.generate_embedding(test_doc)
    vector_store.add_document(test_doc, embedding, {'title': 'France Info'})
    
    # Test RAG query
    result = rag_engine.process_query(
        query="What is the capital of France?",
        top_k=1
    )
    
    assert result['rag_enabled'] is True
    assert len(result['referenced_docs']) > 0
    assert result['confidence_score'] > 0.5
```

---

## 📊 Monitoring & Logging

### Application Logging
```python
# logging_config.py
import logging
from logging.handlers import RotatingFileHandler

def setup_logging(app):
    """Configure application logging."""
    if not app.debug and not app.testing:
        # File handler
        file_handler = RotatingFileHandler(
            'logs/beacon-backend.log',
            maxBytes=10240000,  # 10MB
            backupCount=10
        )
        file_handler.setFormatter(logging.Formatter(
            '%(asctime)s %(levelname)s: %(message)s [in %(pathname)s:%(lineno)d]'
        ))
        file_handler.setLevel(logging.INFO)
        app.logger.addHandler(file_handler)
        
        app.logger.setLevel(logging.INFO)
        app.logger.info('BEACON Backend startup')
```

### Performance Monitoring
```python
# monitoring.py
from functools import wraps
import time

def monitor_performance(func):
    """Decorator to monitor function performance."""
    @wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        try:
            result = func(*args, **kwargs)
            success = True
        except Exception as e:
            result = None
            success = False
            raise
        finally:
            duration = time.time() - start_time
            logger.info(f"{func.__name__} - Duration: {duration:.2f}s, Success: {success}")
        return result
    return wrapper

# Usage
@monitor_performance
def process_rag_query(query: str) -> Dict:
    return rag_engine.process_query(query)
```

---

## 🚨 Error Handling

### Custom Exceptions
```python
# exceptions.py
class BeaconError(Exception):
    """Base exception for BEACON backend."""
    pass

class BedrockError(BeaconError):
    """AWS Bedrock related errors."""
    pass

class ChromaError(BeaconError):
    """ChromaDB related errors."""
    pass

class ProcessingError(BeaconError):
    """Document processing errors."""
    pass

class RAGError(BeaconError):
    """RAG pipeline errors."""
    pass
```

### Global Error Handler
```python
# app.py
@app.errorhandler(BedrockError)
def handle_bedrock_error(error):
    """Handle Bedrock service errors."""
    logger.error(f"Bedrock error: {error}")
    return jsonify({
        'error': 'AI service temporarily unavailable',
        'message': 'Please try again later',
        'timestamp': datetime.utcnow().isoformat()
    }), 503

@app.errorhandler(500)
def handle_internal_error(error):
    """Handle internal server errors."""
    logger.error(f"Internal error: {error}")
    return jsonify({
        'error': 'Internal server error',
        'message': 'An unexpected error occurred',
        'timestamp': datetime.utcnow().isoformat()
    }), 500
```

---

## 📚 Dependencies

### Core Dependencies
```txt
# requirements.txt
Flask==2.3.3
flask-cors==4.0.0

# AWS Integration
boto3==1.28.57
botocore==1.31.57

# Vector Database
chromadb==0.4.18

# Document Processing  
PyPDF2==3.0.1
pdf2image==1.16.3
Pillow==10.0.0

# Utilities
python-dotenv==1.0.0
gunicorn==21.2.0  # Production WSGI server

# Development
pytest==7.4.0
pytest-flask==1.2.0
black==23.7.0     # Code formatting
flake8==6.0.0     # Linting
```

### Optional Dependencies
```txt
# Enhanced features
sentence-transformers==2.2.2  # Alternative embeddings
redis==4.6.0                  # Caching layer
celery==5.3.1                 # Background tasks
```