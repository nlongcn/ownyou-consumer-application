import logging
import json
import subprocess
import pandas as pd
import csv
from tqdm import tqdm
import traceback

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("detailed_log.txt"),
        logging.StreamHandler()
    ]
)

prompt_template = """
You are an AI assistant that processes email summaries to extract information and output it as JSON.
Only output JSON without explanations.
Given the following email summary:

---
{email_summary}
---

Please perform the following tasks:

1. **Products Mentioned**: List any products mentioned in the email summary. If none, return an empty list `[]`.

2. **Category**: Classify the email into one of the following categories:
   - Purchase
   - Information/News/Blog
   - Personal Communication

**Important Instructions:**

- Ensure your response is **valid JSON** and contains **only the JSON object**.
- Use double quotes `"` around all string values.
- Represent empty lists as `[]`.
- Use `null` for null values (do not use `None`).
- Do not include any explanations, notes, or additional text.

**Example:**

{{
  "products": ["Product A", "Product B"],
  "category": "Purchase"
}}
"""

def query_ollama(prompt, model='llama3.2', retries=2):
    for attempt in range(retries + 1):
        try:
            command = ['ollama', 'run', model]
            process = subprocess.Popen(
                command,
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True
            )
            stdout, stderr = process.communicate(input=prompt)
            if process.returncode != 0:
                logging.error(f"Error querying Ollama: {stderr}")
                if attempt < retries:
                    logging.info(f"Retrying Ollama query (attempt {attempt + 1})...")
                else:
                    return None
            else:
                response = stdout.strip()
                response = response.encode('utf-8').decode('utf-8', 'ignore')
                return response
        except Exception as e:
            logging.error(f"Exception during querying Ollama: {e}")
            if attempt < retries:
                logging.info(f"Retrying Ollama query (attempt {attempt + 1})...")
            else:
                return None

    return None

def extract_json_from_response(response):
    try:
        start = response.index('{')
        end = response.rindex('}') + 1
        json_str = response[start:end]
        return json_str
    except ValueError:
        return None

def process_emails_from_csv(input_filename='emails.csv', output_filename='emails_processed.csv'):
    df = pd.read_csv(input_filename)
    processed_data = []

    for index, row in tqdm(df.iterrows(), desc="Processing Emails", unit="email", total=df.shape[0]):
        try:
            logging.info(f"Processing email ID: {row['ID']}")
            summary = row['Summary']

            if summary.strip():
                prompt = prompt_template.format(email_summary=summary)
                response = query_ollama(prompt)

                if response:
                    json_content = extract_json_from_response(response)
                    if json_content:
                        try:
                            result = json.loads(json_content)
                            products = result.get('products', [])
                            category = result.get('category', '')
                        except json.JSONDecodeError as e:
                            logging.error(f"JSON parsing error for email ID {row['ID']}: {e}")
                            logging.debug(f"Response content: {repr(json_content)}")
                            products = []
                            category = "Error parsing response from Ollama"
                    else:
                        logging.error(f"Failed to extract JSON for email ID {row['ID']}. Response: {response}")
                        products = []
                        category = "Error parsing response from Ollama"
                else:
                    products = []
                    category = "No response from Ollama"
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