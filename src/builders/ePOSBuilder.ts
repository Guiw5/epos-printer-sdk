import { MODE_GRAY16, SIGNED_SHORT_MAX, SIGNED_SHORT_MIN, UNSIGNED_BYTE_MAX, UNSIGNED_SHORT_MAX } from "../constants/eposbuilder";
import { escapeControl, escapeMarkup, toBase64Binary, toGrayImage, toHexBinary, toMonoImage, validateRange as validateRange } from "./utils";
import { 
  Alignment, 
  Font, 
  Color, 
  FeedPosition, 
  Mode, 
  BarcodeType, 
  Hri, 
  SymbolType, 
  Level, 
  LineStyle, 
  Direction, 
  Drawer, 
  PulseTime, 
  Pattern, 
  LayoutType, 
  CutType 
} from "../types";

export class ePOSBuilder {
  protected message: string = '';
  protected halftone: number = 0;
  protected brightness: number = 1;
  protected force: boolean = false;

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
    validateRange("linespc", lineSpace, 0, UNSIGNED_BYTE_MAX);
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
    validateRange("width", width, 1, 8);
    validateRange("height", height, 1, 8);
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

  addTextPosition(x: number): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    this.message += `<text x=${x} />`;
    return this
  };

  addTextHPosition(x: number): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    this.message += `<text x="${x}"/>`;
    return this;
  }

  addTextVPosition(y: number): this {
    validateRange("y", y, 0, UNSIGNED_SHORT_MAX);
    this.message += `<text y="${y}"/>`;
    return this;
  }

  // Feed methods
  addFeedUnit(unit: number): this {
    validateRange("unit", unit, 0, UNSIGNED_BYTE_MAX);
    this.message += `<feed unit="${unit}"/>`;
    return this;
  }

  addFeedLine(line: number): this {
    validateRange("line", line, 0, UNSIGNED_BYTE_MAX);
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
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    validateRange("y", y, 0, UNSIGNED_SHORT_MAX);
    validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
    validateRange("height", height, 0, UNSIGNED_SHORT_MAX);
    validateRange("halftone", this.halftone, 0, UNSIGNED_BYTE_MAX);
    validateRange("brightness", this.brightness, 0, UNSIGNED_BYTE_MAX);

    let attrs = ` x="${x}" y="${y}" width="${width}" height="${height}"`;
    if (color) attrs += ` color="${color}"`;
    if (mode) attrs += ` mode="${mode}"`;

    const imgData = context.getImageData(x, y, width, height);

    let raster = null;
    if (mode == MODE_GRAY16) {
      raster = toGrayImage(imgData, this.brightness);
    } else {
      raster = toMonoImage(imgData, this.halftone, this.brightness);
    }
    this.message += `<image${attrs}>${toBase64Binary(raster)}</image>`;
    return this;
  }

  addLogo(key1: number, key2: number): this {
    validateRange("key1", key1, 0, UNSIGNED_BYTE_MAX);
    validateRange("key2", key2, 0, UNSIGNED_BYTE_MAX);
    this.message += `<logo key1="${key1}" key2="${key2}"/>`;
    return this;
  }

  addBarcode(data: string, type: BarcodeType, hri?: Hri, font?: Font, width?: number, height?: number): this {
    let attrs = ` type="${type}"`;
    if (hri) attrs += ` hri="${hri}"`;
    if (font) attrs += ` font="${font}"`;
    if (width !== undefined) {
      validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
      attrs += ` width="${width}"`;
    }
    if (height !== undefined) {
      validateRange("height", height, 0, UNSIGNED_SHORT_MAX);
      attrs += ` height="${height}"`;
    }
    this.message += `<barcode${attrs}>${escapeControl(escapeMarkup(data))}</barcode>`;
    return this;
  }

  addSymbol(data: string, type: SymbolType, level?: Level | number, width?: number, height?: number, size?: number): this {
    let attrs = ` type="${type}"`;
    if (level !== undefined) {
      if (typeof level === 'number') {
        validateRange("level", level, 0, UNSIGNED_BYTE_MAX);
      }
      attrs += ` level="${level}"`;
    }  
    if (width !== undefined) {
      validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
      attrs += ` width="${width}"`;
    }
    if (height !== undefined) {
      validateRange("height", height, 0, UNSIGNED_SHORT_MAX);  
      attrs += ` height="${height}"`;
    } 
    if (size !== undefined) attrs += ` size="${size}"`;
    this.message += `<symbol${attrs}>${escapeControl(escapeMarkup(data))}</symbol>`;
    return this;
  }

  // Line methods
  addHLine(x1: number, x2: number, style?: LineStyle): this {
    validateRange("x1", x1, 0, UNSIGNED_SHORT_MAX);
    validateRange("x2", x2, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x1="${x1}" x2="${x2}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<hline${attrs}/>`;
    return this;
  }

  addVLineBegin(x: number, style?: LineStyle): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x="${x}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<vline-begin${attrs}/>`;
    return this;
  }

  addVLineEnd(x: number, style?: LineStyle): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
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
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    validateRange("y", y, 0, UNSIGNED_SHORT_MAX);
    validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
    validateRange("height", height, 0, UNSIGNED_SHORT_MAX);
    this.message += `<area x="${x}" y="${y}" width="${width}" height="${height}"/>`;
    return this;
  }

  addPageDirection(dir: Direction): this {
    this.message += `<direction dir="${dir}"/>`;
    return this;
  }

  addPagePosition(x: number, y: number): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    validateRange("y", y, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x="${x}" y="${y}"`;
    this.message += `<position${attrs}/>`;
    return this
  };

  addPageLine(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): this {
    validateRange("x1", x1, 0, UNSIGNED_SHORT_MAX);
    validateRange("y1", y1, 0, UNSIGNED_SHORT_MAX);
    validateRange("x2", x2, 0, UNSIGNED_SHORT_MAX);
    validateRange("y2", y2, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
    if (style) attrs += ` style="${style}"`;
    this.message += `<line${attrs}/>`;
    return this;
  }

  addPageRectangle(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): this {
    validateRange("x1", x1, 0, UNSIGNED_SHORT_MAX);
    validateRange("y1", y1, 0, UNSIGNED_SHORT_MAX);
    validateRange("x2", x2, 0, UNSIGNED_SHORT_MAX);
    validateRange("y2", y2, 0, UNSIGNED_SHORT_MAX);
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
    if (repeat) {
      validateRange("repeat", repeat, 0, UNSIGNED_BYTE_MAX);
      attrs += ` repeat="${repeat}"`;
    }  
    if (cycle) {
      validateRange("cycle", cycle, 0, UNSIGNED_SHORT_MAX);
      attrs += ` cycle="${cycle}"`;
    }
    this.message += `<sound${attrs}/>`;
    return this;
  }

  // Layout methods
  addLayout(type: LayoutType, width?: number, height?: number, marginTop?: number, marginBottom?: number, offsetCut?: number, offsetLabel?: number): this {
    let attrs = ` type="${type}"`;
    if (width !== undefined) {
      validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
      attrs += ` width="${width}"`;
    }
    if (height !== undefined) {
      validateRange("height", height, 0, UNSIGNED_SHORT_MAX);
      attrs += ` height="${height}"`;
    }
    if (marginTop !== undefined) {
      validateRange("margin-top", marginTop, SIGNED_SHORT_MIN, SIGNED_SHORT_MAX);
      attrs += ` margin-top="${marginTop}"`;
    }
    if (marginBottom !== undefined) {
      validateRange("margin-bottom", marginBottom, SIGNED_SHORT_MIN, SIGNED_SHORT_MAX);
      attrs += ` margin-bottom="${marginBottom}"`;
    }
    if (offsetCut !== undefined) {
      validateRange("offset-cut", offsetCut, SIGNED_SHORT_MIN, SIGNED_SHORT_MAX);
      attrs += ` offset-cut="${offsetCut}"`;
    } 
    if (offsetLabel !== undefined) {
      validateRange("offset-label", offsetLabel, SIGNED_SHORT_MIN, SIGNED_SHORT_MAX);
      attrs += ` offset-label="${offsetLabel}"`;
    }
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
