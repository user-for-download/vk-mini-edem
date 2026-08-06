import { useEffect } from "react";
import { useWs } from "./WsProvider";
import type { WsServerEvent } from "@edem/contracts";

// Utility to get the payload type if it exists, otherwise undefined
type PayloadOf<T extends WsServerEvent["type"]> = Extract<WsServerEvent, { type: T }> extends { payload: infer P } ? P : undefined;

export function useWsEvent<T extends WsServerEvent["type"]>(
  type: T,
  handler: (payload: PayloadOf<T>) => void
) {
  const { lastMessage } = useWs();

  useEffect(() => {
    if (lastMessage?.type === type) {
      const event = lastMessage as Extract<WsServerEvent, { type: T }>;
      if ("payload" in event) {
        handler(event.payload as PayloadOf<T>);
      } else {
        handler(undefined as PayloadOf<T>);
      }
    }
  }, [lastMessage, type, handler]);
}

