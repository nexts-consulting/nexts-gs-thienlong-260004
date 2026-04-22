import { supabaseFmsService } from "@/services/supabase";

/**
 * Interface for the redeem report entry data
 * Maps to: fms_rp_entry_gsolution_thienlong_2604 table
 */
export interface RedeemReportEntry {
  id?: number;
  created_at?: string;
  updated_at?: string;
  created_by: string;
  phone_number: string;
  customer_name: string;
  bill_number?: string | null;
  sub_code?: string | null;
  scheme?: string | null;
  sale_data: {
    totalInvoice: number;
    invoiceImageUrls: string[];
    promotionScheme: string;
  };
  gift_data: {
    gifts: Record<string, number>; // giftId -> quantity
    giftReceiveImageUrl: string;
  };
  other_data?: Record<string, any> | null;
  location_code?: string | null;
  location_name?: string | null;
  workshift_id?: string | null;
  workshift_name?: string | null;
}

/**
 * Create params for redeem report
 */
export interface CreateRedeemReportParams {
  customerPhone: string;
  customerName: string;
  totalInvoice: number;
  promotionScheme: string;
  gifts: Record<string, number>;
  giftReceiveImageUrl: string;
  invoiceImageUrls: string[];
  locationCode?: string;
  locationName?: string;
  workshiftId?: string;
  workshiftName?: string;
  createdBy: string;
  billNumber?: string;
  otherData?: Record<string, any>;
  subCode?: string;
  scheme?: string;
}

/**
 * Response from creating a redeem report entry
 */
export interface CreateRedeemReportResponse {
  success: boolean;
  data?: RedeemReportEntry;
  error?: string;
}

/**
 * List params for redeem report
 */
export interface ListRedeemReportParams {
  date?: string; // Format: yyyy-MM-dd
  locationCode?: string;
  workshiftId?: string;
  phoneNumber?: string;
  page?: number;
  size?: number;
}

/**
 * Response from listing redeem reports
 */
export interface ListRedeemReportResponse {
  data: RedeemReportEntry[];
  total: number;
}

const TABLE_NAME = "fms_rp_entry_gsolution_thienlong_2604";

export interface CheckBillNumberExistsParams {
  billNumber: string;
  date: string; // Format: yyyy-MM-dd
}

/**
 * Create a new redeem report entry in Supabase
 */
export const createRedeemReport = async (
  params: CreateRedeemReportParams
): Promise<CreateRedeemReportResponse> => {
  try {
    const {
      customerPhone,
      customerName,
      totalInvoice,
      gifts,
      giftReceiveImageUrl,
      promotionScheme,
      invoiceImageUrls,
      locationCode,
      locationName,
      workshiftId,
      workshiftName,
      createdBy,
      billNumber,
      otherData,
      subCode,
      scheme,
    } = params;

    // Prepare insert data
    const now = new Date().toISOString();
    const insertData: Omit<RedeemReportEntry, "id"> = {
      created_at: now,
      updated_at: now,
      created_by: createdBy,
      phone_number: customerPhone,
      customer_name: customerName,
      bill_number: billNumber || null,
      sub_code: subCode || null,
      scheme: scheme || null,
      sale_data: {
        totalInvoice,
        invoiceImageUrls,
        promotionScheme,
      },
      gift_data: {
        gifts,
        giftReceiveImageUrl,
      },
      other_data: otherData || null,
      location_code: locationCode || null,
      location_name: locationName || null,
      workshift_id: workshiftId || null,
      workshift_name: workshiftName || null,
    };

    // Insert data into the table
    const { data, error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .insert(insertData)
      .select()
      .single();

    if (error) {
      console.error("Error creating redeem report:", error);
      return {
        success: false,
        error: error.message || "Failed to create redeem report",
      };
    }

    return {
      success: true,
      data: data as RedeemReportEntry,
    };
  } catch (error) {
    console.error("Exception in createRedeemReport:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * Check if bill number already exists in the same day
 */
export const checkBillNumberExistsInDate = async (
  params: CheckBillNumberExistsParams
): Promise<boolean> => {
  try {
    const { billNumber, date } = params;
    const normalizedBillNumber = billNumber.trim();
    if (!normalizedBillNumber || !date) return false;

    const startDate = `${date}T00:00:00.000Z`;
    const endDate = `${date}T23:59:59.999Z`;

    const { count, error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .select("id", { count: "exact", head: true })
      .eq("bill_number", normalizedBillNumber)
      .gte("created_at", startDate)
      .lte("created_at", endDate);

    if (error) {
      console.error("Error checking bill number in date:", error);
      return false;
    }

    return (count || 0) > 0;
  } catch (error) {
    console.error("Exception in checkBillNumberExistsInDate:", error);
    return false;
  }
};

/**
 * List redeem report entries from Supabase
 */
export const listRedeemReports = async (
  params: ListRedeemReportParams
): Promise<ListRedeemReportResponse> => {
  try {
    const { date, locationCode, workshiftId, phoneNumber, page = 0, size = 10 } = params;

    let query = supabaseFmsService.client
      .from(TABLE_NAME)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filter by date if provided
    if (date) {
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    // Filter by location code
    if (locationCode) {
      query = query.eq("location_code", locationCode);
    }

    // Filter by workshift ID
    if (workshiftId) {
      query = query.eq("workshift_id", workshiftId);
    }

    // Filter by phone number
    if (phoneNumber) {
      query = query.eq("phone_number", phoneNumber);
    }

    // Pagination
    const from = page * size;
    const to = from + size - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error listing redeem reports:", error);
      throw new Error(error.message || "Failed to list redeem reports");
    }

    return {
      data: (data || []) as RedeemReportEntry[],
      total: count || 0,
    };
  } catch (error) {
    console.error("Exception in listRedeemReports:", error);
    throw error;
  }
};

/**
 * Get a single redeem report by ID
 */
export const getRedeemReportById = async (
  id: number
): Promise<RedeemReportEntry | null> => {
  try {
    const { data, error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.error("Error getting redeem report:", error);
      return null;
    }

    return data as RedeemReportEntry;
  } catch (error) {
    console.error("Exception in getRedeemReportById:", error);
    return null;
  }
};

/**
 * Update report entry (for admin verification)
 */
export interface UpdateReportParams {
  id: number;
  adjustedAmount?: number;
  verificationNote?: string;
  verificationStatus?: "correct" | "incorrect";
  gifts?: Record<string, number>;
  totalInvoice?: number;
}

export const updateRedeemReport = async (
  params: UpdateReportParams
): Promise<{ success: boolean; error?: string }> => {
  try {
    const {
      id,
      adjustedAmount,
      verificationNote,
      verificationStatus,
      gifts,
      totalInvoice,
    } = params;

    // Get current record to merge other_data and support gift_data/sale_data update
    const { data: currentRecord, error: fetchError } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .select("other_data, gift_data, sale_data")
      .eq("id", id)
      .single();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }

    // Merge with existing other_data
    const now = new Date().toISOString();
    const updatedOtherData: Record<string, any> = {
      ...(currentRecord?.other_data || {}),
      verification: {
        adjustedAmount,
        note: verificationNote,
        status: verificationStatus || "correct",
        verifiedAt: now,
      },
    };

    const updatePayload: Record<string, any> = {
      other_data: updatedOtherData,
      updated_at: now,
    };

    if (gifts) {
      const currentGiftData = (currentRecord?.gift_data || {}) as {
        gifts?: Record<string, number>;
        giftReceiveImageUrl?: string;
      };
      const oldGifts = { ...(currentGiftData.gifts || {}) };
      const normalizedNewGifts = Object.entries(gifts).reduce<Record<string, number>>(
        (acc, [giftId, qty]) => {
          acc[giftId] = Math.max(0, Number(qty) || 0);
          return acc;
        },
        {}
      );

      const isGiftChanged =
        JSON.stringify(oldGifts) !== JSON.stringify(normalizedNewGifts);

      if (isGiftChanged) {
        // Backup old gifts into other_data before replacing the current gift_data.gifts value.
        const giftDataBackupHistory = Array.isArray(updatedOtherData.gift_data_backup_history)
          ? updatedOtherData.gift_data_backup_history
          : [];
        updatedOtherData.gift_data_backup_history = [
          ...giftDataBackupHistory,
          {
            updatedAt: now,
            oldValue: oldGifts,
            newValue: normalizedNewGifts,
          },
        ];

        updatePayload.gift_data = {
          ...currentGiftData,
          gifts: normalizedNewGifts,
        };
      }
    }

    if (totalInvoice !== undefined) {
      const currentSaleData = (currentRecord?.sale_data || {}) as {
        totalInvoice?: number;
        invoiceImageUrls?: string[];
        promotionScheme?: string;
      };
      updatePayload.sale_data = {
        ...currentSaleData,
        totalInvoice: Math.max(0, Number(totalInvoice) || 0),
      };
    }

    const { error } = await supabaseFmsService.client
      .from(TABLE_NAME)
      .update(updatePayload)
      .eq("id", id);

    if (error) {
      console.error("Error updating report:", error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error("Exception in updateRedeemReport:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
};

/**
 * List params for customer view (by user and workshift)
 */
export interface ListCustomerReportsParams {
  date?: string; // Format: yyyy-MM-dd
  createdBy?: string; // Username
  createdByKeyword?: string; // Partial match by creator
  workshiftId?: string;
  phoneNumber?: string; // Filter by phone number
  customerName?: string; // Filter by customer name
  locationKeyword?: string; // Partial match by location name/code
  dateFrom?: string; // Start date for range (yyyy-MM-dd)
  dateTo?: string; // End date for range (yyyy-MM-dd)
  subCode?: string; // Filter by scheme IDs (for project-level filtering)
  page?: number;
  size?: number;
}

/**
 * Customer report view (simplified for list display)
 */
export interface CustomerReportView {
  id: number;
  phone_number: string;
  customer_name: string;
  sale_data: {
    totalInvoice: number;
    invoiceImageUrls: string[];
  };
  gift_data: {
    gifts: Record<string, number>;
    giftReceiveImageUrl: string;
  };
  location_name: string;
  workshift_name: string;
  created_at: string;
  created_by: string;
}

/**
 * List customer reports (for customer list view)
 * Filters by created_by (username) and workshift_id
 */
export const listCustomerReports = async (
  params: ListCustomerReportsParams
): Promise<ListRedeemReportResponse> => {
  try {
    const {
      date,
      createdBy,
      createdByKeyword,
      workshiftId,
      phoneNumber,
      customerName,
      locationKeyword,
      dateFrom,
      dateTo,
      subCode,
      page = 0,
      size = 10
    } = params;

    let query = supabaseFmsService.client
      .from(TABLE_NAME)
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    // Filter by project schemes
    if (subCode) {
      query = query.eq("sub_code", subCode);
    }

    // Filter by single date if provided
    if (date) {
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    // Filter by date range if provided
    if (dateFrom && dateTo) {
      const startDate = `${dateFrom}T00:00:00.000Z`;
      const endDate = `${dateTo}T23:59:59.999Z`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    } else if (dateFrom) {
      const startDate = `${dateFrom}T00:00:00.000Z`;
      query = query.gte("created_at", startDate);
    } else if (dateTo) {
      const endDate = `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", endDate);
    }

    // Filter by created_by (username)
    if (createdBy) {
      query = query.eq("created_by", createdBy);
    }
    if (createdByKeyword) {
      query = query.ilike("created_by", `%${createdByKeyword}%`);
    }

    // Filter by workshift ID
    if (workshiftId) {
      query = query.eq("workshift_id", workshiftId);
    }

    // Filter by phone number (partial match)
    if (phoneNumber) {
      query = query.ilike("phone_number", `%${phoneNumber}%`);
    }

    // Filter by customer name (partial match)
    if (customerName) {
      query = query.ilike("customer_name", `%${customerName}%`);
    }

    // Filter by location name/code (partial match)
    if (locationKeyword) {
      query = query.or(
        `location_name.ilike.%${locationKeyword}%,location_code.ilike.%${locationKeyword}%`
      );
    }

    // Pagination
    const from = page * size;
    const to = from + size - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      console.error("Error listing customer reports:", error);
      throw new Error(error.message || "Failed to list customer reports");
    }

    return {
      data: (data || []) as RedeemReportEntry[],
      total: count || 0,
    };
  } catch (error) {
    console.error("Exception in listCustomerReports:", error);
    throw error;
  }
};

/**
 * List all customer reports without pagination (for export)
 * Use same filters but no pagination
 */
export const listAllCustomerReports = async (
  params: Omit<ListCustomerReportsParams, 'page' | 'size'>
): Promise<RedeemReportEntry[]> => {
  try {
    const {
      date,
      createdBy,
      createdByKeyword,
      workshiftId,
      phoneNumber,
      customerName,
      locationKeyword,
      dateFrom,
      dateTo,
      subCode,
    } = params;

    let query = supabaseFmsService.client
      .from(TABLE_NAME)
      .select("*")
      .order("created_at", { ascending: false });

    // Filter by project schemes
    if (subCode) {
      query = query.eq("sub_code", subCode);
    }

    // Apply same filters as listCustomerReports
    if (date) {
      const startDate = `${date}T00:00:00.000Z`;
      const endDate = `${date}T23:59:59.999Z`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    }

    if (dateFrom && dateTo) {
      const startDate = `${dateFrom}T00:00:00.000Z`;
      const endDate = `${dateTo}T23:59:59.999Z`;
      query = query.gte("created_at", startDate).lte("created_at", endDate);
    } else if (dateFrom) {
      const startDate = `${dateFrom}T00:00:00.000Z`;
      query = query.gte("created_at", startDate);
    } else if (dateTo) {
      const endDate = `${dateTo}T23:59:59.999Z`;
      query = query.lte("created_at", endDate);
    }

    if (createdBy) {
      query = query.eq("created_by", createdBy);
    }
    if (createdByKeyword) {
      query = query.ilike("created_by", `%${createdByKeyword}%`);
    }

    if (workshiftId) {
      query = query.eq("workshift_id", workshiftId);
    }

    if (phoneNumber) {
      query = query.ilike("phone_number", `%${phoneNumber}%`);
    }

    if (customerName) {
      query = query.ilike("customer_name", `%${customerName}%`);
    }

    if (locationKeyword) {
      query = query.or(
        `location_name.ilike.%${locationKeyword}%,location_code.ilike.%${locationKeyword}%`
      );
    }

    // No pagination - get all results
    const { data, error } = await query;

    if (error) {
      console.error("Error listing all customer reports:", error);
      throw new Error(error.message || "Failed to list all customer reports");
    }

    return (data || []) as RedeemReportEntry[];
  } catch (error) {
    console.error("Exception in listAllCustomerReports:", error);
    throw error;
  }
};

