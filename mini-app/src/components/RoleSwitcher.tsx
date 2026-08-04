// mini-app/src/components/RoleSwitcher.tsx
import { type FC } from "react";
import { SegmentedControl } from "@vkontakte/vkui";
import type { Role } from "@/types";

export interface RoleSwitcherProps {
  role: Role;
  onChange: (role: Role) => void;
}

export const RoleSwitcher: FC<RoleSwitcherProps> = ({ role, onChange }) => {
  return (
    <SegmentedControl<Role>
      value={role}
      onChange={onChange}
      options={[
        { label: "Пассажир", value: "passenger" },
        { label: "Водитель", value: "driver" },
      ]}
    />
  );
};
