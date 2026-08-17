# Field mode

Field mode is intended for understanding a saved cadastral parcel while physically walking around it.

## What it shows

- Current GPS position.
- Browser-reported horizontal accuracy (`± metres`).
- Accuracy circle on the map.
- The selected parcel, or automatic detection of the parcel under the current position.
- Whether the current position is inside or outside the target parcel.
- The geodesic distance to the nearest cadastral boundary.
- A guide line and marker to the nearest point on that boundary.
- Parcel surface in hectares.

The default field workflow works especially well with **Ortofoto PNOA + Catastro boundaries** enabled.

## Start field mode

1. Open Catastro Digital on the phone.
2. Optionally select a saved parcel first. If you do, field mode follows that parcel.
3. Press **Modo campo**.
4. Allow location access when the browser asks.
5. If no parcel was selected, Catastro Digital automatically detects a saved parcel around your current position.
6. Use **Centrarme** or **Ver finca** as needed while walking.

## Important accuracy note

The UI deliberately displays the GPS accuracy supplied by the device. If the distance to the boundary is smaller than the current GPS uncertainty, the app warns that the GPS uncertainty dominates the measurement.

This is an orientation tool for understanding the cadastral geometry on the ground. It is not a legal/topographic boundary survey.

## HTTPS is required on a phone

Browser geolocation is restricted to secure contexts. `http://localhost:3000` can work on the same computer, but a phone opening a LAN address such as `http://192.168.x.x:3000` will normally not be allowed to use geolocation.

For real field use, serve Catastro Digital from an HTTPS address that the phone can reach. The application detects an insecure context and shows a clear message instead of silently failing.

Also remember that a Docker stack running only on a PC at home is not reachable from a remote finca unless you provide network access to that machine (for example through a secure private network or an HTTPS deployment).
