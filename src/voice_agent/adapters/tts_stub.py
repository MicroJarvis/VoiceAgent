class StubTTSAdapter:
    def speak(self, text: str) -> None:
        print(f"agent> {text}")
