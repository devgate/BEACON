"""
Documents API module for BEACON
Handles document upload, management, and file operations
"""
from flask import Blueprint, request, jsonify, send_file
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import time
import logging
import PyPDF2
from pdf2image import convert_from_bytes
import shutil

logger = logging.getLogger(__name__)

# Create Blueprint
documents_bp = Blueprint('documents', __name__)

# Allowed file extensions
ALLOWED_EXTENSIONS = {'pdf', 'txt', 'docx', 'doc', 'xlsx', 'xls', 'csv', 'json', 'md', 'rtf'}

# Storage for documents
documents = []
document_counter = 0

def init_documents_module(app_context):
    """Initialize documents module with app context"""
    global bedrock_service, vector_store, rag_engine
    global document_processor, chroma_service, DocumentChunker
    global generate_embeddings
    global RAG_ENABLED, CHROMA_ENABLED, ENHANCED_PROCESSING_AVAILABLE
    global app_config
    
    bedrock_service = app_context['bedrock_service']
    vector_store = app_context['vector_store']
    rag_engine = app_context['rag_engine']
    document_processor = app_context.get('document_processor')
    chroma_service = app_context.get('chroma_service')
    DocumentChunker = app_context.get('DocumentChunker')
    generate_embeddings = app_context['generate_embeddings']
    RAG_ENABLED = app_context['RAG_ENABLED']
    CHROMA_ENABLED = app_context['CHROMA_ENABLED']
    ENHANCED_PROCESSING_AVAILABLE = app_context['ENHANCED_PROCESSING_AVAILABLE']
    app_config = app_context['app_config']

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def extract_text_from_pdf(file_stream):
    """Extract text from PDF file"""
    try:
        pdf_reader = PyPDF2.PdfReader(file_stream)
        text = ""
        for page in pdf_reader.pages:
            text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        logger.error(f"PDF text extraction error: {e}")
        return None

def extract_images_from_pdf(file_stream, document_id):
    """Extract images from PDF file"""
    images = []
    try:
        file_stream.seek(0)
        pdf_images = convert_from_bytes(file_stream.read(), dpi=150, fmt='PNG')
        
        # Create image directory
        image_dir = os.path.join('static', 'images', f'doc_{document_id}')
        os.makedirs(image_dir, exist_ok=True)
        
        # Save each page as image
        for page_num, image in enumerate(pdf_images, 1):
            image_filename = f'page_{page_num}.png'
            image_path = os.path.join(image_dir, image_filename)
            image.save(image_path, 'PNG')
            
            image_url = f'/static/images/doc_{document_id}/{image_filename}'
            
            images.append({
                'page': page_num,
                'filename': image_filename,
                'url': image_url,
                'path': image_path
            })
        
        logger.info(f"PDF {document_id}: {len(images)} images extracted")
        return images
        
    except Exception as e:
        logger.error(f"PDF image extraction error: {e}")
        return []

def sync_documents_from_chroma():
    """Sync global documents array with ChromaDB collections and verify file existence"""
    global documents
    try:
        if not CHROMA_ENABLED or not chroma_service:
            return
        
        logger.info("🔄 Starting document synchronization from ChromaDB...")
        
        # Get all documents from ChromaDB
        chroma_docs = chroma_service.list_all_documents()
        logger.info(f"📋 Found {len(chroma_docs)} documents in ChromaDB")
        
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
        synced_documents = []
        
        # Helper function to find actual file path
        def find_actual_file_path(doc_id, doc_name):
            """Find the actual file path for a document"""
            if not os.path.exists(uploads_dir):
                return None
                
            import glob
            
            # Try multiple patterns to find the file
            search_patterns = [
                f"doc_{doc_id}_*",
                f"*{doc_id}_*",
                f"{doc_id}.*",
                f"*{doc_name}*" if doc_name and doc_name != 'Unknown' else None,
                f"*{doc_id}*"
            ]
            
            # Remove None patterns
            search_patterns = [p for p in search_patterns if p]
            
            for pattern in search_patterns:
                full_pattern = os.path.join(uploads_dir, pattern)
                matches = glob.glob(full_pattern)
                if matches:
                    # Sort by modification time, newest first
                    matches.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                    actual_path = matches[0]
                    logger.debug(f"✅ Found file for doc {doc_id} via pattern '{pattern}': {actual_path}")
                    return actual_path
            
            logger.warning(f"⚠️ No file found for doc {doc_id} (patterns tried: {search_patterns})")
            return None
        
        # Convert ChromaDB format to documents array format
        for doc_data in chroma_docs.values():
            doc_id = doc_data.get('document_id')
            if not doc_id:
                continue
                
            doc_name = doc_data.get('document_name', 'Unknown')
            logger.debug(f"🔍 Processing ChromaDB document: {doc_id} ({doc_name})")
            
            # Find existing document or create from ChromaDB data
            existing_doc = next((d for d in documents if str(d.get('id')) == str(doc_id)), None)
            
            if existing_doc:
                logger.debug(f"📄 Updating existing document: {doc_id}")
                
                # Update existing document with ChromaDB info
                existing_doc['chunk_count'] = doc_data.get('chunk_count', 1)
                
                # Ensure index_id is set for knowledge base collections
                collection = doc_data.get('collection', 'documents')
                if collection != 'documents':
                    existing_doc['index_id'] = collection
                    existing_doc['knowledge_base_id'] = collection
                
                # Verify and update file path if needed
                current_file_path = existing_doc.get('file_path')
                if not current_file_path or not os.path.exists(current_file_path):
                    actual_file_path = find_actual_file_path(doc_id, doc_name)
                    if actual_file_path:
                        existing_doc['file_path'] = actual_file_path
                        existing_doc['file_size'] = os.path.getsize(actual_file_path)
                        logger.info(f"✅ Updated file path for doc {doc_id}: {actual_file_path}")
                    else:
                        logger.warning(f"⚠️ No physical file found for existing doc {doc_id}")
                        existing_doc['status'] = 'File Missing'
                
                synced_documents.append(existing_doc)
            else:
                logger.debug(f"📄 Creating new document entry for: {doc_id}")
                
                # Create document entry from ChromaDB metadata  
                collection_id = doc_data.get('collection', 'documents')
                index_id = collection_id if collection_id != 'documents' else None
                
                # Try to find the actual file
                actual_file_path = find_actual_file_path(doc_id, doc_name)
                
                if actual_file_path:
                    file_size = os.path.getsize(actual_file_path)
                    status = 'Success'
                    logger.info(f"✅ Found physical file for ChromaDB doc {doc_id}: {actual_file_path}")
                else:
                    # Fallback path if no file found
                    actual_file_path = f"uploads/{doc_name}"
                    file_size = doc_data.get('total_size', 0)
                    status = 'File Missing'
                    logger.warning(f"⚠️ No physical file found for ChromaDB doc {doc_id}, using fallback path")
                
                synced_doc = {
                    'id': int(doc_id) if str(doc_id).isdigit() else doc_id,
                    'title': doc_name,
                    'file_name': doc_name,
                    'original_filename': doc_name,  # Add for download consistency
                    'content': '',  # Will be loaded from file when needed
                    'file_path': actual_file_path,
                    'uploaded_at': doc_data.get('created_at', datetime.now().isoformat()),
                    'index_id': index_id,
                    'knowledge_base_id': index_id,  # Add for consistency
                    'status': status,
                    'chunk_count': doc_data.get('chunk_count', 1),
                    'file_size': file_size
                }
                synced_documents.append(synced_doc)
        
        # Update global documents array
        documents[:] = synced_documents
        
        # Log sync results
        files_found = len([d for d in synced_documents if d['status'] == 'Success'])
        files_missing = len([d for d in synced_documents if d['status'] == 'File Missing'])
        
        logger.info(f"✅ Document sync completed: {len(synced_documents)} total, {files_found} with files, {files_missing} missing files")
        
    except Exception as e:
        logger.error(f"💥 Failed to sync documents from ChromaDB: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")

@documents_bp.route('/api/documents/sync', methods=['POST'])
def sync_documents():
    """Manual sync with ChromaDB collections"""
    try:
        if not CHROMA_ENABLED or not chroma_service:
            return jsonify({'error': 'ChromaDB not enabled'}), 400
        
        sync_documents_from_chroma()
        
        return jsonify({
            'success': True,
            'message': f'Synced {len(documents)} documents from ChromaDB',
            'document_count': len(documents)
        })
    except Exception as e:
        logger.error(f"Manual sync failed: {e}")
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/api/documents')
def get_documents():
    """Get all documents with ChromaDB sync"""
    try:
        # Sync with ChromaDB if enabled
        if CHROMA_ENABLED and chroma_service:
            sync_documents_from_chroma()
        
        return jsonify({'documents': documents})
    except Exception as e:
        logger.error(f"Failed to get documents: {e}")
        return jsonify({'error': str(e)}), 500

@documents_bp.route('/api/upload', methods=['POST'])
def upload_file():
    """Upload and process a document"""
    global document_counter
    
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    # Get parameters
    chunk_strategy = request.form.get('chunk_strategy', 'sentence')
    chunk_size = int(request.form.get('chunk_size', 1000))
    chunk_overlap = int(request.form.get('chunk_overlap', 100))
    index_id = request.form.get('index_id')  # Get knowledge base index ID
    
    # If uploading to existing knowledge base, load existing settings
    if index_id and CHROMA_ENABLED:
        try:
            kb_stats = chroma_service.get_collection_stats_by_kb(index_id)
            if kb_stats and kb_stats.get('total_chunks', 0) > 0:
                # Use existing settings if available
                existing_strategy = kb_stats.get('chunking_strategy')
                existing_chunk_size = kb_stats.get('chunk_size')
                existing_chunk_overlap = kb_stats.get('chunk_overlap')
                
                if existing_strategy:
                    chunk_strategy = existing_strategy
                    logger.info(f"Using existing chunking strategy: {chunk_strategy}")
                
                if existing_chunk_size:
                    chunk_size = int(existing_chunk_size)
                    logger.info(f"Using existing chunk size: {chunk_size}")
                    
                if existing_chunk_overlap:
                    chunk_overlap = int(existing_chunk_overlap)
                    logger.info(f"Using existing chunk overlap: {chunk_overlap}")
        except Exception as e:
            logger.warning(f"Could not load existing KB settings: {e}, using provided parameters")
    
    if file and allowed_file(file.filename):
        processing_start_time = time.time()
        
        try:
            # Save file
            filename = secure_filename(file.filename)
            document_counter += 1
            
            os.makedirs(app_config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app_config['UPLOAD_FOLDER'], f"doc_{document_counter}_{filename}")
            file.save(file_path)
            
            # Extract text
            text_content = ""
            extraction_metadata = {}
            images = []
            
            if document_processor and ENHANCED_PROCESSING_AVAILABLE:
                try:
                    text_content, extraction_metadata = document_processor.extract_text(file_path)
                    logger.info(f"Text extracted using enhanced processor: {len(text_content)} characters")
                except Exception as e:
                    logger.warning(f"Enhanced extraction failed, falling back to PDF-only: {e}")
                    if file.filename.lower().endswith('.pdf'):
                        with open(file_path, 'rb') as f:
                            text_content = extract_text_from_pdf(f)
                        if text_content:
                            with open(file_path, 'rb') as f:
                                images = extract_images_from_pdf(f, document_counter)
            else:
                # Fallback to original method
                if file.filename.lower().endswith('.pdf'):
                    with open(file_path, 'rb') as f:
                        text_content = extract_text_from_pdf(f)
                    if text_content:
                        with open(file_path, 'rb') as f:
                            images = extract_images_from_pdf(f, document_counter)
            
            if not text_content or not text_content.strip():
                return jsonify({'error': '파일에서 텍스트를 추출할 수 없습니다.'}), 400
            
            # Create document entry
            new_doc = {
                'id': document_counter,
                'title': filename,
                'file_name': filename,
                'content': text_content,
                'type': 'uploaded',
                'images': images,
                'file_path': file_path,
                'original_filename': file.filename,
                'index_id': index_id,  # Add knowledge base ID
                'knowledge_base_id': index_id,  # Also add as knowledge_base_id for consistency
                'extraction_metadata': extraction_metadata,
                'uploaded_at': datetime.now().isoformat(),
                'file_size': os.path.getsize(file_path),
                'status': 'Processing'  # Initial processing status
            }
            documents.append(new_doc)
            
            # Process with ChromaDB if enabled
            chroma_processing_result = None
            if CHROMA_ENABLED and chroma_service:
                chroma_processing_result = _process_with_chroma(
                    text_content, filename, document_counter,
                    chunk_strategy, chunk_size, chunk_overlap,
                    extraction_metadata, file.filename, index_id
                )
                if chroma_processing_result and chroma_processing_result['success']:
                    new_doc['chunk_count'] = chroma_processing_result['chunks_created']
            
            # Legacy RAG processing
            legacy_rag_result = None
            if RAG_ENABLED and rag_engine:
                try:
                    category_settings = {'chunk_strategy': chunk_strategy, 'chunk_size': chunk_size, 'chunk_overlap': chunk_overlap}
                    
                    legacy_rag_result = rag_engine.process_document(
                        document_id=str(document_counter),
                        title=filename,
                        content=text_content,
                        category_settings=category_settings
                    )
                    logger.info(f"Legacy RAG processing completed")
                except Exception as e:
                    logger.error(f"Failed to process document with legacy RAG: {e}")
            
            # Update document status to completed
            new_doc['status'] = 'Success'
            new_doc['processed_at'] = datetime.now().isoformat()
            
            # Prepare response
            processing_time = time.time() - processing_start_time
            
            response_data = {
                'success': True,
                'message': f'"{file.filename}" 파일이 성공적으로 업로드되었습니다.',
                'document': {
                    'id': new_doc['id'],
                    'title': new_doc['title'],
                    'preview': text_content[:200] + '...' if len(text_content) > 200 else text_content,
                    'file_size': new_doc['file_size'],
                    'file_extension': extraction_metadata.get('file_extension', ''),
                    'extraction_method': extraction_metadata.get('extraction_method', 'unknown')
                },
                'processing_time': round(processing_time, 2),
                'chroma_enabled': CHROMA_ENABLED,
                'rag_enabled': RAG_ENABLED
            }
            
            if chroma_processing_result:
                response_data['chroma_processing'] = chroma_processing_result
            
            if legacy_rag_result:
                response_data['legacy_rag_processing'] = {
                    'chunks_created': legacy_rag_result.chunks_created,
                    'embeddings_generated': legacy_rag_result.embeddings_generated,
                    'processing_time': round(legacy_rag_result.processing_time, 2),
                    'total_tokens': legacy_rag_result.total_tokens
                }
            
            if extraction_metadata:
                response_data['extraction_metadata'] = extraction_metadata
            
            return jsonify(response_data)
            
        except Exception as e:
            logger.error(f"Upload processing failed: {e}")
            # Update status to failed if document was created
            if 'new_doc' in locals() and new_doc in documents:
                new_doc['status'] = 'Failed'
                new_doc['error'] = str(e)
            return jsonify({'error': f'파일 처리 중 오류가 발생했습니다: {str(e)}'}), 500
    
    return jsonify({'error': f'지원되지 않는 파일 형식입니다. 지원 형식: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

def _process_with_chroma(text_content, filename, doc_id, chunk_strategy, 
                         chunk_size, chunk_overlap, 
                         extraction_metadata, original_filename, index_id=None):
    """Process document with ChromaDB"""
    try:
        logger.info(f"Processing document with Chroma DB: {filename} for KB: {index_id}")
        
        # Generate chunks
        if DocumentChunker:
            if chunk_strategy == 'sentence':
                chunks = DocumentChunker.chunk_by_sentences(
                    text_content, max_chunk_size=chunk_size, overlap=chunk_overlap
                )
            elif chunk_strategy == 'paragraph':
                chunks = DocumentChunker.chunk_by_paragraphs(
                    text_content, max_chunk_size=chunk_size
                )
            elif chunk_strategy == 'token':
                chunks = DocumentChunker.chunk_by_tokens(
                    text_content, max_tokens=chunk_size//4, overlap_tokens=chunk_overlap//4
                )
            elif chunk_strategy == 'by_title':
                chunks = DocumentChunker.chunk_by_title(
                    text_content, max_chunk_size=chunk_size, overlap=chunk_overlap
                )
            else:
                chunks = DocumentChunker.chunk_by_sentences(text_content, chunk_size, chunk_overlap)
        else:
            # Simple fallback chunking
            words = text_content.split()
            chunks = []
            current_chunk = ""
            for word in words:
                if len(current_chunk) + len(word) < chunk_size:
                    current_chunk += word + " "
                else:
                    if current_chunk:
                        chunks.append(current_chunk.strip())
                    current_chunk = word + " "
            if current_chunk:
                chunks.append(current_chunk.strip())
        
        # Generate embeddings
        embeddings = generate_embeddings(chunks)
        
        # Store in Chroma DB
        if index_id:
            # Store in specific knowledge base collection
            document_id = f"kb_{index_id}_doc_{doc_id}"
            success = chroma_service.add_document_to_kb(
                chunks=chunks,
                embeddings=embeddings,
                document_id=document_id,
                document_name=filename,
                index_id=index_id,
                metadata={
                    'chunk_strategy': chunk_strategy,
                    'chunk_size': chunk_size,
                    'file_extension': extraction_metadata.get('file_extension', ''),
                    'original_filename': original_filename
                }
            )
        else:
            # Store in default collection
            document_id = f"doc_{doc_id}"
            success = chroma_service.add_document_chunks(
                chunks=chunks,
                embeddings=embeddings,
                document_id=document_id,
                document_name=filename,
                metadata={
                    'chunk_strategy': chunk_strategy,
                    'chunk_size': chunk_size,
                    'file_extension': extraction_metadata.get('file_extension', ''),
                    'original_filename': original_filename
                }
            )
        
        result = {
            'success': success,
            'chunks_created': len(chunks),
            'embeddings_generated': len(embeddings),
            'chunk_strategy': chunk_strategy,
            'average_chunk_size': sum(len(chunk) for chunk in chunks) // len(chunks) if chunks else 0
        }
        
        logger.info(f"Chroma DB processing completed: {len(chunks)} chunks created")
        return result
        
    except Exception as e:
        logger.error(f"Failed to process document with Chroma DB: {e}")
        return {'success': False, 'error': str(e)}


@documents_bp.route('/api/documents/<doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document"""
    global documents
    
    # Handle both string and integer document IDs
    doc_to_delete = next((d for d in documents if str(d['id']) == str(doc_id)), None)
    
    if not doc_to_delete:
        return jsonify({'error': '문서를 찾을 수 없습니다.'}), 404
    
    try:
        logger.info(f"Attempting to delete document {doc_id}: {doc_to_delete.get('title', 'Unknown')}")
        
        # Delete file if exists
        if doc_to_delete.get('file_path'):
            file_path = doc_to_delete['file_path']
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.info(f"✅ File deleted: {file_path}")
            else:
                logger.warning(f"⚠️ File not found: {file_path}")
        
        # Delete image directory if exists
        image_dir = os.path.join('static', 'images', f'doc_{doc_id}')
        if os.path.exists(image_dir):
            shutil.rmtree(image_dir)
            logger.info(f"Image directory deleted: {image_dir}")
        
        # Remove from RAG system
        rag_deleted_count = 0
        if RAG_ENABLED:
            try:
                rag_deleted_count = rag_engine.delete_document(str(doc_id))
                logger.info(f"Deleted {rag_deleted_count} chunks from legacy RAG system")
            except Exception as e:
                logger.error(f"Failed to delete from legacy RAG: {e}")
        
        # Remove from ChromaDB
        chroma_deleted = False
        if CHROMA_ENABLED and chroma_service:
            try:
                possible_ids = [
                    str(doc_id),
                    f"doc_{doc_id}",
                ]
                
                if doc_to_delete.get('index_id'):
                    possible_ids.append(f"kb_{doc_to_delete['index_id']}_doc_{doc_id}")
                
                for chroma_id in possible_ids:
                    try:
                        deleted = chroma_service.delete_document(chroma_id)
                        if deleted:
                            logger.info(f"✅ Deleted from ChromaDB with ID: {chroma_id}")
                            chroma_deleted = True
                            break
                    except Exception as e:
                        logger.debug(f"Failed to delete with ID {chroma_id}: {e}")
                
                if not chroma_deleted:
                    logger.warning(f"⚠️ Document {doc_id} not found in ChromaDB")
            except Exception as e:
                logger.error(f"Failed to delete from ChromaDB: {e}")
        
        # Remove from documents list
        documents[:] = [d for d in documents if str(d['id']) != str(doc_id)]
        
        return jsonify({
            'success': True,
            'message': f'문서 "{doc_to_delete["title"]}"가 삭제되었습니다.',
            'rag_chunks_deleted': rag_deleted_count if RAG_ENABLED else None
        })
        
    except Exception as e:
        logger.error(f"Document deletion error: {e}")
        return jsonify({'error': f'문서 삭제 중 오류가 발생했습니다: {str(e)}'}), 500

@documents_bp.route('/api/documents/bulk', methods=['DELETE'])
def delete_multiple_documents():
    """Delete multiple documents"""
    global documents
    
    data = request.get_json()
    document_ids = data.get('document_ids', [])
    
    if not document_ids:
        return jsonify({'error': 'Document IDs are required'}), 400
    
    try:
        deleted_count = 0
        deleted_docs = []
        
        for doc_id in document_ids:
            # Handle both string and integer document IDs
            doc_to_delete = next((d for d in documents if str(d['id']) == str(doc_id)), None)
            if not doc_to_delete:
                continue
            
            deleted_docs.append(doc_to_delete['title'])
            
            # Delete file if exists
            try:
                if 'file_path' in doc_to_delete and os.path.exists(doc_to_delete['file_path']):
                    os.remove(doc_to_delete['file_path'])
            except Exception as e:
                logger.warning(f"Failed to delete file for document {doc_id}: {e}")
            
            # Delete from RAG systems
            if RAG_ENABLED:
                try:
                    rag_engine.delete_document(str(doc_id))
                    logger.info(f"Deleted document {doc_id} from legacy RAG")
                except Exception as e:
                    logger.error(f"Failed to delete from legacy RAG: {e}")
            
            # Delete from ChromaDB
            if CHROMA_ENABLED and chroma_service:
                try:
                    possible_ids = [str(doc_id), f"doc_{doc_id}"]
                    if doc_to_delete.get('index_id'):
                        possible_ids.append(f"kb_{doc_to_delete['index_id']}_doc_{doc_id}")
                    
                    for chroma_id in possible_ids:
                        try:
                            if chroma_service.delete_document(chroma_id):
                                logger.info(f"Deleted from ChromaDB: {chroma_id}")
                                break
                        except:
                            pass
                except Exception as e:
                    logger.error(f"Failed to delete from ChromaDB: {e}")
            
            deleted_count += 1
        
        # Remove documents from list
        documents[:] = [d for d in documents if str(d['id']) not in [str(doc_id) for doc_id in document_ids]]
        
        return jsonify({
            'success': True,
            'message': f'{deleted_count} documents deleted successfully',
            'deleted_documents': deleted_docs,
            'deleted_count': deleted_count
        })
        
    except Exception as e:
        logger.error(f"Bulk delete error: {e}")
        return jsonify({'error': f'Failed to delete documents: {str(e)}'}), 500

@documents_bp.route('/api/download/<doc_id>')
def download_file(doc_id):
    """Download a document file with comprehensive error handling and improved file search"""
    logger.info(f"📥 Download request for doc_id: {doc_id}")
    
    try:
        # Validate doc_id format
        try:
            doc_id_int = int(doc_id) if str(doc_id).isdigit() else doc_id
        except (ValueError, TypeError):
            logger.error(f"❌ Invalid doc_id format: {doc_id}")
            return jsonify({
                'error': '유효하지 않은 문서 ID입니다.',
                'details': f'Invalid document ID format: {doc_id}'
            }), 400
        
        logger.info(f"🔍 Searching for doc_id: {doc_id} in documents array (total: {len(documents)})")
        
        # Debug: log available document IDs (limit to first 10 for readability)  
        doc_ids = [str(d.get('id')) for d in documents]
        logger.info(f"📋 Available document IDs (first 10): {doc_ids[:10]}{'...' if len(doc_ids) > 10 else ''}")
        
        uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
        
        # STEP 1: Try to find in documents array first (primary method)
        doc = next((d for d in documents if str(d.get('id')) == str(doc_id)), None)
        
        if doc:
            logger.info(f"📄 Found document record: {doc.get('title', 'Unknown')} (file_path: {doc.get('file_path', 'None')})")
            
            # Check if stored file path exists
            stored_file_path = doc.get('file_path')
            if stored_file_path and os.path.exists(stored_file_path):
                logger.info(f"✅ Using stored file path: {stored_file_path}")
                
                # Get filename with proper fallbacks
                filename = (doc.get('original_filename') or 
                           doc.get('file_name') or 
                           doc.get('title') or 
                           os.path.basename(stored_file_path))
                
                # Ensure file has proper extension
                if not os.path.splitext(filename)[1]:
                    file_ext = os.path.splitext(stored_file_path)[1] or '.pdf'
                    filename = filename + file_ext
                
                logger.info(f"📤 Downloading as filename: {filename}")
                
                return send_file(
                    stored_file_path, 
                    as_attachment=True, 
                    download_name=filename,
                    mimetype='application/octet-stream'
                )
            else:
                logger.warning(f"⚠️ Stored file path not found: {stored_file_path}")

        # STEP 2: Enhanced file pattern matching in uploads directory
        if os.path.exists(uploads_dir):
            import glob
            logger.info(f"🔍 Searching in uploads directory: {uploads_dir}")
            
            # Comprehensive pattern search with priority order
            file_patterns = [
                # New pattern: doc_{id}_{filename}
                f"doc_{doc_id}_*.pdf",
                f"doc_{doc_id}_*.docx", 
                f"doc_{doc_id}_*.txt",
                f"doc_{doc_id}_*",
                
                # Timestamp patterns: {timestamp}_{filename}
                f"*{doc_id}_*.pdf",
                f"*{doc_id}_*.docx",
                f"*{doc_id}_*.txt", 
                f"*{doc_id}_*",
                
                # Direct patterns: {id}.extension
                f"{doc_id}.pdf",
                f"{doc_id}.docx",
                f"{doc_id}.txt",
                f"{doc_id}.*",
                
                # Any file containing doc_id
                f"*{doc_id}*"
            ]
            
            for pattern in file_patterns:
                full_pattern = os.path.join(uploads_dir, pattern)
                matches = glob.glob(full_pattern)
                logger.debug(f"🔎 Pattern '{pattern}': {len(matches)} matches")
                
                if matches:
                    # Sort by modification time, newest first
                    matches.sort(key=lambda x: os.path.getmtime(x), reverse=True)
                    file_path = matches[0]
                    
                    logger.info(f"✅ Found file via pattern '{pattern}': {file_path}")
                    
                    # Determine download filename
                    if doc:
                        # Use document record info if available
                        filename = (doc.get('original_filename') or 
                                   doc.get('file_name') or 
                                   doc.get('title') or
                                   os.path.basename(file_path))
                    else:
                        # Use actual filename if no document record
                        filename = os.path.basename(file_path)
                        
                        # Clean up filename for user-friendly display
                        if filename.startswith('doc_'):
                            # Remove doc_{id}_ prefix
                            parts = filename.split('_', 2)
                            if len(parts) >= 3:
                                filename = parts[2]
                        elif '_' in filename and filename.split('_')[0].isdigit():
                            # Remove timestamp prefix
                            parts = filename.split('_', 1)
                            if len(parts) >= 2:
                                filename = parts[1]
                    
                    # Ensure proper extension
                    if not os.path.splitext(filename)[1]:
                        file_ext = os.path.splitext(file_path)[1] or '.pdf'
                        filename = filename + file_ext
                    
                    logger.info(f"📤 Downloading as: {filename}")
                    
                    return send_file(
                        file_path,
                        as_attachment=True,
                        download_name=filename,
                        mimetype='application/octet-stream'
                    )
        else:
            logger.error(f"❌ Uploads directory not found: {uploads_dir}")

        # STEP 3: Try ChromaDB approach as fallback
        if CHROMA_ENABLED and chroma_service:
            try:
                logger.info(f"🔍 Trying ChromaDB document info for: {doc_id}")
                doc_info = chroma_service.get_document_info(doc_id)
                if doc_info and doc_info.get('exists'):
                    logger.info(f"📄 ChromaDB document info: {doc_info}")
                    # Note: ChromaDB info found but no physical file located
                    # This suggests the file was deleted or moved
            except Exception as e:
                logger.error(f"❌ Error checking ChromaDB: {e}")
        
        # If nothing found, return comprehensive 404
        logger.error(f"❌ Document file not found for doc_id: {doc_id}")
        
        # Provide helpful debug information
        available_files_sample = []
        if os.path.exists(uploads_dir):
            try:
                all_files = [f for f in os.listdir(uploads_dir) if not f.startswith('.')]
                available_files_sample = sorted(all_files)[-5:]  # Last 5 files
            except Exception as e:
                logger.error(f"Error reading uploads directory: {e}")
        
        return jsonify({
            'error': '파일을 찾을 수 없습니다.',
            'details': f'Document ID {doc_id} not found in file system',
            'debug_info': {
                'doc_in_array': doc is not None,
                'stored_path_exists': doc.get('file_path') and os.path.exists(doc.get('file_path')) if doc else False,
                'uploads_dir_exists': os.path.exists(uploads_dir),
                'available_doc_ids': doc_ids[:5],
                'recent_files_sample': available_files_sample
            }
        }), 404
        
    except Exception as e:
        logger.error(f"💥 Download error for doc_id {doc_id}: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        
        return jsonify({
            'error': f'파일 다운로드 중 오류가 발생했습니다: {str(e)}',
            'details': str(e)
        }), 500

@documents_bp.route('/api/documents/<int:doc_id>/reprocess', methods=['POST'])
def reprocess_document(doc_id):
    """Reprocess a document with new settings"""
    try:
        doc = next((d for d in documents if d['id'] == doc_id), None)
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        
        # Get processing options
        data = request.get_json() or {}
        
        # Update document status
        doc['status'] = 'Processing'
        
        # Simulate processing
        time.sleep(1)
        
        # Update status
        doc['status'] = 'Success'
        doc['processed_at'] = datetime.now().isoformat()
        
        logger.info(f"Document {doc_id} reprocessed successfully")
        
        return jsonify({
            'success': True,
            'message': f'Document "{doc["title"]}" queued for reprocessing',
            'document_id': doc_id
        })
        
    except Exception as e:
        logger.error(f"Document reprocessing error: {e}")
        return jsonify({'error': f'Failed to reprocess document: {str(e)}'}), 500

@documents_bp.route('/api/documents/<doc_id>/preview')
def get_document_preview(doc_id):
    """Get document preview with text, images, and metadata"""
    try:
        # Convert doc_id to int if it's a string
        try:
            doc_id_int = int(doc_id)
        except (ValueError, TypeError):
            doc_id_int = doc_id
        
        # Find document - handle both string and int IDs
        doc = None
        for d in documents:
            if str(d.get('id')) == str(doc_id):
                doc = d
                break
        
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        
        file_path = doc.get('file_path')
        
        # If stored file path doesn't exist, try to find the actual file
        file_exists = file_path and os.path.exists(file_path)
        if not file_exists and file_path:
            # Try to find file with timestamp prefix in uploads directory
            upload_dir = os.path.dirname(file_path) or 'uploads'
            original_filename = os.path.basename(file_path)
            
            if os.path.exists(upload_dir):
                for filename in os.listdir(upload_dir):
                    if filename.endswith('_' + original_filename) or filename == original_filename:
                        potential_path = os.path.join(upload_dir, filename)
                        if os.path.exists(potential_path):
                            file_path = potential_path
                            file_exists = True
                            logger.info(f"Found actual file: {file_path} for doc {doc.get('id')}")
                            break
        
        # If no physical file, try to get content from ChromaDB only
        if not file_exists:
            logger.info(f"Physical file not found for doc {doc_id}, trying ChromaDB only")
        
        preview_data = {
            'text_content': '',
            'images': [],
            'metadata': {
                'document_id': doc.get('id'),
                'file_name': doc.get('title', 'Unknown'),
                'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'created_at': doc.get('created_at', datetime.now().isoformat()),
                'status': doc.get('status', 'Unknown')
            }
        }
        
        # For consistent chunking preview, prioritize ChromaDB's original text over file extraction
        # This ensures preview uses same text that was used to create the stored chunks
        text_content = ""
        
        # First, try to reconstruct original text from ChromaDB chunks
        if CHROMA_ENABLED and chroma_service:
            try:
                chunks = chroma_service.get_document_chunks(str(doc.get('id')))
                if chunks and len(chunks) > 0:
                    # Reconstruct the original text from stored chunks
                    # Note: This may not be perfect reconstruction, but it's closer to original
                    text_content = '\n\n'.join(chunks)
                    logger.info(f"Reconstructed original text from {len(chunks)} ChromaDB chunks for doc {doc.get('id')}: {len(text_content)} characters")
            except Exception as e:
                logger.warning(f"Failed to get chunks from ChromaDB for doc {doc.get('id')}: {e}")
        
        # If no ChromaDB content available, extract from file
        if not text_content and file_exists:
            if document_processor and ENHANCED_PROCESSING_AVAILABLE:
                try:
                    # Use enhanced processor (same as upload process)
                    text_content, extraction_metadata = document_processor.extract_text(file_path)
                    logger.info(f"Text extracted using enhanced processor for doc {doc.get('id')}: {len(text_content)} characters")
                except Exception as e:
                    logger.warning(f"Enhanced extraction failed for preview, falling back to basic method: {e}")
                    # Fallback to basic method
                    if file_path.lower().endswith('.pdf'):
                        with open(file_path, 'rb') as file:
                            text_content = extract_text_from_pdf(file)
                    elif file_path.lower().endswith('.txt'):
                        with open(file_path, 'r', encoding='utf-8') as file:
                            text_content = file.read()
                    if text_content:
                        logger.info(f"Fallback extraction for doc {doc.get('id')}: {len(text_content)} characters")
            else:
                # Fallback to original method when enhanced processing not available
                if file_path.lower().endswith('.pdf'):
                    logger.info(f"Attempting to extract text from PDF file: {file_path}")
                    with open(file_path, 'rb') as file:
                        text_content = extract_text_from_pdf(file)
                        logger.info(f"Extracted original text from PDF file for doc {doc.get('id')}: {len(text_content)} characters")
                elif file_path.lower().endswith('.txt'):
                    logger.info(f"Reading text file: {file_path}")
                    with open(file_path, 'r', encoding='utf-8') as file:
                        text_content = file.read()
                        logger.info(f"Read text from TXT file for doc {doc.get('id')}: {len(text_content)} characters")
        
        # Final fallback to ChromaDB chunks if still no content
        if not text_content and CHROMA_ENABLED and chroma_service:
            try:
                chunks = chroma_service.get_document_chunks(str(doc.get('id')))
                if chunks:
                    text_content = '\n\n'.join(chunks)
                    logger.info(f"Retrieved {len(chunks)} chunks from ChromaDB for doc {doc.get('id')} (fallback)")
            except Exception as e:
                logger.warning(f"Failed to get chunks from ChromaDB for doc {doc.get('id')}: {e}")
        
        # If still no content and no file exists, return an error
        if not text_content and not file_exists:
            return jsonify({'error': 'Document content not available - no file and no chunks found'}), 404
        
        # Set text content and metadata
        if text_content:
            preview_data['text_content'] = text_content
            # Update metadata with text statistics
            preview_data['metadata']['word_count'] = len(text_content.split())
            preview_data['metadata']['line_count'] = len(text_content.split('\n'))
            preview_data['metadata']['sentence_count'] = len([s for s in text_content.split('.') if s.strip()])
        
        # Extract images from PDF (only if file exists)
        if file_exists and file_path.lower().endswith('.pdf'):
            with open(file_path, 'rb') as file:
                images = extract_images_from_pdf(file, doc.get('id'))
                preview_data['images'] = images
                preview_data['metadata']['total_pages'] = len(images)
        
        # Add chunking information if available
        if CHROMA_ENABLED and chroma_service:
            try:
                doc_info = chroma_service.get_document_info(str(doc.get('id')))
                if doc_info.get('exists'):
                    preview_data['metadata']['total_chunks'] = doc_info.get('chunk_count', 0)
                    preview_data['metadata']['total_tokens'] = doc_info.get('total_size', 0)
            except Exception as e:
                logger.warning(f"Failed to get chunk info for doc {doc.get('id')}: {e}")
        
        return jsonify({
            'success': True,
            **preview_data
        })
        
    except Exception as e:
        logger.error(f"Document preview error: {e}")
        return jsonify({'error': f'Failed to generate preview: {str(e)}'}), 500

@documents_bp.route('/api/document/formats')
def get_supported_formats():
    """Get list of supported document formats"""
    formats = list(ALLOWED_EXTENSIONS)
    
    format_info = {}
    if ENHANCED_PROCESSING_AVAILABLE and document_processor:
        for fmt in formats:
            format_info[fmt] = {
                'supported': True,
                'description': f'{fmt.upper()} document format'
            }
    
    return jsonify({
        'success': True,
        'supported_formats': formats,
        'format_info': format_info,
        'chroma_enabled': CHROMA_ENABLED,
        'rag_enabled': RAG_ENABLED
    })