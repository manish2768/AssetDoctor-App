/**
 * Asset Doctor — Purchase Document OCR Regression Suite
 *
 * Tests all 10 production scenarios:
 * 1. Readable retail invoice (product, vendor, date, total, inv#)
 * 2. Long multi-line invoice (primary product selection, line items model)
 * 3. Thermal POS bill (clean merchant, date, amount, not poor scan)
 * 4. Invoice without warranty (successful extraction, warranty null)
 * 5. Invoice without serial number (successful extraction, serial null)
 * 6. Variable field naming (Particulars, Bill No, Net Total, Merchant)
 * 7. Downscaling safety (no thumbnail destruction, never upscale)
 * 8. High-res safe resize (aspect ratio preserved, max 2400 long edge)
 * 9. Missing optional fields review model (isDocumentReadable true, no false "couldn't read")
 * 10. Empty text fallback (clean graceful poor scan without crashing)
 */

import { CanonicalOcrPipeline } from '../CanonicalOcrPipeline';
import { RealPurchaseInvoiceExtractor } from '../extractors/RealPurchaseInvoiceExtractor';
import { planScanResize } from '../scanImagePreprocess';
import { summarizeDocumentIntelligence } from '../../../trust/protectionStatus';

function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    console.error(`  ✗ FAIL: ${testName}${detail ? ` (${detail})` : ''}`);
    throw new Error(`Test failed: ${testName} ${detail || ''}`);
  }
  console.log(`  ✓ PASS: ${testName}`);
}

async function runRegressionSuite() {
  console.log('\n================================================================');
  console.log('   PURCHASE DOCUMENT OCR ARCHITECTURE & REGRESSION SUITE');
  console.log('================================================================\n');

  // 1. Readable retail invoice
  console.log('--- 1. Readable Retail Invoice ---');
  {
    const retailBill = `
      CROMA RETAIL STORE
      A UNIT OF INFINITI RETAIL LIMITED
      Tax Invoice No: CR-2026-99102
      Date: 15/04/2026
      Customer: Rahul Sharma
      Description of Goods: Philips Air Fryer HD9252
      Serial No: PH99201994
      Warranty: 2 Years
      Subtotal: Rs. 8,474.58
      CGST 9%: Rs. 762.71
      SGST 9%: Rs. 762.71
      Grand Total: Rs. 10,000.00
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: retailBill });
    assert(Boolean(res.fields.productName), 'Product name detected', res.fields.productName);
    assert(res.fields.productName.includes('Philips'), 'Product name is Philips Air Fryer', res.fields.productName);
    assert(Boolean(res.fields.shopName), 'Store name detected', res.fields.shopName);
    assert(res.fields.invoiceNumber === 'CR-2026-99102', 'Invoice number matches', res.fields.invoiceNumber);
    assert(res.fields.totalAmount === 10000, 'Total amount extracted as 10000', String(res.fields.totalAmount));
    assert(res.fields.invoiceDate === '2026-04-15', 'Invoice date normalized to ISO', res.fields.invoiceDate);
    assert(res.status === 'EXTRACTED', 'Status is EXTRACTED');
    assert(res.reviewInvoice.isDocumentReadable === true, 'isDocumentReadable is true');
  }

  // 2. Long multi-line invoice
  console.log('\n--- 2. Long Multi-line Invoice with Multiple Items ---');
  {
    const multiLineBill = `
      BIG BAZAAR SUPERMARKET
      Bill No: BB-88419
      Date: 28-02-2026
      ------------------------------------------------------------
      Particulars               Qty    Rate       Amount
      ------------------------------------------------------------
      Milton Thermosteel Bottle  1     899.00     899.00
      Prestige Deluxe Cooker 5L  1    2,450.00   2,450.00
      Cotton Bedsheet Double     2     650.00   1,300.00
      Delivery Charges           1     150.00     150.00
      ------------------------------------------------------------
      Sub Total: Rs. 4,799.00
      Discount: Rs. 299.00
      Net Total: Rs. 4,500.00
      Payment Mode: UPI
      Thank you for shopping with us!
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: multiLineBill });
    assert(Boolean(res.fields.productName), 'Product name extracted');
    assert(
      res.fields.productName.includes('Prestige') || res.fields.productName.includes('Milton'),
      'Primary product is non-tax/non-shipping item',
      res.fields.productName
    );
    assert(!res.fields.productName.includes('Big Bazaar'), 'Product is not store name');
    assert(!res.fields.productName.includes('Delivery Charges'), 'Delivery charge not selected as product');
    assert(!res.fields.productName.includes('Sub Total'), 'Sub total not selected as product');
    assert(res.fields.totalAmount === 4500, 'Net total extracted correctly', String(res.fields.totalAmount));
    assert(Array.isArray(res.reviewInvoice.lineItems), 'Line items array created');
    assert(res.reviewInvoice.lineItems.length >= 2, 'Line items parsed properly', `${res.reviewInvoice.lineItems.length} items`);
  }

  // 3. Thermal POS bill
  console.log('\n--- 3. Thermal POS Receipt ---');
  {
    const thermalReceipt = `
      STARBUCKS COFFEE
      STORE #1024 LUCKNOW
      RECEIPT: SB-4410
      DATE: 12.05.2026 14:32
      JAVA CHIP FRAPPUCCINO TALL   380.00
      BLUEBERRY MUFFIN             220.00
      CGST 2.5%                     15.00
      SGST 2.5%                     15.00
      TOTAL                         630.00
      PAID VIA CARD ************1104
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: thermalReceipt });
    assert(res.status !== 'POOR_SCAN', 'Thermal receipt is not marked POOR_SCAN');
    assert(res.fields.totalAmount === 630, 'Grand total extracted as 630', String(res.fields.totalAmount));
    assert(res.fields.shopName?.includes('STARBUCKS'), 'Merchant detected', res.fields.shopName);
    assert(res.reviewInvoice.isDocumentReadable === true, 'Receipt is marked readable');
  }

  // 4. Invoice without warranty
  console.log('\n--- 4. Invoice Without Warranty (Optional Field) ---');
  {
    const noWarrantyBill = `
      FABINDIA OVERSEAS PVT LTD
      Invoice No: FI-55102
      Date: 2026-03-10
      Item: Handcrafted Wooden Table Lamp
      Price: Rs. 3,500.00
      Total Amount: Rs. 3,500.00
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: noWarrantyBill });
    assert(res.fields.warrantyExpiry == null, 'Warranty is null when absent');
    assert(Boolean(res.fields.productName), 'Product detected without warranty', res.fields.productName);
    assert(res.fields.totalAmount === 3500, 'Total detected without warranty', String(res.fields.totalAmount));
    assert(res.extractionConfidence >= 0.70, 'Confidence is solid without warranty', String(res.extractionConfidence));
    assert(res.status !== 'POOR_SCAN', 'Not failed due to absent warranty');
  }

  // 5. Invoice without serial number
  console.log('\n--- 5. Invoice Without Serial Number (Optional Field) ---');
  {
    const noSerialBill = `
      DECATUR SPORTS INDIA
      Bill No: DS-9921
      Date: 2026-04-01
      Particulars: Trekking Backpack 50L
      Total: Rs. 4,999.00
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: noSerialBill });
    assert(res.fields.serialNumber == null, 'Serial number is cleanly null');
    assert(res.fields.productName?.includes('Backpack'), 'Product extracted without serial', res.fields.productName);
    assert(res.fields.totalAmount === 4999, 'Total extracted without serial', String(res.fields.totalAmount));
    assert(res.status !== 'POOR_SCAN', 'Not failed due to absent serial');
  }

  // 6. Variable field naming in retail documents
  console.log('\n--- 6. Variable Field Naming Support ---');
  {
    const variableBill = `
      SHREE GANESH TRADING CO.
      Cash Memo No: CG-881
      Date of Issue: 18/06/2026
      Commodity: Havells Monoblock Water Pump 1HP
      Payable: Rs. 7,850.00
    `;
    const res = await CanonicalOcrPipeline.process({ rawText: variableBill });
    assert(Boolean(res.fields.productName), 'Commodity parsed as productName', res.fields.productName);
    assert(res.fields.invoiceNumber === 'CG-881', 'Cash memo parsed as invoiceNumber', res.fields.invoiceNumber);
    assert(res.fields.totalAmount === 7850, 'Payable parsed as totalAmount', String(res.fields.totalAmount));
    assert(res.fields.invoiceDate === '2026-06-18', 'Date of Issue parsed as invoiceDate', res.fields.invoiceDate);
  }

  // 7. Image downsizing safety: no destructive thumbnails
  console.log('\n--- 7. Image Downsizing Safety: No Thumbnail Degradation ---');
  {
    // A standard receipt of 1200x2800 must NOT be downscaled to a tiny thumbnail
    const smallReceiptPlan = planScanResize(1200, 2400, 2800);
    assert(smallReceiptPlan.resize === true, 'Resizes proportionally for max long edge');
    assert(smallReceiptPlan.targetWidth >= 1000, 'Retains high width resolution', String(smallReceiptPlan.targetWidth));

    // An image already within bounds (1500x2000) must NEVER be upscaled or degraded
    const safeImagePlan = planScanResize(1500, 2400, 2000);
    assert(safeImagePlan.resize === false, 'Skips resize when within safe OCR bounds');
    assert(safeImagePlan.reason === 'skip_upscale', 'Reason is skip_upscale');
  }

  // 8. High-resolution safe resize: long edge capping
  console.log('\n--- 8. High-Resolution Safe Resize (Max 2400 Long Edge) ---');
  {
    // A huge 4000x3000 photo from modern camera
    const hugeImagePlan = planScanResize(4000, 2400, 3000);
    assert(hugeImagePlan.resize === true, 'Resize triggered for 4000px width');
    assert(hugeImagePlan.targetWidth === 2400, 'Width capped at 2400', String(hugeImagePlan.targetWidth));
  }

  // 9. Review intelligence decoupling: readable document is never marked "couldn't read"
  console.log('\n--- 9. Review Screen Intelligence: Decoupled Readability ---');
  {
    const extractedData = {
      productName: 'Samsung Refrigerator 260L',
      shopName: 'Reliance Digital',
      totalAmount: 24500,
      invoiceNumber: 'RD-1002',
      invoiceDate: '2026-05-01',
      // warranty absent
    };
    const intel = summarizeDocumentIntelligence(extractedData, { documentType: 'Purchase Document' });
    assert(intel.detected.length >= 4, 'At least 4 detected fields found', String(intel.detected.length));
    assert(
      !intel.summary.includes("couldn't read"),
      'Summary does not show failure message',
      intel.summary
    );
    assert(
      intel.summary.includes('Samsung Refrigerator 260L') || intel.summary.includes('Reliance Digital'),
      'Summary reports extracted product or vendor',
      intel.summary
    );
  }

  // 10. Truly empty or garbage text fallback
  console.log('\n--- 10. Truly Unreadable Text Graceful Handling ---');
  {
    const garbageText = '   ...    \n\n   ---   ';
    const res = await CanonicalOcrPipeline.process({ rawText: garbageText });
    assert(res.status === 'POOR_SCAN', 'Garbage text correctly marked POOR_SCAN');
    assert(res.needsRetake === true, 'needsRetake is true for garbage text');
  }

  console.log('\n================================================================');
  console.log('   ✓ ALL 10 PURCHASE DOCUMENT REGRESSION TESTS PASSED!');
  console.log('================================================================\n');
}

runRegressionSuite().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
