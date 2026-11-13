from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from skyfield.api import load
from datetime import datetime, timezone, timedelta
import math
import numpy as np

app = FastAPI(title="Space Debris Tracker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load orbital data
TLE_FILE = "backend/data/cosmos2251.tle"

satellites = load.tle_file(TLE_FILE)

ts = load.timescale()


@app.get("/")
def home():
    return {
        "message": "Space Debris Tracking API is running",
        "objects": len(satellites)
    }


@app.get("/api/objects")
def get_objects():

    # Current UTC time
    now = datetime.now(timezone.utc)
    t = ts.from_datetime(now)

    objects = []

    for index, satellite in enumerate(satellites):

        # Calculate current position
        geocentric = satellite.at(t)

        # Geographic coordinates
        subpoint = geocentric.subpoint()

        latitude = subpoint.latitude.degrees
        longitude = subpoint.longitude.degrees
        altitude = subpoint.elevation.km

        # Convert latitude, longitude and altitude to 3D coordinates
        R = 6371  # Earth radius in km

        lat = math.radians(latitude)
        lon = math.radians(longitude)

        radius = R + altitude

        x = radius * math.cos(lat) * math.cos(lon)
        y = radius * math.cos(lat) * math.sin(lon)
        z = radius * math.sin(lat)

        # Velocity
        velocity = geocentric.velocity.km_per_s

        objects.append({
    "object_id": satellites.index(satellite),

    "name": satellite.name,

    "latitude": round(latitude, 4),
    "longitude": round(longitude, 4),
    "altitude_km": round(altitude, 2),

    "x": round(x, 2),
    "y": round(y, 2),
    "z": round(z, 2),

    "velocity_km_s": [
        round(float(velocity[0]), 4),
        round(float(velocity[1]), 4),
        round(float(velocity[2]), 4)
    ]
})

    return {
        "timestamp": now.isoformat(),
        "object_count": len(objects),
        "objects": objects
    }
# ==========================================================
# COLLISION / CLOSE-APPROACH DETECTION
# ==========================================================

def get_risk_level(distance_km):
    """
    Hackathon screening thresholds.

    These are NOT operational collision-probability thresholds.
    They are used to classify close approaches for visualization.
    """

    if distance_km < 1:
        return "CRITICAL"

    if distance_km < 5:
        return "HIGH"

    if distance_km < 10:
        return "MEDIUM"

    if distance_km < 25:
        return "LOW"

    return "SAFE"

@app.get("/api/simulation")
def get_simulation(
    hours: int = Query(24, ge=1, le=48),
    step_minutes: int = Query(10, ge=1, le=60)
):
    now = datetime.now(timezone.utc)

    number_of_steps = int((hours * 60) / step_minutes) + 1

    future_datetimes = [
        now + timedelta(minutes=i * step_minutes)
        for i in range(number_of_steps)
    ]

    future_times = ts.from_datetimes(future_datetimes)

    frames = []

    print(
        f"Generating simulation: "
        f"{len(satellites)} objects × {number_of_steps} frames"
    )

    for frame_index, skyfield_time in enumerate(future_times):

        objects = []

        for object_id, satellite in enumerate(satellites):

            try:
                geocentric = satellite.at(skyfield_time)

                position = geocentric.position.km

                objects.append({
                    "object_id": object_id,
                    "x": round(float(position[0]), 3),
                    "y": round(float(position[1]), 3),
                    "z": round(float(position[2]), 3)
                })

            except Exception:
                continue

        frames.append({
            "time": future_datetimes[frame_index].isoformat(),
            "objects": objects
        })

    return {
        "status": "success",
        "generated_at": now.isoformat(),
        "hours": hours,
        "step_minutes": step_minutes,
        "object_count": len(satellites),
        "frame_count": len(frames),
        "frames": frames
    }

@app.get("/api/collisions")
def detect_collisions(
    hours: int = Query(24, ge=1, le=72),
    step_minutes: int = Query(10, ge=1, le=60),
    threshold_km: float = Query(25, gt=0, le=100),
    limit: int = Query(20, ge=1, le=100)
):

    now = datetime.now(timezone.utc)

    # ------------------------------------------------------
    # FUTURE TIME POINTS
    # ------------------------------------------------------

    number_of_steps = (
        int((hours * 60) / step_minutes) + 1
    )

    future_datetimes = [
        now + timedelta(
            minutes=i * step_minutes
        )
        for i in range(number_of_steps)
    ]

    future_times = ts.from_datetimes(
        future_datetimes
    )

    # ------------------------------------------------------
    # CALCULATE FUTURE POSITIONS
    # ------------------------------------------------------

    positions = []
    valid_objects = []

    for object_id, satellite in enumerate(satellites):

        try:

            position = satellite.at(
                future_times
            ).position.km

            positions.append(
                np.asarray(position).T
            )

            valid_objects.append({
                "object_id": object_id,
                "satellite": satellite
            })

        except Exception:
            continue

    if len(positions) < 2:

        return {
            "status": "error",
            "message": "Not enough valid orbital objects"
        }

    positions = np.asarray(positions)

    collision_events = {}

    # ------------------------------------------------------
    # CHECK EVERY FUTURE TIME
    # ------------------------------------------------------

    for time_index in range(
        len(future_datetimes)
    ):

        current_positions = (
            positions[:, time_index, :]
        )

        # Difference between every pair

        differences = (
            current_positions[:, None, :]
            -
            current_positions[None, :, :]
        )

        distances = np.linalg.norm(
            differences,
            axis=2
        )

        # Only upper triangle
        pair_indices = np.argwhere(
            np.triu(
                distances <= threshold_km,
                k=1
            )
        )

        for i, j in pair_indices:

            distance_km = float(
                distances[i, j]
            )

            object_a = valid_objects[i]
            object_b = valid_objects[j]

            id_a = object_a["object_id"]
            id_b = object_b["object_id"]

            sat_a = object_a["satellite"]
            sat_b = object_b["satellite"]

            # Unique pair based on IDs
            pair_key = (
                min(id_a, id_b),
                max(id_a, id_b)
            )

            # Save closest approach only
            if (
                pair_key not in collision_events
                or
                distance_km <
                collision_events[pair_key][
                    "minimum_distance_km"
                ]
            ):

                collision_events[pair_key] = {

                    "object_1": {
                        "object_id": id_a,
                        "name": sat_a.name
                    },

                    "object_2": {
                        "object_id": id_b,
                        "name": sat_b.name
                    },

                    "minimum_distance_km":
                        round(
                            distance_km,
                            3
                        ),

                    "time":
                        future_datetimes[
                            time_index
                        ].isoformat(),

                    "risk_level":
                        get_risk_level(
                            distance_km
                        )
                }

    # ------------------------------------------------------
    # SORT BY CLOSEST APPROACH
    # ------------------------------------------------------

    events = sorted(
        collision_events.values(),
        key=lambda event:
            event["minimum_distance_km"]
    )

    # ------------------------------------------------------
    # SUMMARY
    # ------------------------------------------------------

    summary = {
        "critical": 0,
        "high": 0,
        "medium": 0,
        "low": 0
    }

    for event in events:

        level = event["risk_level"].lower()

        if level in summary:
            summary[level] += 1

    # ------------------------------------------------------
    # RESPONSE
    # ------------------------------------------------------

    return {

        "status": "success",

        "generated_at":
            now.isoformat(),

        "forecast_hours":
            hours,

        "step_minutes":
            step_minutes,

        "screening_threshold_km":
            threshold_km,

        "objects_analyzed":
            len(valid_objects),

        "close_approaches":
            len(events),

        "summary":
            summary,

        "events":
            events[:limit]
    }
# ==========================================================
# INDIVIDUAL OBJECT TRAJECTORY
# ==========================================================

@app.get("/api/trajectory/{object_id}")
def get_trajectory(
    object_id: int,
    hours: int = Query(24, ge=1, le=72),
    step_minutes: int = Query(10, ge=1, le=60)
):

    # ------------------------------------------------------
    # Validate object ID
    # ------------------------------------------------------

    if object_id < 0 or object_id >= len(satellites):

        return {
            "status": "error",
            "message": "Object ID not found"
        }

    satellite = satellites[object_id]

    # ------------------------------------------------------
    # Create future timestamps
    # ------------------------------------------------------

    now = datetime.now(timezone.utc)

    number_of_steps = int(
        (hours * 60) / step_minutes
    ) + 1

    future_datetimes = [
        now + timedelta(
            minutes=i * step_minutes
        )
        for i in range(number_of_steps)
    ]

    future_times = ts.from_datetimes(
        future_datetimes
    )

    # ------------------------------------------------------
    # Propagate satellite
    # ------------------------------------------------------

    trajectory = []

    for i, skyfield_time in enumerate(future_times):

        try:

            geocentric = satellite.at(
                skyfield_time
            )

            position = geocentric.position.km

            velocity = (
                geocentric.velocity.km_per_s
            )

            latitude = (
                geocentric.subpoint()
                .latitude
                .degrees
            )

            longitude = (
                geocentric.subpoint()
                .longitude
                .degrees
            )

            altitude = (
                geocentric.subpoint()
                .elevation
                .km
            )

            trajectory.append({

                "time":
                    future_datetimes[i].isoformat(),

                "latitude":
                    round(latitude, 6),

                "longitude":
                    round(longitude, 6),

                "altitude_km":
                    round(altitude, 3),

                "x":
                    round(float(position[0]), 3),

                "y":
                    round(float(position[1]), 3),

                "z":
                    round(float(position[2]), 3),

                "velocity_km_s": [
                    round(float(velocity[0]), 6),
                    round(float(velocity[1]), 6),
                    round(float(velocity[2]), 6)
                ]

            })

        except Exception:
            continue

    return {

        "status": "success",

        "object_id":
            object_id,

        "name":
            satellite.name,

        "generated_at":
            now.isoformat(),

        "forecast_hours":
            hours,

        "step_minutes":
            step_minutes,

        "points":
            len(trajectory),

        "trajectory":
            trajectory

    }