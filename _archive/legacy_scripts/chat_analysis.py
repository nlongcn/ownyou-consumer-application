import pandas as pd
import subprocess
import logging
import json
from typing import Optional
from datetime import datetime
from collections import defaultdict

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler(f"chat_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class EmailAnalysisChat:
    def __init__(self, taxonomy_file: str = 'email_taxonomy.csv'):
        """Initialize the chat application with the taxonomy data."""
        try:
            self.taxonomy_data = pd.read_csv(taxonomy_file)
            logger.info(f"Loaded taxonomy data with {len(self.taxonomy_data)} entries")
            self.context = self._prepare_context()
            # Create category-product mapping
            self.category_products = self._create_category_product_mapping()
        except Exception as e:
            logger.error(f"Error loading taxonomy file: {e}")
            raise

    def _create_category_product_mapping(self) -> dict:
        """Create a mapping of categories to their associated products."""
        mapping = defaultdict(list)
        for _, row in self.taxonomy_data.iterrows():
            if pd.notna(row['Products']) and pd.notna(row['Category']):
                products = [p.strip() for p in str(row['Products']).split(';')]
                mapping[row['Category']].extend(products)
        return dict(mapping)

    def _prepare_context(self) -> str:
        """Prepare a context summary of the taxonomy data."""
        category_stats = self.taxonomy_data['Category'].value_counts()
        avg_confidence = self.taxonomy_data['Category_Probability'].mean()
        products_count = len(self.taxonomy_data[self.taxonomy_data['Products'].notna()])
        
        context = f"""
Available data summary:
- Total emails analyzed: {len(self.taxonomy_data)}
- Category distribution: {', '.join(f'{k}({v})' for k, v in category_stats.items())}
- Average classification confidence: {avg_confidence:.2f}
- Emails with products: {products_count}
"""
        logger.debug(f"Prepared context: {context}")
        return context

    def analyze_data(self, query: str) -> Optional[str]:
        """Analyze the taxonomy data based on specific queries."""
        try:
            if 'category' in query.lower():
                category_stats = self.taxonomy_data['Category'].value_counts()
                category_confidence = self.taxonomy_data.groupby('Category')['Category_Probability'].mean()
                
                response = "Category Analysis:\n"
                for category in category_stats.index:
                    count = category_stats[category]
                    conf = category_confidence[category]
                    product_count = len(set(self.category_products.get(category, [])))
                    response += f"\n{category}:\n"
                    response += f"- Count: {count} emails\n"
                    response += f"- Confidence: {conf:.2f}\n"
                    response += f"- Unique products: {product_count}\n"
                
                return response

            elif 'product' in query.lower():
                # Get all products and their counts
                all_products = []
                for products_str in self.taxonomy_data['Products'].dropna():
                    products = [p.strip() for p in str(products_str).split(';')]
                    all_products.extend(products)
                
                product_counts = pd.Series(all_products).value_counts()
                
                # Group products by category
                response = "Product Analysis:\n\n"
                response += "Top 10 Most Mentioned Products:\n"
                for product, count in product_counts.head(10).items():
                    response += f"- {product}: {count} times\n"
                
                # Add category breakdown
                response += "\nProducts by Category:\n"
                for category, products in self.category_products.items():
                    unique_products = len(set(products))
                    if unique_products > 0:
                        response += f"\n{category}:\n"
                        response += f"- Unique products: {unique_products}\n"
                        # Show top 3 products in each category
                        product_counts = pd.Series(products).value_counts()
                        for product, count in product_counts.head(3).items():
                            response += f"  • {product}: {count} times\n"
                
                return response

            elif 'confidence' in query.lower():
                category_conf = self.taxonomy_data.groupby('Category')['Category_Probability'].agg(['mean', 'min', 'max'])
                product_conf = self.taxonomy_data['Products_Probability'].agg(['mean', 'min', 'max'])
                
                response = "Confidence Analysis:\n\n"
                response += "Category Classification Confidence:\n"
                for category in category_conf.index:
                    response += f"\n{category}:\n"
                    response += f"- Average: {category_conf.loc[category, 'mean']:.2f}\n"
                    response += f"- Range: {category_conf.loc[category, 'min']:.2f} - {category_conf.loc[category, 'max']:.2f}\n"
                
                response += "\nProduct Extraction Confidence:\n"
                response += f"- Average: {product_conf['mean']:.2f}\n"
                response += f"- Range: {product_conf['min']:.2f} - {product_conf['max']:.2f}\n"
                
                return response
            else:
                return None

        except Exception as e:
            logger.error(f"Error analyzing data: {e}")
            return None

    def query_llama(self, prompt: str) -> Optional[str]:
        """Query the local llama3.2 model."""
        try:
            full_prompt = f"""
You are an AI assistant analyzing email taxonomy data. Use the following context to answer questions:

{self.context}

Question: {prompt}

Please provide a clear and concise answer based on the available data. If the information is not available in the data, clearly state that.
"""
            logger.debug(f"Sending prompt to llama: {full_prompt}")
            
            process = subprocess.run(
                ["ollama", "run", "llama3.1:70b"],
                input=full_prompt,
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if process.returncode != 0:
                logger.error(f"Llama query failed: {process.stderr}")
                return None
                
            # Clean up the response by removing any duplicate paragraphs
            response = process.stdout.strip()
            logger.debug(f"Received response: {response}")
            
            # Split by common separators and take the first meaningful response
            parts = response.split('A:')  # Split on potential "A:" prefix
            if len(parts) > 1:
                response = parts[1].strip()
            else:
                response = parts[0].strip()
            
            return response
            
        except Exception as e:
            logger.error(f"Error querying llama: {e}")
            return None

    def chat(self):
        """Interactive chat interface."""
        print("\nWelcome to Email Taxonomy Analysis Chat!")
        print("Type 'quit' to exit, 'help' for commands, or enter your question.\n")
        
        while True:
            try:
                user_input = input("\nYou: ").strip()
                
                if user_input.lower() == 'quit':
                    print("Goodbye!")
                    break
                    
                if user_input.lower() == 'help':
                    print("""
Available commands:
- 'quit': Exit the chat
- 'help': Show this help message
- 'stats': Show basic statistics
- 'categories': Show detailed category analysis
- 'products': Show product analysis and trends
- 'confidence': Show confidence scores analysis
                    """)
                    continue

                # First try direct data analysis
                analysis_result = self.analyze_data(user_input)
                if analysis_result:
                    print(f"\nAnalysis: {analysis_result}")
                    continue

                # If no direct analysis, query llama
                response = self.query_llama(user_input)
                if response:
                    # Remove any duplicate text that might appear after "A:"
                    print(f"\nAssistant: {response}")
                else:
                    print("\nSorry, I couldn't process that request. Try asking something else.")

            except Exception as e:
                logger.error(f"Error in chat loop: {e}")
                print("\nSorry, something went wrong. Please try again.")

def main():
    try:
        chat_app = EmailAnalysisChat()
        chat_app.chat()
    except Exception as e:
        logger.error(f"Error in main: {e}")
        print("Error initializing chat application. Please check the logs.")

if __name__ == "__main__":
    main()
