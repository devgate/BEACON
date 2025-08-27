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
    global categories, generate_embeddings
    global RAG_ENABLED, CHROMA_ENABLED, ENHANCED_PROCESSING_AVAILABLE
    global app_config
    
    bedrock_service = app_context['bedrock_service']
    vector_store = app_context['vector_store']
    rag_engine = app_context['rag_engine']
    document_processor = app_context.get('document_processor')
    chroma_service = app_context.get('chroma_service')
    DocumentChunker = app_context.get('DocumentChunker')
    categories = app_context['categories']
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

@documents_bp.route('/api/documents')
def get_documents():
    """Get all documents"""
    return jsonify(documents)

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
    category_id = int(request.form.get('category_id', 4))
    chunk_strategy = request.form.get('chunk_strategy', 'sentence')
    chunk_size = int(request.form.get('chunk_size', 1000))
    chunk_overlap = int(request.form.get('chunk_overlap', 100))
    index_id = request.form.get('index_id')  # Get knowledge base index ID
    
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
                'content': text_content,
                'type': 'uploaded',
                'images': images,
                'file_path': file_path,
                'original_filename': file.filename,
                'category_id': category_id,
                'index_id': index_id,  # Add knowledge base ID
                'extraction_metadata': extraction_metadata,
                'uploaded_at': datetime.now().isoformat(),
                'file_size': os.path.getsize(file_path)
            }
            documents.append(new_doc)
            
            # Process with ChromaDB if enabled
            chroma_processing_result = None
            if CHROMA_ENABLED and chroma_service:
                chroma_processing_result = _process_with_chroma(
                    text_content, filename, document_counter,
                    chunk_strategy, chunk_size, chunk_overlap,
                    category_id, extraction_metadata, file.filename, index_id
                )
                if chroma_processing_result and chroma_processing_result['success']:
                    new_doc['chunk_count'] = chroma_processing_result['chunks_created']
            
            # Legacy RAG processing
            legacy_rag_result = None
            if RAG_ENABLED and rag_engine:
                try:
                    category_settings = next(
                        (cat.get('settings', {}) for cat in categories if cat['id'] == category_id),
                        {'chunk_strategy': chunk_strategy, 'chunk_size': chunk_size, 'chunk_overlap': chunk_overlap}
                    )
                    
                    legacy_rag_result = rag_engine.process_document(
                        document_id=str(document_counter),
                        title=filename,
                        content=text_content,
                        category_id=category_id,
                        category_settings=category_settings
                    )
                    logger.info(f"Legacy RAG processing completed")
                except Exception as e:
                    logger.error(f"Failed to process document with legacy RAG: {e}")
            
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
            return jsonify({'error': f'파일 처리 중 오류가 발생했습니다: {str(e)}'}), 500
    
    return jsonify({'error': f'지원되지 않는 파일 형식입니다. 지원 형식: {", ".join(ALLOWED_EXTENSIONS)}'}), 400

def _process_with_chroma(text_content, filename, doc_id, chunk_strategy, 
                         chunk_size, chunk_overlap, category_id, 
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
                    'category_id': category_id,
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
                    'category_id': category_id,
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

@documents_bp.route('/api/documents/<int:doc_id>', methods=['DELETE'])
def delete_document(doc_id):
    """Delete a document"""
    global documents
    
    doc_to_delete = next((d for d in documents if d['id'] == doc_id), None)
    
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
        documents[:] = [d for d in documents if d['id'] != doc_id]
        
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
            doc_to_delete = next((d for d in documents if d['id'] == doc_id), None)
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
        documents[:] = [d for d in documents if d['id'] not in document_ids]
        
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
    """Download a document file"""
    logger.info(f"Download request for doc_id: {doc_id}")
    
    try:
        logger.info(f"Looking for doc_id: {doc_id} in documents array (total: {len(documents)})")
        
        # Debug: log all document IDs
        doc_ids = [str(d.get('id')) for d in documents]
        logger.info(f"Available document IDs: {doc_ids}")
        
        # First try to find in documents array (primary method)
        doc = next((d for d in documents if str(d.get('id')) == str(doc_id)), None)
        
        if doc and doc.get('file_path'):
            file_path = doc['file_path']
            
            # Check if original file exists
            if os.path.exists(file_path):
                logger.info(f"Serving original file: {file_path}")
                return send_file(
                    file_path, 
                    as_attachment=True, 
                    download_name=doc.get('original_filename', doc.get('title', f'document_{doc_id}.pdf'))
                )
            else:
                logger.warning(f"Original file not found: {file_path}")
        
        # Try ChromaDB approach if available
        if CHROMA_ENABLED and chroma_service:
            try:
                doc_info = chroma_service.get_document_info(doc_id)
                if doc_info and doc_info.get('exists'):
                    # Try to find original file with various naming patterns
                    uploads_dir = os.path.join(os.path.dirname(__file__), '..', 'uploads')
                    
                    # Try different file patterns
                    possible_files = [
                        os.path.join(uploads_dir, f"doc_{doc_id}_*.pdf"),
                        os.path.join(uploads_dir, f"doc_{doc_id}_*.docx"),
                        os.path.join(uploads_dir, f"doc_{doc_id}_*"),
                        os.path.join(uploads_dir, f"{doc_id}.pdf"),
                        os.path.join(uploads_dir, f"{doc_id}.txt")
                    ]
                    
                    import glob
                    for pattern in possible_files:
                        matches = glob.glob(pattern)
                        if matches:
                            file_path = matches[0]  # Take first match
                            logger.info(f"Found file via pattern matching: {file_path}")
                            
                            # Get original filename from document info or use default
                            filename = os.path.basename(file_path)
                            if doc and doc.get('original_filename'):
                                filename = doc['original_filename']
                            
                            return send_file(
                                file_path,
                                as_attachment=True,
                                download_name=filename
                            )
            except Exception as e:
                logger.error(f"Error checking ChromaDB: {e}")
        
        # If nothing found, return 404
        logger.error(f"Document not found: {doc_id}")
        return jsonify({'error': '파일을 찾을 수 없습니다.'}), 404
        
    except Exception as e:
        logger.error(f"Download error for doc_id {doc_id}: {e}")
        return jsonify({'error': f'파일 다운로드 중 오류가 발생했습니다: {str(e)}'}), 500

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

@documents_bp.route('/api/documents/<int:doc_id>/preview')
def get_document_preview(doc_id):
    """Get document preview with text, images, and metadata"""
    try:
        # Find document
        doc = None
        for d in documents:
            if d.get('id') == doc_id:
                doc = d
                break
        
        if not doc:
            return jsonify({'error': 'Document not found'}), 404
        
        file_path = doc.get('file_path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'Document file not found'}), 404
        
        preview_data = {
            'text_content': '',
            'images': [],
            'metadata': {
                'document_id': doc_id,
                'file_name': doc.get('title', 'Unknown'),
                'file_size': os.path.getsize(file_path) if os.path.exists(file_path) else 0,
                'created_at': doc.get('created_at', datetime.now().isoformat()),
                'category_id': doc.get('category_id'),
                'status': doc.get('status', 'Unknown')
            }
        }
        
        # Extract text and images from PDF
        if file_path.lower().endswith('.pdf'):
            with open(file_path, 'rb') as file:
                # Extract text
                text_content = extract_text_from_pdf(file)
                if text_content:
                    preview_data['text_content'] = text_content
                    # Update metadata with text statistics
                    preview_data['metadata']['word_count'] = len(text_content.split())
                    preview_data['metadata']['line_count'] = len(text_content.split('\n'))
                    preview_data['metadata']['sentence_count'] = len([s for s in text_content.split('.') if s.strip()])
                
                # Extract images
                images = extract_images_from_pdf(file, doc_id)
                preview_data['images'] = images
                preview_data['metadata']['total_pages'] = len(images)
        
        # Add chunking information if available
        if CHROMA_ENABLED and chroma_service:
            try:
                doc_info = chroma_service.get_document_info(str(doc_id))
                if doc_info.get('exists'):
                    preview_data['metadata']['total_chunks'] = doc_info.get('chunk_count', 0)
                    preview_data['metadata']['total_tokens'] = doc_info.get('total_size', 0)
            except Exception as e:
                logger.warning(f"Failed to get chunk info for doc {doc_id}: {e}")
        
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