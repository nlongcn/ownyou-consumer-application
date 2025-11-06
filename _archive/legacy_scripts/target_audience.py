import logging
import json
import subprocess
import pandas as pd
import csv
from tqdm import tqdm
import traceback
from typing import List, Optional, Dict
from pydantic import BaseModel, Field

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("detailed_log.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EmailClassification(BaseModel):
    category: str = Field(..., description="Category of the email")
    category_probability: float = Field(..., description="Confidence score of the category classification")
    products: List[str] = Field(default_factory=list, description="List of products mentioned in the email")
    products_probability: float = Field(..., description="Confidence score of the products extraction")

    @staticmethod
    def from_response(response: str) -> Optional['EmailClassification']:
        try:
            data = json.loads(response)
            return EmailClassification(
                category=data.get("category", "Uncategorized"),
                category_probability=data.get("category_probability", 0.0),
                products=data.get("products", []),
                products_probability=data.get("products_probability", 0.0)
            )
        except json.JSONDecodeError as e:
            logger.error(f"JSON decoding failed: {e}")
            logger.debug(f"Invalid JSON response: {response}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error during parsing response: {e}")
            logger.debug(traceback.format_exc())
            return None

def query_ollama(prompt: str, model: str = "llama3.1:70b") -> Optional[str]:
    """
    Query the local Ollama model using subprocess and return the response.
    """
    try:
        process = subprocess.run(
            ["ollama", "run", model],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=60
        )
        if process.returncode != 0:
            logger.error(f"Ollama process failed: {process.stderr.strip()}")
            return None
        return process.stdout.strip()
    except subprocess.TimeoutExpired:
        logger.error("Ollama process timed out.")
        return None
    except Exception as e:
        logger.error(f"Error querying Ollama: {e}")
        logger.debug(traceback.format_exc())
        return None

def analyze_email(summary: str) -> Optional[EmailClassification]:
    """
    Analyze a single email summary to extract category and products.
    """
    if not summary:
        logger.warning("Empty email summary provided for analysis.")
        return None

    prompt = f"""
You are an AI assistant that processes email summaries to extract information and output it as JSON.
Only output JSON without explanations.
Given the following email summary:

---
{summary}
---

Please perform two tasks:

1. Classify this email into one of these categories:
   - Purchase
   - Information/News/Blog
   - Personal Communication

2. Extract any specific products mentioned in the email.

Format your response as JSON:
{{
  "category": "category_name",
  "category_probability": 0.95,
  "products": ["product1", "product2"],
  "products_probability": 0.85
}}

Notes:
- For products, include only specific product names/models mentioned
- If no products are mentioned, use empty list []
- Use probabilities between 0 and 1
- Ensure the response is valid JSON
"""

    logger.debug(f"Generated prompt for analysis:\n{prompt}")

    response = query_ollama(prompt)
    if response:
        logger.debug(f"Ollama response: {response}")
        classification = EmailClassification.from_response(response)
        if classification:
            logger.debug(f"Analysis Result - Category: {classification.category}, "
                      f"Products: {classification.products}")
            return classification
        else:
            logger.error("Failed to parse analysis from Ollama response.")
            return None
    else:
        logger.error("No response received from Ollama.")
        return None

def process_emails(emails: List[str], output_filename: str = 'email_taxonomy.csv'):
    """Process a list of emails to extract categories and products."""
    processed_data = []

    for idx, summary in enumerate(tqdm(emails, desc="Processing Emails", unit="email"), start=1):
        try:
            logger.info(f"Processing email ID: {idx}")
            if summary:
                analysis = analyze_email(summary)
                if analysis:
                    processed_data.append({
                        'ID': idx,
                        'Summary': summary,
                        'Category': analysis.category,
                        'Category_Probability': analysis.category_probability,
                        'Products': '; '.join(analysis.products) if analysis.products else '',
                        'Products_Probability': analysis.products_probability
                    })
                else:
                    logger.warning(f"Analysis failed for email ID: {idx}")
                    processed_data.append({
                        'ID': idx,
                        'Summary': summary,
                        'Category': "Analysis Error",
                        'Category_Probability': 0.0,
                        'Products': '',
                        'Products_Probability': 0.0
                    })
            else:
                logger.warning(f"Skipping email due to empty summary (ID: {idx})")
                processed_data.append({
                    'ID': idx,
                    'Summary': '',
                    'Category': "Empty email summary",
                    'Category_Probability': 0.0,
                    'Products': '',
                    'Products_Probability': 0.0
                })

        except Exception as e:
            logger.error(f"Error processing email (ID: {idx}): {e}")
            logger.debug(traceback.format_exc())
            processed_data.append({
                'ID': idx,
                'Summary': summary,
                'Category': "Processing Error",
                'Category_Probability': 0.0,
                'Products': '',
                'Products_Probability': 0.0
            })

    processed_df = pd.DataFrame(processed_data)
    processed_df.to_csv(output_filename, index=False, quoting=csv.QUOTE_ALL)
    logger.info(f"Processed email data saved to '{output_filename}'.")

def main():
    try:
        emails_df = pd.read_csv('emails_processed.csv')
        emails = emails_df['Summary'].tolist()
        logger.info(f"Loaded {len(emails)} emails for processing")
        process_emails(emails)
    except Exception as e:
        logger.error(f"Error in main function: {e}")
        logger.debug(traceback.format_exc())

if __name__ == "__main__":
    main()
