"""
AWS Bedrock Service Integration for BEACON
Handles model management, invocation, and access control
"""

import boto3
import json
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum
import logging
from botocore.exceptions import ClientError

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class ModelProvider(Enum):
    """Supported Bedrock model providers"""
    ANTHROPIC = "anthropic"
    AI21 = "ai21"
    AMAZON = "amazon"
    COHERE = "cohere"
    META = "meta"
    MISTRAL = "mistral"
    STABILITY = "stability"


@dataclass
class BedrockModel:
    """Data class representing a Bedrock foundation model"""
    model_id: str
    provider: ModelProvider
    name: str
    description: str
    input_modalities: List[str]
    output_modalities: List[str]
    max_tokens: int
    supports_streaming: bool
    supports_system_prompt: bool
    cost_per_1k_input_tokens: float
    cost_per_1k_output_tokens: float
    status: str = "ACTIVE"
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization"""
        result = asdict(self)
        result['provider'] = self.provider.value
        return result


class BedrockService:
    """
    Service class for interacting with AWS Bedrock
    Manages model access, invocation, and response handling
    """
    
    # Model pricing information (as of 2024)
    MODEL_PRICING = {
        "anthropic.claude-3-opus": {"input": 0.015, "output": 0.075},
        "anthropic.claude-3-sonnet": {"input": 0.003, "output": 0.015},
        "anthropic.claude-3-haiku": {"input": 0.00025, "output": 0.00125},
        "anthropic.claude-v2:1": {"input": 0.008, "output": 0.024},
        "anthropic.claude-v2": {"input": 0.008, "output": 0.024},
        "anthropic.claude-instant-v1": {"input": 0.0008, "output": 0.0024},
        "amazon.titan-text-express-v1": {"input": 0.0008, "output": 0.0016},
        "amazon.titan-text-lite-v1": {"input": 0.0003, "output": 0.0004},
        "amazon.titan-embed-text-v1": {"input": 0.0001, "output": 0},
        "meta.llama3-70b-instruct-v1": {"input": 0.00265, "output": 0.0035},
        "meta.llama3-8b-instruct-v1": {"input": 0.0004, "output": 0.0006},
        "meta.llama2-70b-chat-v1": {"input": 0.00195, "output": 0.00256},
        "meta.llama2-13b-chat-v1": {"input": 0.00075, "output": 0.001},
        "mistral.mistral-7b-instruct-v0:2": {"input": 0.00015, "output": 0.0002},
        "mistral.mixtral-8x7b-instruct-v0:1": {"input": 0.00045, "output": 0.0007},
    }
    
    def __init__(self, region_name: str = 'ap-northeast-2', 
                 profile_name: Optional[str] = None):
        """
        Initialize Bedrock service
        
        Args:
            region_name: AWS region for Bedrock
            profile_name: Optional AWS profile name
        """
        session_kwargs = {'region_name': region_name}
        if profile_name:
            session_kwargs['profile_name'] = profile_name
            logger.info(f"Creating session with profile: {profile_name}")
        else:
            logger.info("Creating session without profile (using environment variables)")
            
        session = boto3.Session(**session_kwargs)
        
        self.bedrock_client = session.client(
            service_name='bedrock',
            region_name=region_name
        )
        self.bedrock_runtime = session.client(
            service_name='bedrock-runtime',
            region_name=region_name
        )
        
        self.available_models: List[BedrockModel] = []
        self.region = region_name
        self._refresh_available_models()
    
    def _refresh_available_models(self) -> None:
        """
        Fetch and filter models with active access permissions
        Only returns models that the account has been granted access to
        """
        try:
            # List all foundation models
            response = self.bedrock_client.list_foundation_models()
            
            for model_summary in response.get('modelSummaries', []):
                model_id = model_summary['modelId']
                
                # Check if we have access to this model
                if self._check_model_access(model_id):
                    model = self._parse_model_info(model_summary)
                    if model:
                        self.available_models.append(model)
                        logger.info(f"Model available: {model_id}")
                else:
                    logger.debug(f"No access to model: {model_id}")
                    
        except ClientError as e:
            logger.error(f"Error fetching Bedrock models: {e}")
            raise
    
    def _check_model_access(self, model_id: str) -> bool:
        """
        Check if the current account has access to a specific model
        
        Args:
            model_id: The model identifier
            
        Returns:
            Boolean indicating if access is granted
        """
        try:
            # Try to get model details - this will fail if no access
            response = self.bedrock_client.get_foundation_model(
                modelIdentifier=model_id
            )
            return response.get('modelDetails', {}).get('modelLifecycle', {}).get('status') == 'ACTIVE'
        except ClientError as e:
            if e.response['Error']['Code'] == 'AccessDeniedException':
                return False
            # For other errors, log but don't fail
            logger.warning(f"Error checking access for {model_id}: {e}")
            return False
    
    def _get_inference_profiles(self) -> List[BedrockModel]:
        """
        Get cross-region inference profiles for models
        
        Returns:
            List of BedrockModel instances for inference profiles
        """
        inference_profiles = []
        
        # APAC inference profiles (system-defined profiles available in ap-northeast-2)
        apac_inference_profiles = [
            {
                "profile_id": "apac.anthropic.claude-3-sonnet-20240229-v1:0",
                "base_model": "anthropic.claude-3-sonnet-20240229-v1:0",
                "name": "Claude 3 Sonnet (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 4096,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.003, "output": 0.015}
            },
            {
                "profile_id": "apac.anthropic.claude-3-5-sonnet-20240620-v1:0",
                "base_model": "anthropic.claude-3-5-sonnet-20240620-v1:0",
                "name": "Claude 3.5 Sonnet (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 8192,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.003, "output": 0.015}
            },
            {
                "profile_id": "apac.anthropic.claude-3-haiku-20240307-v1:0",
                "base_model": "anthropic.claude-3-haiku-20240307-v1:0",
                "name": "Claude 3 Haiku (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 4096,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.00025, "output": 0.00125}
            },
            {
                "profile_id": "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
                "base_model": "anthropic.claude-3-5-sonnet-20241022-v2:0",
                "name": "Claude 3.5 Sonnet v2 (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 8192,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.003, "output": 0.015}
            },
            {
                "profile_id": "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",
                "base_model": "anthropic.claude-3-7-sonnet-20250219-v1:0",
                "name": "Claude 3.7 Sonnet (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 8192,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.003, "output": 0.015}
            },
            {
                "profile_id": "apac.amazon.nova-micro-v1:0",
                "base_model": "amazon.nova-micro-v1:0",
                "name": "Amazon Nova Micro (APAC)",
                "provider": ModelProvider.AMAZON,
                "max_tokens": 128000,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.000035, "output": 0.00014}
            },
            {
                "profile_id": "apac.amazon.nova-lite-v1:0",
                "base_model": "amazon.nova-lite-v1:0",
                "name": "Amazon Nova Lite (APAC)",
                "provider": ModelProvider.AMAZON,
                "max_tokens": 300000,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.00006, "output": 0.00024}
            },
            {
                "profile_id": "apac.amazon.nova-pro-v1:0",
                "base_model": "amazon.nova-pro-v1:0",
                "name": "Amazon Nova Pro (APAC)",
                "provider": ModelProvider.AMAZON,
                "max_tokens": 300000,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.0008, "output": 0.0032}
            },
            {
                "profile_id": "apac.anthropic.claude-sonnet-4-20250514-v1:0",
                "base_model": "anthropic.claude-sonnet-4-20250514-v1:0",
                "name": "Claude Sonnet 4 (APAC)",
                "provider": ModelProvider.ANTHROPIC,
                "max_tokens": 8192,
                "supports_streaming": True,
                "supports_system_prompt": True,
                "pricing": {"input": 0.003, "output": 0.015}
            }
        ]
        
        # Add inference profiles without testing (for development)
        for profile in apac_inference_profiles:
            # Add all profiles - testing will happen when they're actually used
            inference_profiles.append(BedrockModel(
                model_id=profile["profile_id"],
                provider=profile["provider"],
                name=profile["name"],
                description=f"Cross-region inference profile for {profile.get('base_model', profile['profile_id'])}",
                input_modalities=["TEXT"],
                output_modalities=["TEXT"],
                max_tokens=profile["max_tokens"],
                supports_streaming=profile["supports_streaming"],
                supports_system_prompt=profile["supports_system_prompt"],
                cost_per_1k_input_tokens=profile["pricing"]["input"],
                cost_per_1k_output_tokens=profile["pricing"]["output"],
                status="ACTIVE"
            ))
            logger.info(f"Added inference profile: {profile['profile_id']}")
        
        return inference_profiles
    
    def _parse_model_info(self, model_summary: Dict) -> Optional[BedrockModel]:
        """
        Parse model information from AWS response
        
        Args:
            model_summary: Model summary from AWS API
            
        Returns:
            BedrockModel instance or None
        """
        try:
            model_id = model_summary['modelId']
            provider_name = model_summary.get('providerName', '').lower()
            
            # Map provider name to enum
            provider_map = {
                'anthropic': ModelProvider.ANTHROPIC,
                'ai21 labs': ModelProvider.AI21,
                'amazon': ModelProvider.AMAZON,
                'cohere': ModelProvider.COHERE,
                'meta': ModelProvider.META,
                'mistral ai': ModelProvider.MISTRAL,
                'stability ai': ModelProvider.STABILITY,
            }
            
            provider = provider_map.get(provider_name, ModelProvider.AMAZON)
            
            # Get pricing info
            base_model_id = model_id.split(':')[0]  # Remove version suffix
            pricing = self.MODEL_PRICING.get(base_model_id, {"input": 0.001, "output": 0.001})
            
            # Determine capabilities
            input_modalities = model_summary.get('inputModalities', ['TEXT'])
            output_modalities = model_summary.get('outputModalities', ['TEXT'])
            
            # Determine max tokens based on model
            max_tokens = 4096  # Default
            if 'claude-3' in model_id:
                max_tokens = 4096
            elif 'claude' in model_id:
                max_tokens = 100000
            elif 'titan' in model_id:
                max_tokens = 8192
            elif 'llama' in model_id:
                max_tokens = 4096
            
            # Check streaming support safely
            streaming_supported = model_summary.get('responseStreamingSupported', False)
            if isinstance(streaming_supported, bool):
                supports_streaming = streaming_supported
            elif isinstance(streaming_supported, list):
                supports_streaming = 'STREAMING' in streaming_supported
            else:
                supports_streaming = False
            
            return BedrockModel(
                model_id=model_id,
                provider=provider,
                name=model_summary.get('modelName', model_id),
                description=model_summary.get('modelDescription', ''),
                input_modalities=input_modalities,
                output_modalities=output_modalities,
                max_tokens=max_tokens,
                supports_streaming=supports_streaming,
                supports_system_prompt=provider in [ModelProvider.ANTHROPIC],
                cost_per_1k_input_tokens=pricing['input'],
                cost_per_1k_output_tokens=pricing['output']
            )
            
        except Exception as e:
            logger.error(f"Error parsing model info for {model_summary.get('modelId')}: {e}")
            return None
    
    def get_available_models(self, 
                           filter_by_capability: Optional[str] = None,
                           filter_by_provider: Optional[str] = None,
                           include_inference_profiles: bool = True) -> List[BedrockModel]:
        """
        Get list of available models with optional filtering
        
        Args:
            filter_by_capability: Filter by input modality (e.g., 'TEXT', 'IMAGE')
            filter_by_provider: Filter by provider name
            include_inference_profiles: Include cross-region inference profiles
            
        Returns:
            List of available BedrockModel instances
        """
        models = self.available_models.copy()
        
        # Filter out context length variants that don't have access
        excluded_models = {
            "anthropic.claude-3-haiku-20240307-v1:0:200k",
            "anthropic.claude-3-sonnet-20240229-v1:0:28k", 
            "anthropic.claude-3-sonnet-20240229-v1:0:200k"
        }
        models = [m for m in models if m.model_id not in excluded_models]
        
        # Add cross-region inference profiles if requested
        if include_inference_profiles:
            models.extend(self._get_inference_profiles())
        
        if filter_by_capability:
            models = [m for m in models if filter_by_capability.upper() in m.input_modalities]
            
        if filter_by_provider:
            models = [m for m in models if m.provider.value == filter_by_provider.lower()]
            
        return models
    
    def get_available_embedding_models(self) -> List[Dict]:
        """
        Get available embedding models from Bedrock
        
        Returns:
            List of embedding model configurations
        """
        try:
            # List all foundation models and filter for embedding models
            response = self.bedrock_client.list_foundation_models()
            embedding_models = []
            
            for model_summary in response.get('modelSummaries', []):
                model_id = model_summary.get('modelId', '')
                model_name = model_summary.get('modelName', '')
                
                # Filter for embedding models
                if any(embed_keyword in model_id.lower() for embed_keyword in ['embed', 'embedding']):
                    # Check if we have access to this model
                    try:
                        model_details = self.bedrock_client.get_foundation_model(
                            modelIdentifier=model_id
                        )
                        
                        # Extract model details
                        details = model_details.get('modelDetails', {})
                        
                        embedding_models.append({
                            'modelId': model_id,
                            'modelName': model_name,
                            'providerName': details.get('providerName', 'Unknown'),
                            'modelStatus': details.get('modelLifecycle', {}).get('status', 'UNKNOWN'),
                            'inputModalities': details.get('inputModalities', ['TEXT']),
                            'outputModalities': details.get('outputModalities', ['EMBEDDINGS']),
                            'customizationsSupported': details.get('customizationsSupported', []),
                            'inferenceTypesSupported': details.get('inferenceTypesSupported', []),
                        })
                        logger.info(f"Found embedding model: {model_id}")
                        
                    except ClientError as e:
                        logger.debug(f"No access to embedding model {model_id}: {e}")
                        continue
            
            # If no models found through API, return known embedding models
            if not embedding_models:
                logger.warning("No embedding models found through API, returning known models")
                embedding_models = [
                    {
                        'modelId': 'amazon.titan-embed-text-v1',
                        'modelName': 'Titan Text Embeddings v1',
                        'providerName': 'Amazon',
                        'modelStatus': 'ACTIVE',
                        'inputModalities': ['TEXT'],
                        'outputModalities': ['EMBEDDINGS']
                    },
                    {
                        'modelId': 'amazon.titan-embed-text-v2:0',
                        'modelName': 'Titan Text Embeddings v2',
                        'providerName': 'Amazon',
                        'modelStatus': 'ACTIVE',
                        'inputModalities': ['TEXT'],
                        'outputModalities': ['EMBEDDINGS']
                    },
                    {
                        'modelId': 'amazon.titan-embed-image-v1',
                        'modelName': 'Titan Multimodal Embeddings',
                        'providerName': 'Amazon',
                        'modelStatus': 'ACTIVE',
                        'inputModalities': ['TEXT', 'IMAGE'],
                        'outputModalities': ['EMBEDDINGS']
                    }
                ]
            
            return embedding_models
            
        except Exception as e:
            logger.error(f"Error fetching embedding models: {e}")
            # Return default models on error
            return [
                {
                    'modelId': 'amazon.titan-embed-text-v1',
                    'modelName': 'Titan Text Embeddings v1',
                    'providerName': 'Amazon',
                    'modelStatus': 'ACTIVE',
                    'inputModalities': ['TEXT'],
                    'outputModalities': ['EMBEDDINGS']
                },
                {
                    'modelId': 'amazon.titan-embed-text-v2:0',
                    'modelName': 'Titan Text Embeddings v2',
                    'providerName': 'Amazon',
                    'modelStatus': 'ACTIVE',
                    'inputModalities': ['TEXT'],
                    'outputModalities': ['EMBEDDINGS']
                }
            ]
    
    def get_model_by_id(self, model_id: str) -> Optional[BedrockModel]:
        """
        Get a specific model by ID, including inference profiles
        
        Args:
            model_id: The model identifier
            
        Returns:
            BedrockModel instance or None
        """
        logger.info(f"get_model_by_id called with: {model_id}")
        
        # Model mapping for inference profile requirements - CHECK THIS FIRST!
        model_mappings = {
            # Nova models - map to APAC inference profiles
            "amazon.nova-micro-v1:0": "apac.amazon.nova-micro-v1:0",
            "amazon.nova-lite-v1:0": "apac.amazon.nova-lite-v1:0",
            "amazon.nova-pro-v1:0": "apac.amazon.nova-pro-v1:0",
            
            # Latest Claude models - map to APAC inference profiles
            "anthropic.claude-3-5-sonnet-20241022-v2:0": "apac.anthropic.claude-3-5-sonnet-20241022-v2:0",
            "anthropic.claude-3-7-sonnet-20250219-v1:0": "apac.anthropic.claude-3-7-sonnet-20250219-v1:0",
            "anthropic.claude-sonnet-4-20250514-v1:0": "apac.anthropic.claude-sonnet-4-20250514-v1:0",
            "anthropic.claude-3-haiku-20240307-v1:0": "apac.anthropic.claude-3-haiku-20240307-v1:0",
            "anthropic.claude-3-sonnet-20240229-v1:0": "apac.anthropic.claude-3-sonnet-20240229-v1:0",
            "anthropic.claude-3-5-sonnet-20240620-v1:0": "apac.anthropic.claude-3-5-sonnet-20240620-v1:0"
        }
        
        # First check if model needs to be mapped to inference profile
        if model_id in model_mappings:
            mapped_profile_id = model_mappings[model_id]
            logger.info(f"Found mapping: {model_id} -> {mapped_profile_id}")
            inference_profiles = self._get_inference_profiles()
            for model in inference_profiles:
                if model.model_id == mapped_profile_id:
                    logger.info(f"Successfully mapped to profile: {model.model_id}")
                    return model
            logger.warning(f"Mapped profile not found: {mapped_profile_id}")
        
        # Then check regular available models (for models that don't need mapping)
        logger.info(f"Checking available models for direct access")
        for model in self.available_models:
            if model.model_id == model_id or model.model_id.startswith(model_id):
                logger.info(f"Found in available models: {model.model_id}")
                return model
        
        # Finally check inference profiles for direct access
        inference_profiles = self._get_inference_profiles()
        for model in inference_profiles:
            if model.model_id == model_id or model.model_id.startswith(model_id):
                return model
        
        logger.warning(f"Model not found: {model_id}")
        return None
    
    def invoke_model(self, 
                    model_id: str, 
                    prompt: str,
                    system_prompt: Optional[str] = None,
                    max_tokens: int = 2048,
                    temperature: float = 0.7,
                    top_p: float = 0.9,
                    stop_sequences: Optional[List[str]] = None) -> Dict[str, Any]:
        """
        Invoke a Bedrock model with the given prompt
        
        Args:
            model_id: Model identifier
            prompt: User prompt
            system_prompt: Optional system prompt
            max_tokens: Maximum tokens to generate
            temperature: Temperature for sampling
            top_p: Top-p for nucleus sampling
            stop_sequences: Optional stop sequences
            
        Returns:
            Dictionary with response text, usage info, and metadata
        """
        model = self.get_model_by_id(model_id)
        if not model:
            raise ValueError(f"Model {model_id} not available or not accessible")
        
        # Log model mapping for debugging
        if model.model_id != model_id:
            logger.info(f"Model {model_id} mapped to inference profile: {model.model_id}")
        
        # Format request based on provider
        request_body = self._format_request(
            model, prompt, system_prompt, max_tokens, temperature, top_p, stop_sequences
        )
        
        try:
            # Invoke the model
            response = self.bedrock_runtime.invoke_model(
                modelId=model.model_id,
                contentType='application/json',
                accept='application/json',
                body=json.dumps(request_body)
            )
            
            # Parse response
            response_body = json.loads(response['body'].read())
            parsed_response = self._parse_response(model, response_body)
            
            # Calculate cost
            input_tokens = parsed_response.get('usage', {}).get('input_tokens', 0)
            output_tokens = parsed_response.get('usage', {}).get('output_tokens', 0)
            
            cost = self._calculate_cost(model, input_tokens, output_tokens)
            parsed_response['cost'] = cost
            
            logger.info(f"Model invoked successfully: {model_id}, Cost: ${cost['total']:.4f}")
            
            return parsed_response
            
        except ClientError as e:
            logger.error(f"Error invoking Bedrock model {model_id}: {e}")
            raise
    
    def invoke_model_with_streaming(self,
                                   model_id: str,
                                   prompt: str,
                                   system_prompt: Optional[str] = None,
                                   max_tokens: int = 2048,
                                   temperature: float = 0.7):
        """
        Invoke a model with response streaming
        
        Yields chunks of the response as they arrive
        """
        model = self.get_model_by_id(model_id)
        if not model:
            raise ValueError(f"Model {model_id} not available")
            
        if not model.supports_streaming:
            raise ValueError(f"Model {model_id} does not support streaming")
        
        request_body = self._format_request(
            model, prompt, system_prompt, max_tokens, temperature
        )
        
        try:
            response = self.bedrock_runtime.invoke_model_with_response_stream(
                modelId=model.model_id,
                contentType='application/json',
                accept='application/json',
                body=json.dumps(request_body)
            )
            
            for event in response['body']:
                chunk = json.loads(event['chunk']['bytes'])
                yield self._parse_streaming_chunk(model, chunk)
                
        except ClientError as e:
            logger.error(f"Error in streaming invocation: {e}")
            raise
    
    def _format_request(self, 
                       model: BedrockModel, 
                       prompt: str,
                       system_prompt: Optional[str] = None,
                       max_tokens: int = 2048,
                       temperature: float = 0.7,
                       top_p: float = 0.9,
                       stop_sequences: Optional[List[str]] = None) -> Dict:
        """
        Format request body based on model provider requirements
        """
        if model.provider == ModelProvider.ANTHROPIC:
            # Anthropic Claude format
            request = {
                "anthropic_version": "bedrock-2023-05-31",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
            
            if system_prompt and model.supports_system_prompt:
                request["system"] = system_prompt
                
            if stop_sequences:
                request["stop_sequences"] = stop_sequences
                
        elif model.provider == ModelProvider.AMAZON:
            # Check if this is a Nova model (uses different format)
            if "nova" in model.model_id.lower():
                # Amazon Nova format (similar to Anthropic)
                request = {
                    "messages": [{"role": "user", "content": [{"text": prompt}]}],
                    "inferenceConfig": {
                        "maxTokens": max_tokens,
                        "temperature": temperature,
                        "topP": top_p
                    }
                }
                
                if system_prompt and model.supports_system_prompt:
                    request["system"] = [{"text": system_prompt}]
                    
                if stop_sequences:
                    request["inferenceConfig"]["stopSequences"] = stop_sequences
            else:
                # Amazon Titan format
                request = {
                    "inputText": prompt,
                    "textGenerationConfig": {
                        "maxTokenCount": max_tokens,
                        "temperature": temperature,
                        "topP": top_p
                    }
                }
                
                if stop_sequences:
                    request["textGenerationConfig"]["stopSequences"] = stop_sequences
                
        elif model.provider == ModelProvider.META:
            # Meta Llama format
            formatted_prompt = prompt
            if system_prompt:
                formatted_prompt = f"<s>[INST] <<SYS>>\n{system_prompt}\n<</SYS>>\n\n{prompt} [/INST]"
            
            request = {
                "prompt": formatted_prompt,
                "max_gen_len": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
            
        elif model.provider == ModelProvider.MISTRAL:
            # Mistral format
            formatted_prompt = f"<s>[INST] {prompt} [/INST]"
            if system_prompt:
                formatted_prompt = f"<s>[INST] {system_prompt}\n\n{prompt} [/INST]"
            
            request = {
                "prompt": formatted_prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
            
            if stop_sequences:
                request["stop"] = stop_sequences
                
        else:
            # Generic format
            request = {
                "prompt": prompt,
                "max_tokens": max_tokens,
                "temperature": temperature,
                "top_p": top_p
            }
            
        return request
    
    def _parse_response(self, model: BedrockModel, response_body: Dict) -> Dict[str, Any]:
        """
        Parse response based on model provider format
        """
        result = {
            "model": model.model_id,
            "provider": model.provider.value
        }
        
        if model.provider == ModelProvider.ANTHROPIC:
            # Anthropic response format
            content = response_body.get("content", [])
            if content and isinstance(content, list):
                result["text"] = content[0].get("text", "")
            else:
                result["text"] = response_body.get("completion", "")
            
            result["usage"] = response_body.get("usage", {})
            result["stop_reason"] = response_body.get("stop_reason")
            
        elif model.provider == ModelProvider.AMAZON:
            # Check if this is a Nova model (different response format)
            if "nova" in model.model_id.lower():
                # Amazon Nova response format
                output = response_body.get("output", {})
                message = output.get("message", {})
                content = message.get("content", [])
                
                if content and isinstance(content, list):
                    result["text"] = content[0].get("text", "")
                else:
                    result["text"] = ""
                
                result["usage"] = response_body.get("usage", {})
                result["stop_reason"] = response_body.get("stopReason")
            else:
                # Amazon Titan response format
                results = response_body.get("results", [])
                if results:
                    result["text"] = results[0].get("outputText", "")
                    result["usage"] = {
                        "input_tokens": results[0].get("tokenCount", 0),
                        "output_tokens": results[0].get("completionTokenCount", 0)
                    }
                else:
                    result["text"] = ""
                    result["usage"] = {}
                
        elif model.provider == ModelProvider.META:
            # Meta Llama response format
            result["text"] = response_body.get("generation", "")
            result["usage"] = {
                "input_tokens": response_body.get("prompt_token_count", 0),
                "output_tokens": response_body.get("generation_token_count", 0)
            }
            result["stop_reason"] = response_body.get("stop_reason")
            
        elif model.provider == ModelProvider.MISTRAL:
            # Mistral response format
            outputs = response_body.get("outputs", [])
            if outputs:
                result["text"] = outputs[0].get("text", "")
                result["stop_reason"] = outputs[0].get("stop_reason")
            else:
                result["text"] = ""
                
            # Mistral doesn't always provide token counts
            result["usage"] = {}
            
        else:
            # Generic response format
            result["text"] = response_body.get("completion", response_body.get("generation", ""))
            result["usage"] = {}
            
        return result
    
    def _parse_streaming_chunk(self, model: BedrockModel, chunk: Dict) -> str:
        """
        Parse a streaming response chunk
        """
        if model.provider == ModelProvider.ANTHROPIC:
            return chunk.get("delta", {}).get("text", "")
        elif model.provider == ModelProvider.AMAZON:
            return chunk.get("outputText", "")
        else:
            return chunk.get("generation", "")
    
    def _calculate_cost(self, model: BedrockModel, 
                       input_tokens: int, output_tokens: int) -> Dict[str, float]:
        """
        Calculate the cost of a model invocation
        
        Args:
            model: The model used
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Dictionary with cost breakdown
        """
        input_cost = (input_tokens / 1000) * model.cost_per_1k_input_tokens
        output_cost = (output_tokens / 1000) * model.cost_per_1k_output_tokens
        total_cost = input_cost + output_cost
        
        return {
            "input_cost": round(input_cost, 6),
            "output_cost": round(output_cost, 6),
            "total": round(total_cost, 6),
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }
    
    def estimate_tokens(self, text: str) -> int:
        """
        Estimate token count for a text string
        Simple approximation: ~4 characters per token
        
        Args:
            text: Input text
            
        Returns:
            Estimated token count
        """
        return len(text) // 4
    
    def generate_embedding(self, text: str, 
                          model_id: str = "amazon.titan-embed-text-v1") -> List[float]:
        """
        Generate text embeddings using Titan Embeddings model
        
        Args:
            text: Text to embed
            model_id: Embedding model ID
            
        Returns:
            List of embedding values
        """
        # Try different embedding models in order of preference
        embedding_models = [
            "amazon.titan-embed-text-v1",
            "amazon.titan-embed-text-v2:0", 
            "cohere.embed-multilingual-v3",
            "cohere.embed-english-v3"
        ]
        
        # Start with the requested model, then try alternatives
        models_to_try = [model_id] + [m for m in embedding_models if m != model_id]
        
        for current_model in models_to_try:
            try:
                response = self.bedrock_runtime.invoke_model(
                    modelId=current_model,
                    contentType='application/json',
                    accept='application/json',
                    body=json.dumps({"inputText": text})
                )
                
                result = json.loads(response['body'].read())
                embedding = result.get('embedding', [])
                if embedding:
                    logger.debug(f"Successfully generated embedding using {current_model}")
                    return embedding
                    
            except ClientError as e:
                logger.debug(f"Embedding model {current_model} failed: {e}")
                continue
        
        # If all models fail, log error and raise exception
        logger.error(f"All embedding models failed for region {self.region}")
        raise Exception(f"No embedding models available in region {self.region}")


# Utility functions for Flask integration
def create_bedrock_service(app_config: Dict) -> BedrockService:
    """
    Factory function to create BedrockService with app configuration
    
    Args:
        app_config: Flask app configuration dictionary
        
    Returns:
        Configured BedrockService instance
    """
    region = app_config.get('BEDROCK_REGION', 'ap-northeast-2')
    profile = app_config.get('AWS_PROFILE')
    
    # Docker 환경에서는 환경변수로 AWS 자격증명을 사용 (profile 사용 안함)
    import os
    aws_key = os.getenv('AWS_ACCESS_KEY_ID')
    aws_secret = os.getenv('AWS_SECRET_ACCESS_KEY')
    logger.info(f"AWS_ACCESS_KEY_ID present: {bool(aws_key)}")
    logger.info(f"AWS_SECRET_ACCESS_KEY present: {bool(aws_secret)}")
    logger.info(f"AWS_PROFILE: {repr(profile)}")
    
    if aws_key and aws_secret:
        # 환경변수가 있으면 profile 사용하지 않음 
        # AWS_PROFILE 환경변수도 명시적으로 제거
        if 'AWS_PROFILE' in os.environ:
            del os.environ['AWS_PROFILE']
        service = BedrockService(region_name=region, profile_name=None)
        logger.info("✅ Using AWS credentials from environment variables")
    elif profile and profile.strip():
        # profile이 설정되어 있으면 profile 사용
        service = BedrockService(region_name=region, profile_name=profile)
        logger.info(f"Using AWS profile: {profile}")
    else:
        # 환경변수도 profile도 없으면 기본값 사용
        service = BedrockService(region_name=region, profile_name=None)
        logger.info("Using default AWS credentials (no profile)")
    
    # Log available models
    models = service.get_available_models()
    logger.info(f"Initialized Bedrock service with {len(models)} available models")
    
    return service


if __name__ == "__main__":
    # Test the service
    service = BedrockService()
    
    # List available models
    print("\n=== Available Models ===")
    for model in service.get_available_models():
        print(f"- {model.name} ({model.model_id})")
        print(f"  Provider: {model.provider.value}")
        print(f"  Cost: ${model.cost_per_1k_input_tokens}/1K input, ${model.cost_per_1k_output_tokens}/1K output")
        print()
    
    # Test invocation (if models are available)
    if service.available_models:
        test_model = service.available_models[0]
        print(f"\n=== Testing {test_model.name} ===")
        
        try:
            response = service.invoke_model(
                model_id=test_model.model_id,
                prompt="What is the capital of South Korea?",
                max_tokens=100,
                temperature=0.5
            )
            
            print(f"Response: {response['text']}")
            print(f"Cost: ${response['cost']['total']:.6f}")
        except Exception as e:
            print(f"Test invocation failed: {e}")