from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers


class PlaceField(serializers.Field):
    """A place is either free text ("Dallas, TX") or {lat, lng, label} picked from suggestions."""

    def to_internal_value(self, data):
        if isinstance(data, str) and data.strip():
            return {"query": data.strip()}
        if isinstance(data, dict) and "lat" in data and "lng" in data:
            try:
                lat, lng = float(data["lat"]), float(data["lng"])
            except (TypeError, ValueError):
                raise serializers.ValidationError("lat and lng must be numbers.")
            if not (-90 <= lat <= 90 and -180 <= lng <= 180):
                raise serializers.ValidationError("lat/lng out of range.")
            return {
                "lat": lat,
                "lng": lng,
                "label": str(data.get("label") or f"{lat:.4f}, {lng:.4f}"),
            }
        raise serializers.ValidationError(
            "Enter a place name or pick one from the suggestions."
        )

    def to_representation(self, value):
        return value


class AnalyzeSerializer(serializers.Serializer):
    origin = PlaceField()
    destination = PlaceField()
    departure = serializers.DateTimeField()
    load_weight_lb = serializers.FloatField(min_value=0, max_value=100_000)
    interval_miles = serializers.ChoiceField(choices=[10, 25, 50], default=25)

    def validate_departure(self, value):
        now = timezone.now()
        if value < now - timedelta(hours=24):
            raise serializers.ValidationError(
                "Departure can't be more than a day in the past."
            )
        if value > now + timedelta(days=14):
            raise serializers.ValidationError(
                "Forecasts only reach about 14 days ahead."
            )
        return value
