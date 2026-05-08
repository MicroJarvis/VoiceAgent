from typing import Protocol


class TTSAdapter(Protocol):
    def speak(self, text: str) -> None:
        ...
