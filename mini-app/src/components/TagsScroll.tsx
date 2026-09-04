// mini-app/src/components/TagsScroll.tsx
import { type FC, useState } from "react";
import { SubnavigationBar, SubnavigationButton } from "@vkontakte/vkui";

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
 * Использует нативный SubnavigationBar + SubnavigationButton из VKUI с ContentBadge.
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
    <SubnavigationBar>
      {tags.map((tag) => {
        const isSelected = selected.includes(tag);
        return (
          <SubnavigationButton
            key={tag}
            selected={isSelected}
            onClick={() => toggle(tag)}
          >
            {tag}
          </SubnavigationButton>
        );
      })}
    </SubnavigationBar>
  );
};
