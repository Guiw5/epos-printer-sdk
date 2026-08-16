import { MODE_GRAY16, SIGNED_SHORT_MAX, SIGNED_SHORT_MIN, UNSIGNED_BYTE_MAX, UNSIGNED_SHORT_MAX } from "../constants/eposbuilder";
import { escapeControl, escapeMarkup, toBase64Binary, toGrayImage, toHexBinary, toMonoImage, validateEnum, validateRange as validateRange } from "./utils";
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

const regexFont = /^(font_[a-e]|special_[ab])$/;
const regexAlign = /^(left|center|right)$/;
const regexColor = /^(none|color_[1-4])$/;
const regexFeed = /^(peeling|cutting|current_tof|next_tof)$/;
const regexMode = /^(mono|gray16)$/;
const regexBarcode = /^(upc_[ae]|[ej]an13|[ej]an8|code(39|93|128|128_auto)|itf|codabar|gs1_128|gs1_databar_(omnidirectional|truncated|limited|expanded))$/;
const regexHri = /^(none|above|below|both)$/;
const regexSymbol = /^(pdf417_(standard|truncated)|qrcode_(model_[12]|micro)|maxicode_mode_[2-6]|gs1_databar_(stacked(_omnidirectional)?|expanded_stacked)|azteccode_(fullrange|compact)|datamatrix_(square|rectangle_(8|12|16)))$/;
const regexLevel = /^(level_[0-8lmqh]|default)$/;
const regexLine = /^(thin|medium|thick)(_double)?$/;
const regexDirection = /^(left_to_right|bottom_to_top|right_to_left|top_to_bottom)$/;
const regexCut = /^(no_feed|feed|reserve)(_fullcut)?$/;
const regexDrawer = /^drawer_[12]$/;
const regexPulse = /^pulse_[1-5]00$/;
const regexPattern = /^(none|pattern_(10|[0-9a-e])|error|paper_end)$/;
const regexLayout = /^(receipt|label)(_bm)?$/;

/** A body that is already a whole document, which cannot be nested inside another one. */
const regexDocument = /^\s*<epos-print[\s>]/;

export class ePOSBuilder {
  protected message: string = '';

  /**
   * Instance constants, vendor parity: `pos.addCut(pos.CUT_FEED)` is the call
   * the Epson documentation shows, and `pos.CUT_FEED` being `undefined` reads
   * as `<cut/>`, which the printer takes as `feed`, so asking for
   * `CUT_NO_FEED` on a label failed silently. Same values as the module-level
   * `constants/eposbuilder` exports.
   */
  readonly CUT_NO_FEED: CutType = "no_feed";
  readonly CUT_FEED: CutType = "feed";
  readonly CUT_RESERVE: CutType = "reserve";
  readonly FULL_CUT_NO_FEED: CutType = "no_feed_fullcut";
  readonly FULL_CUT_FEED: CutType = "feed_fullcut";
  readonly FULL_CUT_RESERVE: CutType = "reserve_fullcut";

  /**
   * Halftone algorithm applied when rasterizing images: 0 dither,
   * 1 error diffusion, 2 threshold (HALFTONE_* constants).
   *
   * Assigning does not validate. The range is checked inside
   * {@link addImage}, where the value is actually used, matching the
   * vendor SDK, so an out-of-range value throws on the next addImage()
   * call rather than on assignment.
   */
  halftone: number = 0;

  /**
   * Gamma correction applied when rasterizing images, 0.1 to 10.
   *
   * Assigning does not validate: the range is checked inside
   * {@link addImage}. See {@link halftone}.
   */
  brightness: number = 1;

  /**
   * Emits `force="true"` on the `<epos-print>` element, telling the printer
   * to accept the job even while it is in a recoverable error state.
   *
   * Assigning does not validate. `send()` consumes the flag along with the
   * body: it is reset to `false` once a print request has been handed off,
   * so it applies to one job only.
   */
  force: boolean = false;

  // Text methods
  addText(data: string): this {
    this.message += `<text>${escapeMarkup(data)}</text>`;
    return this;
  }

  addTextLang(lang: string): this {
    this.message += `<text lang="${escapeMarkup(lang)}"/>`;
    return this;
  }

  addTextAlign(align: Alignment): this {
    validateEnum("align", align, regexAlign);
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
    validateEnum("font", font, regexFont);
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
    if (color) {
      validateEnum("color", color, regexColor);
      attrs += ` color="${color}"`;
    }
    this.message += `<text${attrs}/>`;
    return this;
  }

  addTextPosition(x: number): this {
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
    validateEnum("pos", pos, regexFeed);
    this.message += `<feed pos="${pos}"/>`;
    return this;
  }

  // Image methods
  /**
   * x/y select the source region to read from the canvas (via
   * getImageData), the ePOS-Print XML <image> element itself has no x/y
   * attribute (confirmed against the official ePOS-Print XML manual: only
   * width/height/color/align/mode are valid). Position in page mode is set
   * separately via addPagePosition() before this call.
   */
  addImage(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color?: Color, mode?: Mode): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    validateRange("y", y, 0, UNSIGNED_SHORT_MAX);
    validateRange("width", width, 0, UNSIGNED_SHORT_MAX);
    validateRange("height", height, 0, UNSIGNED_SHORT_MAX);
    validateRange("halftone", this.halftone, 0, 2);
    validateRange("brightness", this.brightness, 0.1, 10);

    let attrs = ` width="${width}" height="${height}"`;
    if (color) {
      validateEnum("color", color, regexColor);
      attrs += ` color="${color}"`;
    }
    if (mode) {
      validateEnum("mode", mode, regexMode);
      attrs += ` mode="${mode}"`;
    }

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
    validateEnum("type", type, regexBarcode);
    let attrs = ` type="${type}"`;
    if (hri) {
      validateEnum("hri", hri, regexHri);
      attrs += ` hri="${hri}"`;
    }
    if (font) {
      validateEnum("font", font, regexFont);
      attrs += ` font="${font}"`;
    }
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
    validateEnum("type", type, regexSymbol);
    let attrs = ` type="${type}"`;
    if (level !== undefined) {
      if (typeof level === 'number') {
        validateRange("level", level, 0, UNSIGNED_BYTE_MAX);
      } else {
        validateEnum("level", level, regexLevel);
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
    if (style) {
      validateEnum("style", style, regexLine);
      attrs += ` style="${style}"`;
    }
    this.message += `<hline${attrs}/>`;
    return this;
  }

  addVLineBegin(x: number, style?: LineStyle): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x="${x}"`;
    if (style) {
      validateEnum("style", style, regexLine);
      attrs += ` style="${style}"`;
    }
    this.message += `<vline-begin${attrs}/>`;
    return this;
  }

  addVLineEnd(x: number, style?: LineStyle): this {
    validateRange("x", x, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x="${x}"`;
    if (style) {
      validateEnum("style", style, regexLine);
      attrs += ` style="${style}"`;
    }
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
    validateEnum("dir", dir, regexDirection);
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
    if (style) {
      validateEnum("style", style, regexLine);
      attrs += ` style="${style}"`;
    }
    this.message += `<line${attrs}/>`;
    return this;
  }

  addPageRectangle(x1: number, y1: number, x2: number, y2: number, style?: LineStyle): this {
    validateRange("x1", x1, 0, UNSIGNED_SHORT_MAX);
    validateRange("y1", y1, 0, UNSIGNED_SHORT_MAX);
    validateRange("x2", x2, 0, UNSIGNED_SHORT_MAX);
    validateRange("y2", y2, 0, UNSIGNED_SHORT_MAX);
    let attrs = ` x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
    if (style) {
      validateEnum("style", style, regexLine);
      attrs += ` style="${style}"`;
    }
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
    validateEnum("drawer", drawer, regexDrawer);
    validateEnum("time", time, regexPulse);
    this.message += `<pulse drawer="${drawer}" time="${time}"/>`;
    return this;
  }

  addSound(pattern: Pattern, repeat?: number, cycle?: number): this {
    validateEnum("pattern", pattern, regexPattern);
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
    validateEnum("type", type, regexLayout);
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
    let attrs = '';
    if (type !== undefined) {
      validateEnum("type", type, regexCut);
      attrs = ` type="${type}"`;
    }
    this.message += `<cut${attrs}/>`;
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

  /**
   * The accumulated body: the children of `<epos-print>`, without the
   * element itself. Not a document, {@link toString} is the document.
   *
   * Capturing it before `send()` and handing it back to {@link setBody}
   * reproduces the same job byte for byte, including any already-serialized
   * `<image>`, so a receipt can be reprinted without rasterizing again. The
   * value is portable across instances.
   */
  getBody(): string {
    return this.message;
  }

  /**
   * Replaces the accumulated body with a previously captured one (see
   * {@link getBody}).
   *
   * Throws on a whole `<epos-print>` document: the body is nested inside
   * one, so `setBody(printer.toString())` would produce invalid, doubly
   * wrapped XML.
   */
  setBody(body: string): this {
    if (regexDocument.test(body)) {
      throw new Error('Parameter "body" is invalid: expected the body of an <epos-print> document, not the document itself. Use getBody(), not toString().');
    }
    this.message = body;
    return this;
  }

  toString(): string {
    const forceAttr = this.force ? ` force="true"` : '';
    return `<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print"${forceAttr}>${this.message}</epos-print>`;
  }
}
