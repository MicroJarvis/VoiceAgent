from typing import Protocol


class ASRAdapter(Protocol):
    def transcribe_once(self) -> str:
        ...
