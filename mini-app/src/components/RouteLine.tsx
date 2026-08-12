// mini-app/src/components/RouteLine.tsx
import { type FC } from "react";
import { Text, Footnote, Flex, Spacing } from "@vkontakte/vkui";

export interface RoutePoint {
  city: string;
  address?: string;
}

export interface RouteLineProps {
  from: RoutePoint;
  to: RoutePoint;
  duration?: string;
  distance?: string;
  seatsLeft?: number;
  seatsLabel?: string;
  price?: number;
  dateLabel?: string;
  time?: string;
}

export const RouteLine: FC<RouteLineProps> = ({
  from,
  to,
  duration,
  distance,
  seatsLeft,
  seatsLabel: seatsLabelProp,
  price,
  dateLabel,
  time,
}) => {
  const tripDetailsText = [
    duration ? `В пути: ${duration}` : undefined,
    distance,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Flex direction="column" gap="xs">
      {/* Строка 1: Дата, время --------- Цена (если переданы) */}
      {(dateLabel || time || price !== undefined) && (
        <Flex align="center" justify="space-between">
          {dateLabel || time ? (
            <Footnote
              weight="2"
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_secondary)" }}
            >
              {[dateLabel, time].filter(Boolean).join(" · ")}
            </Footnote>
          ) : <div />}
          {price !== undefined && (
            <Text
              weight="1"
              // eslint-disable-next-line react/forbid-dom-props
              style={{ color: "var(--vkui--color_text_primary)", fontSize: 18, lineHeight: "22px" }}
            >
              {price.toLocaleString("ru-RU")} ₽
            </Text>
          )}
        </Flex>
      )}

      {/* Строка 2: Маршрут с вертикальной линией слева */}
      <Flex align="stretch" gap="m">
        <Spacing size={6} />
        <Flex
          direction="column"
          align="center"
          // eslint-disable-next-line react/forbid-dom-props
          style={{ width: 10, flexShrink: 0 }}
        >
          <div
            // eslint-disable-next-line react/forbid-dom-props
            style={{
              width: 9,
              height: 9,
              borderRadius: "50%",
              background: "var(--vkui--color_icon_accent, #2bb673)",
              flexShrink: 0,
              boxShadow: "0 0 0 3px var(--vkui--color_background_accent_themed_alpha, rgba(43, 182, 115, 0.15))",
            }}
          />
          <Spacing size={4} />
          <div
            // eslint-disable-next-line react/forbid-dom-props
            style={{
              flex: "1 1 0%",
              width: 2,
              minHeight: 22,
              opacity: 0.55,
              background: "repeating-linear-gradient(to bottom, var(--vkui--color_icon_accent, #2bb673) 0, var(--vkui--color_icon_accent, #2bb673) 3px, transparent 3px, transparent 7px)",
            }}
          />
          <Spacing size={4} />
          <div
            // eslint-disable-next-line react/forbid-dom-props
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--vkui--color_icon_secondary, #99a2ad)",
              flexShrink: 0,
            }}
          />
        </Flex>
        <Spacing size={4} />

        <Flex direction="column" style={{ flex: 1, minWidth: 0 }}>
          {/* Откуда --------------------- Места */}
          <Flex align="center" justify="space-between">
            <Text
              weight="2"
              // eslint-disable-next-line react/forbid-dom-props
              style={{
                color: "var(--vkui--color_text_primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {from.city}
            </Text>
            {seatsLabelProp || seatsLeft !== undefined ? (
              <Footnote
                weight="2"
                // eslint-disable-next-line react/forbid-dom-props
                style={{
                  color: seatsLeft !== undefined && seatsLeft <= 0
                    ? "var(--vkui--color_text_negative, #ff334b)"
                    : "var(--vkui--color_text_accent, #2bb673)",
                  flexShrink: 0,
                }}
              >
                {seatsLabelProp || (seatsLeft! > 0 ? `${seatsLeft} мест` : "нет мест")}
              </Footnote>
            ) : null}
          </Flex>

          {from.address && (
            <>
              <Spacing size={2} />
              <Footnote
                // eslint-disable-next-line react/forbid-dom-props
                style={{
                  color: "var(--vkui--color_text_tertiary, #818c99)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {from.address}
              </Footnote>
            </>
          )}

          <Spacing size={8} />

          {/* Куда */}
          <Text
            weight="2"
            // eslint-disable-next-line react/forbid-dom-props
            style={{
              color: "var(--vkui--color_text_primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {to.city}
          </Text>

          {to.address && (
            <>
              <Spacing size={2} />
              <Footnote
                // eslint-disable-next-line react/forbid-dom-props
                style={{
                  color: "var(--vkui--color_text_tertiary, #818c99)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {to.address}
              </Footnote>
            </>
          )}
        </Flex>
      </Flex>

      {/* Время в пути и расстояние */}
      {tripDetailsText && (
        <>
          <Spacing size={6} />
          <Footnote
            // eslint-disable-next-line react/forbid-dom-props
            style={{ color: "var(--vkui--color_text_secondary)" }}
          >
            {tripDetailsText}
          </Footnote>
        </>
      )}
    </Flex>
  );
};
