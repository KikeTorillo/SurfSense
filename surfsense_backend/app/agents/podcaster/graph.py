from langgraph.graph import StateGraph

from .configuration import Configuration
from .nodes import (
    combine_audio,
    create_merged_podcast_audio,
    create_podcast_transcript,
    generate_audio,
    generate_outline,
    generate_transcript,
    route_pipeline,
)
from .state import State


def build_graph():
    workflow = StateGraph(State, config_schema=Configuration)

    # Legacy nodes
    workflow.add_node("create_podcast_transcript", create_podcast_transcript)
    workflow.add_node("create_merged_podcast_audio", create_merged_podcast_audio)

    # New multi-speaker nodes
    workflow.add_node("generate_outline", generate_outline)
    workflow.add_node("generate_transcript", generate_transcript)
    workflow.add_node("generate_audio", generate_audio)
    workflow.add_node("combine_audio", combine_audio)

    # Conditional entry based on pipeline type
    workflow.add_conditional_edges(
        "__start__",
        route_pipeline,
        {
            "legacy": "create_podcast_transcript",
            "new": "generate_outline",
        },
    )

    # Legacy path
    workflow.add_edge("create_podcast_transcript", "create_merged_podcast_audio")
    workflow.add_edge("create_merged_podcast_audio", "__end__")

    # New path
    workflow.add_edge("generate_outline", "generate_transcript")
    workflow.add_edge("generate_transcript", "generate_audio")
    workflow.add_edge("generate_audio", "combine_audio")
    workflow.add_edge("combine_audio", "__end__")

    graph = workflow.compile()
    graph.name = "Surfsense Podcaster"
    return graph


# Compile the graph once when the module is loaded
graph = build_graph()
