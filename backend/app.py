"""
BEACON Backend Application - Refactored Version
Main application entry point with modular architecture
"""
from flask import Flask
from flask_cors import CORS
import os
import logging
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Import service components
from services.bedrock_service import BedrockService, create_bedrock_service
from storage.vector_store import VectorStore, create_vector_store
from services.rag_engine import RAGEngine, create_rag_engine

# Import enhanced processing components (with fallback)
try:
    from core.document_processor import DocumentProcessor
    from storage.chroma_service import ChromaService, DocumentChunker
    ENHANCED_PROCESSING_AVAILABLE = True
    logger.info("Enhanced document processing modules loaded successfully")
except ImportError as e:
    logger.warning(f"Enhanced document processing not available: {e}")
    DocumentProcessor = None
    ChromaService = None
    DocumentChunker = None
    ENHANCED_PROCESSING_AVAILABLE = False

# Import API modules
from api.misc import misc_bp
from api.chat import chat_bp, init_chat_module
from api.documents import documents_bp, init_documents_module, documents
from api.categories import categories_bp, init_categories_module, categories
from api.knowledge import knowledge_bp, init_knowledge_module
from api.bedrock import bedrock_bp, init_bedrock_module
from api.chroma import chroma_bp, init_chroma_module

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__)
    
    # Configure CORS
    CORS(app, origins=['http://localhost:3000', 'http://localhost:8080'])
    
    # Configure app settings
    app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
    app.config['UPLOAD_FOLDER'] = 'uploads'
    
    # Initialize services
    app_context = initialize_services()
    
    # Add generate_embeddings function to context
    app_context['generate_embeddings'] = generate_embeddings
    app_context['app_config'] = app.config
    
    # Register blueprints
    register_blueprints(app, app_context)
    
    return app

def initialize_services():
    """Initialize all backend services"""
    context = {}
    
    try:
        logger.info("Initializing enhanced document processing system...")
        
        # Initialize Bedrock service
        aws_profile = os.getenv('AWS_PROFILE')
        config = {
            'BEDROCK_REGION': os.getenv('BEDROCK_REGION', 'ap-northeast-2')
        }
        # Only add AWS_PROFILE if it's set and not empty
        if aws_profile and aws_profile.strip():
            config['AWS_PROFILE'] = aws_profile
        
        bedrock_service = create_bedrock_service(config)
        context['bedrock_service'] = bedrock_service
        
        # Initialize vector store (legacy)
        vector_store = create_vector_store(
            table_name=os.getenv('DYNAMODB_VECTORS_TABLE', 'prod-beacon-vectors')
        )
        context['vector_store'] = vector_store
        
        # Initialize RAG engine (legacy)
        rag_engine = create_rag_engine(bedrock_service, vector_store)
        context['rag_engine'] = rag_engine
        
        # Initialize new components (if available)
        if ENHANCED_PROCESSING_AVAILABLE:
            try:
                document_processor = DocumentProcessor()
                chroma_service = ChromaService(
                    persist_directory=os.getenv('CHROMA_DATA_DIR', 'chroma_data')
                )
                context['document_processor'] = document_processor
                context['chroma_service'] = chroma_service
                context['DocumentChunker'] = DocumentChunker
                context['CHROMA_ENABLED'] = True
                logger.info("Enhanced document processing system initialized successfully")
            except Exception as e:
                logger.warning(f"Failed to initialize enhanced processing: {e}")
                context['CHROMA_ENABLED'] = False
        else:
            logger.info("Enhanced processing not available, using legacy mode")
            context['CHROMA_ENABLED'] = False
        
        context['RAG_ENABLED'] = True
        context['ENHANCED_PROCESSING_AVAILABLE'] = ENHANCED_PROCESSING_AVAILABLE
        
    except Exception as e:
        logger.error(f"Failed to initialize document processing system: {e}")
        logger.info("Running in mock mode")
        context['RAG_ENABLED'] = False
        context['CHROMA_ENABLED'] = False
        context['ENHANCED_PROCESSING_AVAILABLE'] = False
        context['bedrock_service'] = None
        context['vector_store'] = None
        context['rag_engine'] = None
        context['document_processor'] = None
        context['chroma_service'] = None
        context['DocumentChunker'] = None
    
    # Add shared data structures
    context['documents'] = documents
    context['categories'] = categories
    
    return context

def generate_embeddings(texts, batch_size=10):
    """
    Generate embeddings for a list of texts using Bedrock
    
    Args:
        texts: List of text strings
        batch_size: Number of texts to process in each batch
        
    Returns:
        List of embedding vectors
    """
    # Get bedrock service from app context
    bedrock_service = None
    RAG_ENABLED = False
    
    # Try to get from current app context
    from flask import current_app
    if current_app:
        app_context = current_app.config.get('app_context', {})
        bedrock_service = app_context.get('bedrock_service')
        RAG_ENABLED = app_context.get('RAG_ENABLED', False)
    
    if not RAG_ENABLED or not bedrock_service:
        logger.warning("Bedrock service not available, returning mock embeddings")
        return [[0.0] * 1536 for _ in texts]  # Mock embeddings
    
    try:
        embeddings = []
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            batch_embeddings = []
            
            for text in batch:
                # Truncate text if too long
                if len(text) > 8000:
                    text = text[:8000]
                
                embedding = bedrock_service.generate_embedding(text)
                batch_embeddings.append(embedding)
            
            embeddings.extend(batch_embeddings)
            
            # Add small delay to avoid rate limiting
            if i + batch_size < len(texts):
                time.sleep(0.1)
        
        logger.info(f"Generated {len(embeddings)} embeddings")
        return embeddings
        
    except Exception as e:
        logger.error(f"Failed to generate embeddings: {e}")
        # Return mock embeddings as fallback
        return [[0.0] * 1536 for _ in texts]

def register_blueprints(app, app_context):
    """Register all blueprints with the Flask app"""
    
    # Store app context in app config for access in generate_embeddings
    app.config['app_context'] = app_context
    
    # Initialize modules with app context
    init_chat_module(app_context)
    init_documents_module(app_context)
    init_categories_module(app_context)
    init_knowledge_module(app_context)
    init_bedrock_module(app_context)
    init_chroma_module(app_context)
    
    # Register blueprints
    app.register_blueprint(misc_bp)
    app.register_blueprint(chat_bp)
    app.register_blueprint(documents_bp)
    app.register_blueprint(categories_bp)
    app.register_blueprint(knowledge_bp)
    app.register_blueprint(bedrock_bp)
    app.register_blueprint(chroma_bp)
    
    return app

if __name__ == '__main__':
    app = create_app()
    app.run(debug=True, host='0.0.0.0', port=5000)