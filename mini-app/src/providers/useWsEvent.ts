import { useEffect, useRef } from "react";
import { useWs } from "./WsProvider";
import type { WsServerEvent } from "@edem/contracts";

// Utility to get the payload type if it exists, otherwise undefined
type PayloadOf<T extends WsServerEvent["type"]> = Extract<WsServerEvent, { type: T }> extends { payload: infer P } ? P : undefined;

export function useWsEvent<T extends WsServerEvent["type"]>(
  type: T,
  handler: (payload: PayloadOf<T>) => void
) {
  const { lastMessage } = useWs();

  // Храним handler в ref: колбэки создаются инлайн при каждом рендере,
  // и зависимость от них в useEffect приводила бы к повторному срабатыванию
  // обработчика с тем же lastMessage на каждый рендер.
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (lastMessage?.type === type) {
      const event = lastMessage as Extract<WsServerEvent, { type: T }>;
      if ("payload" in event) {
        handlerRef.current(event.payload as PayloadOf<T>);
      } else {
        handlerRef.current(undefined as PayloadOf<T>);
      }
    }
  }, [lastMessage, type]);
}