from collections.abc import Callable
from typing import TypedDict

from langgraph.graph import END, START, StateGraph


class RagState(TypedDict, total=False):
    item_id: str
    question: str
    evidence: list[dict]
    answer: str


def build_graph(retrieve: Callable, generate: Callable):
    """Wire real retrieval/generation functions here after data preparation.

    This factory is executable and tested, but is not a completed RAG service.
    Search-term extraction and document selection belong before this graph.
    """
    graph = StateGraph(RagState)
    graph.add_node("retrieve", retrieve)
    graph.add_node("generate", generate)
    graph.add_edge(START, "retrieve")
    graph.add_edge("retrieve", "generate")
    graph.add_edge("generate", END)
    return graph.compile()
