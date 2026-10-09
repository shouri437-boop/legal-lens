import type { GeospatialData } from "@/types/geospatial.types";

// Mock geospatial data for demonstration
export const mockGeospatialData: GeospatialData = {
  landmarks: [
    {
      id: "landmark-1",
      name: "Crime Scene - Main Street",
      location: { lat: 37.7749, lng: -122.4194 },
      type: "crime_scene",
      events: [
        {
          id: "event-1",
          title: "Initial Incident Reported",
          description:
            "First responders arrived at the scene following a 911 call.",
          timestamp: new Date("2024-01-15T14:30:00"),
          layer: "evidence",
          confidence: 0.95,
          sourceDocuments: ["police-report-001.pdf"],
        },
        {
          id: "event-2",
          title: "Evidence Collection",
          description:
            "Forensic team collected physical evidence from the location.",
          timestamp: new Date("2024-01-15T16:45:00"),
          layer: "evidence",
          confidence: 0.98,
          sourceDocuments: ["forensic-report-001.pdf"],
        },
      ],
    },
    {
      id: "landmark-2",
      name: "Witness Residence - Oak Avenue",
      location: { lat: 37.7849, lng: -122.4094 },
      type: "witness_location",
      events: [
        {
          id: "event-3",
          title: "Witness Interview",
          description: "Key witness provided testimony about events observed.",
          timestamp: new Date("2024-01-16T10:00:00"),
          layer: "legal",
          confidence: 0.85,
          sourceDocuments: ["witness-statement-001.pdf"],
        },
      ],
    },
    {
      id: "landmark-3",
      name: "Evidence Storage - Police Station",
      location: { lat: 37.7649, lng: -122.4294 },
      type: "evidence_location",
      events: [
        {
          id: "event-4",
          title: "Evidence Logged",
          description: "All collected evidence was catalogued and stored.",
          timestamp: new Date("2024-01-15T18:00:00"),
          layer: "evidence",
          confidence: 1.0,
          sourceDocuments: ["evidence-log-001.pdf"],
        },
      ],
    },
    {
      id: "landmark-4",
      name: "Suspect Last Known Location",
      location: { lat: 37.7949, lng: -122.3994 },
      type: "suspect_location",
      events: [
        {
          id: "event-5",
          title: "Surveillance Footage",
          description: "Security camera captured suspect at this location.",
          timestamp: new Date("2024-01-15T13:15:00"),
          layer: "evidence",
          confidence: 0.92,
          sourceDocuments: ["surveillance-footage-001.mp4"],
        },
        {
          id: "event-6",
          title: "Strategic Analysis",
          description: "Pattern analysis suggests this was a planned route.",
          timestamp: new Date("2024-01-17T09:00:00"),
          layer: "strategy",
          confidence: 0.78,
        },
      ],
    },
  ],
  paths: [
    {
      id: "path-1",
      from: "landmark-4",
      to: "landmark-1",
      label: "Suspect Movement",
      color: "#FF6B6B",
    },
    {
      id: "path-2",
      from: "landmark-1",
      to: "landmark-3",
      label: "Evidence Transfer",
      color: "#4A90E2",
    },
    {
      id: "path-3",
      from: "landmark-2",
      to: "landmark-1",
      label: "Witness Proximity",
      color: "#50C878",
    },
  ],
};
