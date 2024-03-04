import { Dispatch } from "react";

export const BrushSizePicker = ({
  setThickness,
}: {
  setThickness: Dispatch<number>;
}) => {
  const thicknesses = [1, 3, 5];
  return (
    <div className="flex gap-2 items-center">
      {thicknesses.map((size) => (
        <div
          key={size}
          className="rounded-full bg-black"
          style={{ width: size * 5 + "px", height: size * 5 + "px" }}
          onClick={() => setThickness(size)}
        ></div>
      ))}
    </div>
  );
};
