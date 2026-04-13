import { UseFormRegister, FieldErrors } from "react-hook-form";
import { StyleUtil } from "@/kits/utils";

interface ReportProductItem {
  code: string;
  name: string;
  gift: string;
}

interface ReportProductInputGroupProps {
  items: ReportProductItem[];
  register: UseFormRegister<any>;
  formValues: any;
  errors: FieldErrors;
  isLocked?: boolean;
}

export const ReportProductInputGroup = ({
  items,
  register,
  formValues,
  errors,
  isLocked = false,
}: ReportProductInputGroupProps) => {
  return (
    <div className="divide-y divide-gray-200 bg-white">
      {items.map((item) => {
        const hasValue =
          formValues?.items?.[item.code]?.pcs !== undefined &&
          formValues?.items?.[item.code]?.pcs !== null &&
          formValues?.items?.[item.code]?.pcs > 0 &&
          !Number.isNaN(formValues?.items?.[item.code]?.pcs);

        return (
          <div key={item.code} className="p-4">
            <div className="grid grid-cols-3 items-center gap-4">
              <div className="col-span-2">
                <p className="text-sm font-medium text-gray-900">{item.name}</p>
                <p
                  className={StyleUtil.cn(
                    "text-xs",
                    hasValue
                      ? "font-semibold text-primary-50"
                      : "text-gray-500"
                  )}
                >
                  Quà tặng: {item.gift}
                </p>
              </div>
              <div className="flex items-center justify-end space-x-2">
                <input
                  type="number"
                  min="0"
                  disabled={isLocked}
                  {...register(`items.${item.code}.pcs`, {
                    valueAsNumber: true
                  })}
                  className={StyleUtil.cn(
                    "w-20 border px-3 py-2 text-right font-medium focus:outline-none focus:ring-2 focus:ring-primary-50",
                    {
                      "border-red-500": errors.items && (errors.items as any)?.[item.code]?.pcs,
                      "border-gray-300":
                        !errors.items || !(errors.items as any)?.[item.code]?.pcs,
                      "border-green-30 bg-green-10/10": hasValue,
                    },
                  )}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
