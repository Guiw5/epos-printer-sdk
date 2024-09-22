import { MODE_GRAY16 } from "../commons/constants";
import { escapeControl, escapeMarkup, toBase64Binary, toGrayImage, toHexBinary, toMonoImage } from "../commons/utils";

type Font = 'font_a' | 'font_b' | 'font_c' | 'font_d' | 'font_e' | 'special_a' | 'special_b';
type Alignment = 'left' | 'center' | 'right';
type Color = 'none' | 'color_1' | 'color_2' | 'color_3' | 'color_4';
type FeedPosition = 'peeling' | 'cutting' | 'current_tof' | 'next_tof';
type Mode = 'mono' | 'gray16';
type BarcodeType = 'upc_a' | 'upc_e' | 'ean13' | 'jan13' | 'ean8' | 'jan8' | 'code39' | 
                   'itf' | 'codabar' | 'code93' | 'code128' | 'gs1_128';
type Hri = 'none' | 'above' | 'below' | 'both';
type SymbolType = 'pdf417_standard' | 'pdf417_truncated' | 'qrcode_model_1' | 'qrcode_model_2' | 'qrcode_micro';
type Level = 'level_0' | 'level_1' | 'level_2' | 'level_3' | 'level_4' | 'level_5' | 'level_6' | 
             'level_7' | 'level_8' |  'level_l' | 'level_m' | 'level_q' | 'level_h' | 'default';
type LineStyle = 'thin' | 'medium' | 'thick' | 'thin_double' | 'medium_double' | 'thick_double';
type Direction = 'left_to_right' | 'bottom_to_top' | 'right_to_left' | 'top_to_bottom';
type CutType = 'no_feed' | 'feed' | 'reserve' | 'no_feed_fullcut' | 'feed_fullcut' | 'reserve_fullcut';
type Drawer = 'drawer_1' | 'drawer_2';
type PulseTime = 'pulse_100' | 'pulse_200' | 'pulse_300' | 'pulse_400' | 'pulse_500';
type Pattern = 'none' | 'pattern_0' | 'pattern_1' | 'pattern_2' | 'pattern_3' | 'pattern_4' | 
               'pattern_5' | 'pattern_6' | 'pattern_7' | 'pattern_8' | 'pattern_9' | 'pattern_a' | 
               'pattern_b' | 'pattern_c' | 'pattern_d' | 'pattern_e' | 'pattern_error' | 'pattern_paper_end';
type LayoutType = 'receipt' | 'receipt_bm' | 'label' | 'label_bm';

export class ePOSBuilder {
  private message: string = '';
  private halftone: number = 0;
  private brightness: number = 1;
  private force: boolean = false;

  // Text methods
  addText(data: string): this {
    this.message += `<text>${escapeMarkup(data)}</text>`;
    return this;
  }

  addTextLang(lang: string): this {
    this.message += `<text lang="${lang}"/>`;
    return this;
  }

  addTextAlign(align: Alignment): this {
    this.message += `<text align="${align}"/>`;
    return this;
  }

  addTextRotate(rotate: boolean): this {
    this.message += `<text rotate="${rotate}"/>`;
    return this;
  }

  addTextLineSpace(lineSpace: number): this {
    this.message += `<text linespc="${lineSpace}"/>`;
    return this;
  }

  addTextFont(font: Font): this {
    this.message += `<text font="${font}"/>`;
    return this;
  }

  addTextSmooth(smooth: boolean): this {
    this.message += `<text smooth="${smooth}"/>`;
    return this;
  }

  addTextDouble(dw?: boolean, dh?: boolean): this {
    let attrs = '';
    if (dw !== undefined) attrs += ` dw="${dw}"`;
    if (dh !== undefined) attrs += ` dh="${dh}"`;
    this.message += `<text${attrs}/>`;
    return this;
  }

  addTextSize(width: number, height: number): this {
    this.message += `<text width="${width}" height="${height}"/>`;
    return this;
  }

  addTextStyle(reverse?: boolean, underline?: boolean, emphasize?: boolean, color?: Color): this {
    let attrs = '';
    if (reverse) attrs += ` reverse="${reverse}"`;
    if (underline) attrs += ` ul="${underline}"`;
    if (emphasize) attrs += ` em="${emphasize}"`;
    if (color) attrs += ` color="${color}"`;
    this.message += `<text${attrs}/>`;
    return this;
  }

  addTextHPosition(x: number): this {
    this.message += `<text x="${x}"/>`;
    return this;
  }

  addTextVPosition(y: number): this {
    this.message += `<text y="${y}"/>`;
    return this;
  }

  // Feed methods
  addFeedUnit(unit: number): this {
    this.message += `<feed unit="${unit}"/>`;
    return this;
  }

  addFeedLine(line: number): this {
    this.message += `<feed line="${line}"/>`;
    return this;
  }

  addFeed(): this {
    this.message += `<feed/>`;
    return this;
  }

  addFeedPosition(pos: FeedPosition): this {
    this.message += `<feed pos="${pos}"/>`;
    return this;
  }

  // Image methods
  addImage(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color?: Color, mode?: Mode): this {
    let attrs = ` x="${x}" y="${y}" width="${width}" height="${height}"`;
    if (color) attrs += ` color="${color}"`;
    if (mode) attrs += ` mode="${mode}"`;

    const imgData = context.getImageData(x, y, width, height);
    const raster = (mode == MODE_GRAY16) ? toGrayImage(imgData, this.brightness) : toMonoImage(imgData, this.halftone, this.brightness);
    this.message += `<image${attrs}>${toBase64Binary(raster)}</image>`;
    return this;
  }

  addLogo(key1: number, key2: number): this {
    this.message += `<logo key1="${key1}" key2="${key2}"/>`;
    return this;
  }

  addBarcode(data: string, type: BarcodeType, hri?: Hri, font?: Font, width?: number, height?: number): this {
    let attrs = ` type="${type}"`;
    if (hri) attrs += ` hri="${hri}"`;
    if (font) attrs += ` font="${font}"`;
    if (width) attrs += ` width="${width}"`;
    if (height) attrs += ` height="${height}"`;
    this.message += `<barcode${attrs}>${escapeControl(escapeMarkup(data))}</barcode>`;
    return this;
  }

  addSymbol(data: string, type: SymbolType, level?: Level, width?: number, height?: number, size?: number): this {
    let attrs = ` type="${type}"`;
    if (level !== undefined) attrs += ` level="${level}"`;
    if (width !== undefined) attrs += ` width="${width}"`;
    if (height !== undefined) attrs += ` height="${height}"`;
    if (size !== undefined) attrs += ` size="${size}"`;
    this.message += `<symbol${attrs}>${escapeControl(escapeMarkup(data))}</symbol>`;
    return this;
  }

  // Line methods
  addHLine(x1: number, x2: number, style?: LineStyle): this {
    let attrs = ` x1="${x1}" x2="${x2}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<hline${attrs}/>`;
    return this;
  }

  addVLineBegin(x: number, style?: LineStyle): this {
    let attrs = ` x="${x}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<vline-begin${attrs}/>`;
    return this;
  }

  addVLineEnd(x: number, style?: LineStyle): this {
    let attrs = ` x="${x}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<vline-end${attrs}/>`;
    return this;
  }

  // Page methods
  addPageBegin(): this {
    this.message += `<page>`;
    return this;
  }

  addPageEnd(): this {
    this.message += `</page>`;
    return this;
  }

  addPageArea(x: number, y: number, width: number, height: number): this {
    this.message += `<area x="${x}" y="${y}" width="${width}" height="${height}"/>`;
    return this;
  }

  addPageDirection(dir: Direction): this {
    this.message += `<direction dir="${dir}"/>`;
    return this;
  }

  addPageLine(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): this {
    let attrs = ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<line${attrs}/>`;
    return this;
  }

  addPageRectangle(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): this {
    let attrs = ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<rectangle${attrs}/>`;
    return this;
  }

  addRotateBegin(): this {
    this.message += `<rotate-begin/>`;
    return this;
  }

  addRotateEnd(): this {
    this.message += `<rotate-end/>`;
    return this;
  }

  // Pulse and sound methods
  addPulse(drawer: Drawer, time: PulseTime): this {
    this.message += `<pulse drawer="${drawer}" time="${time}"/>`;
    return this;
  }

  addSound(pattern: Pattern, repeat?: number, cycle?: number): this {
    let attrs = ` pattern="${pattern}"`;
    if (repeat) attrs += ` repeat="${repeat}"`;
    if (cycle) attrs += ` cycle="${cycle}"`;
    this.message += `<sound${attrs}/>`;
    return this;
  }

  // Layout methods
  addLayout(type: LayoutType, width?: number, height?: number, marginTop?: number, marginBottom?: number, offsetCut?: number, offsetLabel?: number): this {
    let attrs = ` type="${type}"`;
    if (width) attrs += ` width="${width}"`;
    if (height) attrs += ` height="${height}"`;
    if (marginTop) attrs += ` margin-top="${marginTop}"`;
    if (marginBottom) attrs += ` margin-bottom="${marginBottom}"`;
    if (offsetCut) attrs += ` offset-cut="${offsetCut}"`;
    if (offsetLabel) attrs += ` offset-label="${offsetLabel}"`;
    this.message += `<layout${attrs}/>`;
    return this;
  }

  // Cut methods
  addCut(type?: CutType): this {
    const cutType = type ? ` type="${type}"` : '';
    this.message += `<cut${cutType}/>`;
    return this;
  }

  // Miscellaneous
  addRecovery(): this {
    this.message += `<recovery/>`;
    return this;
  }

  addReset(): this {
    this.message += `<reset/>`;
    return this;
  }

  addCommand(data: string): this {
    this.message += `<command>${toHexBinary(data)}</command>`;
    return this;
  }

  toString(): string {
    const forceAttr = this.force ? ` force="true"` : '';
    return `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"${forceAttr}>${this.message}</epos-print>`;
  }
}
