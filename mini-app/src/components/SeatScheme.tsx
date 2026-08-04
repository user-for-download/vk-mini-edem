// mini-app/src/components/SeatScheme.tsx
import { type FC } from "react";
import { Button } from "@vkontakte/vkui";
import { Icon28UserOutline } from "@vkontakte/icons";

export interface SeatSchemeProps {
  seatsTotal: number;
  takenSeats: number[];
  selectedSeat: number | null;
  onSelect: (seat: number | null) => void;
}

export const SeatScheme: FC<SeatSchemeProps> = ({
  seatsTotal,
  takenSeats,
  selectedSeat,
  onSelect,
}) => {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
      {Array.from({ length: seatsTotal }, (_, i) => {
        const seat = i + 1;
        const isTaken = takenSeats.includes(seat);
        const isSelected = selectedSeat === seat;

        return (
          <Button
            key={seat}
            size="m"
            mode={isSelected ? "primary" : isTaken ? "tertiary" : "secondary"}
            disabled={isTaken}
            before={<Icon28UserOutline />}
            onClick={() => onSelect(isSelected ? null : seat)}
            aria-label={isTaken ? `Место ${seat} занято` : `Выбрать место ${seat}`}
            style={{ minWidth: 72 }}
          >
            {seat}
          </Button>
        );
      })}
    </div>
  );
};
