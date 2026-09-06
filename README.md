# 💧 WaterScope-AI
## Domain-Specific Small Language Models 

& MCP-Enabled Research Agents for Water Sustainability

<p align="center">
  <strong>Domain Knowledge · Small Language Models · Publication Intelligence · MCP Agents</strong>
</p>

<p align="center">
  <a href="https://starfriend10.github.io/WaterScope-AI/">
    <img src="https://img.shields.io/badge/🌐_Interactive_Platform-WaterScope--AI-0077B6?style=for-the-badge" alt="WaterScope-AI Platform">
  </a>
  <a href="https://github.com/starfriend10/WaterScope-AI">
    <img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github" alt="GitHub">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/SLM-Llama--3.1--8B-blue" alt="SLM">
  <img src="https://img.shields.io/badge/AI-Domain_Specialized-purple" alt="Domain Specialized AI">
  <img src="https://img.shields.io/badge/MCP-Research_Agent-orange" alt="MCP Agent">
  <img src="https://img.shields.io/badge/Domain-Water_Sustainability-00A6A6" alt="Water Sustainability">
  <img src="https://img.shields.io/badge/Status-Research_Platform-brightgreen" alt="Status">
</p>

---

## 🌊 Overview

**WaterScope-AI** is an AI-powered research platform for exploring the use of **domain-specific Small Language Models (SLMs)** and **agentic AI** in water and environmental engineering.

The project began with the development and evaluation of compact language models specialized in **water sustainability knowledge**, including domain adaptation, instruction tuning, preference optimization, and multiple-choice question answering (MCQA).

WaterScope-AI has since expanded beyond standalone language-model inference toward an integrated research environment combining:

- 🧠 **Domain-specific Small Language Models**
- 📝 **Water sustainability MCQA benchmarking**
- 💬 **AI-assisted explanations and research conversation**
- 🔎 **Hybrid scientific publication search**
- 📚 **Paper metadata, full-text, and research media exploration**
- 🔗 **Model Context Protocol (MCP)**
- 🤖 **MCP-enabled research agents**

Together, these components explore a broader transition from **domain knowledge → specialized models → research tools → AI agents**.

> **Research objective:** Explore how compact, domain-specialized language models can provide reliable knowledge capabilities while MCP connects these models with scientific information, tools, and research workflows.

---

## 🚀 Explore WaterScope-AI

### 🌐 Interactive Research Platform

👉 **https://starfriend10.github.io/WaterScope-AI/**

The platform provides multiple complementary ways to explore domain-specific AI for water research.

| Module | Description |
|---|---|
| 🧠 **MCQA Analysis** | Evaluate domain-specific SLMs using water sustainability multiple-choice questions |
| ⚖️ **Model Comparison** | Compare predictions across different post-training strategies |
| 💡 **AI Explanation** | Generate explanations for model predictions and domain questions |
| 📚 **Curated MCQA** | Explore expert-derived water sustainability questions |
| 💬 **Research Chat** | Interact with specialized language models through conversational interfaces |
| 🔎 **Publication Search** | Search water research literature using hybrid ranking and structured metadata |
| 🖼️ **Research Media** | Explore figures, tables, and other information associated with publications |
| 🔖 **Paper Selection** | Bookmark and select publications for downstream research interaction |
| 🤖 **MCP Research Agent** | Connect AI models with publication retrieval and research tools through MCP |

---

# 🧠 Domain-Specific Small Language Models

## Why Small Language Models?

Water and environmental engineering require specialized knowledge spanning areas such as:

- wastewater treatment
- water quality
- biological processes
- nutrient removal
- resource recovery
- environmental sustainability
- process engineering
- emerging contaminants
- water-energy interactions

General-purpose LLMs contain broad knowledge, but specialized scientific tasks can benefit from **domain adaptation and targeted post-training**.

WaterScope-AI investigates whether compact models can acquire stronger domain capabilities while remaining substantially smaller than frontier-scale general-purpose models.

---

## 🔬 Model Development

The project uses **Llama-3.1-8B-Instruct** as a representative compact language-model foundation and investigates multiple post-training strategies.

### Domain Adaptation

Domain-specific scientific literature is used to strengthen the model's representation of water and wastewater knowledge.

### Instruction Tuning

Instruction-based training improves the model's ability to follow structured scientific questions and perform domain MCQA tasks.

### Direct Preference Optimization

Preference-based post-training further aligns model responses with desired expert reasoning and answer behavior.

Representative model variants include:

| Model | Training Strategy |
|---|---|
| **Base** | Foundation instruction model |
| **DA** | Domain adaptation |
| **DA-IT** | Domain adaptation + instruction tuning |
| **DA-DPO** | Domain adaptation + direct preference optimization |
| **DA-IT-DPO** | Combined domain adaptation, instruction tuning, and preference optimization |

The framework is designed to support continued experimentation with additional datasets, post-training strategies, and compact model architectures.

---

# 🧪 MCQA Benchmarking

Multiple-choice question answering provides a controlled framework for evaluating domain knowledge.

WaterScope-AI contains curated questions covering water sustainability and environmental engineering topics and enables users to compare model predictions interactively.

### Interactive workflow

```text
Scientific Question
       │
       ▼
┌───────────────────┐
│ WaterScope-AI UI  │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Specialized SLMs  │
├───────────────────┤
│ Base              │
│ DA                │
│ DA-IT             │
│ DA-DPO            │
│ DA-IT-DPO         │
└─────────┬─────────┘
          │
          ▼
 Prediction + Explanation
```

The benchmarking environment supports research into how different post-training strategies affect specialized scientific knowledge.

---

# 🔎 Scientific Publication Intelligence

WaterScope-AI has expanded from model benchmarking into **AI-assisted scientific literature exploration**.

The publication interface supports hybrid retrieval across a growing water research corpus and provides structured access to scientific information.

### Publication Search

Researchers can:

- search scientific publications using natural-language queries
- retrieve ranked literature results
- inspect publication metadata
- explore associated research media
- bookmark relevant papers
- select publications for downstream AI interaction

The system separates **literature discovery** from **agent interaction**, allowing researchers to inspect and control the information supplied to the AI.

---

# 🤖 MCP-Enabled Research Agent

## From Language Models to Research Agents

Traditional language-model applications primarily generate text from the information contained in their model context.

Research workflows, however, require interaction with external resources such as:

- scientific publication databases
- metadata indexes
- document collections
- retrieval systems
- research software
- computational tools

WaterScope-AI therefore explores **Model Context Protocol (MCP)** as an interoperability layer between AI models and external research capabilities.

```text
                         WaterScope-AI
                              │
            ┌─────────────────┴─────────────────┐
            │                                   │
            ▼                                   ▼
   Domain-Specific SLMs                 Research Interface
            │                                   │
            └──────────────┬────────────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │ MCP Client  │
                    └──────┬──────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        Publication     Metadata      Research
         Retrieval       Search        Tools
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                    Research Agent
```

Instead of requiring every AI application to implement custom integrations independently, MCP provides a standardized mechanism for exposing **resources, tools, and workflows** to AI systems.

---

## 🔗 Current MCP Research Workflow

The experimental research agent connects language models with WaterScope-AI's scientific retrieval infrastructure.

```text
User Research Question
        │
        ▼
┌──────────────────────┐
│ WaterScope-AI Agent  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ MCP Tool Interface   │
└──────────┬───────────┘
           │
     ┌─────┴─────┐
     ▼           ▼
 Metadata      Paper
 Retrieval    Retrieval
     │           │
     └─────┬─────┘
           ▼
  Relevant Publications
           │
           ▼
   Language Model
           │
           ▼
 Research-Oriented Answer
```

This architecture allows the AI system to move beyond passive conversation toward **tool-assisted scientific research workflows**.

The current implementation is an experimental research prototype and continues to evolve as the publication corpus, MCP tools, and agent capabilities expand.

---

# 🏗️ Platform Architecture

WaterScope-AI combines static web deployment, cloud AI infrastructure, scientific data resources, and MCP services.

```text
┌─────────────────────────────────────────────────────────────┐
│                    WaterScope-AI Platform                   │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  GitHub Pages Frontend                      │
│             HTML · CSS · JavaScript · UI                    │
└─────────────────────────────┬───────────────────────────────┘
                              │
             ┌────────────────┴────────────────┐
             │                                 │
             ▼                                 ▼
┌────────────────────────┐          ┌────────────────────────┐
│     SLM Functions      │          │   Research Assistant   │
│                        │          │                        │
│ • MCQA                  │          │ • Publication Search   │
│ • Model Comparison      │          │ • Paper Exploration    │
│ • Explanation           │          │ • Research Chat        │
└────────────┬───────────┘          └────────────┬───────────┘
             │                                   │
             ▼                                   ▼
┌────────────────────────┐          ┌────────────────────────┐
│ Hugging Face / Gradio  │          │      MCP Services      │
│                        │          │                        │
│ Specialized SLMs       │          │ Retrieval · Metadata   │
└────────────────────────┘          └────────────┬───────────┘
                                                │
                                                ▼
                                   ┌────────────────────────┐
                                   │ Scientific Literature  │
                                   │ & Research Resources   │
                                   └────────────────────────┘
```

### Core Technologies

| Component | Technology |
|---|---|
| 🌐 Frontend | HTML5, CSS3, JavaScript |
| 📄 Hosting | GitHub Pages |
| 🧠 Language Models | Llama-3.1-8B-based SLMs |
| 🤗 Model Infrastructure | Hugging Face |
| 🔌 Model API | Gradio |
| 🔗 Agent Interoperability | Model Context Protocol (MCP) |
| 🔎 Metadata Retrieval | Vector + hybrid retrieval |
| 🗂️ Vector Infrastructure | Qdrant |
| 📚 Research Data | Scientific publication metadata and full text |

---

# 💻 Local Deployment

Clone the repository:

```bash
git clone https://github.com/starfriend10/WaterScope-AI.git
cd WaterScope-AI
```

Because the frontend is designed for browser-based deployment, it can be served locally using a simple HTTP server:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Some AI and agent functions require their corresponding backend services or Hugging Face endpoints to be available.

---

# 📁 Project Structure

A simplified representation of the project is:

```text
WaterScope-AI/
│
├── index.html
├── instructions.html
├── ...
│
├── assets/
│   ├── figures/
│   ├── logo/
│   └── ...
│
├── data/
│   └── ...
│
├── JS/
│   └── ...
│
└── README.md
```

The web interface, model endpoints, publication resources, and MCP services are intentionally modular so individual components can evolve independently.

---

# 🔬 Research Applications

WaterScope-AI provides an experimental environment for studying several questions at the intersection of **AI and environmental engineering**:

### 🧠 Domain AI

How effectively can compact language models acquire specialized scientific knowledge?

### ⚙️ Post-Training

How do domain adaptation, instruction tuning, and preference optimization affect expert-domain performance?

### 📊 Scientific Benchmarking

How can curated domain MCQA datasets reveal strengths and limitations that general benchmarks may overlook?

### 🔎 Literature Intelligence

How can hybrid retrieval improve interaction with large scientific publication collections?

### 🤖 Agentic Research

How can MCP allow specialized language models to interact with scientific resources and external tools?

### 🌱 Sustainable AI

Can smaller domain-specialized models provide useful scientific capabilities with lower computational requirements than much larger general-purpose systems?

---

# 🗺️ Development Direction

WaterScope-AI is an ongoing research platform. Current development focuses on connecting specialized AI models with increasingly capable research infrastructure.

```text
Domain Literature
       ↓
Domain Adaptation
       ↓
Instruction / Preference Tuning
       ↓
Specialized SLMs
       ↓
Scientific Benchmarking
       ↓
Publication Retrieval
       ↓
MCP Tool Integration
       ↓
Research Agents
```

Future extensions may include:

- broader water and environmental engineering corpora
- additional compact model architectures
- improved hybrid and semantic retrieval
- richer full-text scientific interaction
- expanded MCP tools
- connection with water-system modeling software
- scientific databases and structured knowledge resources
- multi-step agentic research workflows

---

# 🤝 Contributing & Collaboration

We welcome research collaborations related to:

- 💧 water and environmental engineering
- 🧠 domain-specific language models
- 📚 scientific datasets
- 📊 AI benchmarking
- 🔎 scientific information retrieval
- 🔗 Model Context Protocol
- 🤖 scientific research agents
- 🌐 research platform development

For collaborations, dataset contributions, feature suggestions, or technical issues, please open an **Issue** in this repository.

---

# 📖 Citation

A publication describing WaterScope-AI and its domain-specific SLM framework is under development.

If you use the current research platform or software, please cite:

```bibtex
@software{WaterScopeAI2026,
  title  = {WaterScope-AI: Domain-Specific Small Language Models and MCP-Enabled Research Agents for Water Sustainability},
  author = {Zhu, Jun-Jie and Jiang, Jinyue and Yang, Meiqi and Ren, Z. Jason},
  year   = {2026},
  url    = {https://github.com/starfriend10/WaterScope-AI}
}
```

**Publication DOI:** To be updated

---

# 📜 License

WaterScope-AI is developed for **academic and research purposes**.

For commercial use, redistribution, or licensing inquiries, please contact the authors.

---

<p align="center">
  <strong>💧 WaterScope-AI</strong><br>
  Domain Knowledge → Specialized Models → Research Tools → MCP Agents
</p>

<p align="center">
  <a href="https://starfriend10.github.io/WaterScope-AI/">Explore the Platform</a>
  ·
  <a href="https://github.com/starfriend10/WaterScope-AI">GitHub Repository</a>
</p>

<p align="center">
  ⭐ If WaterScope-AI is useful for your research, please consider starring the repository.
</p>
