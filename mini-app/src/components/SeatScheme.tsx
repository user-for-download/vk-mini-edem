// mini-app/src/components/SeatScheme.tsx
import { type FC } from "react";
import { Caption } from "@vkontakte/vkui";

export interface SeatSchemeProps {
  seatsTotal: number;
  takenSeats: number[];
  selectedSeat: number | null;
  onSelect: (seat: number | null) => void;
}

export const SeatScheme: FC<SeatSchemeProps> = ({ seatsTotal, takenSeats, selectedSeat, onSelect }) => {
  const frontSeats = seatsTotal >= 2 ? [1] : [];
  const backSeats = seatsTotal >= 2
    ? Array.from({ length: seatsTotal - 1 }, (_, i) => i + 2)
    : Array.from({ length: seatsTotal }, (_, i) => i + 1);

  const renderSeat = (seat: number) => {
    const isTaken = takenSeats.includes(seat);
    const isSelected = selectedSeat === seat;
    let className = "SeatScheme__seat";
    if (isTaken) className += " SeatScheme__seat--taken";
    if (isSelected) className += " SeatScheme__seat--selected";

    return (
      <button
        key={seat}
        type="button"
        className={className}
        disabled={isTaken}
        onClick={() => onSelect(isSelected ? null : seat)}
        aria-label={isTaken ? `Место ${seat} занято` : `Выбрать место ${seat}`}
        aria-pressed={isSelected}
      >
        {seat}
      </button>
    );
  };

  return (
    <div className="SeatScheme" role="radiogroup" aria-label="Выбор места">
      <div className="SeatScheme__row">
        <div className="SeatScheme__seat SeatScheme__seat--driver" aria-label="Водитель">🚗</div>
        {frontSeats.map(renderSeat)}
      </div>
      {backSeats.length > 0 && (
        <div className="SeatScheme__row SeatScheme__row--back">
          {backSeats.map(renderSeat)}
        </div>
      )}
      <div className="SeatScheme__legend">
        <div className="SeatScheme__legendItem">
          <div className="SeatScheme__legendDot SeatScheme__legendDot--selected" />
          <Caption level="1">Выбрано</Caption>
        </div>
        <div className="SeatScheme__legendItem">
          <div className="SeatScheme__legendDot SeatScheme__legendDot--free" />
          <Caption level="1">Свободно</Caption>
        </div>
        <div className="SeatScheme__legendItem">
          <div className="SeatScheme__legendDot SeatScheme__legendDot--taken" />
          <Caption level="1">Занято</Caption>
        </div>
      </div>
    </div>
  );
};
