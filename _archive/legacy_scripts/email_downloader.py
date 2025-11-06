import os
import logging
import base64
import csv
import json
import subprocess
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from bs4 import BeautifulSoup
import re
from tqdm import tqdm

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("detailed_log.txt"),
        logging.StreamHandler()
    ]
)

def authenticate_gmail_api():
    logging.info("Authenticating with Gmail API...")
    creds = None
    if os.path.exists('token.json'):
        logging.info("Loading existing credentials...")
        creds = Credentials.from_authorized_user_file('token.json')
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            logging.info("Refreshing expired credentials...")
            creds.refresh(Request())
        else:
            logging.info("Starting authentication flow...")
            flow = InstalledAppFlow.from_client_secrets_file('credentials.json', ['https://www.googleapis.com/auth/gmail.readonly'])
            creds = flow.run_local_server(port=0)
        with open('token.json', 'w') as token:
            token.write(creds.to_json())
    if creds and creds.valid:
        logging.info("Authentication successful.")
    else:
        logging.error("Authentication failed.")
    return creds

def download_emails(service, max_emails=200):
    logging.info("Downloading emails...")
    try:
        result = service.users().messages().list(userId='me', maxResults=max_emails).execute()
        messages = result.get('messages', [])
        if not messages:
            logging.warning("No messages found.")
        else:
            logging.info(f"Downloaded {len(messages)} messages.")
    except Exception as e:
        logging.error(f"Error downloading emails: {e}")
        messages = []
    return messages

def extract_body(payload):
    body = ''
    if 'parts' in payload:
        for part in payload['parts']:
            try:
                if part.get('mimeType') == 'text/plain':
                    part_body = base64.urlsafe_b64decode(part['body'].get('data', '')).decode('utf-8', errors='ignore')
                    if part_body.strip():
                        body += part_body + "\n"
                elif part.get('mimeType') == 'text/html':
                    html_part_body = base64.urlsafe_b64decode(part['body'].get('data', '')).decode('utf-8', errors='ignore')
                    if html_part_body.strip():
                        body += clean_html(html_part_body) + "\n"
                elif 'parts' in part:
                    nested_body = extract_body(part)
                    if nested_body.strip():
                        body += nested_body + "\n"
            except Exception as e:
                logging.error(f"Error extracting part: {e}")
    else:
        try:
            if payload.get('mimeType') == 'text/plain':
                body = base64.urlsafe_b64decode(payload['body'].get('data', '')).decode('utf-8', errors='ignore')
            elif payload.get('mimeType') == 'text/html':
                body = clean_html(base64.urlsafe_b64decode(payload['body'].get('data', '')).decode('utf-8', errors='ignore'))
        except Exception as e:
            logging.error(f"Error extracting main payload: {e}")

    return body

def clean_html(html):
    soup = BeautifulSoup(html, 'html.parser')
    for script_or_style in soup(['script', 'style']):
        script_or_style.decompose()
    text = soup.get_text(separator='\n')
    text = re.sub(r'\n\s*\n+', '\n\n', text).strip()
    return text

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

def summarize_email(body):
    prompt = f"""
    Please provide a detailed summary of the following email content. The summary should capture all important information and context, but be concise enough to fit within a single cell of a CSV file.
    - There should be no line breaks in the summary. 
    - Do not mention this is a sunmmary.
    - Do not include any explanations, notes, or additional text.
    Email content:
    {body}

    Detailed summary:
    """
    
    response = query_ollama(prompt)
    if response:
        return response.strip()
    else:
        return "Failed to generate summary"

def save_emails_to_csv(emails, filename='emails.csv'):
    with open(filename, mode='w', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow(['ID', 'Date', 'From', 'Subject', 'Summary'])
        for email in emails:
            writer.writerow([
                email['id'],
                email.get('date', ''),
                email.get('from_email', ''),
                email.get('subject', ''),
                email.get('summary', '')
            ])
    logging.info(f"Emails saved to {filename}.")

def main():
    try:
        logging.info("Starting script...")

        # Authenticate Gmail API
        creds = authenticate_gmail_api()
        if creds is None:
            logging.error("Failed to authenticate with Gmail API.")
            return

        # Build Gmail service
        service = build('gmail', 'v1', credentials=creds)

        # Download emails
        emails = download_emails(service)

        # Process emails
        processed_emails = []
        for email in tqdm(emails, desc="Processing Emails", unit="email"):
            msg_id = email['id']
            message = service.users().messages().get(userId='me', id=msg_id, format='full').execute()
            payload = message.get('payload', {})
            headers = {header['name']: header['value'] for header in payload.get('headers', [])}
            
            body = extract_body(payload)
            summary = summarize_email(body)
            
            processed_emails.append({
                'id': msg_id,
                'date': headers.get('Date', ''),
                'from_email': headers.get('From', ''),
                'subject': headers.get('Subject', ''),
                'summary': summary
            })

        # Save emails to CSV
        save_emails_to_csv(processed_emails)

    except Exception as e:
        logging.error(f"Script terminated due to unexpected error: {e}")

if __name__ == "__main__":
    main()
