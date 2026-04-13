import { supabaseFmsService } from "@/services/supabase";

const TABLE_NAME = "fms_rp_entry_gsolution_nx_gs_mar_260002_rp_sale";
const REDEEM_TABLE_NAME = "fms_rp_entry_gsolution_mar_260002";

/**
 * Shape of the `data` jsonb column
 */
export interface SaleReportData {
  sales: {
    combo_69k_actual: number;
    combo_109k_actual: number;
    doublemintQuantity_actual: number;
    doublemintOtherQuantity_actual: number;
    coolairQuantity_actual: number;
  };
  gifts: {
    combo_01_skittles_mm_actual: number;
    combo_02_snickers_actual: number;
    combo_03_mm_peanut_actual: number;
    tui_tote_actual: number;
  };
  sampling: {
    dm_rs_refresher_plan: number;
    dm_rs_refresher_actual: number;
    dm_rs_mint_plan: number;
    dm_rs_mint_actual: number;
  };
  feedback: {
    advantages: string;
    difficulties: string;
  };
  samplingImageUrls: string[];
}

/**
 * System-aggregated data stored in additional_data_1
 */
export interface SystemAggregatedData {
  systemSales: {
    combo_69k: number;
    combo_109k: number;
    doublemintQuantity: number;
    doublemintOtherQuantity: number;
    coolairQuantity: number;
  };
  systemGifts: {
    combo_01_skittles_mm: number;
    combo_02_snickers: number;
    combo_03_mm_peanut: number;
    tui_tote: number;
  };
}

/**
 * Full row from the table
 */
export interface SaleReportEntry {
  id: string;
  unique_value: string;
  entry_label?: string | null;
  data: SaleReportData;
  additional_data_1?: SystemAggregatedData | null;
  additional_data_2?: Record<string, any> | null;
  workshift_id?: number | null;
  workshift_name?: string | null;
  location_code?: string | null;
  location_name?: string | null;
  attendance_id?: string | null;
  created_by: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Build the unique_value for one report per attendance
 */
function buildUniqueValue(attendanceId: number | string): string {
  return `sale_report_${attendanceId}`;
}

function toSafeNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Fetch existing sale report for the given attendance
 */
export const getSaleReportByAttendance = async (
  attendanceId: number | string,
): Promise<SaleReportEntry | null> => {
  try {
    const uniqueValue = buildUniqueValue(attendanceId);

    const { data, error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .select("*")
      .eq("unique_value", uniqueValue)
      .maybeSingle();

    if (error) {
      console.error("Error fetching sale report:", error);
      return null;
    }

    return data as SaleReportEntry | null;
  } catch (error) {
    console.error("Exception in getSaleReportByAttendance:", error);
    return null;
  }
};

/**
 * Aggregate redeem entries for the current workshift to compute system counts.
 *
 * Counts:
 *   - promotionScheme "69K" → combo_69k sales
 *   - promotionScheme "109K" → tui_109k sales
 *   - gift "combo_keo" → combo_keo gifts
 *   - gift "combo_cookie" → combo_cookie gifts  (counted together with combo_keo? or separate)
 *   - gift "tui_tote" → tui_tote gifts
 */
export const aggregateRedeemDataForWorkshift = async (
  workshiftId: string,
  createdBy: string,
  date: string,
): Promise<SystemAggregatedData> => {
  const defaultResult: SystemAggregatedData = {
    systemSales: {
      combo_69k: 0,
      combo_109k: 0,
      doublemintQuantity: 0,
      doublemintOtherQuantity: 0,
      coolairQuantity: 0,
    },
    systemGifts: { combo_01_skittles_mm: 0, combo_02_snickers: 0, tui_tote: 0, combo_03_mm_peanut: 0 },
  };

  try {
    const startDate = `${date}T00:00:00.000Z`;
    const endDate = `${date}T23:59:59.999Z`;

    const { data, error } = await supabaseFmsService.client
      .from(REDEEM_TABLE_NAME)
      .select("sale_data, gift_data")
      .eq("workshift_id", workshiftId)
      .eq("created_by", createdBy)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) {
      console.error("Error aggregating redeem data:", error);
      return defaultResult;
    }

    if (!data || data.length === 0) return defaultResult;

    const result = { ...defaultResult };
    result.systemSales = {
      combo_69k: 0,
      combo_109k: 0,
      doublemintQuantity: 0,
      doublemintOtherQuantity: 0,
      coolairQuantity: 0,
    };
    result.systemGifts = { combo_01_skittles_mm: 0, combo_02_snickers: 0, tui_tote: 0, combo_03_mm_peanut: 0 };

    for (const entry of data) {
      const saleData = entry.sale_data as any;
      const giftData = entry.gift_data as any;

      const gifts = giftData?.gifts || {};
      const combo01Skittles = toSafeNumber(gifts["combo_01_skittles_mm"]);
      const combo02Snickers = toSafeNumber(gifts["combo_02_snickers"]);
      const combo03MmPeanut = toSafeNumber(gifts["combo_03_mm_peanut"]);
      const tuiTote = toSafeNumber(gifts["tui_tote"]);
      const doublemintQuantity = toSafeNumber(saleData?.doublemintQuantity);
      const doublemintOtherQuantity = toSafeNumber(saleData?.doublemintOtherQuantity);
      const coolairQuantity = toSafeNumber(saleData?.coolairQuantity);

      result.systemSales.combo_69k += combo01Skittles + combo02Snickers + combo03MmPeanut;
      result.systemSales.combo_109k += tuiTote;

      result.systemSales.doublemintQuantity += doublemintQuantity;
      result.systemSales.doublemintOtherQuantity += doublemintOtherQuantity;
      result.systemSales.coolairQuantity += coolairQuantity;

      // Count gifts
      result.systemGifts.combo_01_skittles_mm += combo01Skittles;
      result.systemGifts.combo_02_snickers += combo02Snickers;
      result.systemGifts.combo_03_mm_peanut += combo03MmPeanut;
      result.systemGifts.tui_tote += tuiTote;
    }

    return result;
  } catch (error) {
    console.error("Exception in aggregateRedeemDataForWorkshift:", error);
    return defaultResult;
  }
};

export interface UpsertSaleReportParams {
  attendanceId: number | string;
  data: SaleReportData;
  systemData: SystemAggregatedData;
  workshiftId?: number | null;
  workshiftName?: string | null;
  locationCode?: string | null;
  locationName?: string | null;
  createdBy: string;
}

/**
 * Create or update sale report.
 * Uses unique_value to detect existing row.
 */
export const upsertSaleReport = async (
  params: UpsertSaleReportParams,
): Promise<{ success: boolean; data?: SaleReportEntry; error?: string }> => {
  try {
    const {
      attendanceId,
      data: reportData,
      systemData,
      workshiftId,
      workshiftName,
      locationCode,
      locationName,
      createdBy,
    } = params;

    const uniqueValue = buildUniqueValue(attendanceId);
    const now = new Date().toISOString();

    // Check if record already exists
    const existing = await getSaleReportByAttendance(attendanceId);

    if (existing) {
      // Update
      const { data, error } = await supabaseFmsService.client
        .from(TABLE_NAME)
        .update({
          data: reportData,
          additional_data_1: systemData,
          updated_by: createdBy,
          updated_at: now,
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (error) {
        console.error("Error updating sale report:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as SaleReportEntry };
    }

    // Insert
    const insertData = {
      unique_value: uniqueValue,
      entry_label: "Báo cáo cuối ca",
      data: reportData,
      additional_data_1: systemData,
      workshift_id: workshiftId,
      workshift_name: workshiftName,
      location_code: locationCode,
      location_name: locationName,
      attendance_id: String(attendanceId),
      created_by: createdBy,
      updated_by: createdBy,
      created_at: now,
      updated_at: now,
    };

    const { data, error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating sale report:", error);
      return { success: false, error: error.message };
    }

    return { success: true, data: data as SaleReportEntry };
  } catch (error) {
    console.error("Exception in upsertSaleReport:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};
