# WaterScope AI: Domain-Specific Small Language Models for Water Sustainability

![GitHub](https://img.shields.io/github/license/starfriend10/WaterScope-AI-demo)
![GitHub last commit](https://img.shields.io/github/last-commit/starfriend10/WaterScope-AI-demo)
![GitHub issues](https://img.shields.io/github/issues/starfriend10/WaterScope-AI-demo)
![Hugging Face](https://img.shields.io/badge/Hugging%20Face-Space-blue)

## Overview
WaterScope AI is a research-focused platform that utilizes specialized small language models (SLMs) optimized for water sustainability applications. This project provides an interactive web interface for multiple-choice question answering (MCQA) with domain-specific models fine-tuned on water sustainability literature and research data.

## Technical Architecture
- Frontend: GitHub Pages (HTML/CSS/JavaScript)
- Backend: Hugging Face Inference API
- Models: Domain-adapted instruction-tuned and preference-optimized SLMs
- Data Handling: CSV integration via PapaParse library

## Features
- Real-time MCQA analysis with dual-model comparison
- Interactive research dataset browsing and selection
- Explanation generation capabilities
- Cross-page API connection persistence
- Responsive web design for research use cases

## Installation & Setup
1. Clone the repository:
git clone https://github.com/starfriend10/WaterScope-AI-demo.git

2. Navigate to project directory:
cd WaterScope-AI-demo

3. Open demo.html in web browser or deploy to GitHub Pages

## API Integration
The platform connects to Hugging Face Space: EnvironmentalAI/WaterScopeAI
Gradio client initialization happens automatically on page load

## Dataset Structure
The system uses Decarbonization_MCQA.csv with the following columns:
- ID: Unique question identifier
- Question: Research question text
- A, B, C, D: Multiple choice options

## Usage
### For Researchers:
1. Select questions from the research database
2. Configure analysis parameters
3. Run model comparison
4. Review results and explanations

### For Developers:
JavaScript API example:
const result = await gradioApp.predict("/run_mcqa_comparison", {
    question: "Your research question",
    opt_a: "Option A",
    opt_b: "Option B",
    opt_c: "Option C", 
    opt_d: "Option D",
    generate_explanation: true
});

## Model Performance
The domain-adapted models show significant improvement over baseline models in water sustainability tasks, with enhanced accuracy and expert alignment.

## Project Structure
- demo.html: Main research interface
- chat.html: Experimental chat interface  
- script.js: MCQA evaluation logic
- chat.js: Chat functionality
- style-research.css: Styling
- Data/Decarbonization_MCQA.csv: Research dataset

## Dependencies
- Gradio Client API
- PapaParse CSV parser
- Font Awesome icons
- Modern web browser with JavaScript support

## Contributing
Research collaborations welcome in:
- Water domain expertise
- Dataset contributions
- Model improvements
- Interface enhancements

## Citation
Please cite as:
@software{WaterScopeAI2025,
  title = {WaterScope AI: Domain-Specific Small Language Models for Water Sustainability},
  author = {Princeton University, Department of Civil and Environmental Engineering},
  year = {2025},
  url = {https://github.com/starfriend10/WaterScope-AI-demo}
}

## License
Academic and research use permitted. Contact authors for commercial inquiries.

## Research Team
Department of Civil and Environmental Engineering
Princeton University

## Contact
- GitHub Issues: https://github.com/starfriend10/WaterScope-AI-demo/issues
- Research inquiries: Department of Civil and Environmental Engineering, Princeton University

## Acknowledgments
- Princeton University CEE Department
- Hugging Face for model hosting
- GitHub for repository management
- Open-source research community
