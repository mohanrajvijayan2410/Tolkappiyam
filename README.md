## Tolkappiyam AI: An Intelligent Classical Tamil Knowledge Agent

Hosted Link: https://tholkapiyam2026.pythonanywhere.com/

Tolkappiyam AI is an AI-assisted knowledge exploration platform built around the literary, grammatical, and cultural concepts of Tolkappiyam. It accepts natural-language queries in Tamil, English, or mixed input, maps them to ontology concepts, and renders an interactive knowledge graph with academic explanations, evidence metadata, cognitive views, translation support, and downloadable PDF reports.

The project combines a Flask backend, a dataset-driven ontology layer, D3.js graph visualization, and LLM-backed reasoning through Gemini and Groq. It is designed as a full-stack showcase of AI-assisted knowledge retrieval for Classical Tamil studies.

# Dataset

- **Dataset Type**: Structured Semantic Literary Knowledge Base  
- **Source**: English translation of *Tolkappiyam* with validated Tamil references  
- **Core Domains**: Ezhuthu, Sol, Porul, Akam, and Puram  
- **Knowledge Model**: Ontology and Knowledge Graph based semantic representation  
- **Features Included**: Concepts, semantic relationships, sutra references, aliases, and bilingual labels  
- **Purpose**: Supports semantic reasoning, graph traversal, explainable AI retrieval, and bilingual literary knowledge exploration  

## Dataset Link
[(Dataset)](https://drive.google.com/drive/folders/1zPSoReURy3DO0fHqU3b58fpxxAkOqLxF?usp=drive_link)

## Sample Video
[Click here to watch the demo](video/demo.mp4)
## Installation & Setup

### Pre-requisites

- Python 3.x
- `pip`
- Internet access for LLM/API calls
- At least one Gemini or Groq API key

### 1. Clone the Repository

```bash
git clone <your-repository-url>
cd tolkappiyam-ai
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
GEMINI_API_KEY_1=your_gemini_api_key
GROQ_API_KEY_1=your_groq_api_key
LLM_PROVIDER_ORDER=gemini,groq
GEMINI_MODEL_NAME=models/gemini-2.5-flash
GROQ_MODEL_NAME=llama-3.1-8b-instant
LLM_REQUEST_TIMEOUT_SECONDS=45
```

Notes:

- You can configure multiple keys such as `GEMINI_API_KEY_2`, `GROQ_API_KEY_2`, and so on.
- Provider order is configurable through `LLM_PROVIDER_ORDER`.
- If multiple keys are provided, the backend rotates keys and falls back between providers on failure.

### 4. Run the Application

```bash
python backend/app.py
```

Open the app in your browser:

```text
http://127.0.0.1:5000/
```

## Sample Input and Output

### Input

```text
Query: Kurinji thinai
Language: both
```

### Output

The system returns:

- A detected theme such as `Thinai`
- A canonical concept such as `Kurinji`
- A focused ontology subgraph
- An academic explanation in English and Tamil

Example response shape:

```json
{
  "theme": "Thinai",
  "canonical": "Kurinji",
  "graph": {
    "nodes": [],
    "links": [],
    "meta": {
      "start_nodes": ["Kurinji"],
      "depth": 2
    }
  },
  "explanation": "English Explanation: ... Tamil Explanation: ..."
}
```
## Architecture Workflow

The system architecture is organized into four major layers:

1. **Graph Processing and Subgraph Extraction**

   * preprocessing of user queries
   * identification of literary and domain concepts
   * canonical transformation of extracted terms
   * mapping concepts into structured semantic CSV data
   * extraction of relevant contextual subgraphs

2. **Ontology Mapping and Semantic Reasoning**

   * natural language understanding of user input
   * intent detection and semantic interpretation
   * ontology alignment and concept mapping
   * knowledge graph traversal for relevant relationship discovery
   * identification of optimal concept paths

3. **Cognitive Reasoning and Weightage Calculation**

   * contextual subgraph analysis
   * graph centrality computation
   * semantic importance weight assignment
   * relevance-based reasoning across connected concepts
   * importance-aware inference generation

4. **Visualization and Explanation**

   * bilingual human-readable output generation
   * linkage of concepts with corresponding sutra references
   * analytics and relationship computation
   * interactive weighted graph visualization
   * explainable AI-based literary knowledge presentation

<img width="1131" height="1600" alt="image" src="https://github.com/user-attachments/assets/520b8d04-dea1-4a58-8b49-9fedcc717b23" />

# Product Screenshots

## 1. Main Knowledge Graph Dashboard

The primary dashboard visualizes interconnected literary concepts, semantic relationships, ontology mappings, and multi-hop graph traversal results for intelligent knowledge exploration.

<p align="center">
  <img width="1600" height="743" alt="Main Knowledge Graph Dashboard" src="https://github.com/user-attachments/assets/1b5d96af-35b3-4962-ae00-d51e8002a7f9" />
</p>

---

## 2. Concept Detail and Source Trace Window

This module displays detailed concept-level analysis, semantic associations, source tracing, and linked sutra references extracted from the ontology-based knowledge graph.

<p align="center">
  <img width="1110" height="860" alt="Concept Detail and Source Trace Window" src="https://github.com/user-attachments/assets/a3c285df-9589-40de-a1ab-8257b6546d28" />
</p>

---

## 3. Cognitive Architecture Analysis Window

The cognitive reasoning interface performs semantic weight calculation, graph analytics, node importance evaluation, and contextual reasoning visualization.

<p align="center">
  <img width="1600" height="786" alt="Cognitive Architecture Analysis Window" src="https://github.com/user-attachments/assets/fa88be6d-03e3-483c-94ec-4c2be55c2769" />
</p>

---

## 4. Tamil Interface and Localized Visualization

The bilingual visualization interface provides Tamil-centric literary knowledge representation with localized semantic exploration and explainable AI outputs.

<p align="center">
  <img width="1600" height="778" alt="Tamil Interface and Localized Visualization" src="https://github.com/user-attachments/assets/999d1c4c-ca59-45d5-9f79-06df900dd704" />
</p>
---

## Algorithm Workflow

### 1. Load Semantic Data
- Load structured ontology and graph data derived from `T` and `O`.

### 2. Preprocess Query
- Accept Tamil or English query `Q`
- Remove stop words
- Normalize query terms
- Identify the query domain
- Convert processed query into canonical form `Qc`

### 3. Graph Construction and Subgraph Extraction
- Construct or access knowledge graph `G = (V, E)`
- Extract contextual subgraph `G' = (V', E')`
- Use BFS or multi-hop traversal from mapped concept `c*`

### 4. Ontology Mapping
- Map `Qc` to ontology concept `c*`
- Retrieve related concepts and semantic relationships

### 5. Intent-Aware Reasoning
- Detect query intent
- Select the most relevant semantic paths
- Traverse direct and indirect concept relationships

### 6. Cognitive Weightage Computation
- Compute node degree centrality:

  `DC(v) = deg(v) / (|V| - 1)`

- Assign semantic weight:

  `W(v) = DC(v)`

- Construct weighted graph:

  `G'w = (V', E', W)`

### 7. Explanation and Output Generation
- Retrieve sutra references associated with graph nodes and edges
- Generate bilingual human-readable explanation `Ex`
- Compute graph analytics:
  - node distribution
  - relationship density
  - semantic connectivity

### 8. Final Output
- Return weighted graph `G'w`
- Return generated explanation `Ex`


## Features

- AI-powered theme classification for Tolkappiyam queries
- Canonical query simplification aligned to Classical Tamil concepts
- Ontology-based knowledge graph traversal from curated CSV datasets
- Interactive graph exploration with node search, analytics, and hierarchy view
- Academic explanation generation in English, Tamil, and other target languages
- Translation endpoint for UI strings and explanatory content
- Cognitive architecture generation for concept-level interpretive analysis
- Evidence-aware node metadata including source section, sutra reference, and extracted sentence
- Tamil Arivu Guide with dialog-style concept narration
- PDF export containing graph snapshot, explanation, evidence, and cognitive summary
- Gemini and Groq provider rotation with automatic fallback

  # Result Analysis

The performance of the proposed Tolkappiyam Knowledge Graph System is evaluated using query response time distribution and comparative semantic reasoning metrics.

The system demonstrates stable and efficient performance, with most query responses occurring between **1.5 to 2.0 seconds**. The average response time is approximately **1.74 seconds**, indicating efficient ontology mapping, semantic reasoning, and graph traversal even for complex contextual queries.

Minor response variations occur due to differences in semantic complexity and traversal depth, but no significant latency is observed.


---

# Query Response Time Statistics

| Metric | Value |
|---|---|
| Minimum Response Time | ~1.4 sec |
| Maximum Response Time | ~2.05 sec |
| Average Response Time | 1.74 sec |
| Typical Response Range | 1.5 – 2.0 sec |
| Performance Stability | High (Low Variance) |

---

# Query Response Time Distribution

<img width="1536" height="1024" alt="image" src="https://github.com/user-attachments/assets/481a6bbf-0632-4c73-a3ca-720f03ed3b66" />


---

# Comparative Analysis and Discussion

The proposed ontology-based reasoning system is compared against:
- Keyword-Based Retrieval Systems
- Aganitiyam (Base Paper)
- Proposed Ontology-Based System

The evaluation uses five major metrics:
- Query Accuracy
- Contextual Relevance
- Ontology Coverage
- Explainability
- Scalability

The ontology-driven framework consistently outperforms traditional approaches due to semantic reasoning, graph traversal, contextual inference, and explainable AI integration.

---

# Comparative Performance Metrics

| Metric | Keyword-Based | Aganitiyam (Base Paper) | Proposed (Ontology) |
|---|---|---|---|
| Query Accuracy | 0.68 | 0.75 | 0.91 |
| Contextual Relevance | 0.62 | 0.70 | 0.89 |
| Ontology Coverage | 0.55 | 0.63 | 0.93 |
| Explainability | 0.10 | 0.40 | 0.90 |
| Scalability | 0.45 | 0.55 | 0.88 |

---

# Core Metric Comparison Graph


<img width="3867" height="1795" alt="image" src="https://github.com/user-attachments/assets/b3f93fc5-f4a7-484b-b80b-8382d0bda59f" />


---

# Concept Processing and Knowledge Graph Reasoning Workflow

The following workflow illustrates how the system transforms a raw user query into a structured semantic explanation using ontology mapping, graph traversal, semantic weighting, and explainable AI reasoning.

Unlike traditional keyword-based retrieval systems, the proposed framework preserves semantic relationships and supports deep contextual literary reasoning.

---

# Workflow Stages

| Stage | Mathematical Representation | Example Calculation | Explanation |
|---|---|---|---|
| Input | `Q` | “Akam enraal enna?” | Accepts Tamil or English user query |
| Query Cleaning | `Qp = clean(Q)` | Remove stop words → “Akam” | Simplifies query for semantic mapping |
| Canonical Mapping | `Qc = map(Qp)` | “Akam” → Canonical Concept | Converts terms into ontology-aligned representation |
| Graph Access | `G = (V,E)` | `V={Porul, Akam}` | Loads structured knowledge graph |
| Subgraph Extraction | `G'=(V',E')` | `Porul → Akam` | Extracts context-relevant subgraph |
| Ontology Matching | `c* ∈ V` | `c* = Akam` | Identifies ontology concept node |
| Degree Centrality | `DC(v)=deg(v)/(V-1)` | `DC(Akam)=2` | Measures node importance |
| Weight Assignment | `W(v)=DC(v)` | `W(Akam)=2` | Assigns semantic importance weights |
| Weighted Graph Construction | `G'w=(V',E',W)` | Weighted Akam Subgraph | Builds reasoning graph |
| Evidence Linking | `Ex = link(node,sutra)` | `Akam → Sutra Reference` | Connects reasoning to source evidence |
| Final Output | `Ex = generate(G'w)` | Bilingual Explanation | Generates explainable semantic output |

---



## Project Structure

```text
/tolkappiyam-ai
|
|-- backend/
|   |-- app.py                    # Flask application entry point
|   |-- client.py                 # Gemini/Groq provider routing and failover
|   |-- config.py                 # Environment and model configuration
|   |-- classifier.py             # Theme classification
|   |-- simplifier.py             # Canonical query simplification
|   |-- thol_preprocess.py        # Query normalization
|   |-- ontology_mapper.py        # Ontology loading and subgraph generation
|   |-- explanation_generator.py  # Academic explanation generation
|   |-- cognitive_architecture.py # Cognitive view builder
|   |-- guide_dialog.py           # Tamil Arivu Guide dialog generation
|   |-- translator.py             # Multilingual translation
|   |-- pdf_report.py             # PDF report export
|   `-- sutra_evidence.py         # Evidence inference helpers
|
|-- data/
|   |-- Ontology.csv              # Core ontology concepts and relations
|   `-- Query_Mapping.csv         # Thinai and concept mapping dataset
|
|-- static/
|   |-- css/
|   `-- js/
|
|-- templates/
|   `-- index.html                # Main web interface
|
|-- requirements.txt
`-- README.md
```


## How It Works

1. The user submits a query from the web interface.
2. The backend preprocesses the query using Tolkappiyam-aware normalization.
3. An LLM classifies the query into a primary domain such as `Akam`, `Puram`, `Thinai`, `Sol`, or `Ezhuthu`.
4. The query is simplified into a canonical Tolkappiyam-aligned concept.
5. The ontology engine resolves the best matching node and builds a focused subgraph from `Ontology.csv`.
6. The explanation generator produces an academic explanation in the selected language.
7. Optional modules generate cognitive architecture, translation output, guide dialog, or a PDF research report.

## API Endpoints

### `POST /query`

Generates the main knowledge-graph response.

Payload:

```json
{
  "query": "Kurinji thinai",
  "language": "both",
  "depth": 2
}
```

Returns:

- `theme`
- `canonical`
- `graph`
- `explanation`

### `POST /cognitive`

Builds a concept-level cognitive architecture summary.

Payload:

```json
{
  "concept": "Kurinji",
  "theme": "Thinai",
  "canonical": "Kurinji"
}
```

### `POST /translate`

Translates short UI or explanation strings.

Payload:

```json
{
  "target": "ta",
  "source": "English",
  "texts": ["Concept Meaning", "Literary Context"]
}
```

### `POST /guide/dialog`

Returns a dialog-style explanation for the Tamil Arivu Guide.

Payload:

```json
{
  "concept": "Kurinji",
  "query": "Kurinji thinai",
  "theme": "Thinai",
  "canonical": "Kurinji",
  "language": "en"
}
```

### `POST /export/pdf`

Exports the current graph, explanation, and cognitive summary as a PDF report.

## Deployment

This project can be deployed on platforms such as:

- PythonAnywhere
- Render
- Any VPS or Python-compatible hosting environment

Make sure your hosting environment includes:

- The required Python dependencies
- The `.env` configuration
- Access to the `data/`, `static/`, and `templates/` directories

## Notes

- The app supports Tamil, English, and multilingual UI/explanation flows.
- If Tolkappiyam-specific normalization is unavailable, the backend safely falls back to raw user input.
- Actual explanation content may vary depending on the configured LLM provider and available evidence metadata.
