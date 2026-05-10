import pandas as pd

QUERY_DF = pd.read_csv("tolkappiyam-ai/data/Query_Mapping.csv")
ONTOLOGY_DF = pd.read_csv("tolkappiyam-ai/data/Ontology.csv")

def get_few_shot_examples(limit=5):
    samples = QUERY_DF.sample(limit)
    return samples.to_dict(orient="records")
