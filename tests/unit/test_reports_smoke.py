import pytest

from src.email_parser.analysis.marketing_analyzer import UnbiasedMarketingAnalyzer
from src.email_parser.analysis.authentic_ikigai_analyzer import AuthenticIkigaiAnalyzer
from src.email_parser.llm_clients.base import LLMClientFactory


def test_taxonomy_load_does_not_crash():
    ana = UnbiasedMarketingAnalyzer({'provider': 'ollama'}, model_name='ollama')
    tx = ana._load_product_taxonomy()
    assert isinstance(tx, list)


def test_marketing_analyze_smoke():
    emails = [
        {
            'ID': '1', 'Subject': 'Sale: 50% off', 'From': 'promo@shop.com',
            'Date': '2025-08-20', 'Category': 'Marketing', 'Key_Topics': 'sale, discount',
            'Sentiment': 'neutral', 'Summary': 'Hurry, last chance to save.'
        },
        {
            'ID': '2', 'Subject': 'Your order has shipped', 'From': 'store@example.com',
            'Date': '2025-08-21', 'Category': 'Shipment Related', 'Key_Topics': 'order, shipping',
            'Sentiment': 'neutral', 'Summary': 'Order #1234 shipped.'
        }
    ]

    ana = UnbiasedMarketingAnalyzer({'provider': 'ollama', 'seed': 123}, model_name='ollama')
    insights = ana.analyze_emails(emails, output_prefix='pytest_smoke')

    assert isinstance(insights.summary, str)
    assert isinstance(insights.data_coverage, dict)
    assert 'total_emails' in insights.data_coverage


def test_authentic_newsletter_treated_personal_smoke():
    client = LLMClientFactory.create_client('ollama', {'provider': 'ollama'})
    ika = AuthenticIkigaiAnalyzer(client)

    emails = [
        {
            'ID': '1', 'Subject': 'Weekly Python newsletter', 'From': 'newsletter@pythonweekly.com',
            'Date': '2025-08-21T09:00:00Z', 'Category': 'Newsletter', 'Key_Topics': 'python, tutorials',
            'Sentiment': 'positive', 'Summary': 'Top Python articles this week.'
        }
    ]

    insights = ika.analyze_emails(emails, output_prefix=None)
    assert isinstance(insights.primary_ikigai, str)
    assert insights.primary_ikigai != ''

