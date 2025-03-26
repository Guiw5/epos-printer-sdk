import type { CashChanger } from "./devices/CashChanger";
import type { CAT } from "./devices/CAT";
import type { DeviceTerminal } from "./devices/DeviceTerminal";
import type { Printer } from "./devices/Printer";
import { TYPES } from "./constants/devices";

export type Font = 'font_a' | 'font_b' | 'font_c' | 'font_d' | 'font_e' | 'special_a' | 'special_b';
export type Alignment = 'left' | 'center' | 'right';
export type Color = 'none' | 'color_1' | 'color_2' | 'color_3' | 'color_4';
export type FeedPosition = 'peeling' | 'cutting' | 'current_tof' | 'next_tof';
export type Mode = 'mono' | 'gray16';
export type BarcodeType = 'upc_a' | 'upc_e' | 'ean13' | 'jan13' | 'ean8' | 'jan8' | 'code39' | 
                   'itf' | 'codabar' | 'code93' | 'code128' | 'gs1_128';
export type Hri = 'none' | 'above' | 'below' | 'both';
export type SymbolType = 'pdf417_standard' | 'pdf417_truncated' | 'qrcode_model_1' | 'qrcode_model_2' | 'qrcode_micro';
export type Level = 'level_0' | 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_5' | 'level_6' | 
             'level_7' | 'level_8' |  'level_l' | 'level_m' | 'level_q' | 'level_h' | 'default';
export type LineStyle = 'thin' | 'medium' | 'thick' | 'thin_double' | 'medium_double' | 'thick_double';
export type Direction = 'left_to_right' | 'bottom_to_top' | 'right_to_left' | 'top_to_bottom';
export type CutType = 'no_feed' | 'feed' | 'reserve' | 'no_feed_fullcut' | 'feed_fullcut' | 'reserve_fullcut';
export type Drawer = 'drawer_1' | 'drawer_2';
export type PulseTime = 'pulse_100' | 'pulse_200' | 'pulse_300' | 'pulse_400' | 'pulse_500';
export type Pattern = 'none' | 'pattern_0' | 'pattern_1' | 'pattern_2' | 'pattern_3' | 'pattern_4' | 
               'pattern_5' | 'pattern_6' | 'pattern_7' | 'pattern_8' | 'pattern_9' | 'pattern_a' | 
               'pattern_b' | 'pattern_c' | 'pattern_d' | 'pattern_e' | 'pattern_error' | 'pattern_paper_end';
export type LayoutType = 'receipt' | 'receipt_bm' | 'label' | 'label_bm';

//ePosPrint
export type SendParams = { address: string, request?: string, printjobid?: string, isPrintRequest: boolean };

//CanvasPrint
export type PrintParams = { canvas: HTMLCanvasElement, cut: boolean, mode: Mode, printjobid?: string }

export type DeviceConstructor = new (...args: any[]) => IDevice;

export type IDevice =  Printer | CAT | DeviceTerminal | CashChanger;

export type DeviceType = typeof TYPES[keyof typeof TYPES];

// como hago una sobrecarga de funciones?
export type DeviceCallbackCode = (code: string) => void;
export type DeviceCallbackDevice = (deviceObject: IDevice | null, code?: string) => void;
export type DeviceCallback =  DeviceCallbackCode & DeviceCallbackDevice;
export type ConnectionCallback = (result: string) => void;
