"""
Vision API Test Service for BEACON
Handles PDF image extraction and vision analysis using OpenAI GPT-4 Vision
"""

import os
import base64
import json
import logging
from typing import Dict, List, Any, Optional
from PIL import Image
import fitz  # PyMuPDF for PDF processing
import io
import requests
import uuid
from dataclasses import dataclass, asdict

# Set up logging
logger = logging.getLogger(__name__)

@dataclass
class Entity:
    id: str
    name: str
    type: str  # 'person', 'object', 'text', 'diagram', etc.
    description: str
    confidence: float
    bounding_box: Optional[Dict[str, float]] = None

@dataclass
class Relationship:
    source_entity_id: str
    target_entity_id: str
    relation_type: str  # 'contains', 'related_to', 'appears_in', etc.
    confidence: float
    description: str

@dataclass
class VisionAnalysisResult:
    entities: List[Entity]
    relationships: List[Relationship]
    context: str
    spatial_info: Dict[str, Any]

class VisionService:
    def __init__(self, openai_api_key: str = None, bedrock_region: str = "ap-northeast-2"):
        """
        Initialize Vision Service
        
        Args:
            openai_api_key: OpenAI API key for vision analysis
            bedrock_region: AWS Bedrock region (fallback option)
        """
        self.openai_api_key = openai_api_key or os.getenv('OPENAI_API_KEY')
        self.bedrock_region = bedrock_region
        
        if not self.openai_api_key:
            logger.warning("OpenAI API key not provided. Only PDF extraction will work.")
    
    def extract_images_from_pdf(self, pdf_path: str) -> List[Dict[str, Any]]:
        """
        Extract images from PDF file using PyMuPDF
        
        Args:
            pdf_path: Path to PDF file
            
        Returns:
            List of extracted images with metadata
        """
        try:
            doc = fitz.open(pdf_path)
            images = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                image_list = page.get_images()
                
                for img_index, img in enumerate(image_list):
                    try:
                        xref = img[0]
                        pix = fitz.Pixmap(doc, xref)
                        
                        # Convert to PIL Image
                        if pix.n - pix.alpha < 4:  # GRAY or RGB
                            img_data = pix.tobytes("png")
                            pil_image = Image.open(io.BytesIO(img_data))
                            
                            # Convert to base64
                            buffered = io.BytesIO()
                            pil_image.save(buffered, format="PNG")
                            img_base64 = base64.b64encode(buffered.getvalue()).decode()
                            
                            images.append({
                                'id': f"page_{page_num}_img_{img_index}",
                                'page_number': page_num + 1,
                                'image_index': img_index,
                                'base64': img_base64,
                                'format': 'PNG',
                                'size': pil_image.size,
                                'file_size': len(img_data)
                            })
                        
                        pix = None  # Release memory
                        
                    except Exception as e:
                        logger.warning(f"Failed to extract image {img_index} from page {page_num}: {e}")
                        continue
            
            doc.close()
            logger.info(f"Extracted {len(images)} images from PDF")
            return images
            
        except Exception as e:
            logger.error(f"Failed to extract images from PDF: {e}")
            return []
    
    def analyze_image_with_openai(self, image_base64: str, context_text: str = "") -> VisionAnalysisResult:
        """
        Analyze image using OpenAI GPT-4 Vision API
        
        Args:
            image_base64: Base64 encoded image
            context_text: Surrounding text context
            
        Returns:
            Vision analysis result
        """
        if not self.openai_api_key:
            raise ValueError("OpenAI API key is required for vision analysis")
        
        system_prompt = """
You are a helpful assistant that analyzes images for document processing purposes. Please analyze this image and extract key information in JSON format.

Return a JSON object with the following structure:
{
  "entities": [
    {
      "id": "unique_identifier",
      "name": "entity_name",
      "type": "entity_type", 
      "description": "detailed_description",
      "confidence": 0.8
    }
  ],
  "relationships": [
    {
      "source_entity_id": "source_id",
      "target_entity_id": "target_id", 
      "relation_type": "relationship_type",
      "confidence": 0.7,
      "description": "relationship_description"
    }
  ],
  "context": "overall_context_description",
  "spatial_info": {
    "layout": "layout_type",
    "regions": ["region1", "region2"]
  }
}

Entity types: text, diagram, chart, table, object, icon, logo, button, form, etc.
Relationship types: contains, points_to, related_to, appears_with, above, below, etc.
"""
        
        try:
            headers = {
                'Authorization': f'Bearer {self.openai_api_key}',
                'Content-Type': 'application/json'
            }
            
            payload = {
                "model": "gpt-4o",
                "messages": [
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text",
                                "text": f"이미지를 분석해주세요. 주변 텍스트 맥락: {context_text[:500]}" if context_text else "이미지를 분석해주세요."
                            },
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/png;base64,{image_base64}",
                                    "detail": "high"
                                }
                            }
                        ]
                    }
                ],
                "max_tokens": 2000,
                "temperature": 0.1
            }
            
            response = requests.post(
                "https://api.openai.com/v1/chat/completions",
                headers=headers,
                json=payload,
                timeout=30
            )
            
            # Debug: Log the full response
            logger.info(f"OpenAI API Status: {response.status_code}")
            logger.info(f"Response headers: {response.headers}")
            
            if response.status_code != 200:
                logger.error(f"OpenAI API error: {response.status_code}")
                logger.error(f"Error response: {response.text[:1000]}")  # First 1000 chars
                return self._create_empty_result()
            
            # Try to parse response as JSON
            try:
                result = response.json()
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse response as JSON: {e}")
                logger.error(f"Raw response: {response.text[:1000]}")
                return self._create_empty_result()
            
            # Extract content from OpenAI response
            if 'choices' not in result or len(result['choices']) == 0:
                logger.error(f"Invalid OpenAI response structure: {result}")
                return self._create_empty_result()
                
            content = result['choices'][0]['message']['content']
            logger.info(f"OpenAI content preview: {content[:200]}...")
            
            # Check if OpenAI refused to analyze the image
            if "I'm sorry" in content or "I can't" in content or "cannot" in content:
                logger.warning(f"OpenAI refused to analyze image: {content}")
                # Return a generic result for refused images
                return VisionAnalysisResult(
                    entities=[
                        Entity(
                            id="generic_content",
                            name="Document Content",
                            type="text",
                            description="Content that could not be analyzed due to policy restrictions",
                            confidence=0.5
                        )
                    ],
                    relationships=[],
                    context="Image analysis was restricted by content policy",
                    spatial_info={"layout": "unknown", "regions": []}
                )
            
            # Parse JSON response from content
            try:
                # Clean up the content in case it has markdown formatting
                content_cleaned = content.strip()
                if content_cleaned.startswith('```json'):
                    content_cleaned = content_cleaned[7:]
                if content_cleaned.endswith('```'):
                    content_cleaned = content_cleaned[:-3]
                content_cleaned = content_cleaned.strip()
                
                analysis_data = json.loads(content_cleaned)
                return self._parse_analysis_result(analysis_data)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse OpenAI response as JSON: {e}")
                logger.error(f"Raw content: {content}")
                # Try to create a basic result from the text content
                return VisionAnalysisResult(
                    entities=[
                        Entity(
                            id="text_content",
                            name="Text Content",
                            type="text", 
                            description=content[:200] + "..." if len(content) > 200 else content,
                            confidence=0.3
                        )
                    ],
                    relationships=[],
                    context=f"Unable to parse structured response: {content[:100]}...",
                    spatial_info={"layout": "text", "regions": ["main"]}
                )
                
        except Exception as e:
            logger.error(f"OpenAI vision analysis failed: {e}")
            return self._create_empty_result()
    
    def _parse_analysis_result(self, data: Dict[str, Any]) -> VisionAnalysisResult:
        """Parse analysis result from API response"""
        try:
            # Parse entities
            entities = []
            for entity_data in data.get('entities', []):
                entity = Entity(
                    id=entity_data.get('id', str(uuid.uuid4())),
                    name=entity_data.get('name', ''),
                    type=entity_data.get('type', 'unknown'),
                    description=entity_data.get('description', ''),
                    confidence=float(entity_data.get('confidence', 0.5))
                )
                entities.append(entity)
            
            # Parse relationships
            relationships = []
            for rel_data in data.get('relationships', []):
                relationship = Relationship(
                    source_entity_id=rel_data.get('source_entity_id', ''),
                    target_entity_id=rel_data.get('target_entity_id', ''),
                    relation_type=rel_data.get('relation_type', 'related_to'),
                    confidence=float(rel_data.get('confidence', 0.5)),
                    description=rel_data.get('description', '')
                )
                relationships.append(relationship)
            
            return VisionAnalysisResult(
                entities=entities,
                relationships=relationships,
                context=data.get('context', ''),
                spatial_info=data.get('spatial_info', {})
            )
            
        except Exception as e:
            logger.error(f"Failed to parse analysis result: {e}")
            return self._create_empty_result()
    
    def _create_empty_result(self) -> VisionAnalysisResult:
        """Create empty analysis result"""
        return VisionAnalysisResult(
            entities=[],
            relationships=[],
            context="분석 실패",
            spatial_info={}
        )
    
    def process_pdf_with_vision(self, pdf_path: str, max_images: int = 3) -> Dict[str, Any]:
        """
        Process entire PDF with vision analysis
        
        Args:
            pdf_path: Path to PDF file
            max_images: Maximum number of images to analyze (for performance)
            
        Returns:
            Combined analysis results
        """
        try:
            # Extract text context (simplified - you might want to use existing text extraction)
            doc = fitz.open(pdf_path)
            text_context = ""
            for page in doc:
                text_context += page.get_text() + "\n"
            doc.close()
            
            # Extract images
            images = self.extract_images_from_pdf(pdf_path)
            
            # Limit images for performance
            images_to_analyze = images[:max_images]
            if len(images) > max_images:
                logger.info(f"Limiting analysis to first {max_images} images out of {len(images)} total")
            
            # Analyze each image
            analysis_results = []
            all_entities = []
            all_relationships = []
            
            for i, img_data in enumerate(images_to_analyze):
                logger.info(f"Analyzing image {img_data['id']} ({i+1}/{len(images_to_analyze)})")
                
                # Get relevant text context (simplified - get text from same page)
                page_context = text_context  # In real implementation, extract per-page context
                
                # Analyze image
                analysis = self.analyze_image_with_openai(
                    img_data['base64'],
                    page_context[:1000]  # Limit context size
                )
                
                # Store results
                img_result = {
                    'image_id': img_data['id'],
                    'page_number': img_data['page_number'],
                    'analysis': asdict(analysis),
                    'image_metadata': {k: v for k, v in img_data.items() if k != 'base64'}  # Exclude base64 from result
                }
                analysis_results.append(img_result)
                
                # Aggregate entities and relationships
                all_entities.extend(analysis.entities)
                all_relationships.extend(analysis.relationships)
            
            # Build graph structure
            graph_data = self._build_graph_structure(all_entities, all_relationships, text_context)
            
            return {
                'pdf_path': pdf_path,
                'total_images': len(images),
                'text_length': len(text_context),
                'image_analyses': analysis_results,
                'graph_data': graph_data,
                'summary': {
                    'total_entities': len(all_entities),
                    'total_relationships': len(all_relationships),
                    'entity_types': list(set(entity.type for entity in all_entities)),
                    'relation_types': list(set(rel.relation_type for rel in all_relationships))
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to process PDF with vision: {e}")
            return {
                'error': str(e),
                'pdf_path': pdf_path
            }
    
    def _build_graph_structure(self, entities: List[Entity], relationships: List[Relationship], text_context: str) -> Dict[str, Any]:
        """Build graph structure from entities and relationships"""
        
        # Create nodes (entities)
        nodes = []
        for entity in entities:
            nodes.append({
                'id': entity.id,
                'label': entity.name,
                'type': entity.type,
                'description': entity.description,
                'confidence': entity.confidence,
                'source': 'vision'
            })
        
        # Add text-based entities (simplified)
        # In a real implementation, you'd extract entities from text using NER
        text_entity = {
            'id': 'text_content',
            'label': 'Document Text',
            'type': 'text',
            'description': text_context[:200] + "..." if len(text_context) > 200 else text_context,
            'confidence': 1.0,
            'source': 'text'
        }
        nodes.append(text_entity)
        
        # Create edges (relationships)
        edges = []
        for rel in relationships:
            edges.append({
                'source': rel.source_entity_id,
                'target': rel.target_entity_id,
                'type': rel.relation_type,
                'description': rel.description,
                'confidence': rel.confidence
            })
        
        return {
            'nodes': nodes,
            'edges': edges,
            'metadata': {
                'created_at': str(uuid.uuid4()),
                'node_count': len(nodes),
                'edge_count': len(edges)
            }
        }


# Test function
def test_vision_service():
    """Test the vision service with sample data"""
    service = VisionService()
    
    # Test with a sample PDF (you need to provide an actual PDF file)
    test_pdf = "/app/uploads/test.pdf"
    
    if os.path.exists(test_pdf):
        result = service.process_pdf_with_vision(test_pdf)
        print(json.dumps(result, indent=2, default=str))
    else:
        print("Test PDF not found. Please upload a PDF file to /app/uploads/test.pdf")


if __name__ == "__main__":
    test_vision_service()