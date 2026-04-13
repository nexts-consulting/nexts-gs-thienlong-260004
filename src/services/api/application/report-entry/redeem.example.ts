/**
 * Example usage of Redeem Report Service
 * 
 * This file demonstrates how to use the redeem report service
 * to create and list redeem reports in Supabase
 */

import {
  createRedeemReport,
  listRedeemReports,
  getRedeemReportById,
  type CreateRedeemReportParams,
  type ListRedeemReportParams,
} from "./redeem";

/**
 * Example 1: Create a new redeem report
 */
export async function exampleCreateReport() {
  const params: CreateRedeemReportParams = {
    customerPhone: "0901234567",
    customerName: "Nguyễn Văn A",
    totalInvoice: 500000,
    gifts: {
      scheme_1: 1, // Dây đeo thẻ + Bộ truyện Akooland (x1)
      scheme_3: 1, // Máy hút bụi mini + Bộ truyện Akooland (x1)
      bonus_christmas_card: 1, // Thiệp giáng sinh (x1)
      event_checkin_bag: 1, // Quà tặng check in (x1)
    },
    giftReceiveImageUrl: "https://storage.googleapis.com/bucket/images/gift_receive.jpg",
    invoiceImageUrls: [
      "https://storage.googleapis.com/bucket/images/invoice_1.jpg",
      "https://storage.googleapis.com/bucket/images/invoice_2.jpg",
    ],
    locationCode: "LOC001",
    locationName: "AEON Mall Hà Đông",
    workshiftId: "1",
    workshiftName: "Ca sáng",
    createdBy: "user123",
    billNumber: "HD001", // Optional
    otherData: {
      // Optional additional data
      notes: "Customer is VIP",
      referralCode: "REF123",
    },
  };

  try {
    const response = await createRedeemReport(params);

    if (response.success) {
      console.log("✅ Report created successfully:", response.data);
      console.log("Report ID:", response.data?.id);
      return response.data;
    } else {
      console.error("❌ Failed to create report:", response.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Exception:", error);
    return null;
  }
}

/**
 * Example 2: List reports by date
 */
export async function exampleListReportsByDate() {
  const params: ListRedeemReportParams = {
    date: "2026-02-08", // Format: yyyy-MM-dd
    page: 0,
    size: 10,
  };

  try {
    const response = await listRedeemReports(params);
    console.log("📋 Found", response.total, "reports");
    console.log("Reports:", response.data);
    return response;
  } catch (error) {
    console.error("❌ Failed to list reports:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Example 3: List reports by location
 */
export async function exampleListReportsByLocation() {
  const params: ListRedeemReportParams = {
    locationCode: "LOC001",
    date: "2026-02-08",
    page: 0,
    size: 10,
  };

  try {
    const response = await listRedeemReports(params);
    console.log("📋 Found", response.total, "reports for location LOC001");
    return response;
  } catch (error) {
    console.error("❌ Failed to list reports:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Example 4: List reports by phone number
 */
export async function exampleListReportsByPhone() {
  const params: ListRedeemReportParams = {
    phoneNumber: "0901234567",
    page: 0,
    size: 10,
  };

  try {
    const response = await listRedeemReports(params);
    console.log("📋 Found", response.total, "reports for phone 0901234567");
    return response;
  } catch (error) {
    console.error("❌ Failed to list reports:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Example 5: Get a specific report by ID
 */
export async function exampleGetReportById(reportId: number) {
  try {
    const report = await getRedeemReportById(reportId);
    
    if (report) {
      console.log("📄 Report details:", report);
      console.log("Customer:", report.customer_name);
      console.log("Phone:", report.phone_number);
      console.log("Total Invoice:", report.sale_data.totalInvoice);
      console.log("Gifts:", report.gift_data.gifts);
      return report;
    } else {
      console.warn("⚠️ Report not found");
      return null;
    }
  } catch (error) {
    console.error("❌ Failed to get report:", error);
    return null;
  }
}

/**
 * Example 6: Paginated listing with all filters
 */
export async function exampleListWithPagination() {
  const params: ListRedeemReportParams = {
    date: "2026-02-08",
    locationCode: "LOC001",
    workshiftId: "1",
    page: 0,
    size: 20,
  };

  try {
    const response = await listRedeemReports(params);
    
    console.log("📋 Pagination info:");
    console.log("- Total records:", response.total);
    console.log("- Page:", params.page);
    console.log("- Page size:", params.size);
    console.log("- Records returned:", response.data.length);
    
    return response;
  } catch (error) {
    console.error("❌ Failed to list reports:", error);
    return { data: [], total: 0 };
  }
}

/**
 * Example 7: Process gift data from report
 */
export async function exampleProcessGiftData(reportId: number) {
  try {
    const report = await getRedeemReportById(reportId);
    
    if (!report) {
      console.warn("⚠️ Report not found");
      return;
    }

    // Extract gift data
    const gifts = report.gift_data.gifts;
    const giftReceiveImageUrl = report.gift_data.giftReceiveImageUrl;

    console.log("🎁 Gift Information:");
    
    // Scheme gifts
    const schemeGifts = Object.entries(gifts).filter(([key]) => key.startsWith("scheme_"));
    if (schemeGifts.length > 0) {
      console.log("\n📦 Scheme Gifts:");
      schemeGifts.forEach(([giftId, quantity]) => {
        console.log(`- ${giftId}: ${quantity} pcs`);
      });
    }

    // Bonus gifts
    const bonusGifts = Object.entries(gifts).filter(([key]) => key.startsWith("bonus_"));
    if (bonusGifts.length > 0) {
      console.log("\n🎉 Bonus Gifts:");
      bonusGifts.forEach(([giftId, quantity]) => {
        console.log(`- ${giftId}: ${quantity} pcs`);
      });
    }

    // Event gifts
    const eventGifts = Object.entries(gifts).filter(([key]) => key.startsWith("event_"));
    if (eventGifts.length > 0) {
      console.log("\n🎊 Event Gifts:");
      eventGifts.forEach(([giftId, quantity]) => {
        console.log(`- ${giftId}: ${quantity} pcs`);
      });
    }

    console.log("\n📸 Gift Receive Image:", giftReceiveImageUrl);

    // Extract sale data
    const saleData = report.sale_data;
    console.log("\n💰 Sale Information:");
    console.log("- Total Invoice:", saleData.totalInvoice.toLocaleString("vi-VN"), "VNĐ");
    console.log("- Invoice Images:", saleData.invoiceImageUrls.length);
    saleData.invoiceImageUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

  } catch (error) {
    console.error("❌ Failed to process gift data:", error);
  }
}

/**
 * Example 8: Create report with minimal data (event gifts only, no purchase)
 */
export async function exampleCreateReportEventGiftsOnly() {
  const params: CreateRedeemReportParams = {
    customerPhone: "0901234567",
    customerName: "Nguyễn Văn B",
    totalInvoice: 0, // No purchase
    gifts: {
      event_checkin_bag: 1, // Only event gift
    },
    giftReceiveImageUrl: "https://storage.googleapis.com/bucket/images/gift_receive_2.jpg",
    invoiceImageUrls: [], // No invoice images needed for event gifts
    locationCode: "LOC002",
    locationName: "AEON Mall Long Biên",
    workshiftId: "2",
    workshiftName: "Ca chiều",
    createdBy: "user456",
  };

  try {
    const response = await createRedeemReport(params);

    if (response.success) {
      console.log("✅ Event-only report created successfully:", response.data);
      return response.data;
    } else {
      console.error("❌ Failed to create report:", response.error);
      return null;
    }
  } catch (error) {
    console.error("❌ Exception:", error);
    return null;
  }
}

