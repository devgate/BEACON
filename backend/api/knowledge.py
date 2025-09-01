"""
Knowledge Base API module for BEACON
Handles knowledge base management and operations
"""
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from datetime import datetime
import os
import time
import logging
import PyPDF2

logger = logging.getLogger(__name__)

# Create Blueprint
knowledge_bp = Blueprint('knowledge', __name__)

# Knowledge bases storage
knowledge_bases_storage = []

def init_knowledge_module(app_context):
    """Initialize knowledge module with app context"""
    global documents, chroma_service, DocumentChunker, generate_embeddings
    global RAG_ENABLED, CHROMA_ENABLED, rag_engine
    global app_config
    
    documents = app_context['documents']
    chroma_service = app_context.get('chroma_service')
    DocumentChunker = app_context.get('DocumentChunker')
    generate_embeddings = app_context['generate_embeddings']
    RAG_ENABLED = app_context['RAG_ENABLED']
    CHROMA_ENABLED = app_context['CHROMA_ENABLED']
    rag_engine = app_context['rag_engine']
    app_config = app_context['app_config']
    
    # Sync documents from ChromaDB on startup
    if CHROMA_ENABLED and chroma_service:
        from .documents import sync_documents_from_chroma
        try:
            sync_documents_from_chroma()
            logger.info("Initial sync from ChromaDB completed")
        except Exception as e:
            logger.error(f"Failed to sync documents on startup: {e}")

@knowledge_bp.route('/api/knowledge')
def get_knowledge_bases():
    """Get list of knowledge bases"""
    try:
        # Add document count for each knowledge base
        knowledge_bases_with_counts = []
        for kb in knowledge_bases_storage:
            kb_copy = kb.copy()
            kb_copy['document_count'] = len([d for d in documents if d.get('index_id') == kb['id']])
            knowledge_bases_with_counts.append(kb_copy)
        
        return jsonify({
            'success': True,
            'knowledge_bases': knowledge_bases_with_counts
        })
        
    except Exception as e:
        logger.error(f"Failed to get knowledge bases: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge', methods=['POST'])
def create_knowledge_base():
    """Create a new knowledge base"""
    try:
        data = request.json
        name = data.get('name')
        kb_id = data.get('id')
        description = data.get('description', '')
        
        if not name or not kb_id:
            return jsonify({'error': 'Name and ID are required'}), 400
        
        # Check if ID already exists
        if any(kb['id'] == kb_id for kb in knowledge_bases_storage):
            return jsonify({'error': 'Knowledge base ID already exists'}), 400
        
        # Validate ID format (prefix_name)
        import re
        pattern = r'^[a-zA-Z]+_[a-zA-Z0-9]+$'
        if not re.match(pattern, kb_id):
            return jsonify({'error': 'Index ID must follow the pattern prefix_name (e.g., manual_collection)'}), 400
        
        new_kb = {
            'id': kb_id,
            'name': name,
            'description': description,
            'status': 'active',
            'created_at': datetime.now().isoformat()
        }
        
        # Create ChromaDB collection for this knowledge base
        if CHROMA_ENABLED and chroma_service:
            success = chroma_service.create_collection_for_kb(kb_id)
            if success:
                logger.info(f"ChromaDB collection created for KB: {kb_id}")
                new_kb['chroma_collection'] = kb_id
            else:
                logger.warning(f"Failed to create ChromaDB collection for KB: {kb_id}")
        
        knowledge_bases_storage.append(new_kb)
        
        return jsonify({
            'success': True,
            'knowledge_base': new_kb
        })
        
    except Exception as e:
        logger.error(f"Failed to create knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge/<index_id>', methods=['PUT'])
def update_knowledge_base(index_id):
    """Update an existing knowledge base"""
    try:
        data = request.json
        
        # Find the knowledge base
        kb_index = next((i for i, kb in enumerate(knowledge_bases_storage) if kb['id'] == index_id), None)
        
        if kb_index is None:
            return jsonify({'error': 'Knowledge base not found'}), 404
        
        # Update fields
        if 'name' in data:
            knowledge_bases_storage[kb_index]['name'] = data['name']
        if 'description' in data:
            knowledge_bases_storage[kb_index]['description'] = data['description']
        if 'status' in data:
            knowledge_bases_storage[kb_index]['status'] = data['status']
        
        knowledge_bases_storage[kb_index]['updated_at'] = datetime.now().isoformat()
        
        return jsonify({
            'success': True,
            'knowledge_base': knowledge_bases_storage[kb_index]
        })
        
    except Exception as e:
        logger.error(f"Failed to update knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge-bases/<index_id>/documents')
def get_knowledge_base_documents(index_id):
    """Get documents belonging to a specific knowledge base"""
    try:
        # Filter documents by knowledge base ID
        kb_documents = [
            doc for doc in documents 
            if str(doc.get('knowledge_base_id')) == str(index_id)
        ]
        
        return jsonify({
            'success': True,
            'documents': kb_documents,
            'count': len(kb_documents)
        })
        
    except Exception as e:
        logger.error(f"Failed to get knowledge base documents: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge/<index_id>', methods=['DELETE'])
def delete_knowledge_base(index_id):
    """Delete a knowledge base"""
    try:
        # Check if there are documents in this knowledge base
        kb_documents = [d for d in documents if d.get('index_id') == index_id]
        if kb_documents:
            # Delete all documents from ChromaDB if they exist
            if CHROMA_ENABLED and chroma_service:
                for doc in kb_documents:
                    doc_id = f"kb_{index_id}_doc_{doc['id']}"
                    try:
                        chroma_service.delete_document(doc_id)
                        logger.info(f"Deleted document {doc_id} from ChromaDB")
                    except Exception as e:
                        logger.warning(f"Could not delete document {doc_id}: {e}")
            
            # Remove documents from memory
            documents[:] = [d for d in documents if d.get('index_id') != index_id]
        
        # Find and remove the knowledge base
        kb_index = next((i for i, kb in enumerate(knowledge_bases_storage) if kb['id'] == index_id), None)
        
        if kb_index is None:
            return jsonify({'error': 'Knowledge base not found'}), 404
        
        deleted_kb = knowledge_bases_storage.pop(kb_index)
        
        # Delete ChromaDB collection for this knowledge base
        if CHROMA_ENABLED and chroma_service:
            success = chroma_service.delete_collection_for_kb(index_id)
            if success:
                logger.info(f"ChromaDB collection deleted for KB: {index_id}")
            else:
                logger.warning(f"Failed to delete ChromaDB collection for KB: {index_id}")
        
        return jsonify({
            'success': True,
            'deleted': deleted_kb
        })
        
    except Exception as e:
        logger.error(f"Failed to delete knowledge base: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge/<index_id>/documents')
def get_kb_documents(index_id):
    """Get documents for a specific knowledge base"""
    try:
        # Filter documents by index_id
        kb_documents = [d for d in documents if d.get('index_id') == index_id]
        
        # Format documents for frontend
        formatted_docs = []
        for doc in kb_documents:
            formatted_docs.append({
                'id': doc['id'],
                'file_name': doc['title'],
                'file_size': doc.get('file_size', 0),
                'uploaded_at': doc.get('uploaded_at', datetime.now().isoformat()),
                'status': doc.get('status', 'Completed'),
                'chunk_count': doc.get('chunk_count', 1),
                'index_id': index_id
            })
        
        return jsonify({
            'success': True,
            'documents': formatted_docs,
            'total': len(formatted_docs)
        })
        
    except Exception as e:
        logger.error(f"Failed to get documents for knowledge base {index_id}: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge/upload', methods=['POST'])
def upload_to_knowledge_base():
    """Upload file to specific knowledge base"""
    if 'file' not in request.files:
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
    
    file = request.files['file']
    index_id = request.form.get('index_id')
    
    if file.filename == '':
        return jsonify({'error': '파일이 선택되지 않았습니다.'}), 400
        
    if not index_id:
        return jsonify({'error': 'Knowledge base ID가 필요합니다.'}), 400
    
    try:
        # Secure filename
        filename = secure_filename(file.filename)
        
        # Create unique filename
        timestamp = str(int(time.time()))
        unique_filename = f"{timestamp}_{filename}"
        
        # Ensure upload directory exists
        os.makedirs(app_config['UPLOAD_FOLDER'], exist_ok=True)
        
        # Save file
        file_path = os.path.join(app_config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Get file size
        file_size = os.path.getsize(file_path)
        
        # Process file content
        content = ""
        try:
            if filename.lower().endswith('.pdf'):
                # PDF processing
                with open(file_path, 'rb') as pdf_file:
                    pdf_reader = PyPDF2.PdfReader(pdf_file)
                    for page in pdf_reader.pages:
                        content += page.extract_text() + "\n"
            elif filename.lower().endswith(('.txt', '.md')):
                # Text file processing
                with open(file_path, 'r', encoding='utf-8') as txt_file:
                    content = txt_file.read()
            else:
                content = f"File: {filename} (Content not extracted)"
                
        except Exception as e:
            logger.warning(f"Could not extract content from {filename}: {e}")
            content = f"File: {filename} (Content extraction failed)"
        
        # Create document record
        new_doc = {
            'id': len(documents) + 1,
            'title': filename,
            'content': content[:1000] + ('...' if len(content) > 1000 else ''),
            'file_path': file_path,
            'file_size': file_size,
            'uploaded_at': datetime.now().isoformat(),
            'index_id': index_id,
            'status': 'Pending',
            'chunk_count': max(1, len(content) // 1000)  # Estimate chunks
        }
        
        documents.append(new_doc)
        
        # Update status to Processing
        new_doc['status'] = 'Processing'
        
        # Process with ChromaDB or RAG
        chunks_added = 0
        try:
            if CHROMA_ENABLED and chroma_service and content.strip():
                chunks_added = _process_with_chroma_kb(
                    content, filename, new_doc['id'], index_id,
                    request.form, file_path
                )
            elif RAG_ENABLED and content.strip():
                chunks_added = _process_with_rag_kb(
                    content, filename, new_doc, index_id, file_path
                )
            
            # Update status to Completed on success
            new_doc['status'] = 'Completed'
        except Exception as e:
            # Update status to Failed on error
            new_doc['status'] = 'Failed'
            logger.error(f"Document processing failed: {e}")
        
        logger.info(f"File uploaded: {filename} (ID: {new_doc['id']}, Index: {index_id})")
        
        return jsonify({
            'success': True,
            'message': f'파일 "{filename}"이 성공적으로 업로드되었습니다.',
            'document_id': new_doc['id'],
            'chunks_added': chunks_added,
            'document': {
                'id': new_doc['id'],
                'file_name': new_doc['title'],
                'file_size': new_doc['file_size'],
                'uploaded_at': new_doc['uploaded_at'],
                'status': new_doc['status'],
                'chunk_count': new_doc['chunk_count'],
                'index_id': index_id
            }
        })
        
    except Exception as e:
        logger.error(f"File upload error: {e}")
        return jsonify({'error': f'파일 업로드 중 오류가 발생했습니다: {str(e)}'}), 500

def _process_with_chroma_kb(content, filename, doc_id, index_id, form_data, file_path):
    """Process document with ChromaDB for knowledge base"""
    try:
        logger.info("=== RAG 준비단계 시작 ===")
        logger.info("1. ✅ 파일 업로드 완료")
        logger.info("2. ✅ 텍스트 추출 완료 - %d 문자 추출", len(content))
        
        # Get processing parameters
        chunk_strategy = form_data.get('chunking_strategy', 'sentence')
        chunk_size = int(form_data.get('chunk_size', 1000))
        chunk_overlap = int(form_data.get('chunk_overlap', 100))
        
        logger.info("3. 🔄 청크 분할 시작 - 전략: %s, 크기: %d", chunk_strategy, chunk_size)
        
        # Generate chunks
        if DocumentChunker:
            if chunk_strategy == 'sentence':
                chunks = DocumentChunker.chunk_by_sentences(
                    content, max_chunk_size=chunk_size, overlap=chunk_overlap
                )
            elif chunk_strategy == 'paragraph':
                chunks = DocumentChunker.chunk_by_paragraphs(
                    content, max_chunk_size=chunk_size
                )
            elif chunk_strategy == 'token':
                chunks = DocumentChunker.chunk_by_tokens(
                    content, max_tokens=chunk_size//4, overlap_tokens=chunk_overlap//4
                )
            else:
                chunks = DocumentChunker.chunk_by_sentences(content, chunk_size, chunk_overlap)
        else:
            # Simple fallback chunking
            words = content.split()
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
        
        logger.info("3. ✅ 청크 분할 완료 - %d개 청크 생성", len(chunks))
        
        # Generate embeddings
        logger.info("4. 🔄 Bedrock 임베딩 생성 시작 - %d개 청크", len(chunks))
        embeddings = generate_embeddings(chunks)
        logger.info("4. ✅ Bedrock 임베딩 생성 완료")
        
        # Store in specific knowledge base collection
        logger.info("5. 🔄 ChromaDB 저장 시작 - Collection: %s", index_id)
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
                'original_filename': filename,
                'file_path': file_path,
                'uploaded_at': datetime.now().isoformat()
            }
        )
        
        if success:
            chunks_added = len(chunks)
            logger.info("5. ✅ ChromaDB 저장 완료 - %d개 청크 저장", chunks_added)
            logger.info("=== RAG 준비단계 완료 ===")
            return chunks_added
        else:
            logger.error("5. ❌ ChromaDB 저장 실패")
            logger.error("=== RAG 준비단계 실패 ===")
            return 0
            
    except Exception as e:
        logger.error(f"Failed to add document to ChromaDB: {e}")
        
        # Fallback to legacy RAG
        return _process_with_rag_kb(content, filename, {'id': doc_id}, index_id, file_path)

def _process_with_rag_kb(content, filename, doc_info, index_id, file_path):
    """Process document with legacy RAG for knowledge base"""
    try:
        chunks_added = rag_engine.add_document(
            doc_id=str(doc_info['id']),
            content=content,
            metadata={
                'title': filename,
                'file_path': file_path,
                'index_id': index_id,
                'uploaded_at': doc_info.get('uploaded_at', datetime.now().isoformat())
            }
        )
        logger.info(f"Added {chunks_added} chunks to legacy RAG system")
        return chunks_added
    except Exception as e:
        logger.error(f"Failed to add document to legacy RAG: {e}")
        return 0

@knowledge_bp.route('/api/knowledge/<index_id>/reprocess-chunks', methods=['POST'])
def reprocess_knowledge_base_chunks(index_id):
    """
    Reprocess all documents in a knowledge base with new chunking strategy
    """
    try:
        data = request.json
        chunk_strategy = data.get('chunk_strategy', 'sentence')
        chunk_size = int(data.get('chunk_size', 512))
        chunk_overlap = int(data.get('chunk_overlap', 50))
        
        logger.info(f"Starting reprocess for KB {index_id} with strategy: {chunk_strategy}, size: {chunk_size}, overlap: {chunk_overlap}")
        
        # Get all documents in this knowledge base (check both index_id and knowledge_base_id)
        kb_documents = [d for d in documents if (d.get('index_id') == index_id or d.get('knowledge_base_id') == index_id)]
        
        # Log for debugging
        logger.info(f"Found {len(kb_documents)} documents for KB {index_id}")
        logger.info(f"Total documents in memory: {len(documents)}")
        if documents:
            logger.info(f"Sample document keys: {list(documents[0].keys())}")
            logger.info(f"Sample document index_id: {documents[0].get('index_id')}")
            logger.info(f"Sample document knowledge_base_id: {documents[0].get('knowledge_base_id')}")
        
        # If no documents found in memory, try to sync from ChromaDB
        if not kb_documents and CHROMA_ENABLED and chroma_service:
            logger.info(f"No documents found in memory for KB {index_id}, trying to sync from ChromaDB")
            try:
                # Sync documents from ChromaDB for this knowledge base
                synced_docs = chroma_service.sync_documents_for_kb(index_id)
                if synced_docs:
                    documents.extend(synced_docs)
                    kb_documents = [d for d in documents if (d.get('index_id') == index_id or d.get('knowledge_base_id') == index_id)]
                    logger.info(f"Synced {len(synced_docs)} documents from ChromaDB")
            except Exception as sync_error:
                logger.warning(f"Failed to sync documents from ChromaDB: {sync_error}")
        
        if not kb_documents:
            return jsonify({'error': 'No documents found in knowledge base'}), 404
        
        # First, extract content from all documents BEFORE clearing ChromaDB
        logger.info(f"Extracting content from {len(kb_documents)} documents before clearing ChromaDB")
        documents_with_content = []
        
        for doc in kb_documents:
            file_path = doc.get('file_path')
            content = ""
            
            # Try to get content from file first
            if file_path and os.path.exists(file_path):
                try:
                    if file_path.lower().endswith('.pdf'):
                        with open(file_path, 'rb') as pdf_file:
                            pdf_reader = PyPDF2.PdfReader(pdf_file)
                            for page in pdf_reader.pages:
                                content += page.extract_text() + "\n"
                    elif file_path.lower().endswith(('.txt', '.md')):
                        with open(file_path, 'r', encoding='utf-8') as txt_file:
                            content = txt_file.read()
                    logger.info(f"Extracted {len(content)} characters from file for document {doc['id']}")
                except Exception as file_error:
                    logger.warning(f"Failed to extract from file {file_path}: {file_error}")
            
            # If file extraction failed, try ChromaDB BEFORE clearing
            if not content.strip() and CHROMA_ENABLED and chroma_service:
                try:
                    content = chroma_service.extract_document_content(index_id, doc['id'])
                    if content.strip():
                        logger.info(f"Extracted {len(content)} characters from ChromaDB for document {doc['id']}")
                        # Also get and update metadata
                        chromadb_metadata = chroma_service.get_document_metadata(index_id, doc['id'])
                        if chromadb_metadata:
                            doc.update(chromadb_metadata)
                except Exception as extract_error:
                    logger.warning(f"Failed to extract content from ChromaDB for document {doc['id']}: {extract_error}")
            
            # Store document with its content for later processing
            doc_with_content = doc.copy()
            doc_with_content['extracted_content'] = content
            documents_with_content.append(doc_with_content)
            
            if not content.strip():
                logger.warning(f"No content found for document {doc['id']} - will be marked as failed")
        
        # Now clear the ChromaDB collection for this knowledge base
        if CHROMA_ENABLED and chroma_service:
            logger.info(f"Clearing ChromaDB collection for KB: {index_id}")
            try:
                # Try to delete and recreate the collection
                if hasattr(chroma_service, 'delete_collection_for_kb'):
                    chroma_service.delete_collection_for_kb(index_id)
                    chroma_service.create_collection_for_kb(index_id)
                    logger.info(f"Successfully cleared ChromaDB collection for KB: {index_id}")
                else:
                    # Fallback: Delete individual documents
                    logger.info(f"Using fallback method to clear documents for KB: {index_id}")
                    for doc in kb_documents:
                        document_id = f"kb_{index_id}_doc_{doc['id']}"
                        try:
                            if hasattr(chroma_service, 'delete_document'):
                                chroma_service.delete_document(document_id)
                            elif hasattr(chroma_service.collection, 'delete'):
                                chroma_service.collection.delete(ids=[document_id])
                            logger.debug(f"Deleted document {document_id} from ChromaDB")
                        except Exception as delete_error:
                            logger.warning(f"Could not delete document {document_id}: {delete_error}")
            except Exception as clear_error:
                logger.warning(f"Failed to clear ChromaDB collection for KB {index_id}: {clear_error}")
                # Continue with reprocessing even if clearing fails
        
        # Track processing results
        processed_count = 0
        failed_count = 0
        total_chunks = 0
        
        # Update all documents to reprocessing status with initial progress
        for doc_with_content in documents_with_content:
            doc_with_content['status'] = 'Reprocessing'
            doc_with_content['reprocessing_progress'] = 0
            doc_with_content['reprocessing_stage'] = 'Starting'
        
        # Process each document with new chunking strategy using pre-extracted content
        total_docs = len(documents_with_content)
        for idx, doc_with_content in enumerate(documents_with_content):
            doc = doc_with_content  # Work with the copy that has extracted_content
            try:
                # Stage 1: Content Extraction (0-25%) - Use pre-extracted content
                doc['reprocessing_progress'] = 0
                doc['reprocessing_stage'] = 'Extracting content'
                logger.info(f"Processing document {idx+1}/{total_docs}: {doc['title']} - Stage 1: Using pre-extracted content")
                
                # Use the content we extracted before clearing ChromaDB
                content = doc.get('extracted_content', '')
                
                if not content.strip():
                    logger.error(f"No pre-extracted content available for document {doc['id']}")
                    doc['status'] = 'Failed'
                    doc['reprocessing_stage'] = 'Failed - No content available'
                    doc['reprocessing_progress'] = 0
                    failed_count += 1
                    continue
                
                # Stage 1 Complete (25%)
                doc['reprocessing_progress'] = 25
                doc['reprocessing_stage'] = 'Content extracted'
                logger.info(f"Document {doc['id']}: Content extraction complete - {len(content)} characters")
                
                # Stage 2: Text Chunking (25-50%)
                doc['reprocessing_progress'] = 25
                doc['reprocessing_stage'] = 'Creating chunks'
                logger.info(f"Document {doc['id']}: Stage 2: Chunking with strategy: {chunk_strategy}")
                chunks = []
                
                # Strategy mapping to handle different naming conventions
                strategy_mapping = {
                    'sentence': 'sentence',
                    'by_sentence': 'sentence', 
                    'paragraph': 'paragraph',
                    'by_paragraph': 'paragraph',
                    'title': 'title',
                    'by_title': 'title',
                    'token': 'token',
                    'by_token': 'token',
                    'fixed': 'fixed',
                    'semantic': 'semantic',
                    'sliding': 'sliding'
                }
                
                normalized_strategy = strategy_mapping.get(chunk_strategy, 'sentence')
                logger.info(f"Normalized strategy: {normalized_strategy}")
                
                if DocumentChunker:
                    if normalized_strategy == 'sentence':
                        chunks = DocumentChunker.chunk_by_sentences(
                            content, max_chunk_size=chunk_size, overlap=chunk_overlap
                        )
                    elif normalized_strategy == 'paragraph':
                        chunks = DocumentChunker.chunk_by_paragraphs(
                            content, max_chunk_size=chunk_size
                        )
                    elif normalized_strategy == 'title':
                        chunks = DocumentChunker.chunk_by_title(
                            content, max_chunk_size=chunk_size, overlap=chunk_overlap
                        )
                    elif normalized_strategy == 'token':
                        chunks = DocumentChunker.chunk_by_tokens(
                            content, max_tokens=chunk_size//4, overlap_tokens=chunk_overlap//4
                        )
                    else:
                        logger.warning(f"Unknown strategy {normalized_strategy}, using sentence-based chunking")
                        chunks = DocumentChunker.chunk_by_sentences(content, chunk_size, chunk_overlap)
                else:
                    # Simple fallback chunking
                    words = content.split()
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
                
                # Stage 2 Complete (50%)
                doc['reprocessing_progress'] = 50
                doc['reprocessing_stage'] = f'Chunks created ({len(chunks)})'
                logger.info(f"Document {doc['id']}: Generated {len(chunks)} chunks")
                
                # Stage 3: Embedding Generation (50-75%)
                doc['reprocessing_progress'] = 50
                doc['reprocessing_stage'] = 'Generating embeddings'
                logger.info(f"Document {doc['id']}: Stage 3: Generating embeddings for {len(chunks)} chunks")
                
                embeddings = generate_embeddings(chunks)
                
                # Stage 3 Complete (75%)
                doc['reprocessing_progress'] = 75
                doc['reprocessing_stage'] = 'Embeddings generated'
                logger.info(f"Document {doc['id']}: Embedding generation complete")
                
                # Stage 4: ChromaDB Storage (75-100%)
                doc['reprocessing_progress'] = 75
                doc['reprocessing_stage'] = 'Storing in database'
                logger.info(f"Document {doc['id']}: Stage 4: Storing in ChromaDB")
                
                # Store in ChromaDB
                if CHROMA_ENABLED and chroma_service:
                    document_id = f"kb_{index_id}_doc_{doc['id']}"
                    success = chroma_service.add_document_to_kb(
                        chunks=chunks,
                        embeddings=embeddings,
                        document_id=document_id,
                        document_name=doc['title'],
                        index_id=index_id,
                        metadata={
                            'chunk_strategy': chunk_strategy,
                            'chunk_size': chunk_size,
                            'chunk_overlap': chunk_overlap,
                            'reprocessed_at': datetime.now().isoformat(),
                            'original_filename': doc['title'],
                            'file_path': doc.get('file_path')
                        }
                    )
                    
                    if success:
                        # Stage 4 Complete (100%)
                        doc['status'] = 'Completed'
                        doc['reprocessing_progress'] = 100
                        doc['reprocessing_stage'] = 'Complete'
                        doc['chunk_count'] = len(chunks)
                        doc['chunk_strategy'] = chunk_strategy
                        doc['chunk_size'] = chunk_size
                        doc['chunk_overlap'] = chunk_overlap
                        doc['last_reprocessed'] = datetime.now().isoformat()
                        processed_count += 1
                        total_chunks += len(chunks)
                        logger.info(f"Document {doc['id']}: Reprocessing complete - {len(chunks)} chunks stored")
                    else:
                        doc['status'] = 'Failed'
                        doc['reprocessing_stage'] = 'Failed - Storage error'
                        doc['reprocessing_progress'] = 75
                        failed_count += 1
                        logger.error(f"Document {doc['id']}: Failed to store in ChromaDB")
                else:
                    # Fallback to legacy RAG if ChromaDB not available
                    chunks_added = _process_with_rag_kb(
                        content, doc['title'], doc, index_id, doc.get('file_path')
                    )
                    if chunks_added > 0:
                        doc['status'] = 'Completed'
                        doc['reprocessing_progress'] = 100
                        doc['reprocessing_stage'] = 'Complete (Legacy RAG)'
                        doc['chunk_count'] = chunks_added
                        processed_count += 1
                        total_chunks += chunks_added
                        logger.info(f"Document {doc['id']}: Legacy RAG processing complete - {chunks_added} chunks")
                    else:
                        doc['status'] = 'Failed'
                        doc['reprocessing_stage'] = 'Failed - Legacy RAG error'
                        doc['reprocessing_progress'] = 75
                        failed_count += 1
                        logger.error(f"Document {doc['id']}: Failed to process with legacy RAG")
                
            except Exception as e:
                logger.error(f"Failed to reprocess document {doc['id']}: {e}")
                doc['status'] = 'Failed'
                doc['reprocessing_stage'] = f'Failed - {str(e)[:50]}'
                doc['reprocessing_progress'] = 0
                failed_count += 1
        
        logger.info(f"Reprocessing complete for KB {index_id}: {processed_count} success, {failed_count} failed, {total_chunks} total chunks")
        
        return jsonify({
            'success': True,
            'message': f'Reprocessed {processed_count} documents successfully',
            'processed_count': processed_count,
            'failed_count': failed_count,
            'total_documents': total_docs,
            'total_chunks': total_chunks,
            'chunk_strategy': chunk_strategy,
            'chunk_size': chunk_size,
            'chunk_overlap': chunk_overlap,
            'reprocessing_complete': True,
            'documents': [{
                'id': doc['id'],
                'title': doc['title'],
                'status': doc['status'],
                'chunk_count': doc.get('chunk_count', 0),
                'reprocessing_progress': doc.get('reprocessing_progress', 0),
                'reprocessing_stage': doc.get('reprocessing_stage', 'Unknown'),
                'last_reprocessed': doc.get('last_reprocessed'),
                'chunk_strategy': doc.get('chunk_strategy', chunk_strategy),
                'chunk_size': doc.get('chunk_size', chunk_size),
                'chunk_overlap': doc.get('chunk_overlap', chunk_overlap)
            } for doc in documents_with_content]
        })
        
    except Exception as e:
        logger.error(f"Failed to reprocess knowledge base {index_id}: {e}")
        return jsonify({'error': str(e)}), 500

@knowledge_bp.route('/api/knowledge/<index_id>/reprocessing-status', methods=['GET'])
def get_reprocessing_status(index_id):
    """
    Get the current reprocessing status for a knowledge base
    Used for real-time polling during document reprocessing
    """
    try:
        # Get all documents in this knowledge base
        kb_documents = [d for d in documents if (d.get('index_id') == index_id or d.get('knowledge_base_id') == index_id)]
        
        if not kb_documents:
            return jsonify({'error': 'No documents found in knowledge base'}), 404
        
        # Calculate overall progress
        total_docs = len(kb_documents)
        completed_docs = len([d for d in kb_documents if d.get('status') == 'Completed'])
        failed_docs = len([d for d in kb_documents if d.get('status') == 'Failed'])
        processing_docs = len([d for d in kb_documents if d.get('status') == 'Reprocessing'])
        
        # Calculate average progress for reprocessing documents
        reprocessing_docs = [d for d in kb_documents if d.get('status') == 'Reprocessing']
        average_progress = 0
        if reprocessing_docs:
            total_progress = sum(d.get('reprocessing_progress', 0) for d in reprocessing_docs)
            average_progress = total_progress / len(reprocessing_docs)
        
        # Overall completion percentage
        overall_progress = ((completed_docs + failed_docs) / total_docs * 100) if total_docs > 0 else 0
        if processing_docs > 0:
            # Factor in the progress of currently processing documents
            overall_progress = ((completed_docs + failed_docs) / total_docs * 100) + (processing_docs / total_docs * average_progress)
        
        # Determine current status
        if completed_docs == total_docs:
            overall_status = 'Completed'
        elif failed_docs == total_docs:
            overall_status = 'Failed'
        elif processing_docs > 0:
            overall_status = 'Reprocessing'
        else:
            overall_status = 'Ready'
        
        return jsonify({
            'knowledge_base_id': index_id,
            'overall_status': overall_status,
            'overall_progress': round(overall_progress, 1),
            'total_documents': total_docs,
            'completed_documents': completed_docs,
            'failed_documents': failed_docs,
            'processing_documents': processing_docs,
            'average_processing_progress': round(average_progress, 1),
            'documents': [{
                'id': doc['id'],
                'title': doc['title'],
                'status': doc['status'],
                'reprocessing_progress': doc.get('reprocessing_progress', 0),
                'reprocessing_stage': doc.get('reprocessing_stage', 'Ready'),
                'chunk_count': doc.get('chunk_count', 0),
                'last_reprocessed': doc.get('last_reprocessed')
            } for doc in kb_documents],
            'timestamp': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to get reprocessing status for KB {index_id}: {e}")
        return jsonify({'error': str(e)}), 500