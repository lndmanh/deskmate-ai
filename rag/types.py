from dataclasses import dataclass


@dataclass(frozen=True)
class RetrievedDocument:
    source: str
    title: str
    content: str
    score: float
