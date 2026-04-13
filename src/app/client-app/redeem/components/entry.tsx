"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useGlobalContext } from "@/contexts/global.context";
import { CurrencyInput } from "@/components/DynamicForm/fields/CurrencyInput";
import { TextInput } from "@/kits/components/text-input";
import { Button } from "@/kits/components/button";
import { IconButton } from "@/kits/components/icon-button";
import { Icons } from "@/kits/components/icons";
import { LoadingOverlay } from "@/kits/components/loading-overlay";
import { useNotification } from "@/kits/components/notification";
import { ImageCaptureInputWithUpload } from "@/kits/components/image-capture-input-upload";
import { MultipleImagesCaptureInputUpload } from "@/kits/components/multiple-images-capture-input-upload";
import { StyleUtil } from "@/kits/utils";
import { createRedeemReport } from "@/services/api/application/report-entry/redeem";
import type { CloudConfig } from "@/kits/components/image-capture-input-upload/types";

/**
 * Interface for currentAttendance data from parent app
 */
interface CurrentAttendance {
  id: number;
  project_code: string;
  username: string;
  workshift_id: number | null;
  workshift_name: string;
  shift_start_time: string | null;
  shift_end_time: string | null;
  location_id: number | null;
  location_code: string;
  location_name: string;
  checkin_time: string | null;
  checkout_time: string | null;
  status: "CHECKED_IN" | "CHECKED_OUT" | "AUTO_CHECKED_OUT";
  timing_status: "ON_TIME" | "LATE" | "EARLY" | "ABSENT";
  checkin_photo_url: string | null;
  checkout_photo_url: string | null;
  checkin_lat: number | null;
  checkin_lng: number | null;
  checkout_lat: number | null;
  checkout_lng: number | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

const DEV_ATTENDANCE: CurrentAttendance = {
  id: 99999,
  project_code: "DEV_PROJECT",
  username: "dev_user",
  workshift_id: 1,
  workshift_name: "Ca dev test",
  shift_start_time: null,
  shift_end_time: null,
  location_id: 1,
  location_code: "DEV_LOC",
  location_name: "Dev Location",
  checkin_time: new Date().toISOString(),
  checkout_time: null,
  status: "CHECKED_IN",
  timing_status: "ON_TIME",
  checkin_photo_url: null,
  checkout_photo_url: null,
  checkin_lat: null,
  checkin_lng: null,
  checkout_lat: null,
  checkout_lng: null,
  metadata: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const Entry = () => {
  const globalStore = useGlobalContext();
  const router = useRouter();
  const searchParams = useSearchParams();
  const notification = useNotification();
  const isDevMode = searchParams.get("mode") === "dev";

  const {
    watch,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      totalInvoice: 0,
    },
  });

  // Parent app data - required before allowing input
  const [currentAttendance, setCurrentAttendance] = useState<CurrentAttendance | null>(null);
  const [isReady, setIsReady] = useState(false);

  // Form states
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [giftReceiveImageUrl, setGiftReceiveImageUrl] = useState<string | null>(null);
  const [invoiceImageUrls, setInvoiceImageUrls] = useState<string[]>([]);
  const [gifts, setGifts] = useState<Record<string, number>>({});
  const [formKey, setFormKey] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [componentKey, setComponentKey] = useState(0);

  // Track image uploading states
  const [isGiftImageUploading, setIsGiftImageUploading] = useState(false);
  const [invoiceUploadingSet, setInvoiceUploadingSet] = useState<Set<number>>(new Set());

  const isLocalOrPendingImageUrl = (url?: string | null) => {
    if (!url) return true;
    const normalized = url.trim().toLowerCase();
    if (!normalized) return true;

    // Local preview and non-uploaded values should never be submitted.
    if (
      normalized.startsWith("blob:") ||
      normalized.startsWith("data:") ||
      normalized.startsWith("file:")
    ) {
      return true;
    }

    try {
      const parsed = new URL(url);
      const isHttpUrl = parsed.protocol === "http:" || parsed.protocol === "https:";
      if (!isHttpUrl) return true;

      const host = parsed.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
        return true;
      }

      return false;
    } catch {
      // Relative paths or invalid URLs are treated as pending/local.
      return true;
    }
  };

  const hasPendingInvoiceImages = invoiceImageUrls.some((url) => isLocalOrPendingImageUrl(url));
  const hasPendingGiftImage = isLocalOrPendingImageUrl(giftReceiveImageUrl);
  const isAnyUploading =
    isGiftImageUploading ||
    invoiceUploadingSet.size > 0 ||
    hasPendingInvoiceImages ||
    (giftReceiveImageUrl ? hasPendingGiftImage : false);

  const formValues = watch();
  const totalInvoice = formValues?.totalInvoice || 0;

  const BUCKET_PATH = "thienlong-holiday-304-2026/redeem";
  const MAX_GIFTS_PER_INVOICE = 100; // Maximum number of gifts that can be received based on invoice

  // Firebase cloud config for image uploads
  const invoiceCloudConfig: CloudConfig = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const locationName = currentAttendance?.location_name || "unknown";
    return {
      provider: "firebase",
      path: `${BUCKET_PATH}/${locationName}/${today}`,
      generateFileName: (file: File) => {
        const phoneStr = phone || "unknown";
        return `invoice_${phoneStr}_${Date.now()}_${file.name}`;
      },
    };
  }, [currentAttendance?.location_name, phone]);

  const giftReceiveCloudConfig: CloudConfig = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const locationName = currentAttendance?.location_name || "unknown";
    return {
      provider: "firebase",
      path: `${BUCKET_PATH}/${locationName}/${today}`,
      generateFileName: (file: File) => {
        const phoneStr = phone || "unknown";
        return `gift_receive_${phoneStr}_${Date.now()}.jpg`;
      },
    };
  }, [currentAttendance?.location_name, phone]);

  const giftOptions = [
    {id: "holiday_304_gift", name: "Hóa đơn Thiên Long từ 75.000", gift: "Khăn quàng Cờ Việt Nam & Trải nghiệm tô vẽ nón lá", requiredPoints: 0},
  ];


  // State to manage selected bonus gifts
  const [selectedBonusGifts, setSelectedBonusGifts] = useState<Record<string, boolean>>({});

  // State to manage selected event gifts
  const [selectedEventGifts, setSelectedEventGifts] = useState<Record<string, boolean>>({});

  // Calculate remaining points (total invoice - points used for all selected gifts)
  // Maximum 3 gifts can be selected based on invoice
  const totalPointsUsed = Object.entries(gifts).reduce((total, [giftId, qty]) => {
    if (qty > 0) {
      const gift = giftOptions.find((g) => g.id === giftId);
      if (gift) {
        return total + (gift.requiredPoints * qty);
      }
    }
    return total;
  }, 0);

  const remainingPoints = Math.max(0, totalInvoice - totalPointsUsed);

  // Calculate total quantity of selected gifts
  const totalGiftQuantity = Object.values(gifts).reduce((sum, qty) => sum + qty, 0);

  // Calculate all gifts customer will receive
  const getCustomerGifts = () => {
    const customerGifts: Array<{ name: string; qty: number; type: "scheme" | "bonus" | "event" }> = [];

    // Add scheme gifts
    Object.entries(gifts).forEach(([giftId, qty]) => {
      if (qty > 0) {
        const gift = giftOptions.find((g) => g.id === giftId);
        if (gift) {
          customerGifts.push({
            name: gift.gift,
            qty: qty,
            type: "scheme",
          });
        }
      }
    });

    // Add bonus gifts
    // Object.entries(selectedBonusGifts).forEach(([giftId, isSelected]) => {
    //   if (isSelected) {
    //     const bonusGift = BONUS_GIFTS.find((bg) => bg.id === giftId);
    //     if (bonusGift) {
    //       customerGifts.push({
    //         name: bonusGift.name,
    //         qty: 1,
    //         type: "bonus",
    //       });
    //     }
    //   }
    // });

    // Add event gifts
    // Object.entries(selectedEventGifts).forEach(([giftId, isSelected]) => {
    //   if (isSelected) {
    //     const eventGift = EVENT_GIFTS.find((eg) => eg.id === giftId);
    //     if (eventGift) {
    //       customerGifts.push({
    //         name: eventGift.name,
    //         qty: 1,
    //         type: "event",
    //       });
    //     }
    //   }
    // });

    return customerGifts;
  };

  const customerGifts = getCustomerGifts();

  // Adjust gift quantity - maximum 3 gifts can be selected based on invoice
  // Each gift must be affordable based on remaining invoice amount
  const adjustGift = (giftId: string, delta: number, requiredPoints: number) => {
    setGifts((prev) => {
      const currentQty = prev[giftId] || 0;

      // If trying to add (delta > 0)
      if (delta > 0) {
        return { ...prev, [giftId]: (currentQty || 0) + 1 };
      }

      // If removing (delta < 0)
      if (delta < 0) {
        if (currentQty <= 0) {
          return prev;
        }
        // Decrease quantity or remove if reaches 0
        const newQty = currentQty - 1;
        if (newQty <= 0) {
          const { [giftId]: _, ...rest } = prev;
          return rest;
        }
        return { ...prev, [giftId]: newQty };
      }

      return prev;
    });
  };


  useEffect(() => {
    if (!totalInvoice) {
      setGifts({});
      setSelectedBonusGifts({});
      return;
    }

    setGifts((prev) => {
      const updated: Record<string, number> = {};
      let totalPointsUsed = 0;
      let totalQty = 0;

      Object.entries(prev).forEach(([giftId, qty]) => {
        if (qty > 0) {

          const gift = giftOptions.find((g) => g.id === giftId);
          if (!gift) {
            return;
          }

          // Calculate remaining points after previous gifts
          const remainingPoints = totalInvoice - totalPointsUsed;

          if (remainingPoints >= gift.requiredPoints && totalQty < MAX_GIFTS_PER_INVOICE) {
            // Keep the gift, but only if we have enough remaining points for the quantity
            let keepQty = 0;
            for (let i = 0; i < qty; i++) {
              const pointsNeededForOne = gift.requiredPoints;
              if (totalPointsUsed + pointsNeededForOne <= totalInvoice && totalQty < MAX_GIFTS_PER_INVOICE) {
                keepQty++;
                totalPointsUsed += pointsNeededForOne;
                totalQty++;
              } else {
                break;
              }
            }

            if (keepQty > 0) {
              updated[giftId] = keepQty;
            }
          }
        }
      });

      return updated;
    });
  }, [totalInvoice]);

  // Auto-select bonus gifts when conditions change
  // useEffect(() => {
  //   setSelectedBonusGifts((prev) => {
  //     const updated: Record<string, boolean> = { ...prev };

  //     BONUS_GIFTS.forEach((bonusGift) => {
  //       const isBonusDate = checkIsBonusDate(bonusGift.dates);
  //       const eligibleForBonus = totalInvoice >= bonusGift.minAmount && isBonusDate;

  //       if (eligibleForBonus) {
  //         // Auto-select if defaultSelected is true and not already set (allows manual uncheck later)
  //         if (bonusGift.defaultSelected && !(bonusGift.id in prev)) {
  //           updated[bonusGift.id] = true;
  //         }
  //         // If already manually unchecked (false), keep it unchecked
  //         // If already checked (true), keep it checked
  //       } else {
  //         // Remove if not eligible
  //         delete updated[bonusGift.id];
  //       }
  //     });

  //     return updated;
  //   });
  // }, [totalInvoice]);

  /**
   * Listen for messages from parent app via postMessage API
   */
  useEffect(() => {
    if (isDevMode) {
      setCurrentAttendance(DEV_ATTENDANCE);
      setIsReady(true);
      console.log("🛠️ DEV MODE: Using dummy attendance data");
      return;
    }

    const handleMessage = (event: MessageEvent) => {
      // Validate origin for security
      const allowedOrigins = [
        process.env.NEXT_PUBLIC_PARENT_APP_URL || "",
        "http://localhost:3000",
        "http://localhost:3001",
        "https://fms-app.nextsconsulting.com",
        "https://fms-admin.nextsconsulting.com",
      ].filter(Boolean);

      if (!allowedOrigins.some(origin => event.origin.includes(origin))) {
        console.warn("Message from untrusted origin:", event.origin);
        return;
      }

      // Handle message
      const message = event.data;

      switch (message.type) {
        case "INIT_FORM_DATA":
          const attendance = message.payload?.currentAttendance;
          if (attendance) {
            setCurrentAttendance(attendance);
            setIsReady(true);
            console.log("✅ Received attendance data from parent app:", attendance);
          } else {
            console.warn("⚠️ No attendance data received from parent app");
            notification.warning({
              title: "Cảnh báo",
              description: "Chưa có thông tin chấm công. Vui lòng check-in trước khi sử dụng form.",
            });
          }
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    };

    window.addEventListener("message", handleMessage);

    // Notify parent that form is ready
    const parentOrigin = process.env.NEXT_PUBLIC_PARENT_APP_URL || "*";
    window.parent.postMessage(
      { type: "FORM_READY" },
      parentOrigin
    );

    console.log("📡 Sent FORM_READY message to parent app");

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [isDevMode]);

  const onSubmit = async (formData: any) => {
    // Validate parent app data
    if (!currentAttendance) {
      notification.error({
        title: "Lỗi",
        description: "Chưa có thông tin chấm công từ ứng dụng chính. Vui lòng kiểm tra lại.",
        options: {
          duration: 4000,
        },
      });
      return;
    }

    const errors: string[] = [];

    if (!phone) {
      errors.push("Số điện thoại không được để trống");
    } else if (!phone.match(/^(0[3|5|7|8|9])+([0-9]{8})$/)) {
      errors.push("Số điện thoại không hợp lệ");
    }

    if (!fullName) {
      errors.push("Họ tên khách hàng không được để trống");
    }

    // Only require invoice images if there's a purchase (totalInvoice > 0)
    if (totalInvoice > 0) {
      if (!invoiceImageUrls || invoiceImageUrls.length === 0) {
        errors.push("Chụp ít nhất 1 hình ảnh hóa đơn");
      } else if (invoiceImageUrls.some((url) => isLocalOrPendingImageUrl(url))) {
        errors.push("Ảnh hóa đơn chưa tải lên xong. Vui lòng chờ upload hoàn tất.");
      }
    }

    if (!giftReceiveImageUrl) {
      errors.push("Chụp hình khách nhận quà");
    } else if (isLocalOrPendingImageUrl(giftReceiveImageUrl)) {
      errors.push("Ảnh khách nhận quà chưa tải lên xong. Vui lòng chờ upload hoàn tất.");
    }

    if (errors.length > 0) {
      notification.error({
        title: "Vui lòng kiểm tra lại thông tin",
        description: (
          <div>
            {errors.map((err, idx) => (
              <div key={idx}>{err}</div>
            ))}
          </div>
        ),
        options: {
          duration: 4000,
        },
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const allGifts: Record<string, number> = {};

      // Selected gifts
      Object.entries(gifts).forEach(([giftId, qty]) => {
        if (qty > 0) {
          allGifts[giftId] = qty;
        }
      });

      // Add selected bonus gifts
      Object.entries(selectedBonusGifts).forEach(([giftId, isSelected]) => {
        if (isSelected) {
          allGifts[giftId] = 1;
        }
      });

      // Add selected event gifts
      Object.entries(selectedEventGifts).forEach(([giftId, isSelected]) => {
        if (isSelected) {
          allGifts[giftId] = 1;
        }
      });

      // Images are already uploaded to Firebase via the upload components
      // Submit data to Supabase
      const response = await createRedeemReport({
        customerPhone: phone,
        customerName: fullName,
        totalInvoice: totalInvoice,
        promotionScheme: "holiday_304_scheme",
        gifts: allGifts,
        giftReceiveImageUrl: giftReceiveImageUrl || "",
        invoiceImageUrls: invoiceImageUrls,
        locationCode: currentAttendance.location_code,
        locationName: currentAttendance.location_name,
        workshiftId: currentAttendance.workshift_id?.toString(),
        workshiftName: currentAttendance.workshift_name,
        createdBy: currentAttendance.username,
        subCode: "thienlong_75k",
        scheme: "holiday_304_scheme",
      });

      if (response.success) {
        setComponentKey((prev) => prev + 1);
        notification.success({
          title: "Gửi thành công",
          description: "Thông tin khách hàng đã được ghi nhận.",
          options: {
            duration: 3000,
          },
        });

        // Reset form sau khi gửi thành công
        reset({
          totalInvoice: 0,
        });

        setPhone("");
        setFullName("");
        setGiftReceiveImageUrl(null);
        setInvoiceImageUrls([]);
        setGifts({});
        setSelectedBonusGifts({});
        setSelectedEventGifts({});
        setFormKey((prev) => prev + 1);

        // Notify parent app (optional)
        window.parent.postMessage(
          {
            type: "FORM_SUBMITTED",
            payload: { reportId: response.data?.id },
          },
          process.env.NEXT_PUBLIC_PARENT_APP_URL || "*"
        );
      } else {
        notification.error({
          title: "Lỗi khi gửi",
          description: response.error || "Có lỗi xảy ra khi lưu dữ liệu",
          options: {
            duration: 3000,
          },
        });
      }
    } catch (err: any) {
      console.error("Error submitting report:", err);
      notification.error({
        title: "Lỗi khi gửi",
        description: err.message || "Có lỗi xảy ra",
        options: {
          duration: 3000,
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Show loading state while waiting for parent app data
  if (!isReady || !currentAttendance) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-10">
        <div className="text-center">
          <LoadingOverlay active={true} />
          <p className="mt-32 text-sm text-gray-60">
            Đang tải dữ liệu từ ứng dụng chính...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <LoadingOverlay active={isSubmitting} />
      <div className="bg-white border-b border-gray-200 p-4 sticky top-0 z-10">
        <p className="text-xs text-gray-60 mt-1">
          Điểm làm việc: {currentAttendance.location_name} ({currentAttendance.location_code})
        </p>
        <p className="text-xs text-gray-60">
          Ca làm việc: {currentAttendance.workshift_name}
        </p>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="flex h-full flex-col">
        <div className="mb-16">
          <div className="flex-1 overflow-auto p-4">
            {/* General Information */}
            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-gray-800">
                Thông tin khách hàng và hóa đơn
              </h3>
              <div className="space-y-4 bg-white p-5">
                <TextInput
                  type="number"
                  label="Số điện thoại"
                  placeholder="VD: 0901234567"
                  value={phone}
                  maxLength={10}
                  minLength={10}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <TextInput
                  label="Họ tên khách hàng"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                  }}
                />
                <CurrencyInput
                  label="Tổng số tiền hóa đơn"
                  placeholder="Nhập tổng số tiền hóa đơn"
                  value={totalInvoice}
                  onChange={(value) => {
                    setValue("totalInvoice", Number(value) || 0);
                  }}
                  error={!!errors.totalInvoice}
                />

                <MultipleImagesCaptureInputUpload
                  key={componentKey}
                  label="Hình ảnh hóa đơn"
                  helperText="Chụp ảnh hóa đơn"
                  value={invoiceImageUrls}
                  onChange={setInvoiceImageUrls}
                  enableUpload={true}
                  cloudConfig={invoiceCloudConfig}
                  minImages={totalInvoice === 0 ? 0 : 1}
                  maxImages={3}
                  defaultFacingMode="environment"
                  onUploadProgress={(idx) => {
                    setInvoiceUploadingSet((prev) => new Set(prev).add(idx));
                  }}
                  onUploadSuccess={(idx) => {
                    setInvoiceUploadingSet((prev) => {
                      const next = new Set(prev);
                      next.delete(idx);
                      return next;
                    });
                  }}
                  onUploadError={(idx) => {
                    setInvoiceUploadingSet((prev) => {
                      const next = new Set(prev);
                      next.delete(idx);
                      return next;
                    });
                  }}
                />
              </div>
            </div>

            {/* Gift Options */}
            <div className={StyleUtil.cn("mb-6", { "opacity-50": !totalInvoice })}>
              <h3 className="mb-3 text-base font-semibold text-gray-800">
                Chọn quà tặng{" "}
              </h3>
              <div className="divide-y divide-gray-200 bg-white">
                {giftOptions.map((gift) => {
                  const qty = gifts[gift.id] || 0;
                  return (
                    <div key={gift.id} className="grid grid-cols-2 items-center gap-2 p-4">
                      <div className="col-span-1">
                        <p className="text-sm font-medium text-gray-900">{gift.gift}</p>
                        <p className="text-xs text-gray-500">{gift.name}</p>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <IconButton
                          size="large"
                          variant="tertiary"
                          icon={Icons.Subtract}
                          onClick={() => adjustGift(gift.id, -1, gift.requiredPoints)}
                          disabled={qty === 0 || !totalInvoice}
                        />
                        <input
                          className="w-16  border border-gray-300 py-2 text-center text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary-50"
                          value={qty}
                          readOnly
                        />
                        <IconButton
                          size="large"
                          variant="tertiary"
                          icon={Icons.Add}
                          onClick={() => adjustGift(gift.id, 1, gift.requiredPoints)}
                          disabled={!totalInvoice}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bonus Gifts */}
            {/* {(() => {
              const availableBonusGifts = BONUS_GIFTS.filter((bonusGift) => {
                const isBonusDate = checkIsBonusDate(bonusGift.dates);
                const eligibleForBonus = totalInvoice >= bonusGift.minAmount && isBonusDate;
                return eligibleForBonus;
              });

              if (availableBonusGifts.length === 0) return null;

              return (
                <div className="mb-6">
                  <h3 className="mb-3 text-base font-semibold text-gray-800">Quà tặng bonus</h3>
                  <div className="space-y-3 bg-white p-4 border-l-4 border-primary-50">
                    {availableBonusGifts.map((bonusGift) => {
                      const isChecked = selectedBonusGifts[bonusGift.id] || false;

                      return (
                        <label
                          key={bonusGift.id}
                          className="flex items-start gap-3 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              setSelectedBonusGifts((prev) => ({
                                ...prev,
                                [bonusGift.id]: e.target.checked,
                              }));
                            }}
                            className="mt-1 h-5 w-5 border-gray-300 accent-primary-50 text-primary-50 cursor-pointer"
                          />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{bonusGift.name}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {bonusGift.minAmount > 0
                                ? `Quà tặng cho đơn hàng từ ${bonusGift.minAmount.toLocaleString("vi-VN")} VNĐ`
                                : "Quà tặng cho tất cả hóa đơn"}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })()} */}

            {/* Event Gifts - Always available, no purchase requirement */}
            {/* <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-gray-800">Quà tặng workshop Colokit</h3>
              <div className="space-y-3 bg-white p-4 border-l-4 border-primary-50">
                {EVENT_GIFTS.map((eventGift) => {
                  const isChecked = selectedEventGifts[eventGift.id] || false;

                  return (
                    <label
                      key={eventGift.id}
                      className="flex items-start gap-3 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          setSelectedEventGifts((prev) => ({
                            ...prev,
                            [eventGift.id]: e.target.checked,
                          }));
                        }}
                        className="mt-1 h-5 w-5 border-gray-300 accent-primary-50 text-primary-50 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{eventGift.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          Quà tặng workshop
                        </p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div> */}

            {/* Customer Gifts Summary */}
            {customerGifts.length > 0 && (
              <div className="mb-6">
                <h3 className="mb-3 text-base font-semibold text-gray-800">
                  Tổng hợp quà khách nhận được
                </h3>
                <div className="bg-white p-4">
                  <div className="space-y-2">
                    {customerGifts.map((gift, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 border-l-4 border-primary-50 bg-primary-50/5 p-3"
                      >
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-800">
                            <span className="text-primary-50 font-semibold">{gift.qty}x</span> - {gift.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="mb-3 text-base font-semibold text-gray-800">Hình khách nhận quà</h3>
              <div className="space-y-4 bg-white p-5">
                <ImageCaptureInputWithUpload
                  key={formKey}
                  defaultFacingMode="environment"
                  enableUpload={true}
                  helperText="Chụp ảnh khách nhận quà"
                  value={giftReceiveImageUrl}
                  onChange={setGiftReceiveImageUrl}
                  cloudConfig={giftReceiveCloudConfig}
                  onUploadProgress={() => setIsGiftImageUploading(true)}
                  onUploadSuccess={() => setIsGiftImageUploading(false)}
                  onUploadError={() => setIsGiftImageUploading(false)}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="fixed bottom-0 left-0 right-0 border-t bg-white p-4">
          <Button
            type="submit"
            variant="primary"
            className="w-full"
            centered
            disabled={isSubmitting || isAnyUploading}
          >
            {isAnyUploading ? "Đang tải ảnh lên..." : "Lưu báo cáo"}
          </Button>
        </div>
      </form>
    </>
  );
};
