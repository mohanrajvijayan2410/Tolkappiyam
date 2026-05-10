try:
    from tholkaappiyam import thol
except ImportError:
    thol = None

def preprocess_query(query):
    """
    Preprocess user query using Tolkāppiyam-specific linguistic normalization.
    Falls back to raw query if thol is unavailable.
    """
    if thol and hasattr(thol, "normalize"):
        return thol.normalize(query)
    return query
