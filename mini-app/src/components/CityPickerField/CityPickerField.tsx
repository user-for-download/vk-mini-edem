// mini-app/src/components/CityPickerField/CityPickerField.tsx
//
// Поле выбора города в форме поездки. Реализовано на `CustomSelect`:
// дропдаун открывается прямо из поля, без третьего уровня модалки
// (фор-ма → модалка → модалка — было UX-бредом). Справочник грузится
// одним запросом через `useAllCitiesQuery`; фильтрация — клиентская
// через `filterFn` (case-insensitive contains).
//
// UX:
//  - иконка `Icon20LocationMapOutline` слева = контекстная подсказка;
//  - тап → дропдаун с поиском по `q`;
//  - текущий выбранный город помечен `disabled` (нельзя выбрать повторно);
//  - в `EditTripModal` поле `disabled` целиком + helperText «не меняется».
import { type FC, useMemo } from "react";
import {
  Button,
  CustomSelect,
  CustomSelectOption,
  Flex,
  FormItem,
} from "@vkontakte/vkui";
import { Icon20LocationMapOutline } from "@vkontakte/icons";
import type { CityDto } from "@edem/contracts";
import { useAllCitiesQuery } from "@/queries/useAllCities";

/**
 * `SelectValue` (string | number | readonly string[] | null) — тип
 * значения `CustomSelect.value` (см. доки VKUI). Локальный алиас,
 * чтобы не тянуть внутренний тип.
 */
type CustomSelectValue = string | number | readonly string[] | null;

/**
 * Опция для `CustomSelect`. Помимо обязательных `value`/`label`,
 * несёт `description` (для возможного расширения, например регион)
 * и `disabled` (для уже выбранного города).
 */
interface CityOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

/**
 * Кастомный поиск: case-insensitive contains по `label`. Для 25–200
 * городов O(N) на каждое нажатие — незаметно.
 */
const filterFn = (query: string, option: CityOption): boolean =>
  option.label.toLowerCase().includes(query.trim().toLowerCase());

export interface CityPickerFieldProps {
  /** Текущее значение. `null` = поле пустое. */
  value: CityDto | null;
  /** Колбэк выбора. */
  onChange: (city: CityDto) => void;
  /** Заголовок поля («Откуда» / «Куда»). */
  label: string;
  /** Текст ошибки (status="error" + подпись снизу). */
  error?: string;
  /** Дополнительная подпись снизу (например, «Маршрут нельзя изменить»). */
  helperText?: string;
  /** Блокирует всё поле (для EditTripModal). */
  disabled?: boolean;
  /** Уникальный id для ARIA. */
  id: string;
  /** ID города, который нужно скрыть из списка (например, выбранный «куда»). */
  excludeCityId?: string;
}

export const CityPickerField: FC<CityPickerFieldProps> = ({
  value,
  onChange,
  label,
  error,
  helperText,
  disabled = false,
  id,
  excludeCityId,
}) => {
  const {
    data: cities = [],
    isFetching,
    isError: isCitiesError,
    error: citiesError,
    refetch: refetchCities,
  } = useAllCitiesQuery();

  // Справочник не загрузился и кэша нет: CustomSelect покажет пустой
  // список (тупик без обратной связи), поэтому ниже в `bottom`
  // выводим ошибку с кнопкой повтора — повторный запрос через `refetch`.
  const isCitiesLoadFailed = isCitiesError && cities.length === 0;

  const options: CityOption[] = useMemo(() => {
    const list = excludeCityId
      ? cities.filter((city) => city.id !== excludeCityId)
      : cities;
    return list.map((city) => ({
      value: city.id,
      label: city.name,
      // Текущий выбранный в этом поле — disabled, чтобы пользователь
      // видел свой выбор (label остаётся), но не мог «пере-выбрать» того же.
      disabled: value?.id === city.id,
    }));
  }, [cities, value?.id, excludeCityId]);

  const handleChange = (_: unknown, newValue: CustomSelectValue) => {
    if (typeof newValue !== "string" || newValue === "") return;
    const picked = cities.find((city) => city.id === newValue);
    if (picked) onChange(picked);
  };

  return (
    <FormItem
      htmlFor={id}
      top={label}
      status={error ? "error" : "default"}
      bottom={
        error ? (
          // eslint-disable-next-line react/forbid-dom-props
          <span role="alert" style={{ color: "var(--vkui--color_text_negative)", fontSize: 13 }}>
            {error}
          </span>
        ) : isCitiesLoadFailed ? (
          <Flex direction="column" gap={4} align="start">
            {/* eslint-disable-next-line react/forbid-dom-props */}
            <span role="alert" style={{ color: "var(--vkui--color_text_negative)", fontSize: 13 }}>
              {citiesError instanceof Error
                ? `Не удалось загрузить справочник: ${citiesError.message}`
                : "Не удалось загрузить справочник городов. Проверьте соединение."}
            </span>
            <Button size="s" mode="tertiary" onClick={() => { void refetchCities(); }}>
              Попробовать снова
            </Button>
          </Flex>
        ) : helperText ? (
          // eslint-disable-next-line react/forbid-dom-props
          <span style={{ color: "var(--vkui--color_text_secondary)", fontSize: 13 }}>
            {helperText}
          </span>
        ) : undefined
      }
    >
      <CustomSelect
        id={id}
        // value=null (НЕ undefined) — невыбранное состояние, см. доки VKUI.
        // placeholder дублирует label выбранного, чтобы текст не пустовал.
        value={value?.id ?? null}
        onChange={handleChange}
        options={options}
        placeholder={value?.name ?? "Не выбран"}
        before={<Icon20LocationMapOutline />}
        searchable
        filterFn={filterFn}
        fetching={isFetching}
        fetchingInProgressLabel="Справочник загружается..."
        fetchingCompletedLabel={`Городов загружено: ${options.length}`}
        allowClearButton
        disabled={disabled}
        renderOption={({ option, ...restProps }) => (
          <CustomSelectOption {...restProps} description={option.description} />
        )}
        slotProps={{
          input: { id, "aria-label": label },
        }}
      />
    </FormItem>
  );
};
