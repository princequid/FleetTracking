import React from "react";
import Badge from "../common/Badge";
import { getStatusVariant, getStatusLabel } from "../../constants/tripStatus";

export default function TripStatusBadge({ status }) {
  // Renders through the shared Badge so contrast comes from theme-aware tokens
  // rather than inline hex, and shows a human label instead of the raw enum.
  return (
    <Badge variant={getStatusVariant(status)} dot>
      {getStatusLabel(status)}
    </Badge>
  );
}
