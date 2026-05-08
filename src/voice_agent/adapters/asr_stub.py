class StubASRAdapter:
    def transcribe_once(self) -> str:
        return input("you> ")
