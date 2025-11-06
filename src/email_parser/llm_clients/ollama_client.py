"""
Ollama LLM client implementation.

Provides integration with local Ollama models.
"""

import subprocess
import json
import time
import requests
from typing import Dict, Any, List, Optional
from ..llm_clients.base import BaseLLMClient, LLMProvider, LLMRequest, LLMResponse, LLMMessage
from ..utils.logging import get_logger, TimedOperation, get_performance_logger


class OllamaClient(BaseLLMClient):
    """Client for Ollama local LLM models."""
    
    def __init__(self, config: Dict[str, Any]):
        """Initialize Ollama client.

        Args:
            config: Configuration dictionary with Ollama settings
        """
        import os
        super().__init__(config)

        # Get config from dict or fallback to environment variables
        self.base_url = config.get('ollama_base_url') or os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        self.default_model = config.get('ollama_model') or os.getenv('OLLAMA_MODEL')

        if not self.default_model:
            raise ValueError("Ollama model must be specified in OLLAMA_MODEL environment variable")

        self.timeout = None  # No timeout for large models
        self.performance_logger = get_performance_logger(f"{__name__}.OllamaClient")

        # Verify connection on initialization
        self._verify_connection()
    
    def get_provider(self) -> LLMProvider:
        """Get the provider type."""
        return LLMProvider.OLLAMA
    
    def is_available(self) -> bool:
        """Check if Ollama service is available."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            self.logger.debug(f"Ollama availability check failed: {e}")
            return False
    
    def _verify_connection(self) -> None:
        """Verify connection to Ollama service."""
        if not self.is_available():
            self.logger.warning(
                "Ollama service not available. Please ensure Ollama is running.",
                base_url=self.base_url
            )
        else:
            self.logger.info(
                "Successfully connected to Ollama service",
                base_url=self.base_url
            )
    
    def get_supported_models(self) -> List[str]:
        """Get list of available Ollama models."""
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=10)
            if response.status_code == 200:
                data = response.json()
                models = [model['name'] for model in data.get('models', [])]
                self.logger.debug(f"Available Ollama models: {models}")
                return models
            else:
                self.logger.error(f"Failed to get models: HTTP {response.status_code}")
                return []
        except Exception as e:
            self.logger.error(f"Error getting supported models: {e}")
            return []
    
    def estimate_cost(self, request: LLMRequest) -> Optional[float]:
        """Estimate cost (Ollama is free, so returns 0)."""
        return 0.0
    
    def _format_messages_for_ollama(self, messages: List[LLMMessage]) -> str:
        """Format messages for Ollama API."""
        # For simpler models, we'll combine all messages into a single prompt
        formatted_parts = []
        
        for message in messages:
            if message.role == "system":
                formatted_parts.append(f"System: {message.content}")
            elif message.role == "user":
                formatted_parts.append(f"User: {message.content}")
            elif message.role == "assistant":
                formatted_parts.append(f"Assistant: {message.content}")
        
        return "\n\n".join(formatted_parts)
    
    def _call_ollama_api(self, prompt: str, model: str) -> Dict[str, Any]:
        """Call Ollama API and return response."""
        api_url = f"{self.base_url}/api/generate"
        
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "top_k": 40,
            }
        }
        
        start_time = time.time()
        
        try:
            response = requests.post(
                api_url,
                json=payload
            )
            
            response_time = time.time() - start_time
            
            self.performance_logger.log_api_call(
                provider="ollama",
                endpoint="/api/generate",
                status_code=response.status_code,
                response_time=response_time,
                request_size=len(json.dumps(payload).encode()),
                response_size=len(response.content)
            )
            
            if response.status_code == 200:
                return response.json()
            else:
                raise Exception(f"Ollama API error: HTTP {response.status_code} - {response.text}")
        
        except requests.exceptions.Timeout:
            raise Exception("Ollama request timeout (this shouldn't happen with no timeout set)")
        except requests.exceptions.ConnectionError:
            raise Exception("Could not connect to Ollama service. Is it running?")
        except Exception as e:
            raise Exception(f"Ollama API call failed: {str(e)}")
    
    def _call_ollama_subprocess(self, prompt: str, model: str) -> str:
        """Fallback: Call Ollama via subprocess (original method)."""
        try:
            process = subprocess.run(
                ["ollama", "run", model],
                input=prompt,
                capture_output=True,
                text=True
            )
            
            if process.returncode != 0:
                raise Exception(f"Ollama process failed: {process.stderr.strip()}")
            
            return process.stdout.strip()
        
        except subprocess.TimeoutExpired:
            raise Exception("Ollama process timeout (this shouldn't happen with no timeout set)")
        except FileNotFoundError:
            raise Exception("Ollama command not found. Please install Ollama.")
        except Exception as e:
            raise Exception(f"Ollama subprocess call failed: {str(e)}")
    
    def generate(self, request: LLMRequest) -> LLMResponse:
        """Generate response using Ollama."""
        # CRITICAL: Always use the exact model specified in the request
        if not request.model:
            raise ValueError(f"Model must be explicitly specified in LLMRequest. No fallback to default model allowed.")
        
        # Validate request
        validation_errors = self.validate_request(request)
        if validation_errors:
            error_msg = "; ".join(validation_errors)
            return self.create_error_response(error_msg, request.model)
        
        # Prepare messages
        messages = self.prepare_messages(request)
        model = request.model  # NO FALLBACK - use exact model requested
        
        # Check if model is available
        available_models = self.get_supported_models()
        if available_models and model not in available_models:
            self.logger.warning(
                f"Model '{model}' not found in available models. Attempting anyway.",
                available_models=available_models
            )
        
        # Format prompt
        prompt = self._format_messages_for_ollama(messages)
        
        self.logger.debug(
            "Sending request to Ollama",
            model=model,
            prompt_length=len(prompt),
            messages_count=len(messages)
        )
        
        start_time = time.time()
        
        with TimedOperation(self.performance_logger, "ollama_generate", {"model": model}):
            try:
                # Try API method first
                if self.is_available():
                    response_data = self._call_ollama_api(prompt, model)
                    response_text = response_data.get('response', '')
                    
                    # Extract usage information
                    usage = {
                        'prompt_eval_count': response_data.get('prompt_eval_count', 0),
                        'eval_count': response_data.get('eval_count', 0),
                        'total_duration': response_data.get('total_duration', 0),
                        'load_duration': response_data.get('load_duration', 0),
                        'eval_duration': response_data.get('eval_duration', 0),
                    }
                else:
                    # Fallback to subprocess method
                    self.logger.debug("Using subprocess fallback for Ollama")
                    response_text = self._call_ollama_subprocess(prompt, model)
                    usage = {}
                
                processing_time = time.time() - start_time
                
                # Clean up response
                response_text = response_text.strip()
                
                self.logger.debug(
                    "Received response from Ollama",
                    model=model,
                    response_length=len(response_text),
                    processing_time=processing_time
                )
                
                return LLMResponse(
                    content=response_text,
                    model=model,
                    usage=usage,
                    metadata={
                        'provider': 'ollama',
                        'processing_time': processing_time,
                        'prompt_length': len(prompt),
                        'base_url': self.base_url
                    },
                    success=True
                )
            
            except Exception as e:
                error_msg = str(e)
                self.logger.error(
                    "Ollama generation failed",
                    model=model,
                    error=error_msg,
                    processing_time=time.time() - start_time
                )
                
                return self.create_error_response(error_msg, model)
    
    def pull_model(self, model_name: str) -> bool:
        """Pull a model from Ollama repository.
        
        Args:
            model_name: Name of the model to pull
            
        Returns:
            True if successful, False otherwise
        """
        try:
            self.logger.info(f"Pulling Ollama model: {model_name}")
            
            # Try API method first
            if self.is_available():
                api_url = f"{self.base_url}/api/pull"
                payload = {"name": model_name}
                
                response = requests.post(
                    api_url,
                    json=payload,
                    timeout=300  # Model pulling can take a while
                )
                
                if response.status_code == 200:
                    self.logger.info(f"Successfully pulled model: {model_name}")
                    return True
                else:
                    self.logger.error(f"Failed to pull model via API: {response.text}")
            
            # Fallback to subprocess
            process = subprocess.run(
                ["ollama", "pull", model_name],
                capture_output=True,
                text=True,
                timeout=300
            )
            
            if process.returncode == 0:
                self.logger.info(f"Successfully pulled model: {model_name}")
                return True
            else:
                self.logger.error(f"Failed to pull model: {process.stderr}")
                return False
        
        except Exception as e:
            self.logger.error(f"Error pulling model {model_name}: {e}")
            return False
    
    def list_running_models(self) -> List[Dict[str, Any]]:
        """List currently running models."""
        try:
            response = requests.get(f"{self.base_url}/api/ps", timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data.get('models', [])
            else:
                self.logger.error(f"Failed to list running models: HTTP {response.status_code}")
                return []
        except Exception as e:
            self.logger.error(f"Error listing running models: {e}")
            return []
    
    def show_model_info(self, model_name: str) -> Optional[Dict[str, Any]]:
        """Get information about a specific model."""
        try:
            api_url = f"{self.base_url}/api/show"
            payload = {"name": model_name}
            
            response = requests.post(api_url, json=payload, timeout=10)
            if response.status_code == 200:
                return response.json()
            else:
                self.logger.error(f"Failed to get model info: HTTP {response.status_code}")
                return None
        except Exception as e:
            self.logger.error(f"Error getting model info for {model_name}: {e}")
            return None