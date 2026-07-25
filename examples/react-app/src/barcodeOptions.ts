import type { BarcodeType, SymbolType } from 'epos-printer-sdk/http';

// Verified against the official ePOS-Print XML User's Manual (Rev.AF),
// Chapter 4 XML Reference, <barcode> and <symbol> "type" attribute tables.
export const BARCODE_TYPES: BarcodeType[] = [
  'upc_a', 'upc_e', 'ean13', 'jan13', 'ean8', 'jan8', 'code39', 'itf', 'codabar', 'code93',
  'code128', 'code128_auto', 'gs1_128',
  'gs1_databar_omnidirectional', 'gs1_databar_truncated', 'gs1_databar_limited', 'gs1_databar_expanded',
];

export const SYMBOL_TYPES: SymbolType[] = [
  'qrcode_model_1', 'qrcode_model_2', 'qrcode_micro',
  'pdf417_standard', 'pdf417_truncated',
  'maxicode_mode_2', 'maxicode_mode_3', 'maxicode_mode_4', 'maxicode_mode_5', 'maxicode_mode_6',
  'gs1_databar_stacked', 'gs1_databar_stacked_omnidirectional', 'gs1_databar_expanded_stacked',
  'azteccode_fullrange', 'azteccode_compact',
  'datamatrix_square', 'datamatrix_rectangle_8', 'datamatrix_rectangle_12', 'datamatrix_rectangle_16',
];
