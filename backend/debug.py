#!/usr/bin/env python3
"""
Test script to debug Tolkāppiyam Knowledge Graph
Run this to check if your CSV is being read correctly
"""

import pandas as pd
import sys

print("=" * 60)
print("🔍 DEBUGGING TOLKĀPPIYAM KNOWLEDGE GRAPH")
print("=" * 60)

# Load CSV
try:
    ontology = pd.read_csv("data/Ontology.csv")
    print("✅ CSV loaded successfully!")
except Exception as e:
    print(f"❌ Error loading CSV: {e}")
    sys.exit(1)

# Check structure
print(f"\n📊 CSV Structure:")
print(f"   Columns: {ontology.columns.tolist()}")
print(f"   Total rows: {len(ontology)}")
print(f"   Shape: {ontology.shape}")

# Show first rows
print(f"\n📄 First 5 rows:")
print(ontology.head())

# Check for null values
print(f"\n🔍 Null values per column:")
print(ontology.isnull().sum())

# Get unique concepts
print(f"\n📚 Sample concepts from column 0:")
col0_unique = ontology.iloc[:, 0].dropna().unique()
for i, concept in enumerate(col0_unique[:10]):
    print(f"   {i+1}. {concept}")

print(f"\n📚 Sample concepts from column 1:")
col1_unique = ontology.iloc[:, 1].dropna().unique()
for i, concept in enumerate(col1_unique[:10]):
    print(f"   {i+1}. {concept}")

# Test the get_subgraph function
print(f"\n" + "=" * 60)
print("🧪 TESTING get_subgraph() FUNCTION")
print("=" * 60)

def get_subgraph(root):
    root = root.strip().lower()
    nodes = set()
    links = []
    
    for _, row in ontology.iterrows():
        src = str(row[0]).strip()
        tgt = str(row[1]).strip()
        
        src_lower = src.lower()
        tgt_lower = tgt.lower()
        
        # Bidirectional search
        if root in src_lower or src_lower in root or root in tgt_lower or tgt_lower in root:
            nodes.add(src)
            nodes.add(tgt)
            links.append({
                "source": src,
                "target": tgt
            })
    
    return {
        "nodes": [{"id": n} for n in nodes],
        "links": links
    }

# Test with different queries
test_queries = [
    "தினை",  # Thinai
    "இயல்பு",  # Iyalpu
    "குறிஞ்சி",  # Kurinji
    "mullai",  # English
    "akam",
]

print(f"\nTesting queries:")
for query in test_queries:
    result = get_subgraph(query)
    print(f"\n   Query: '{query}'")
    print(f"   → Nodes: {len(result['nodes'])}")
    print(f"   → Links: {len(result['links'])}")
    if result['nodes']:
        print(f"   → Sample nodes: {[n['id'] for n in result['nodes'][:3]]}")

# Get first concept from CSV and test
if len(ontology) > 0:
    first_concept = str(ontology.iloc[0, 0]).strip()
    print(f"\n🎯 Testing with first concept from CSV: '{first_concept}'")
    result = get_subgraph(first_concept)
    print(f"   → Nodes: {len(result['nodes'])}")
    print(f"   → Links: {len(result['links'])}")
    if result['links']:
        print(f"   → Sample link: {result['links'][0]}")

print(f"\n" + "=" * 60)
print("✅ Debug complete!")
print("=" * 60) 