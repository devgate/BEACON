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
def get_knowledge_base_documents(index_id):
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
                'status': doc.get('status', 'Success'),
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
            'category_id': None,
            'index_id': index_id,
            'status': 'Success',
            'chunk_count': max(1, len(content) // 1000)  # Estimate chunks
        }
        
        documents.append(new_doc)
        
        # Process with ChromaDB or RAG
        chunks_added = 0
        if CHROMA_ENABLED and chroma_service and content.strip():
            chunks_added = _process_with_chroma_kb(
                content, filename, new_doc['id'], index_id,
                request.form, file_path
            )
        elif RAG_ENABLED and content.strip():
            chunks_added = _process_with_rag_kb(
                content, filename, new_doc, index_id, file_path
            )
        
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
                'category_id': doc_info.get('category_id'),
                'uploaded_at': doc_info.get('uploaded_at', datetime.now().isoformat())
            }
        )
        logger.info(f"Added {chunks_added} chunks to legacy RAG system")
        return chunks_added
    except Exception as e:
        logger.error(f"Failed to add document to legacy RAG: {e}")
        return 0