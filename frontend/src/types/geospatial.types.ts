// Geospatial Intelligence Types

export interface LandmarkEvent {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  layer: "evidence" | "legal" | "strategy";
  confidence?: number;
  sourceDocuments?: string[];
}

export interface Landmark {
  id: string;
  name: string;
  location: {
    lat: number;
    lng: number;
  };
  events: LandmarkEvent[];
  type:
    | "crime_scene"
    | "witness_location"
    | "evidence_location"
    | "suspect_location"
    | "other";
}

export interface GeospatialPath {
  id: string;
  from: string; // landmark ID
  to: string; // landmark ID
  label?: string;
  color?: string;
}

export interface GeospatialData {
  landmarks: Landmark[];
  paths: GeospatialPath[];
}

export type MapView = "2d" | "3d";
