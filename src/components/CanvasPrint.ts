import { CUT_FEED, CUT_NO_FEED } from "../constants/eposbuilder";
import type { Mode, Color, Alignment, LayoutType, FeedPosition, PrintParams } from "../types";
import { Connection } from "./Connection";
import { ePOSPrint } from "../builders/ePOSPrint";

interface Layout {
  width: number;
  height: number;
  margin_top: number;
  margin_bottom: number;
  offset_cut: number;
  offset_label: number;
}

export class CanvasPrint extends ePOSPrint {
  mode: Mode;
  align: Alignment;
  color: Color;
  paper: LayoutType;
  feed: FeedPosition;
  cut: boolean;
  layout: Layout | null;
  connection: Connection | null;

  // Constants
  readonly ALIGN_LEFT: Alignment = "left";
  readonly ALIGN_CENTER: Alignment = "center";
  readonly ALIGN_RIGHT: Alignment = "right";
  readonly COLOR_NONE: Color = "none";
  readonly COLOR_1: Color = "color_1";
  readonly COLOR_2: Color = "color_2";
  readonly COLOR_3: Color = "color_3";
  readonly COLOR_4: Color = "color_4";
  readonly FEED_PEELING: FeedPosition = "peeling";
  readonly FEED_CUTTING: FeedPosition = "cutting";
  readonly FEED_CURRENT_TOF: FeedPosition = "current_tof";
  readonly FEED_NEXT_TOF: FeedPosition = "next_tof";
  readonly HALFTONE_DITHER = 0;
  readonly HALFTONE_ERROR_DIFFUSION = 1;
  readonly HALFTONE_THRESHOLD = 2;
  readonly MODE_MONO: Mode = "mono";
  readonly MODE_GRAY16: Mode = "gray16";
  readonly PAPER_RECEIPT: LayoutType = "receipt";
  readonly PAPER_RECEIPT_BM: LayoutType = "receipt_bm";
  readonly PAPER_LABEL: LayoutType = "label";
  readonly PAPER_LABEL_BM: LayoutType = "label_bm";

  constructor(address: string) {
    super(address);
    this.address = address;
    this.halftone = 0;
    this.brightness = 1;
    this.mode = this.MODE_MONO;
    this.align = this.ALIGN_LEFT;
    this.color = this.COLOR_1;
    this.paper = this.PAPER_RECEIPT;
    this.feed = this.FEED_CURRENT_TOF;
    this.cut = false;
    this.layout = null;
    this.connection = null;
  }

  setConnection(connection: Connection) {
    this.connection = connection;
  }
  
  getPrintParams(...params: [HTMLCanvasElement, (string | boolean)?, Mode?, string?]): PrintParams {
    const len = params.length;
    let cut = this.cut;
    let mode = this.mode;
    let [canvas] = params;
    let printjobid = "";
      
    switch (len) {
      case 2:
        [canvas, printjobid] = params as [HTMLCanvasElement, string];
        break;
      case 3:
        [canvas, cut = cut, mode = mode] = params as [HTMLCanvasElement, boolean, Mode];
        break;  
      case 4:
        [canvas, cut = cut, mode = mode, printjobid] = params as [HTMLCanvasElement, boolean, Mode, string];
        break
    }

    return { canvas, cut, mode, printjobid };
  }
  
  /**
   * Print the canvas
   * @param canvas html canvas element
   */
  print(canvas: HTMLCanvasElement):void;

  /**
   * Print the canvas and sets the printjobid
   * @param canvas canvas html element
   * @param printjobid print job id
   */
  print(canvas: HTMLCanvasElement, printjobid: string):void;

  /**
   * Print the canvas, with the option to cut paper and setting mode
   * @param canvas canvas html element
   * @param cut cut paper cmd
   * @param mode mono or gray mode
   */
  print(canvas: HTMLCanvasElement, cut: boolean, mode: Mode):void;
  
  /**
   * Print the canvas, with the option to cut paper, setting mode and printjobid
   * @param canvas canvas html element
   * @param cut cut paper cmd
   * @param mode mono or gray mode
   * @param printjobid print job id
   */
  print(canvas: HTMLCanvasElement, cut: boolean, mode: Mode, printjobid: string):void;

  print(...params: [HTMLCanvasElement, (string | boolean)?, Mode?, string?]):void {
    const { canvas, cut, mode, printjobid } = this.getPrintParams(...params);
    
    if (!canvas || typeof canvas.getContext !== "function") {
      throw new Error("Canvas is not supported");
    }

    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Unable to get 2D context from canvas");
    }

    // Add layout if available
    if (this.layout) {
      const { width, height, margin_top, margin_bottom, offset_cut, offset_label } = this.layout;
      this.addLayout(this.paper, width, height, margin_top, margin_bottom, offset_cut, offset_label);
    }

    // Add feed position if not a receipt
    if (this.paper !== this.PAPER_RECEIPT) {
      this.addFeedPosition(this.FEED_CURRENT_TOF);
      if (this.layout) {
        this.addFeedPosition(this.FEED_NEXT_TOF);
      }
    }

    // Add alignment, image, and cut
    this.addTextAlign(this.align);
    this.addImage(context, 0, 0, canvas.width, canvas.height, this.color, mode);

    if (this.paper !== this.PAPER_RECEIPT) {
      this.addFeedPosition(this.feed);
      if (cut) {
        this.addCut(CUT_NO_FEED);
      }
    } else if (cut) {
      this.addCut(CUT_FEED);
    }

    // changed to print the message with the printjobid
    this.send(this.toString(), printjobid);
  }

  recover() {
    this.force = true;
    this.addRecovery();
    this.send();
  }

  reset() {
    this.addReset();
    this.send();
  }
}
