# WaterScope AI: Domain-Specific Small Language Models for Water Sustainability

![GitHub](https://img.shields.io/github/license/starfriend10/WaterScope-AI-demo)
![GitHub last commit](https://img.shields.io/github/last-commit/starfriend10/WaterScope-AI-demo)
![GitHub issues](https://img.shields.io/github/issues/starfriend10/WaterScope-AI-demo)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Space-blue)

## Abstract

WaterScope AI is an innovative research platform that leverages domain-specific small language models (SLMs) for advancing water sustainability research. This project demonstrates the application of instruction-tuned and preference-optimized language models specifically designed for multiple-choice question answering (MCQA) in the water sustainability domain. Our models provide researchers with specialized AI assistance for analyzing complex water-related challenges through an intuitive web interface connected to Hugging Face inference endpoints.

## Research Overview

### Problem Statement
Water sustainability faces complex challenges requiring interdisciplinary expertise. Traditional language models lack domain-specific knowledge in water systems, climate impacts, and environmental engineering, limiting their utility for researchers and practitioners in this critical field.

### Methodology
We developed and fine-tuned two specialized language models:

1. **DA-IT Model** (Domain-Adapted Instruction-Tuned): Instruction-tuned on water sustainability corpora
2. **DA-DPO Model** (Domain-Adapted Direct Preference Optimization): Preference-optimized for expert-aligned responses

### Technical Architecture
Frontend (GitHub Pages) → Gradio Client API → Hugging Face Inference → Specialized SLMs


## Key Features

### Research Interface
- **MCQA Analysis**: Domain-specific multiple-choice question answering with model comparisons
- **Real-time Processing**: Live API connectivity to Hugging Face inference endpoints
- **Explanation Generation**: Option to receive detailed reasoning behind model predictions
- **Research Dataset Integration**: Pre-loaded with water sustainability MCQA examples

### Technical Specifications
- **Frontend**: HTML5, CSS3, JavaScript with responsive design
- **API Integration**: Gradio client for Hugging Face space connectivity
- **Data Handling**: PapaParse for CSV dataset integration
- **Model Deployment**: Optimized inference on Hugging Face infrastructure

## Dataset

The platform utilizes the **Decarbonization_MCQA Dataset** containing:

| Column | Description | Example |
|--------|-------------|---------|
| ID | Unique identifier | 1 |
| Question | Research question | What role do wastewater utilities play in the water sector? |
| A | Option A | They primarily focus on desalination |
| B | Option B | They collect and treat generated wastewater... |
| C | Option C | They distribute bottled water to homes... |
| D | Option D | They only monitor water purity in natural bodies... |

**Domain Coverage**: Wastewater management, climate impacts, sustainability practices  
**Research-Grounded**: Questions derived from water sustainability literature  
**Extensible Architecture**: Support for additional domain-specific datasets

## Installation and Deployment

### Local Development
```bash
# Clone repository
git clone https://github.com/starfriend10/WaterScope-AI-demo.git

# Navigate to project directory
cd WaterScope-AI-demo

# Open index.html in web browser or deploy to GitHub Pages

