import React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useWsEvent } from "@/providers/useWsEvent";

export const GlobalWsListener: React.FC = () => {
  const queryClient = useQueryClient();

  useWsEvent("notification:new", () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
    queryClient.invalidateQueries({ queryKey: ["users", "me"] });
  });

  useWsEvent("booking:new", ({ tripId }) => {
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
  });

  useWsEvent("booking:status_changed", ({ tripId }) => {
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "trip", tripId] });
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
  });

  useWsEvent("trip:status_changed", ({ tripId }) => {
    queryClient.invalidateQueries({ queryKey: ["trips", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "my"] });
    queryClient.invalidateQueries({ queryKey: ["bookings", "history"] });
    queryClient.invalidateQueries({ queryKey: ["trip", tripId] });
  });

  return null;
};
