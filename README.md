# WaterScope AI: Domain-Specific Small Language Models for Water Sustainability

[WaterScope AI](https://starfriend10.github.io/WaterScope-AI-demo) is an innovative research platform that leverages domain-specific small language models (SLMs) for advancing water sustainability research. This project demonstrates the application of instruction-tuned and preference-optimized language models specifically designed for multiple-choice question answering (MCQA) in the water sustainability domain. Our models provide researchers with specialized AI assistance for analyzing complex water-related challenges through an intuitive web interface connected to Hugging Face inference endpoints.


---
## Research Overview

### Problem Statement
Water sustainability faces complex challenges requiring interdisciplinary expertise. Traditional language models lack domain-specific knowledge in water systems, climate impacts, and environmental engineering, limiting their utility for researchers and practitioners in this critical field.

### Methodology
We developed and fine-tuned two specialized language models:

1. **DA-IT Model** (Domain-Adaptation Instruction-Tuning): Instruction-tuned on water/wastewater sustainability corpora
2. **DA-DPO Model** (Domain-Adaptation Direct Preference Optimization): Preference-optimized for expert-aligned responses

### Technical Architecture
Frontend (GitHub Pages) → Gradio Client API → Hugging Face Inference → Specialized SLMs

### Technical Specifications
- **Frontend**: HTML5, CSS3, JavaScript with responsive design
- **API Integration**: Gradio client for Hugging Face space connectivity
- **Data Handling**: PapaParse for CSV dataset integration
- **Model Deployment**: Optimized inference on Hugging Face infrastructure

---

## Usage Instructions

### Research Interface
Visit the [WaterScope AI Website](https://starfriend10.github.io/WaterScope-AI-demo)
- **MCQA Analysis**: Domain-specific multiple-choice question answering with model comparisons
- **Real-time Processing**: Live API connectivity to Hugging Face inference endpoints
- **Explanation Generation**: Option to receive detailed reasoning behind model predictions
- **Research Dataset Integration**: Pre-loaded with water sustainability MCQA examples
- **Chatbot**: Experience real-time conversation (this function is for an experimental purpose)

## Installation and Deployment

### Local Development
bash
# Clone repository
git clone https://github.com/starfriend10/WaterScope-AI-demo.git


### For Developers
    // API Integration Example
    const result = await gradioApp.predict("/run_mcqa_comparison", {
        question: "Water sustainability research question",
        opt_a: "Option A",
        opt_b: "Option B",
        // ... additional options (opt_c, opt_d, etc.)
        generate_explanation: true
    });

---

## Research Applications

### Current Capabilities
- Domain-specific question answering
- Model performance comparison
- Educational demonstrations for water sustainability
- Research hypothesis testing

### Future Directions
- Expanded domain coverage (more water sub-domains)
- Additional model architectures and ensembles
- Integration with water system databases and sensor feeds
- Real-time data processing capabilities

---

## Contributing
We welcome research collaborations and contributions in:
- Water domain expertise
- Additional dataset contributions
- Model improvements and benchmarking
- Interface and UX enhancements

Please open a GitHub Issue on the project repository to propose collaborations, datasets, or code contributions.

Repository: https://github.com/starfriend10/WaterScope-AI-demo

---

## Citation
If you use WaterScope AI in your research, please cite:

    @software{WaterScopeAI2025,
      title = {WaterScope AI: Domain-Specific Small Language Models for Water Sustainability},
      author = {Princeton University, Department of Civil and Environmental Engineering},
      year = {2025},
      url = {https://github.com/starfriend10/WaterScope-AI-demo}
    }

---

## License
This research software is available for academic and research use.
For commercial-use inquiries or licensing, please contact the authors.

---

## Research Team
Affiliation: Department of Civil and Environmental Engineering, Princeton University
Research Focus: AI applications in environmental engineering, water sustainability, and climate resilience

---


## Contact
- GitHub Issues: https://github.com/starfriend10/WaterScope-AI-demo/issues
- Research Collaboration: Department of Civil and Environmental Engineering, Princeton University

---

WaterScope AI is an ongoing research initiative demonstrating domain-specific AI for addressing critical water sustainability challenges.






