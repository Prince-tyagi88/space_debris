from skyfield.api import load
from datetime import datetime, timezone


# Load orbital data
satellites = load.tle_file("backend/data/cosmos2251.tle")

print("\nFIRST 10 OBJECTS DOWNLOADED:")
for satellite in satellites[:10]:
    print(satellite.name)

# Skyfield time scale
ts = load.timescale()

# Current UTC time
now = datetime.now(timezone.utc)
t = ts.from_datetime(now)


print("--------------------------------")
print("SPACE OBJECT TRACKER")
print("--------------------------------")
print("Objects:", len(satellites))
print("Time:", now.isoformat())
print("--------------------------------")


for satellite in satellites[:20]:

    # Calculate position
    geocentric = satellite.at(t)

    # Convert to latitude / longitude / altitude
    subpoint = geocentric.subpoint()

    latitude = subpoint.latitude.degrees
    longitude = subpoint.longitude.degrees
    altitude = subpoint.elevation.km

    print()
    print("Object:", satellite.name)
    print("Latitude:", round(latitude, 3), "°")
    print("Longitude:", round(longitude, 3), "°")
    print("Altitude:", round(altitude, 2), "km")