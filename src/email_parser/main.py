#!/usr/bin/env python3
"""
Main CLI entry point for the email parser system.

Provides a comprehensive command-line interface for:
- Email download from Gmail/Outlook
- LLM processing with multiple providers
- Marketing and ikigai analysis
- CSV output generation
- Session log management
"""

import os
import sys
import argparse
import asyncio
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any, Optional, Union
import pandas as pd
import json
import logging

# Add the src directory to the Python path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root / "src"))

from email_parser.models.email import (
    EmailProvider, ProcessedEmail, RawEmail, ProcessingResult,
    EmailSummary, EmailClassification, EmailCategory, ProcessingStatus
)
from email_parser.providers.base import EmailProviderFactory
from email_parser.llm_clients.base import LLMClientFactory
from email_parser.utils.config import get_config, AppConfig, ConfigManager
from email_parser.utils.logging_manager import get_logger, EmailParserLogger
from email_parser.analysis.marketing_analyzer import UnbiasedMarketingAnalyzer
from email_parser.analysis.holistic_ikigai_analyzer import HolisticIkigaiAnalyzer
from email_parser.analysis.authentic_ikigai_analyzer import AuthenticIkigaiAnalyzer
# Removed complex model selection - using simple .env config instead


class EmailParser:
    """Main email parser application."""
    
    def __init__(self, config: Optional[AppConfig] = None):
        """Initialize the email parser.
        
        Args:
            config: Optional configuration. If None, loads from environment.
        """
        self.config = config or get_config()
        self.logger = logging.getLogger(__name__)
        self.enhanced_logger = get_logger()
        # Model selection is handled via simple .env config
        
        # Track processed emails for session
        self.session_emails: List[ProcessedEmail] = []
        self.session_stats: Dict[str, Any] = {
            'start_time': datetime.now(),
            'emails_downloaded': 0,
            'emails_processed': 0,
            'emails_analyzed': 0,
            'providers_used': [],
            'models_used': [],
            'errors': []
        }
    
    def download_emails(self, 
                       provider_type: EmailProvider,
                       max_emails: int = 50,
                       query: Optional[str] = None,
                       after_date: Optional[datetime] = None,
                       before_date: Optional[datetime] = None) -> List[RawEmail]:
        """Download emails from the specified provider."""
        self.logger.info(f"Starting email download - Provider: {provider_type.value}, Max emails: {max_emails}")
        
        start_time = time.time()
        
        try:
            # Get provider configuration
            provider_config = self._get_provider_config(provider_type)
            
            # Create email provider
            email_provider = EmailProviderFactory.create_provider(provider_type, provider_config)
            
            # Set up query parameters
            query_params = {}
            if query:
                query_params['query'] = query
            if after_date:
                query_params['after_date'] = after_date
            if before_date:
                query_params['before_date'] = before_date
            
            # Download emails
            # Create email query
            from email_parser.providers.base import EmailQuery
            email_query = EmailQuery(
                max_emails=max_emails,
                query=query_params.get('query'),
                after_date=query_params.get('after_date'),
                before_date=query_params.get('before_date')
            )
            email_batch = email_provider.download_emails(email_query)
            emails = email_batch.emails
            
            duration = time.time() - start_time
            
            self.logger.info(f"Email download complete - Downloaded: {len(emails)}, Duration: {duration:.2f}s")
            self.enhanced_logger.log_email_processing_complete(
                provider_type.value, len(emails), duration
            )
            
            # Update session stats
            self.session_stats['emails_downloaded'] += len(emails)
            if provider_type.value not in self.session_stats['providers_used']:
                self.session_stats['providers_used'].append(provider_type.value)
            
            return emails
            
        except Exception as e:
            self.logger.error(f"Email download failed - Provider: {provider_type.value}, Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'email_download',
                'provider': provider_type.value,
                'max_emails': max_emails,
                'query': query
            })
            self.session_stats['errors'].append({
                'operation': 'download',
                'provider': provider_type.value,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            raise
    
    def process_emails_with_llm(self,
                               emails: List[RawEmail],
                               instruction: Optional[str] = None) -> List[ProcessedEmail]:
        """Process emails using LLM for analysis and categorization with concurrent processing."""
        if not emails:
            return []

        # Get email model configuration from .env
        if not self.config.llm.email_model:
            raise ValueError("EMAIL_MODEL must be specified in .env file")

        # Parse email model (format: provider:model)
        config_manager = ConfigManager()
        provider, model = config_manager.parse_model_config(self.config.llm.email_model)

        # Concurrency settings - configurable via environment variable
        import os
        default_concurrency = 5  # Default to 5 concurrent requests
        max_concurrency = int(os.getenv('EMAIL_PROCESSING_CONCURRENCY', default_concurrency))
        max_workers = min(max_concurrency, len(emails))  # Don't exceed email count

        self.logger.info(f"Starting email processing - Provider: {provider}, Model: {model}, Count: {len(emails)}, Concurrent workers: {max_workers}")

        start_time = time.time()

        try:
            # Get LLM configuration
            llm_config = self._get_llm_config()

            # Create LLM client
            llm_client = LLMClientFactory.create_client(provider, llm_config)

            # Process emails concurrently
            processed_emails = []
            failed_emails = []

            # Helper function to process single email (for thread pool)
            def process_single_email(email_with_index):
                i, email = email_with_index
                try:
                    self.logger.debug(f"Processing email {i+1}/{len(emails)} - ID: {email.id}")

                    # Analyze email with LLM
                    analysis = llm_client.analyze_email(
                        self._format_email_for_analysis(email),
                        model=model  # CRITICAL: Pass exact model name
                    )

                    # Convert to ProcessedEmail
                    processed_email = self._convert_analysis_to_processed_email(email, analysis)
                    return (i, processed_email, None)

                except Exception as e:
                    self.logger.warning(f"Failed to process email {email.id} - Error: {str(e)}")
                    return (i, None, email.id)

            # Use ThreadPoolExecutor for concurrent processing
            from concurrent.futures import ThreadPoolExecutor, as_completed

            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # Submit all emails for processing with their indices
                futures = {
                    executor.submit(process_single_email, (i, email)): i
                    for i, email in enumerate(emails)
                }

                # Collect results as they complete
                results = [None] * len(emails)  # Pre-allocate results list
                completed_count = 0

                for future in as_completed(futures):
                    idx, processed_email, failed_id = future.result()
                    results[idx] = (processed_email, failed_id)

                    completed_count += 1
                    if completed_count % 10 == 0 or completed_count == len(emails):
                        progress_pct = (completed_count / len(emails)) * 100
                        self.logger.info(f"Progress: {completed_count}/{len(emails)} emails processed ({progress_pct:.1f}%)")

                # Extract processed emails and failures in original order
                for processed_email, failed_id in results:
                    if processed_email:
                        processed_emails.append(processed_email)
                    if failed_id:
                        failed_emails.append(failed_id)
            
            duration = time.time() - start_time
            
            self.logger.info(f"Email processing complete - Processed: {len(processed_emails)}, Failed: {len(failed_emails)}, Duration: {duration:.2f}s")
            self.enhanced_logger.log_email_processing_complete(
                provider, len(processed_emails), duration
            )
            
            # Update session stats
            self.session_stats['emails_processed'] += len(processed_emails)
            self.session_stats['emails_analyzed'] += len(processed_emails)  # Count once when emails are processed
            model_key = f"{provider}:{model}"
            if model_key not in self.session_stats['models_used']:
                self.session_stats['models_used'].append(model_key)
            
            # Add to session emails
            self.session_emails.extend(processed_emails)
            
            return processed_emails
            
        except Exception as e:
            self.logger.error(f"Email processing failed - Provider: {provider}, Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'email_processing',
                'llm_provider': provider,
                'email_model': model,
                'email_count': len(emails)
            })
            self.session_stats['errors'].append({
                'operation': 'processing',
                'llm_provider': provider,
                'error': str(e),
                'timestamp': datetime.now().isoformat()
            })
            raise
    
    def run_marketing_analysis(self,
                              processed_emails: Optional[List[Dict[str, Any]]] = None,
                              csv_file: Optional[str] = None,
                              output_file: str = "marketing_analysis.csv") -> str:
        """Run marketing analysis on processed emails."""
        # Get marketing model configuration from .env
        if not self.config.llm.marketing_model:
            raise ValueError("MARKETING_MODEL must be specified in .env file")
        
        # Parse marketing model (format: provider:model)
        config_manager = ConfigManager()
        provider, model = config_manager.parse_model_config(self.config.llm.marketing_model)
        
        self.logger.info(f"Starting marketing analysis - Model: {self.config.llm.marketing_model}")
        
        try:
            # Load emails if CSV file provided
            if csv_file:
                df = pd.read_csv(csv_file)
                processed_emails = df.to_dict('records')
            elif processed_emails is None:
                processed_emails = [email.to_csv_row() for email in self.session_emails]
            
            if not processed_emails:
                raise ValueError("No processed emails available for marketing analysis")
            
            # Get LLM configuration
            llm_config = self._get_llm_config()

            # Create LLM client for the specific provider
            llm_client = LLMClientFactory.create_client(provider, llm_config)

            # Create marketing analyzer with the full model specification
            marketing_analyzer = UnbiasedMarketingAnalyzer(llm_config, f"{provider}:{model}")
            marketing_analyzer.llm_client = llm_client  # Override the client
            marketing_analyzer.model_name = model  # Set the exact model name
            
            # Run analysis
            insights = marketing_analyzer.analyze_emails(processed_emails, output_file)

            # Export insights JSON to marketing_insights folder
            from pathlib import Path
            from datetime import datetime
            import os
            os.makedirs("marketing_insights", exist_ok=True)
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            json_path = Path("marketing_insights") / f"{Path(output_file).stem}_marketing_insights_{ts}.json"
            marketing_analyzer.export_insights_to_json(insights, str(json_path))
            
            self.logger.info(f"Marketing analysis complete - Output: {json_path}")
            # Don't double-count emails for multiple analysis types
            
            return str(json_path)
            
        except Exception as e:
            self.logger.error(f"Marketing analysis failed - Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'marketing_analysis',
                'marketing_model': marketing_model,
                'email_count': len(processed_emails) if processed_emails else 0
            })
            raise
    
    def run_ikigai_analysis(self,
                           processed_emails: Optional[List[Dict[str, Any]]] = None,
                           csv_file: Optional[str] = None,
                           output_file: str = "ikigai_analysis.csv",
                           use_holistic: bool = False) -> str:
        """Run ikigai analysis on processed emails."""
        # Get ikigai model configuration from .env
        if not self.config.llm.ikigai_model:
            raise ValueError("IKIGAI_MODEL must be specified in .env file")

        # Parse ikigai model (format: provider:model)
        config_manager = ConfigManager()
        provider, model = config_manager.parse_model_config(self.config.llm.ikigai_model)

        analysis_type = "holistic" if use_holistic else "authentic"
        self.logger.info(f"Starting {analysis_type} ikigai analysis - Model: {self.config.llm.ikigai_model}")

        try:
            # Load emails if CSV file provided
            if csv_file:
                df = pd.read_csv(csv_file)
                processed_emails = df.to_dict('records')
            elif processed_emails is None:
                processed_emails = [email.to_csv_row() for email in self.session_emails]

            if not processed_emails:
                raise ValueError("No processed emails available for ikigai analysis")

            # Get LLM configuration
            llm_config = self._get_llm_config()

            # Create LLM client
            llm_client = LLMClientFactory.create_client(provider, llm_config)

            # Create appropriate analyzer
            if use_holistic:
                analyzer = HolisticIkigaiAnalyzer(llm_client, self.logger, model)
            else:
                analyzer = AuthenticIkigaiAnalyzer(llm_client, self.logger, model)

            # Run analysis
            insights = analyzer.analyze_emails(processed_emails, output_file)

            self.logger.info(f"{analysis_type.title()} ikigai analysis complete - Output: {output_file}")
            # Don't double-count emails for multiple analysis types

            return output_file

        except Exception as e:
            self.logger.error(f"Ikigai analysis failed - Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'ikigai_analysis',
                'analysis_type': analysis_type,
                'ikigai_model': ikigai_model,
                'email_count': len(processed_emails) if processed_emails else 0
            })
            raise

    def generate_iab_profile(self,
                            emails: Optional[List[RawEmail]] = None,
                            csv_file: Optional[str] = None,
                            output_file: str = "iab_consumer_profile.json",
                            user_id: Optional[str] = None,
                            force_reprocess: bool = False) -> str:
        """Generate IAB Taxonomy consumer profile from emails.

        Args:
            emails: List of RawEmail objects to process
            csv_file: Path to CSV file with processed emails
            output_file: Output JSON file path
            user_id: User identifier (defaults to 'user_<timestamp>')
            force_reprocess: If True, reprocess all emails (ignore processed tracking)

        Returns:
            Path to generated JSON profile
        """
        from datetime import datetime
        from email_parser.workflow.executor import run_workflow, get_workflow_summary
        from email_parser.memory.manager import MemoryManager
        from langgraph.store.memory import InMemoryStore
        from email_parser.models.iab_taxonomy import IABConsumerProfile

        # Generate user_id if not provided
        if user_id is None:
            user_id = f"user_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        self.logger.info(f"Starting IAB profile generation - User: {user_id}")

        try:
            # Prepare email data for workflow
            email_dicts = []

            if csv_file:
                # Load from CSV
                self.logger.info(f"Loading emails from CSV: {csv_file}")
                df = pd.read_csv(csv_file)
                for _, row in df.iterrows():
                    # Try different field names (case-insensitive)
                    email_id = row.get('ID') or row.get('id') or row.get('message_id') or f"email_{len(email_dicts)}"
                    subject = row.get('Subject') or row.get('subject') or ''
                    # For body, prefer Summary (from processed emails), then body
                    body = row.get('Summary') or row.get('summary') or row.get('body') or row.get('Body') or ''
                    date = row.get('Date') or row.get('date') or str(datetime.now())
                    from_email = row.get('From') or row.get('from_email') or row.get('from') or ''

                    email_dict = {
                        'id': email_id,
                        'subject': subject,
                        'summary': body,  # Map CSV Summary column to 'summary' field (Phase 1.1 fix)
                        'body': body,     # Also include as 'body' for backwards compatibility
                        'date': date,
                        'from': from_email
                    }
                    email_dicts.append(email_dict)
            elif emails:
                # Convert RawEmail objects to dicts
                self.logger.info(f"Processing {len(emails)} raw emails")
                for email in emails:
                    body_content = email.body_plain or email.body_html or ''
                    email_dict = {
                        'id': email.id,
                        'subject': email.subject or '',
                        'summary': body_content,  # For IAB workflow agents (Phase 1.1)
                        'body': body_content,     # For backwards compatibility
                        'date': email.date.isoformat() if email.date else str(datetime.now()),
                        'from': email.from_email or ''
                    }
                    email_dicts.append(email_dict)
            else:
                raise ValueError("Either emails or csv_file must be provided")

            if not email_dicts:
                raise ValueError("No emails to process")

            self.logger.info(f"Prepared {len(email_dicts)} emails for IAB workflow")

            # Initialize memory manager (uses SQLite by default, configured in .env)
            memory_manager = MemoryManager(user_id=user_id)

            # Run IAB taxonomy workflow
            self.logger.info("Executing IAB taxonomy workflow...")
            if force_reprocess:
                self.logger.info("Force reprocess enabled - will reprocess all emails")
            final_state = run_workflow(
                user_id=user_id,
                emails=email_dicts,
                memory_manager=memory_manager,
                force_reprocess=force_reprocess
            )

            # Get workflow summary
            summary = get_workflow_summary(final_state)
            self.logger.info(f"Workflow complete - Processed: {summary['emails_processed']}/{summary['total_emails']}")

            # Build IAB Consumer Profile from workflow results
            self.logger.info("Building IAB consumer profile...")
            profile = self._build_iab_profile_from_state(final_state, user_id, memory_manager)

            # Add tiered classification structure (schema v2.0)
            self.logger.info("Adding tiered classification structure...")
            from email_parser.utils.profile_tier_formatter import add_tiered_structure_to_profile

            # Convert profile to dict
            profile_dict = profile.model_dump()

            # Prepare memories by section from updated_profile in state
            updated_profile = final_state.get('updated_profile', {})

            # If no new emails processed, retrieve from memory manager
            if not updated_profile and memory_manager:
                all_memories = memory_manager.get_all_semantic_memories()
                updated_profile = {
                    "demographics": [],
                    "household": [],
                    "interests": [],
                    "purchase_intent": []
                }
                for memory in all_memories:
                    section = memory.get("section", "unknown")
                    if section in updated_profile:
                        updated_profile[section].append(memory)

            # Add tiered structure to profile dict
            profile_dict = add_tiered_structure_to_profile(profile_dict, updated_profile)

            # Export to JSON (write enhanced dict directly)
            self.logger.info(f"Exporting enhanced profile to: {output_file}")
            import json
            with open(output_file, 'w') as f:
                json.dump(profile_dict, f, indent=2, default=str)

            # Log statistics
            self.logger.info(f"IAB Profile Generation Complete:")
            self.logger.info(f"  User: {user_id}")
            self.logger.info(f"  Emails Processed: {summary['emails_processed']}")
            self.logger.info(f"  Demographics: {len(profile.demographics.__dict__)} classifications")
            self.logger.info(f"  Household: {len(profile.household.__dict__)} classifications")
            self.logger.info(f"  Interests: {len(profile.interests)} classifications")
            self.logger.info(f"  Purchase Intent: {len(profile.purchase_intent)} classifications")
            self.logger.info(f"  Output: {output_file}")

            # Log cost summary if available
            if "cost_tracker" in final_state and final_state["cost_tracker"]:
                cost_tracker = final_state["cost_tracker"]
                if len(cost_tracker.calls) > 0:
                    total_cost = cost_tracker.get_total_cost()
                    per_email = total_cost / summary['emails_processed'] if summary['emails_processed'] > 0 else 0
                    self.logger.info(f"  LLM Cost: ${total_cost:.4f} USD (${per_email:.4f} per email)")
                    for provider, stats in cost_tracker.provider_stats.items():
                        self.logger.info(f"    {provider}: ${stats.total_cost_usd:.4f}")

            return output_file

        except Exception as e:
            self.logger.error(f"IAB profile generation failed - Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'iab_profile_generation',
                'user_id': user_id,
                'email_count': len(email_dicts) if 'email_dicts' in locals() else 0
            })
            raise

    def _build_iab_profile_from_state(self, state: Dict[str, Any], user_id: str, memory_manager=None) -> 'IABConsumerProfile':
        """Build IABConsumerProfile from workflow state.

        Args:
            state: Final workflow state with updated_profile
            user_id: User identifier
            memory_manager: Optional MemoryManager to retrieve existing memories when no emails processed

        Returns:
            IABConsumerProfile instance
        """
        from datetime import datetime
        import os
        from email_parser.models.iab_taxonomy import (
            IABConsumerProfile, DemographicsProfile, HouseholdProfile,
            InterestSelection, PurchaseIntentSelection, MemoryStats,
            GeneratorMetadata, DataCoverage, SectionConfidence
        )

        updated_profile = state.get('updated_profile', {})

        # If no emails were processed this run, retrieve existing memories from database
        if not updated_profile and memory_manager:
            self.logger.info("No new emails processed - retrieving existing profile from database")
            all_memories = memory_manager.get_all_semantic_memories()

            # Group memories by section
            updated_profile = {
                "demographics": [],
                "household": [],
                "interests": [],
                "purchase_intent": [],
                "actual_purchases": []
            }

            for memory in all_memories:
                section = memory.get("section", "unknown")
                if section in updated_profile:
                    updated_profile[section].append(memory)

            self.logger.info(f"Retrieved {len(all_memories)} existing memories from database")
            self.logger.info(f"  Interests: {len(updated_profile['interests'])}")
            self.logger.info(f"  Demographics: {len(updated_profile['demographics'])}")
            self.logger.info(f"  Household: {len(updated_profile['household'])}")

        # Build demographics - workflow returns list of memories, need to convert to DemographicsProfile
        from email_parser.models.iab_taxonomy import DemographicSelection
        demographics_list = updated_profile.get('demographics', [])
        demographics_dict = {}

        # Map grouping_value to demographic fields (same as profile_tier_formatter.py)
        grouping_to_demographic_field = {
            "Gender": "gender",
            "Age": "age_range",
            "Education (Highest Level)": "education",
            "Employment Status": "occupation",
            "Marital Status": "marital_status",
            "Language": "language",
        }

        if isinstance(demographics_list, list):
            # Map memory values to demographics fields
            for demo in demographics_list:
                if isinstance(demo, dict):
                    value = demo.get('value', '')
                    # Create DemographicSelection object from memory data
                    selection = DemographicSelection(
                        taxonomy_id=demo.get('taxonomy_id', 0),
                        tier_path=demo.get('tier_path', demo.get('category_path', 'Unknown')),
                        value=value,
                        confidence=demo.get('confidence', 0.7),
                        evidence_count=demo.get('evidence_count', 1),
                        last_validated=demo.get('last_validated', datetime.now().isoformat()),
                        days_since_validation=demo.get('days_since_validation', 0)
                    )

                    # Use grouping_value from taxonomy to map to correct field
                    grouping_value = demo.get('grouping_value', '')
                    field_name = grouping_to_demographic_field.get(grouping_value)

                    if field_name:
                        demographics_dict[field_name] = selection
                    else:
                        self.logger.warning(f"Unknown demographics grouping_value: {grouping_value} for classification: {value}")

        demographics = DemographicsProfile(**demographics_dict) if demographics_dict else DemographicsProfile()

        # Build household - workflow returns list of memories
        from email_parser.models.iab_taxonomy import TaxonomySelection, HouseholdLocation
        household_list = updated_profile.get('household', [])
        household_dict = {}
        location_fields = {}  # Accumulate location sub-fields

        # Map grouping_value to household fields (same as profile_tier_formatter.py)
        grouping_to_household_field = {
            "Household Income (USD)": "income",
            "Length of Residence": "length_of_residence",
            "Life Stage": "life_stage",
            "Median Home Value (USD)": "median_home_value",
            "Monthly Housing Payment (USD)": "monthly_housing_payment",
            "Number of Adults": "number_of_adults",
            "Number of Children": "number_of_children",
            "Number of Individuals": "number_of_individuals",
            "Ownership": "ownership",
            "Property_Type": "property_type",
            "Urbanization": "urbanization",
            "Language": "language"
        }

        if isinstance(household_list, list):
            for house in household_list:
                if isinstance(house, dict):
                    value = house.get('value', '')
                    tier_path = house.get('tier_path', house.get('category_path', 'Unknown'))

                    # Create TaxonomySelection object from memory data
                    selection = TaxonomySelection(
                        taxonomy_id=house.get('taxonomy_id', 0),
                        tier_path=tier_path,
                        value=value,
                        confidence=house.get('confidence', 0.7),
                        evidence_count=house.get('evidence_count', 1),
                        last_validated=house.get('last_validated', datetime.now().isoformat()),
                        days_since_validation=house.get('days_since_validation', 0)
                    )

                    # Use grouping_value from taxonomy to map to correct field
                    grouping_value = house.get('grouping_value', '')

                    # Handle "Home Location" specially - it has sub-fields
                    if grouping_value == "Home Location":
                        # Parse tier_path to determine location type
                        # Format: "Demographic | Household Data | Home Location | *Country Extension"
                        if "*Country Extension" in tier_path:
                            location_fields['country'] = selection
                        elif "*Region / State Extension" in tier_path:
                            location_fields['region_state'] = selection
                        elif "*City Extension" in tier_path:
                            location_fields['city'] = selection
                        elif "*Metro / DMA Extension" in tier_path:
                            location_fields['metro_dma'] = selection
                        elif "*Zip or postal code Extension" in tier_path:
                            location_fields['zip_postal'] = selection
                        else:
                            self.logger.warning(f"Unknown Home Location sub-type in tier_path: {tier_path}")
                    else:
                        # Regular household field
                        field_name = grouping_to_household_field.get(grouping_value)
                        if field_name:
                            household_dict[field_name] = selection
                        else:
                            self.logger.warning(f"Unknown household grouping_value: {grouping_value} for classification: {value}")

        # Build HouseholdLocation if we have any location fields
        if location_fields:
            household_dict['location'] = HouseholdLocation(**location_fields)

        household = HouseholdProfile(**household_dict) if household_dict else HouseholdProfile()

        # Build interests - need to extract from memory format
        interests = []
        for interest_data in updated_profile.get('interests', []):
            if isinstance(interest_data, dict) and 'value' in interest_data:
                # Extract required fields for InterestSelection
                try:
                    selection = InterestSelection(
                        taxonomy_id=interest_data.get('taxonomy_id', 0),
                        tier_path=interest_data.get('tier_path', interest_data.get('category_path', 'Unknown')),
                        value=interest_data['value'],
                        confidence=interest_data.get('confidence', 0.7),
                        evidence_count=interest_data.get('evidence_count', 1),
                        last_validated=interest_data.get('last_validated', datetime.now().isoformat()),
                        days_since_validation=interest_data.get('days_since_validation', 0)
                    )
                    interests.append(selection)
                except Exception as e:
                    self.logger.warning(f"Skipping invalid interest data: {e}")

        # Build purchase intent
        purchase_intent = []
        for purchase_data in updated_profile.get('purchase_intent', []):
            if isinstance(purchase_data, dict) and 'value' in purchase_data:
                try:
                    selection = PurchaseIntentSelection(
                        taxonomy_id=purchase_data.get('taxonomy_id', 0),
                        tier_path=purchase_data.get('tier_path', purchase_data.get('category_path', 'Unknown')),
                        value=purchase_data['value'],
                        confidence=purchase_data.get('confidence', 0.7),
                        evidence_count=purchase_data.get('evidence_count', 1),
                        last_validated=purchase_data.get('last_validated', datetime.now().isoformat()),
                        days_since_validation=purchase_data.get('days_since_validation', 0),
                        purchase_intent_flag=purchase_data.get('purchase_intent_flag')
                    )
                    purchase_intent.append(selection)
                except Exception as e:
                    self.logger.warning(f"Skipping invalid purchase intent data: {e}")

        # Build memory stats
        all_selections = interests + purchase_intent

        # Calculate confidence distribution
        high_confidence = sum(1 for s in all_selections if s.confidence >= 0.8)
        moderate_confidence = sum(1 for s in all_selections if 0.5 <= s.confidence < 0.8)
        low_confidence = sum(1 for s in all_selections if s.confidence < 0.5)

        # Calculate average confidence
        avg_confidence = (
            sum(s.confidence for s in all_selections) / len(all_selections)
            if all_selections else 0.7
        )

        # Calculate stale facts (>30 days since validation)
        facts_needing_validation = sum(
            1 for s in all_selections
            if s.days_since_validation and s.days_since_validation > 30
        )

        memory_stats = MemoryStats(
            total_facts_stored=len(all_selections),
            high_confidence_facts=high_confidence,
            moderate_confidence_facts=moderate_confidence,
            low_confidence_facts=low_confidence,
            facts_needing_validation=facts_needing_validation,
            average_confidence=avg_confidence
        )

        # Build generator metadata
        llm_provider = os.getenv('LLM_PROVIDER', 'openai')
        llm_model = state.get('llm_model') or f"{llm_provider}:default"
        generator = GeneratorMetadata(
            system="email_parser_iab_taxonomy",
            llm_model=llm_model,
            workflow_version="1.0"
        )

        # Build data coverage
        total_emails = state.get('total_emails', 0)
        emails_processed = state.get('current_email_index', 0)
        workflow_start = state.get('workflow_started_at', datetime.now().isoformat())
        workflow_end = state.get('workflow_completed_at', datetime.now().isoformat())

        data_coverage = DataCoverage(
            total_emails_analyzed=emails_processed,
            emails_this_run=emails_processed,
            date_range=f"{workflow_start[:10]} to {workflow_end[:10]}"
        )

        # Build section confidence
        # Calculate average confidence per section
        def calc_section_confidence(selections):
            return (
                sum(s.confidence for s in selections) / len(selections)
                if selections else 0.0
            )

        section_confidence = SectionConfidence(
            demographics=0.7,  # Placeholder - demographics don't have confidence scores in current model
            household=0.7,     # Placeholder
            interests=calc_section_confidence(interests),
            purchase_intent=calc_section_confidence(purchase_intent),
            actual_purchases=0.0  # No actual purchases in current implementation
        )

        # Create profile
        profile = IABConsumerProfile(
            user_id=user_id,
            profile_version=1,
            generated_at=datetime.now().isoformat(),
            generator=generator,
            data_coverage=data_coverage,
            demographics=demographics,
            household=household,
            interests=interests,
            purchase_intent=purchase_intent,
            memory_stats=memory_stats,
            section_confidence=section_confidence
        )

        return profile
    
    def run_full_pipeline(self,
                         providers: List[EmailProvider],
                         max_emails: int = 50,
                         output_file: str = "emails_processed.csv",
                         query: Optional[str] = None,
                         after_date: Optional[datetime] = None,
                         before_date: Optional[datetime] = None,
                         instruction: Optional[str] = None,
                         full_analysis: bool = True,
                         marketing_only: bool = False,
                         ikigai_only: bool = False,
                         pull_only: bool = False) -> ProcessingResult:
        """Run the complete email processing pipeline."""
        self.logger.info(f"Starting full pipeline - Providers: {[p.value for p in providers]}, Max emails: {max_emails}")
        
        if len(providers) == 1:
            return self._run_single_provider_pipeline(
                provider=providers[0],
                max_emails=max_emails,
                output_file=output_file,
                query=query,
                after_date=after_date,
                before_date=before_date,
                instruction=instruction,
                full_analysis=full_analysis,
                marketing_only=marketing_only,
                ikigai_only=ikigai_only,
                pull_only=pull_only
            )
        else:
            return self.run_multi_provider_pipeline(
                providers=providers,
                max_emails=max_emails,
                output_file=output_file,
                query=query,
                after_date=after_date,
                before_date=before_date,
                instruction=instruction,
                full_analysis=full_analysis,
                marketing_only=marketing_only,
                ikigai_only=ikigai_only,
                pull_only=pull_only
            )
    
    def _run_single_provider_pipeline(self,
                                     provider: EmailProvider,
                                     max_emails: int = 50,
                                     output_file: str = "emails_processed.csv",
                                     query: Optional[str] = None,
                                     after_date: Optional[datetime] = None,
                                     before_date: Optional[datetime] = None,
                                     instruction: Optional[str] = None,
                                     full_analysis: bool = True,
                                     marketing_only: bool = False,
                                     ikigai_only: bool = False,
                                     pull_only: bool = False) -> ProcessingResult:
        """Run pipeline for a single provider."""
        start_time = time.time()
        
        try:
            self.logger.info(f"Running single provider pipeline - Provider: {provider.value}")
            
            # Step 1: Download emails
            emails = self.download_emails(
                provider_type=provider,
                max_emails=max_emails,
                query=query,
                after_date=after_date,
                before_date=before_date
            )
            
            if pull_only:
                self.logger.info(f"Pull-only mode complete - Downloaded {len(emails)} emails")
                # Export raw emails to CSV for Step 2
                if emails and output_file:
                    self.export_raw_emails_to_csv(emails, output_file)
                    self.logger.info(f"Exported {len(emails)} raw emails to {output_file}")
                return ProcessingResult(
                    success=True,
                    processed_emails=[],
                    failed_emails=[],
                    processing_time=time.time() - start_time
                )
            
            if not emails:
                self.logger.warning("No emails downloaded - Pipeline complete")
                return ProcessingResult(
                    success=True,
                    processed_emails=[],
                    failed_emails=[],
                    processing_time=time.time() - start_time
                )
            
            # Step 2: Process emails with LLM (unless analysis-only modes)
            processed_emails = []
            if not marketing_only and not ikigai_only:
                processed_emails = self.process_emails_with_llm(
                    emails=emails,
                    instruction=instruction
                )
            
            # Step 3: Export to CSV (if we have processed emails)
            if processed_emails:
                self.export_to_csv(processed_emails, output_file)
                self.logger.info(f"Exported {len(processed_emails)} emails to {output_file}")
            
            # Step 4: Run additional analysis if requested
            if full_analysis or marketing_only:
                try:
                    marketing_file = f"marketing_{output_file}"
                    self.run_marketing_analysis(
                        processed_emails=[email.to_csv_row() for email in processed_emails] if processed_emails else None,
                        csv_file=output_file if not processed_emails else None,
                        output_file=marketing_file
                    )
                    self.logger.info(f"Marketing analysis complete - Output: {marketing_file}")
                except Exception as e:
                    self.logger.error(f"Marketing analysis failed - Error: {str(e)}")
                    if marketing_only:
                        raise
            
            if full_analysis or ikigai_only:
                try:
                    ikigai_file = f"ikigai_{output_file}"
                    holistic_ikigai_file = f"holistic_ikigai_{output_file}"
                    
                    # Run authentic ikigai analysis
                    self.run_ikigai_analysis(
                        processed_emails=[email.to_csv_row() for email in processed_emails] if processed_emails else None,
                        csv_file=output_file if not processed_emails else None,
                        output_file=ikigai_file,
                        use_holistic=False
                    )
                    
                    # Run holistic ikigai analysis
                    self.run_ikigai_analysis(
                        processed_emails=[email.to_csv_row() for email in processed_emails] if processed_emails else None,
                        csv_file=output_file if not processed_emails else None,
                        output_file=holistic_ikigai_file,
                        use_holistic=True
                    )
                    
                    self.logger.info(f"Ikigai analysis complete - Outputs: {ikigai_file}, {holistic_ikigai_file}")
                    
                except Exception as e:
                    self.logger.error(f"Ikigai analysis failed - Error: {str(e)}")
                    if ikigai_only:
                        raise
            
            # Create result
            failed_emails = [email.id for email in processed_emails if email.status == "failed"]
            successful_emails = [email for email in processed_emails if email.status != "failed"]
            
            result = ProcessingResult(
                success=True,
                processed_emails=successful_emails,
                failed_emails=failed_emails,
                processing_time=time.time() - start_time
            )
            
            self.logger.info(f"Single provider pipeline complete - Success: {len(successful_emails)}, Failed: {len(failed_emails)}, Duration: {result.processing_time:.2f}s")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Single provider pipeline failed - Provider: {provider.value}, Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'single_provider_pipeline',
                'provider': provider.value,
                'max_emails': max_emails
            })
            raise
    
    def run_multi_provider_pipeline(self,
                                   providers: List[EmailProvider],
                                   max_emails: int = 50,
                                   output_file: str = "emails_processed_combined.csv",
                                   query: Optional[str] = None,
                                   after_date: Optional[datetime] = None,
                                   before_date: Optional[datetime] = None,
                                   instruction: Optional[str] = None,
                                   full_analysis: bool = True,
                                   marketing_only: bool = False,
                                   ikigai_only: bool = False,
                                   pull_only: bool = False) -> ProcessingResult:
        """Run pipeline across multiple providers and combine results."""
        start_time = time.time()
        
        self.logger.info(f"Running multi-provider pipeline - Providers: {[p.value for p in providers]}")
        
        all_processed_emails = []
        all_failed_emails = []
        provider_results = {}
        
        try:
            for provider in providers:
                try:
                    self.logger.info(f"Processing provider: {provider.value}")
                    
                    # Run single provider pipeline
                    result = self._run_single_provider_pipeline(
                        provider=provider,
                        max_emails=max_emails,
                        output_file=f"{provider.value}_{output_file}",
                        query=query,
                        after_date=after_date,
                        before_date=before_date,
                        instruction=instruction,
                        full_analysis=False,  # We'll do combined analysis later
                        marketing_only=False,
                        ikigai_only=False,
                        pull_only=pull_only
                    )
                    
                    provider_results[provider.value] = result
                    all_processed_emails.extend(result.processed_emails)
                    all_failed_emails.extend(result.failed_emails)
                    
                    self.logger.info(f"Provider {provider.value} complete - Success: {len(result.processed_emails)}, Failed: {len(result.failed_emails)}")
                    
                except Exception as e:
                    self.logger.error(f"Provider {provider.value} failed - Error: {str(e)}")
                    provider_results[provider.value] = None
                    all_failed_emails.append(f"{provider.value}_provider_failure")
            
            if pull_only:
                self.logger.info(f"Multi-provider pull-only complete - Total emails: {sum(len(result.processed_emails) if result else 0 for result in provider_results.values())}")
                return ProcessingResult(
                    success=True,
                    processed_emails=[],
                    failed_emails=[],
                    processing_time=time.time() - start_time
                )
            
            # Export combined results
            if all_processed_emails:
                self.export_to_csv(all_processed_emails, output_file)
                self.logger.info(f"Combined export complete - {len(all_processed_emails)} emails to {output_file}")
            
            # Run combined analysis if requested
            if full_analysis or marketing_only:
                try:
                    marketing_file = f"marketing_{output_file}"
                    self.run_marketing_analysis(
                        processed_emails=[email.to_csv_row() for email in all_processed_emails],
                        output_file=marketing_file
                    )
                    self.logger.info(f"Combined marketing analysis complete - Output: {marketing_file}")
                except Exception as e:
                    self.logger.error(f"Combined marketing analysis failed - Error: {str(e)}")
                    if marketing_only:
                        raise
            
            if full_analysis or ikigai_only:
                try:
                    ikigai_file = f"ikigai_{output_file}"
                    holistic_ikigai_file = f"holistic_ikigai_{output_file}"
                    
                    # Run authentic ikigai analysis
                    self.run_ikigai_analysis(
                        processed_emails=[email.to_csv_row() for email in all_processed_emails],
                        output_file=ikigai_file,
                        use_holistic=False
                    )
                    
                    # Run holistic ikigai analysis
                    self.run_ikigai_analysis(
                        processed_emails=[email.to_csv_row() for email in all_processed_emails],
                        output_file=holistic_ikigai_file,
                        use_holistic=True
                    )
                    
                    self.logger.info(f"Combined ikigai analysis complete - Outputs: {ikigai_file}, {holistic_ikigai_file}")
                    
                except Exception as e:
                    self.logger.error(f"Combined ikigai analysis failed - Error: {str(e)}")
                    if ikigai_only:
                        raise
            
            # Create combined result
            result = ProcessingResult(
                success=len(provider_results) > 0 and any(r is not None for r in provider_results.values()),
                processed_emails=all_processed_emails,
                failed_emails=all_failed_emails,
                processing_time=time.time() - start_time
            )
            
            self.logger.info(f"Multi-provider pipeline complete - Total success: {len(all_processed_emails)}, Total failed: {len(all_failed_emails)}, Duration: {result.processing_time:.2f}s")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Multi-provider pipeline failed - Error: {str(e)}")
            self.enhanced_logger.log_error_with_context(e, {
                'operation': 'multi_provider_pipeline',
                'providers': [p.value for p in providers],
                'max_emails': max_emails
            })
            raise
    
    def export_to_csv(self, processed_emails: List[ProcessedEmail], output_file: str) -> None:
        """Export processed emails to CSV."""
        if not processed_emails:
            self.logger.warning("No processed emails to export")
            return
        
        try:
            # Convert to CSV rows
            csv_rows = []
            for email in processed_emails:
                row = email.to_csv_row(include_confidence=self.config.processing.output_include_confidence)
                csv_rows.append(row)
            
            # Create DataFrame and export
            df = pd.DataFrame(csv_rows)
            df.to_csv(output_file, index=False)
            
            self.logger.info(f"Exported {len(processed_emails)} emails to {output_file}")
            
        except Exception as e:
            self.logger.error(f"CSV export failed - File: {output_file}, Error: {str(e)}")
            raise

    def export_raw_emails_to_csv(self, raw_emails: List[RawEmail], output_file: str) -> None:
        """Export raw emails to CSV for Step 2 processing."""
        if not raw_emails:
            self.logger.warning("No raw emails to export")
            return

        try:
            # Convert to CSV rows
            csv_rows = []
            for email in raw_emails:
                row = {
                    'ID': email.id,
                    'Date': email.date.isoformat() if email.date else '',
                    'From': email.from_email or '',
                    'Subject': email.subject or '',
                    'body_plain': email.body_plain or '',
                    'provider': email.provider.value
                }
                csv_rows.append(row)

            # Create DataFrame and export
            df = pd.DataFrame(csv_rows)
            df.to_csv(output_file, index=False)

            self.logger.info(f"Exported {len(raw_emails)} raw emails to {output_file}")

        except Exception as e:
            self.logger.error(f"Raw CSV export failed - File: {output_file}, Error: {str(e)}")
            raise

    def load_raw_emails_from_csv(self, csv_path: str) -> List[RawEmail]:
        """
        Load raw emails from Step 1 CSV output.

        Args:
            csv_path: Path to CSV file from --pull-only step

        Returns:
            List of RawEmail objects

        CSV Format Expected:
            ID, Date, From, Subject, body_plain, provider
        """
        self.logger.info(f"Loading raw emails from CSV: {csv_path}")

        try:
            df = pd.read_csv(csv_path)

            # Validate required columns
            required_cols = ['ID', 'From', 'Subject']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                raise ValueError(f"CSV missing required columns: {missing_cols}")

            # Determine body column name (could be 'body_plain' or 'Body')
            body_col = None
            for col in ['body_plain', 'Body', 'body', 'content']:
                if col in df.columns:
                    body_col = col
                    break

            if not body_col:
                raise ValueError("CSV must have a body column (body_plain, Body, body, or content)")

            raw_emails = []
            for _, row in df.iterrows():
                # Determine provider
                provider = EmailProvider.GMAIL  # Default
                if 'provider' in df.columns:
                    provider_str = str(row['provider']).lower()
                    if 'outlook' in provider_str or 'hotmail' in provider_str:
                        provider = EmailProvider.OUTLOOK

                # Parse date
                email_date = None
                if 'Date' in df.columns and pd.notna(row['Date']):
                    try:
                        email_date = pd.to_datetime(row['Date'])
                    except:
                        pass

                raw_email = RawEmail(
                    id=str(row['ID']),
                    provider=provider,
                    date=email_date,
                    from_email=str(row.get('From', '')),
                    subject=str(row.get('Subject', '')),
                    body_plain=str(row.get(body_col, '')),
                    body_html=None,
                    headers={},
                    attachments=[]
                )
                raw_emails.append(raw_email)

            self.logger.info(f"Loaded {len(raw_emails)} raw emails from CSV")
            return raw_emails

        except Exception as e:
            self.logger.error(f"Failed to load raw emails from CSV: {e}")
            raise

    def load_summaries_from_csv(self, csv_path: str) -> List[ProcessedEmail]:
        """
        Load processed emails (with summaries) from Step 2 CSV output.

        Args:
            csv_path: Path to CSV file from --summarize-only step

        Returns:
            List of ProcessedEmail objects with summaries

        CSV Format Expected:
            ID, Date, From, Subject, Summary, Category, Products, Status
        """
        self.logger.info(f"Loading summaries from CSV: {csv_path}")

        try:
            df = pd.read_csv(csv_path)

            # Validate this is a summaries CSV (has Summary column)
            if 'Summary' not in df.columns:
                raise ValueError("CSV does not appear to be a summaries file (missing 'Summary' column)")

            processed_emails = []
            for _, row in df.iterrows():
                # Parse provider
                provider = EmailProvider.GMAIL  # Default
                if 'provider' in df.columns:
                    provider_str = str(row['provider']).lower()
                    if 'outlook' in provider_str:
                        provider = EmailProvider.OUTLOOK

                # Parse date
                email_date = None
                if 'Date' in df.columns and pd.notna(row['Date']):
                    try:
                        email_date = pd.to_datetime(row['Date'])
                    except:
                        pass

                # Create EmailSummary
                summary = None
                if pd.notna(row.get('Summary')):
                    summary = EmailSummary(
                        email_id=str(row['ID']),
                        summary=str(row['Summary']),
                        word_count=len(str(row.get('Summary', '')).split()),
                        confidence=float(row.get('Summary_Confidence', 0.8)),
                        processing_time=0.0
                    )

                # Create EmailClassification
                classification = None
                if pd.notna(row.get('Category')):
                    try:
                        category = EmailCategory(str(row['Category']))
                    except:
                        category = EmailCategory.OTHER

                    classification = EmailClassification(
                        category=category,
                        category_confidence=float(row.get('Category_Confidence', 0.8)),
                        products=[],
                        products_confidence=float(row.get('Products_Confidence', 0.0)),
                        key_topics=str(row.get('Key_Topics', ''))
                    )

                # Parse status
                status = ProcessingStatus.COMPLETED
                if 'Status' in df.columns:
                    try:
                        status = ProcessingStatus(str(row['Status']))
                    except:
                        status = ProcessingStatus.COMPLETED

                processed_email = ProcessedEmail(
                    id=str(row['ID']),
                    provider=provider,
                    date=email_date,
                    from_email=str(row.get('From', '')),
                    subject=str(row.get('Subject', '')),
                    summary=summary,
                    classification=classification,
                    status=status
                )
                processed_emails.append(processed_email)

            self.logger.info(f"Loaded {len(processed_emails)} processed emails from CSV")
            return processed_emails

        except Exception as e:
            self.logger.error(f"Failed to load summaries from CSV: {e}")
            raise

    def show_session_logs(self, detailed: bool = False) -> None:
        """Display session logs and statistics."""
        print("\\n" + "="*60)
        print("EMAIL PARSER SESSION SUMMARY")
        print("="*60)
        
        # Session overview
        duration = datetime.now() - self.session_stats['start_time']
        print(f"Session Duration: {duration}")
        print(f"Emails Downloaded: {self.session_stats['emails_downloaded']}")
        print(f"Emails Processed: {self.session_stats['emails_processed']}")
        print(f"Emails Analyzed: {self.session_stats['emails_analyzed']}")
        print(f"Providers Used: {', '.join(self.session_stats['providers_used']) or 'None'}")
        print(f"Models Used: {', '.join(self.session_stats['models_used']) or 'None'}")
        print(f"Errors: {len(self.session_stats['errors'])}")
        
        # Error details
        if self.session_stats['errors'] and detailed:
            print("\\n" + "-"*40)
            print("ERROR DETAILS")
            print("-"*40)
            for i, error in enumerate(self.session_stats['errors'], 1):
                print(f"{i}. Operation: {error['operation']}")
                print(f"   Error: {error['error']}")
                print(f"   Time: {error['timestamp']}")
                if i < len(self.session_stats['errors']):
                    print()
        
        # Log file locations
        log_dir = self.enhanced_logger.get_session_logs_dir()
        structured_log = self.enhanced_logger.get_structured_log_file()
        
        print("\\n" + "-"*40)
        print("LOG FILES")
        print("-"*40)
        print(f"Log Directory: {log_dir}")
        print(f"Structured Logs: {structured_log}")
        
        if detailed:
            print("\\n" + "-"*40)
            print("PROCESSED EMAILS SAMPLE")
            print("-"*40)
            if self.session_emails:
                for i, email in enumerate(self.session_emails[:3], 1):
                    print(f"{i}. {email.subject or 'No Subject'}")
                    print(f"   From: {email.from_email or 'Unknown'}")
                    print(f"   Status: {email.status}")
                    if i < min(3, len(self.session_emails)):
                        print()
                if len(self.session_emails) > 3:
                    print(f"... and {len(self.session_emails) - 3} more")
            else:
                print("No emails processed in this session")
        
        print("="*60)
    
    def _get_provider_config(self, provider_type: EmailProvider) -> Dict[str, Any]:
        """Get configuration for email provider."""
        if provider_type == EmailProvider.GMAIL:
            return {
                'gmail_credentials_file': self.config.email_providers.gmail_credentials_file,
                'gmail_token_file': self.config.email_providers.gmail_token_file,
                'gmail_scopes': self.config.email_providers.gmail_scopes,
            }
        elif provider_type == EmailProvider.OUTLOOK:
            return {
                'microsoft_client_id': self.config.email_providers.microsoft_client_id,
                'microsoft_client_secret': self.config.email_providers.microsoft_client_secret,
                'microsoft_tenant_id': self.config.email_providers.microsoft_tenant_id,
                'microsoft_token_file': self.config.email_providers.microsoft_token_file,
                'microsoft_scopes': self.config.email_providers.microsoft_scopes,
            }
        else:
            raise ValueError(f"Unsupported provider: {provider_type}")
    
    def _get_llm_config(self) -> Dict[str, Any]:
        """Get configuration for LLM client."""
        import os
        return {
            'ollama_base_url': self.config.llm.ollama_base_url,
            'ollama_model': self.config.llm.ollama_model,
            'ollama_timeout': self.config.llm.ollama_timeout,
            'openai_api_key': self.config.llm.openai_api_key,
            'openai_model': self.config.llm.openai_model,
            'openai_max_tokens': self.config.llm.openai_max_tokens,
            'openai_temperature': self.config.llm.openai_temperature,
            'anthropic_api_key': self.config.llm.anthropic_api_key,
            'anthropic_model': self.config.llm.anthropic_model,
            'anthropic_max_tokens': self.config.llm.anthropic_max_tokens,
            'seed': int(os.getenv('LLM_SEED', '42')),
            'redact_reports': os.getenv('REDACT_REPORTS', '') in ('1','true','yes','on')
        }
    
    def _format_email_for_analysis(self, email: RawEmail) -> str:
        """Format raw email for LLM analysis."""
        content_parts = []
        
        # Add subject
        if email.subject:
            content_parts.append(f"Subject: {email.subject}")
        
        # Add sender
        if email.from_email:
            content_parts.append(f"From: {email.from_email}")
        
        # Add date
        if email.date:
            content_parts.append(f"Date: {email.date.strftime('%Y-%m-%d %H:%M:%S')}")
        
        # Add body (prefer plain text, fall back to HTML)
        body = email.body_plain or email.body_html or ""
        if body:
            content_parts.append(f"Content: {body[:2000]}")  # Limit content length
        
        return "\\n\\n".join(content_parts)
    
    def _convert_analysis_to_processed_email(self, raw_email: RawEmail, analysis: Dict[str, Any]) -> ProcessedEmail:
        """Convert LLM analysis result to ProcessedEmail."""
        from email_parser.models.email import EmailSummary, EmailClassification, ProductExtraction, EmailCategory, ProcessingStatus
        
        try:
            # Create summary
            summary = EmailSummary(
                email_id=raw_email.id,
                summary=analysis.get('summary', 'No summary available'),
                word_count=len((raw_email.body_plain or raw_email.body_html or '').split()),
                confidence=analysis.get('confidence', 0.7),
                processing_time=analysis.get('processing_time', 0.0)
            )
            
            # Create product extractions
            products = []
            for product_data in analysis.get('products', []):
                if isinstance(product_data, dict):
                    product = ProductExtraction(
                        name=product_data.get('name', ''),
                        category=product_data.get('category'),
                        brand=product_data.get('brand'),
                        model=product_data.get('model'),
                        price=product_data.get('price'),
                        confidence=product_data.get('confidence', 0.5)
                    )
                    products.append(product)
                elif isinstance(product_data, str):
                    # Simple string product
                    product = ProductExtraction(
                        name=product_data,
                        confidence=0.5
                    )
                    products.append(product)
            
            # Create classification
            category_str = analysis.get('category', 'Other')
            try:
                category = EmailCategory(category_str)
            except ValueError:
                category = EmailCategory.OTHER
            
            # Handle key_topics - convert list to comma-separated string if needed
            key_topics_raw = analysis.get('key_topics')
            key_topics = None
            if key_topics_raw:
                if isinstance(key_topics_raw, list):
                    key_topics = ', '.join(str(topic) for topic in key_topics_raw)
                elif isinstance(key_topics_raw, str):
                    key_topics = key_topics_raw

            classification = EmailClassification(
                email_id=raw_email.id,
                category=category,
                category_confidence=analysis.get('category_confidence', 0.7),
                products=products,
                products_confidence=analysis.get('products_confidence', 0.7),
                keywords=analysis.get('keywords', []),
                key_topics=key_topics,
                sentiment=analysis.get('sentiment'),
                processing_time=analysis.get('processing_time', 0.0)
            )
            
            # Create processed email
            processed_email = ProcessedEmail(
                id=raw_email.id,
                provider=raw_email.provider,
                date=raw_email.date,
                from_email=raw_email.from_email,
                subject=raw_email.subject,
                summary=summary,
                classification=classification,
                status=ProcessingStatus.COMPLETED
            )
            
            return processed_email
            
        except Exception as e:
            # Create failed email
            self.logger.warning(f"Failed to convert analysis for email {raw_email.id} - Error: {str(e)}")
            return ProcessedEmail(
                id=raw_email.id,
                provider=raw_email.provider,
                date=raw_email.date,
                from_email=raw_email.from_email,
                subject=raw_email.subject,
                status=ProcessingStatus.FAILED,
                error_message=str(e)
            )


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure the argument parser."""
    parser = argparse.ArgumentParser(
        description="Email Parser - Download, process, and analyze emails with AI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Download and process Gmail emails
  python main.py --provider gmail --max-emails 50

  # Generate IAB Taxonomy profile from emails
  python main.py --iab-profile --provider gmail --max-emails 50

  # Generate IAB profile from existing CSV
  python main.py --iab-csv emails_processed.csv --iab-output my_profile.json

  # Run full analysis pipeline
  python main.py --provider gmail outlook --full-analysis --max-emails 100

  # Marketing analysis only
  python main.py --analyze-csv emails_processed.csv --marketing-only

  # Discrete 3-step workflow (Phase 2):
  # Step 1: Download emails only
  python main.py --pull-only --provider gmail --max-emails 100 --output raw.csv

  # Step 2: Summarize emails only
  python main.py --summarize-only --input-csv raw.csv --output summaries.csv

  # Step 3: IAB classification from summaries
  python main.py --iab-csv summaries.csv --iab-output profile.json --user-id user_123

  # Show session logs
  python main.py --show-logs
        """
    )
    
    # Main operation arguments
    parser.add_argument(
        '--provider',
        type=str,
        choices=['gmail', 'outlook', 'hotmail'],
        nargs='+',
        help='Email provider(s) to use (space-separated: --provider gmail outlook)'
    )
    
    parser.add_argument(
        '--max-emails',
        type=int,
        default=50,
        help='Maximum number of emails to download per provider (default: 50)'
    )
    
    
    # Email filtering
    parser.add_argument(
        '--query',
        type=str,
        help='Email search query (provider-specific syntax)'
    )
    
    parser.add_argument(
        '--after-date',
        type=str,
        help='Download emails after this date (YYYY-MM-DD)'
    )
    
    parser.add_argument(
        '--before-date',
        type=str,
        help='Download emails before this date (YYYY-MM-DD)'
    )
    
    # Output options
    parser.add_argument(
        '--output',
        type=str,
        default='emails_processed.csv',
        help='Output CSV file name (default: emails_processed.csv)'
    )
    
    parser.add_argument(
        '--instruction',
        type=str,
        help='Custom instruction for LLM processing'
    )
    
    # Analysis modes
    parser.add_argument(
        '--pull-only',
        action='store_true',
        help='Only download emails, skip processing'
    )
    
    parser.add_argument(
        '--full-analysis',
        action='store_true',
        help='Run complete analysis pipeline (processing + marketing + ikigai)'
    )
    
    parser.add_argument(
        '--marketing-only',
        action='store_true',
        help='Run marketing analysis only'
    )
    
    parser.add_argument(
        '--ikigai-only',
        action='store_true',
        help='Run ikigai analysis only'
    )
    
    # CSV input analysis
    parser.add_argument(
        '--analyze-csv',
        type=str,
        help='Analyze existing CSV file instead of downloading emails'
    )
    
    parser.add_argument(
        '--ikigai-csv',
        type=str,
        help='Run ikigai analysis on existing CSV file'
    )
    
    parser.add_argument(
        '--holistic-ikigai-csv',
        type=str,
        help='Run holistic ikigai analysis on existing CSV file'
    )

    # IAB Taxonomy Profile
    parser.add_argument(
        '--iab-profile',
        action='store_true',
        help='Generate IAB Taxonomy consumer profile from emails'
    )

    parser.add_argument(
        '--iab-output',
        type=str,
        default='iab_consumer_profile.json',
        help='Output JSON file for IAB profile (default: iab_consumer_profile.json)'
    )

    parser.add_argument(
        '--iab-csv',
        type=str,
        help='Generate IAB profile from existing CSV file instead of downloading emails'
    )

    parser.add_argument(
        '--user-id',
        type=str,
        help='User identifier for IAB profile (enables persistence testing across sessions)'
    )

    parser.add_argument(
        '--force-reprocess',
        action='store_true',
        help='Force reprocessing of all emails (ignore already-processed tracking)'
    )

    # Configuration
    parser.add_argument(
        '--config',
        type=str,
        help='Path to configuration file'
    )
    
    # Utilities
    parser.add_argument(
        '--show-logs',
        action='store_true',
        help='Show session logs and statistics'
    )
    
    parser.add_argument(
        '--show-logs-detailed',
        action='store_true',
        help='Show detailed session logs and statistics'
    )
    
    # Processing options
    parser.add_argument(
        '--concurrent',
        action='store_true',
        help='Enable concurrent processing (experimental)'
    )

    # Reproducibility & privacy options
    parser.add_argument(
        '--seed',
        type=int,
        help='Deterministic seed for sampling and analysis'
    )
    parser.add_argument(
        '--redact',
        action='store_true',
        help='Redact PII (emails, IDs) in exported reports'
    )

    # Discrete step control (Phase 2)
    parser.add_argument(
        '--summarize-only',
        action='store_true',
        help='Step 2: Summarize emails using EMAIL_MODEL without running IAB classification'
    )

    parser.add_argument(
        '--input-csv',
        type=str,
        help='Input CSV file (raw emails for summarization, summaries for classification)'
    )

    parser.add_argument(
        '--email-model',
        type=str,
        help='Override EMAIL_MODEL from .env (format: provider:model, e.g., google:gemini-2.0-flash-exp)'
    )

    parser.add_argument(
        '--taxonomy-model',
        type=str,
        help='Override TAXONOMY_MODEL from .env (format: provider:model, e.g., openai:gpt-4o-mini)'
    )

    return parser


def parse_date_argument(date_str: str) -> datetime:
    """Parse date argument string to datetime."""
    try:
        return datetime.strptime(date_str, '%Y-%m-%d')
    except ValueError:
        raise ValueError(f"Invalid date format: {date_str}. Use YYYY-MM-DD format.")


def main():
    """Main entry point."""
    parser = create_argument_parser()
    args = parser.parse_args()
    
    # Initialize logging
    enhanced_logger = get_logger()
    logger = logging.getLogger(__name__)
    
    try:
        # Apply CLI overrides to environment so downstream components can read them
        import os
        if args.seed is not None:
            os.environ['LLM_SEED'] = str(args.seed)
        if args.redact:
            os.environ['REDACT_REPORTS'] = '1'
        # Handle log display commands
        if args.show_logs or args.show_logs_detailed:
            email_parser = EmailParser()
            email_parser.show_session_logs(detailed=args.show_logs_detailed)
            return
        
        # Handle CSV-only analysis
        if args.analyze_csv:
            if not Path(args.analyze_csv).exists():
                logger.error(f"CSV file not found: {args.analyze_csv}")
                sys.exit(1)
            
            email_parser = EmailParser()
            
            if args.marketing_only or args.full_analysis:
                marketing_file = f"marketing_{args.analyze_csv}"
                email_parser.run_marketing_analysis(
                    csv_file=args.analyze_csv,
                    output_file=marketing_file
                )
                logger.info(f"Marketing analysis complete: {marketing_file}")
            
            if args.ikigai_only or args.full_analysis:
                ikigai_file = f"ikigai_{args.analyze_csv}"
                holistic_ikigai_file = f"holistic_ikigai_{args.analyze_csv}"
                
                email_parser.run_ikigai_analysis(
                    csv_file=args.analyze_csv,
                    output_file=ikigai_file,
                    use_holistic=False
                )
                
                email_parser.run_ikigai_analysis(
                    csv_file=args.analyze_csv,
                    output_file=holistic_ikigai_file,
                    use_holistic=True
                )
                
                logger.info(f"Ikigai analysis complete: {ikigai_file}, {holistic_ikigai_file}")
            
            email_parser.show_session_logs()
            return
        
        # Handle individual ikigai CSV analysis
        if args.ikigai_csv:
            if not Path(args.ikigai_csv).exists():
                logger.error(f"CSV file not found: {args.ikigai_csv}")
                sys.exit(1)
            
            email_parser = EmailParser()
            ikigai_file = f"ikigai_{args.ikigai_csv}"
            
            email_parser.run_ikigai_analysis(
                csv_file=args.ikigai_csv,
                output_file=ikigai_file,
                use_holistic=False
            )
            logger.info(f"Authentic ikigai analysis complete: {ikigai_file}")
            email_parser.show_session_logs()
            return
        
        if args.holistic_ikigai_csv:
            if not Path(args.holistic_ikigai_csv).exists():
                logger.error(f"CSV file not found: {args.holistic_ikigai_csv}")
                sys.exit(1)

            email_parser = EmailParser()
            holistic_ikigai_file = f"holistic_ikigai_{args.holistic_ikigai_csv}"

            email_parser.run_ikigai_analysis(
                csv_file=args.holistic_ikigai_csv,
                output_file=holistic_ikigai_file,
                use_holistic=True
            )
            logger.info(f"Holistic ikigai analysis complete: {holistic_ikigai_file}")
            email_parser.show_session_logs()
            return

        # Handle Step 2: Summarization only (discrete step control)
        if args.summarize_only:
            if not args.input_csv:
                logger.error("--summarize-only requires --input-csv (path to raw emails CSV)")
                sys.exit(1)

            if not Path(args.input_csv).exists():
                logger.error(f"Input CSV file not found: {args.input_csv}")
                sys.exit(1)

            email_parser = EmailParser()

            logger.info(f"🔄 Step 2: Summarizing emails from CSV: {args.input_csv}")

            # Load raw emails from CSV (Step 1 output)
            raw_emails = email_parser.load_raw_emails_from_csv(args.input_csv)

            if not raw_emails:
                logger.error("No emails found in input CSV")
                sys.exit(1)

            logger.info(f"Loaded {len(raw_emails)} raw emails from CSV")

            # Apply model override if --email-model provided
            if args.email_model:
                # Override EMAIL_MODEL in environment
                os.environ['EMAIL_MODEL'] = args.email_model
                logger.info(f"Using EMAIL_MODEL override: {args.email_model}")

            # Process emails with LLM (summarization)
            processed_emails = email_parser.process_emails_with_llm(
                raw_emails,
                instruction=args.instruction
            )

            # Save summaries to output CSV
            output_file = args.output or 'emails_summaries.csv'
            email_parser.export_to_csv(processed_emails, output_file)

            logger.info(f"✅ Step 2 complete: {len(processed_emails)} emails summarized → {output_file}")
            logger.info(f"Next step: Run IAB classification with --iab-csv {output_file}")
            return

        # Handle IAB profile generation from CSV (Step 3: Classification)
        if args.iab_csv:
            if not Path(args.iab_csv).exists():
                logger.error(f"CSV file not found: {args.iab_csv}")
                sys.exit(1)

            email_parser = EmailParser()

            # Detect CSV format (summaries from Step 2 or raw emails from Step 1)
            df = pd.read_csv(args.iab_csv)
            has_summaries = 'Summary' in df.columns or 'summary' in df.columns
            has_body = any(col in df.columns for col in ['body', 'Body', 'body_plain'])

            if has_summaries:
                logger.info(f"🔄 Step 3: Detected summaries CSV (Step 2 output) - skipping re-summarization")
            elif has_body:
                logger.info(f"🔄 Detected raw emails CSV (Step 1 output) - will summarize before classification")
            else:
                logger.warning("CSV format unclear - proceeding with IAB workflow")

            # Apply model override if --taxonomy-model provided
            if args.taxonomy_model:
                os.environ['TAXONOMY_MODEL'] = args.taxonomy_model
                logger.info(f"Using TAXONOMY_MODEL override: {args.taxonomy_model}")

            logger.info(f"Generating IAB profile from CSV: {args.iab_csv}")
            output_path = email_parser.generate_iab_profile(
                csv_file=args.iab_csv,
                output_file=args.iab_output,
                user_id=args.user_id,
                force_reprocess=args.force_reprocess
            )

            logger.info(f"✅ Step 3 complete: IAB profile generated → {output_path}")
            if has_summaries:
                logger.info(f"Successfully used summaries from Step 2 (no re-summarization needed)")
            # Note: Session logs show legacy processing stats, not IAB workflow stats
            # email_parser.show_session_logs()
            return

        # Handle IAB profile generation with email download
        if args.iab_profile:
            if not args.provider:
                logger.error("IAB profile generation requires --provider (gmail or outlook)")
                sys.exit(1)

            # Parse providers
            providers = []
            for provider_str in args.provider:
                try:
                    provider = EmailProvider(provider_str)
                    providers.append(provider)
                except ValueError:
                    logger.error(f"Invalid provider: {provider_str}")
                    sys.exit(1)

            # Parse date arguments
            after_date = None
            before_date = None
            if args.after_date:
                try:
                    after_date = parse_date_argument(args.after_date)
                except ValueError as e:
                    logger.error(str(e))
                    sys.exit(1)

            if args.before_date:
                try:
                    before_date = parse_date_argument(args.before_date)
                except ValueError as e:
                    logger.error(str(e))
                    sys.exit(1)

            # Initialize email parser
            email_parser = EmailParser()

            # Download emails from all providers
            all_emails = []
            for provider in providers:
                logger.info(f"Downloading emails from {provider.value}...")
                emails = email_parser.download_emails(
                    provider_type=provider,
                    max_emails=args.max_emails,
                    query=args.query,
                    after_date=after_date,
                    before_date=before_date
                )
                all_emails.extend(emails)
                logger.info(f"Downloaded {len(emails)} emails from {provider.value}")

            if not all_emails:
                logger.warning("No emails downloaded. Cannot generate IAB profile.")
                sys.exit(1)

            logger.info(f"Total emails downloaded: {len(all_emails)}")
            logger.info("Generating IAB Taxonomy profile...")

            # Generate IAB profile
            output_path = email_parser.generate_iab_profile(
                emails=all_emails,
                output_file=args.iab_output,
                user_id=args.user_id,
                force_reprocess=args.force_reprocess
            )

            logger.info(f"✅ IAB profile generation complete: {output_path}")
            # Note: Session logs show legacy processing stats, not IAB workflow stats
            # email_parser.show_session_logs()
            return

        # Main pipeline execution
        if not args.provider:
            logger.error("No email provider specified. Use --provider gmail or --provider outlook")
            parser.print_help()
            sys.exit(1)
        
        # Parse providers
        providers = []
        for provider_str in args.provider:
            try:
                provider = EmailProvider(provider_str)
                providers.append(provider)
            except ValueError:
                logger.error(f"Invalid provider: {provider_str}")
                sys.exit(1)
        
        # Parse date arguments
        after_date = None
        before_date = None
        if args.after_date:
            try:
                after_date = parse_date_argument(args.after_date)
            except ValueError as e:
                logger.error(str(e))
                sys.exit(1)
        
        if args.before_date:
            try:
                before_date = parse_date_argument(args.before_date)
            except ValueError as e:
                logger.error(str(e))
                sys.exit(1)
        
        # Initialize email parser
        logger.info("Initializing Email Parser")
        email_parser = EmailParser()
        
        # Get model configurations from .env file via config
        config = email_parser.config.llm
        
        # Log configuration
        enhanced_logger.log_structured("pipeline_start", {
            "providers": [p.value for p in providers],
            "max_emails": args.max_emails,
            "email_model": config.email_model,
            "marketing_model": config.marketing_model,
            "ikigai_model": config.ikigai_model,
            "full_analysis": args.full_analysis,
            "pull_only": args.pull_only,
            "marketing_only": args.marketing_only,
            "ikigai_only": args.ikigai_only
        })
        
        # Run pipeline
        result = email_parser.run_full_pipeline(
            providers=providers,
            max_emails=args.max_emails,
            output_file=args.output,
            query=args.query,
            after_date=after_date,
            before_date=before_date,
            instruction=args.instruction,
            full_analysis=args.full_analysis,
            marketing_only=args.marketing_only,
            ikigai_only=args.ikigai_only,
            pull_only=args.pull_only
        )
        
        # Log results
        enhanced_logger.log_structured("pipeline_complete", {
            "success": result.success,
            "processed_emails": len(result.processed_emails),
            "failed_emails": len(result.failed_emails),
            "processing_time": result.processing_time
        })
        
        # Show session summary
        email_parser.show_session_logs()
        
        # Exit with appropriate code
        if result.success:
            logger.info("Email processing pipeline completed successfully")
        else:
            logger.error("Email processing pipeline completed with errors")
            sys.exit(1)
        
    except KeyboardInterrupt:
        logger.info("Pipeline interrupted by user")
        sys.exit(130)
    except Exception as e:
        logger.error(f"Pipeline failed with error: {str(e)}")
        enhanced_logger.log_error_with_context(e, {
            'operation': 'main_pipeline',
            'args': vars(args)
        })
        sys.exit(1)


if __name__ == "__main__":
    main()
