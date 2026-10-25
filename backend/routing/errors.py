class ServiceError(Exception):
    """A problem we can explain to the user (bad input, or an upstream API failing)."""

    def __init__(self, message, status=502):
        super().__init__(message)
        self.message = message
        self.status = status
