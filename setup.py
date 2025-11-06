#!/usr/bin/env python3
"""
Setup script for Email Parser - AI-powered email analysis tool
"""

from setuptools import setup, find_packages
from pathlib import Path

# Read the README file
readme_path = Path(__file__).parent / "README.md"
if readme_path.exists():
    with open(readme_path, "r", encoding="utf-8") as fh:
        long_description = fh.read()
else:
    long_description = "AI-powered email parser with Gmail and Outlook support"

# Read requirements
requirements_path = Path(__file__).parent / "requirements.txt"
if requirements_path.exists():
    with open(requirements_path, "r", encoding="utf-8") as fh:
        requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]
else:
    requirements = [
        "google-api-python-client>=2.0.0",
        "google-auth>=2.0.0",
        "google-auth-oauthlib>=1.0.0",
        "msal>=1.20.0",
        "requests>=2.25.0",
        "pandas>=1.3.0",
        "tqdm>=4.60.0",
        "pydantic>=2.0.0",
        "python-dotenv>=0.19.0",
        "structlog>=23.0.0",
        "rich>=13.0.0",
        "beautifulsoup4>=4.10.0",
        "instructor>=1.0.0",
        "openai>=1.0.0",
        "anthropic>=0.25.0",
    ]

setup(
    name="email-parser",
    version="1.0.0",
    author="Email Parser Team",
    author_email="support@emailparser.ai",
    description="AI-powered email parser with automated account setup",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/your-org/email-parser",
    package_dir={"": "src"},
    packages=find_packages(where="src"),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: End Users/Desktop",
        "Topic :: Communications :: Email",
        "Topic :: Office/Business",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=7.0.0",
            "pytest-cov>=4.0.0",
            "black>=23.0.0",
            "flake8>=6.0.0",
            "mypy>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "email-parser=email_parser.main:main",
            "email-parser-setup=email_parser.setup.account_setup:main_setup_cli",
        ],
    },
    include_package_data=True,
    zip_safe=False,
    keywords="email parser ai gmail outlook llm automation oauth",
    project_urls={
        "Bug Reports": "https://github.com/your-org/email-parser/issues",
        "Source": "https://github.com/your-org/email-parser",
        "Documentation": "https://docs.emailparser.ai",
    },
)