// mini-app/src/components/TagsScroll.tsx
import { type FC, useState } from "react";
import { HorizontalScroll } from "@vkontakte/vkui";

export interface TagsScrollProps {
  tags: string[];
  defaultSelected?: string[];

  /**
   * Controlled mode: выбранные теги снаружи.
   */
  selected?: string[];

  /**
   * Controlled mode: callback при изменении выбора.
   */
  onChange?: (selected: string[]) => void;
}

/**
 * Горизонтальный ряд фильтров-пилюль.
 * Теперь умеет работать и как uncontrolled, и как controlled компонент.
 */
export const TagsScroll: FC<TagsScrollProps> = ({
  tags,
  defaultSelected = [],
  selected: controlledSelected,
  onChange,
}) => {
  const [internalSelected, setInternalSelected] = useState<string[]>(defaultSelected);

  const selected = controlledSelected ?? internalSelected;

  const toggle = (tag: string) => {
    const next = selected.includes(tag)
      ? selected.filter((t) => t !== tag)
      : [...selected, tag];

    if (onChange) {
      onChange(next);
    } else {
      setInternalSelected(next);
    }
  };

  return (
    <HorizontalScroll showArrows>
      <div className="TagsScroll__list">
        {tags.map((tag) => {
          const active = selected.includes(tag);

          return (
            <button
              key={tag}
              type="button"
              className={`TagsScroll__pill${active ? " TagsScroll__pill--active" : ""}`}
              aria-pressed={active}
              onClick={() => toggle(tag)}
            >
              {tag}
            </button>
          );
        })}
      </div>
    </HorizontalScroll>
  );
};
