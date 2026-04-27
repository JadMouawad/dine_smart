import Map, { Marker, NavigationControl } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function OwnerLocationMap({
  viewState,
  onMove,
  onClick,
  latitude,
  longitude,
  viewOnly = false,
}) {
  return (
    <Map
      {...viewState}
      onMove={onMove}
      onClick={viewOnly ? undefined : onClick}
      mapboxAccessToken={MAPBOX_TOKEN}
      style={{ width: "100%", height: "100%" }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      cursor={viewOnly ? "grab" : "crosshair"}
    >
      <NavigationControl position="top-right" />
      {latitude != null && longitude != null && (
        <Marker longitude={longitude} latitude={latitude} anchor="bottom">
          <div
            className="ownerMapPin"
            title={`${latitude}, ${longitude}`}
            aria-label="Restaurant location pin"
          />
        </Marker>
      )}
    </Map>
  );
}
