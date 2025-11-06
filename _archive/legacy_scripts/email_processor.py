import logging
import pandas as pd
import csv
from tqdm import tqdm
import traceback
from typing import List
from pydantic import BaseModel, Field
import instructor
from openai import OpenAI

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("detailed_log.txt"),
        logging.StreamHandler()
    ]
)

class EmailAnalysis(BaseModel):
    products: List[str] = Field(default_factory=list, description="List of products mentioned in the email summary")
    category: str = Field(..., description="Category of the email: Purchase, News/Blog/Spam, Personal Communication, Invoice, Shipment Related, Insurance, Bank Related, Car, House Related, Other")

# Patch the OpenAI client with instructor for Ollama
client = instructor.patch(
    OpenAI(
        base_url="http://localhost:11434/v1",
        api_key="ollama",  # required, but unused
    ),
    mode=instructor.Mode.JSON,
)

def process_email(summary: str) -> EmailAnalysis:
    """Process a single email summary using the patched OpenAI client with Ollama."""
    try:
        return client.chat.completions.create(
            model="llama3.2",  # Using llama3.2 model
            response_model=EmailAnalysis,
            messages=[
                {"role": "system", "content": "You are an AI assistant that processes email summaries to extract information. Only show the results not your thinking."},
                {"role": "user", "content": f"Analyze the following email summary:\n\n{summary}"}
            ]
        )
    except Exception as e:
        logging.error(f"Error processing email: {e}")
        return EmailAnalysis(products=[], category="Error in processing")

def process_emails_from_csv(input_filename='emails.csv', output_filename='emails_processed.csv'):
    df = pd.read_csv(input_filename)
    processed_data = []

    for index, row in tqdm(df.iterrows(), desc="Processing Emails", unit="email", total=df.shape[0]):
        try:
            logging.info(f"Processing email ID: {row['ID']}")
            summary = row['Summary']

            if summary.strip():
                result = process_email(summary)
                products = result.products
                category = result.category
            else:
                products = []
                category = "Empty email summary"
                logging.warning(f"Skipping email due to empty summary (ID: {row['ID']})")

            processed_data.append({
                'ID': row['ID'],
                'Date': row['Date'],
                'From': row['From'],
                'Subject': row['Subject'],
                'Summary': summary,
                'Products': ', '.join(products),
                'Category': category
            })

        except Exception as e:
            logging.error(f"Skipping email due to error (ID: {row['ID']}): {e}")
            logging.debug(f"Traceback: {traceback.format_exc()}")

    processed_df = pd.DataFrame(processed_data)
    processed_df.to_csv(output_filename, index=False, quoting=csv.QUOTE_ALL)
    logging.info(f"Processed email data saved to '{output_filename}'.")

if __name__ == "__main__":
    process_emails_from_csv()
