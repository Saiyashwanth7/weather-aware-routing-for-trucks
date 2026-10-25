import logging

from rest_framework.response import Response
from rest_framework.views import APIView

from ..clients import geocode
from ..clients import routing as routing_client
from ..errors import ServiceError
from ..services import trip_planner
from .serializers import AnalyzeSerializer

log = logging.getLogger(__name__)


def _format_errors(errors):
    parts = []
    for field, msgs in errors.items():
        msgs = msgs if isinstance(msgs, (list, tuple)) else [msgs]
        parts.append(f"{field}: {' '.join(str(m) for m in msgs)}")
    return "; ".join(parts)


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok"})


class GeocodeView(APIView):
    """GET /api/geocode?q=Dallas  ->  {"results": [{"label", "lat", "lng"}]}"""

    def get(self, request):
        query = request.query_params.get("q", "").strip()
        if len(query) < 2:
            return Response({"results": []})
        try:
            return Response({"results": geocode.search(query)})
        except ServiceError as exc:
            return Response({"error": exc.message}, status=exc.status)


class AnalyzeView(APIView):
    """POST /api/analyze: routes, weather checkpoints, risk and a recommendation for one trip."""

    def post(self, request):
        serializer = AnalyzeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response({"error": _format_errors(serializer.errors)}, status=400)
        data = serializer.validated_data
        departure = data["departure"]

        try:
            origin = geocode.resolve(data["origin"])
            destination = geocode.resolve(data["destination"])
            routes, warnings = routing_client.get_routes(origin, destination)
            result = trip_planner.analyze_routes(
                routes, departure, data["load_weight_lb"], data["interval_miles"]
            )
        except ServiceError as exc:
            return Response({"error": exc.message}, status=exc.status)
        except Exception:
            log.exception("Unexpected error while analysing a trip")
            return Response(
                {"error": "Something went wrong on our side. Please try again."},
                status=500,
            )

        result.update(
            {
                "origin": origin,
                "destination": destination,
                "departure": trip_planner.iso(departure),
                "load_weight_lb": data["load_weight_lb"],
                "interval_miles": data["interval_miles"],
                "warnings": warnings,
            }
        )
        return Response(result)
