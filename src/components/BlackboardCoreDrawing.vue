<template>
  <div class="blackboard" elevation="1">
    <!-- CREATE A CUSTOM CURSOR? -->
    <slot name="canvas-toolbar"
      :currentTool="currentTool"
      :isFullScreen="isFullScreen"
      :changeTool="changeTool"
      :handleImageFile="handleImageFile"
      :resetBoard="resetBlackboard"
      :toggleFullScreen="toggleFullScreen"
      :setTouchDisabled="setTouchDisabled"
      :touchDisabled="onlyAllowApplePencil"
      :undoPenStroke="eraseStroke"
    >

    </slot>

    <div ref="BlackboardWrapper" class="blackboard-wrapper" style="position: relative;">
      <canvas ref="FrontCanvas" class="front-canvas"
        @touchstart="e => touchStart(e)"
        @touchmove="e => touchMove(e)"
        @touchend="e => touchEnd(e)"
        @mousedown="e => mouseDown(e)"
        @mousemove="e => mouseMove(e)"
        @mouseup="e => mouseUp(e)"
      ></canvas>

      <canvas ref="BackCanvas" class="back-canvas">

      </canvas>
    </div>
  </div>
</template>

<script>
/**
 * A HTML canvas that supports drawing with stylus/touch/mouse.
 * 
 * NOTE: this is NOT safe for concurrency: if `strokesArray` is reset while the user is still drawing,
 * then the canvas UI will diverge from `strokesArray` (part of the stroke will be cut-off).
 * However, this issue is minor in most practical situations, so will be ignored for now. 
 * 
 * Maintains the invariant that the UI exactly reflects the strokesArray (see proof):
 * 
 * Start state: initially, strokesArray is empty, and the canvas is blank
 * Transition states: 
 *   1. `strokesArray` gets modified 
 *   2. The user draws a stroke on the the canvas
 *   3. The canvas resizes 
 * 
 * 1. strokesArray => UI:
 *     case 1: a new stroke is pushed to `strokesArray`
 *         The watcher will draw it onto <canvas/> * and call `localStrokesArray.push(newStroke)`. 
 * 
 *     case 2: `strokesArray` becomes empty
 *         The watcher wipes the <canvas/> and calls `localStrokesArray = []`.
 * 
 *     Note that mutating / deleting existing strokes are both disallowed (which will be enforced by an ADT later).
 * 
 * 2. UI => strokesArray:
 *     No matter how the user draws, `handleEndOfStroke()` is called:
 *     DANGER (TODO: refactor): eraser strokes does NOT pass `handleEndOfStroke()`
 *         1. $emit("stroke-drawn", newStroke) // so the client's `strokesArray` will be updated via v-model.
 *         2. localStrokesArray.push(newStroke) // so when the above change propagates back down, the strokesArray watcher ignores it. 
 * 
 * 3. The canvas resizes
 *      HTML <canvas/> automatically wipes. However, our resize listener will 
 *      re-render all the strokes on `strokesArray`. 
 * 
 * Therefore, strokesArray <=> UI. 
 */
import BlackboardToolBar from "@/components/BlackboardToolBar.vue";
import CanvasDrawMixin from "@/mixins/CanvasDrawMixin.js";
import { BlackboardTools, MASSIVE_MODE_DIMENSIONS } from "@/CONSTANTS.js";

import { getRandomId, isIosSafari } from "@/helpers.js";
import { mapState } from "vuex";

export default {
  props: {
    strokesArray: {
      type: Array,
      required: true
    },
    currentTime: {
      type: Number,
      default: () => 0
    },
    backgroundImage: {
      type: Object
      // don't set `required` to true yet to avoid minor crashes
    },
    sizeAndOrientationMode: {
      type: String,
      required: true
    }
  },
  mixins: [
    CanvasDrawMixin
  ],
  components: { 
    BlackboardToolBar
  },
  data () {
    return {
      canvas: null,
      ctx: null,
      bgCanvas: null,
      bgCtx: null,
      isHoldingLeftClick: false,

      // `[...strokesArray]` creates a fresh copy rather than an alias
      localStrokesArray: [...this.strokesArray], 
      currentStroke: { 
        points: [] 
      },

      // initialize `prevPoint` to an invalid coordinate to signal that it's not defined initially
      prevPoint: { 
        x: -1, 
        y: -1 
      },
      imageBlob: null,
      isFullScreen: false
    }
  },
  computed: {
    ...mapState([
      "user",
      "currentTool", 
      "onlyAllowApplePencil",
      "canvasDimensions",
      "isBoardFullscreen"
    ]),
    sessionID () { return this.$store.state.session.currentID; },
    imageBlobUrl () { return this.imageBlob ? URL.createObjectURL(this.imageBlob) : ""; },
    isPen () { return this.currentTool.type === BlackboardTools.PEN; },
    isNormalEraser () { return this.currentTool.type === BlackboardTools.NORMAL_ERASER; },
    isStrokeEraser () { return this.currentTool.type === BlackboardTools.STROKE_ERASER; }
  },
  watch: {
    sizeAndOrientationMode () {
      this.resizeBlackboard(); 
    },
    /**
     * Ensures `strokesArray => UI`, that is whenever the client mutates the `strokesArray` prop, we update <canvas/> accordingly`. 
     * 
     * Note we ignore the case where (n == this.localStrokesArray.length)
     * because it means that user drew on canvas --> emits event --> client changes --> triggers our own watch hook
     */
    strokesArray () {
      const n = this.strokesArray.length; 
      if (n === 0) {
        this.ctx.clearRect(0, 0, this.canvas.scrollWidth, this.canvas.scrollHeight);
        this.localStrokesArray = [];
      } else if (n - this.localStrokesArray.length === 1) { 
        const newStroke = this.strokesArray[n-1];
        if (newStroke.startTime === newStroke.endTime) {
          this.$_drawStroke(newStroke, null) // instantly
        } else {
          this.$_drawStroke(newStroke, this.$_getPointDuration(newStroke)); // smoothly 
        }
        this.localStrokesArray.push(newStroke);
      } 
      this.checkRepInvariant(); 
    },
    /**
     * Updates the background image. 
     * 
     * Ensures <ClientComponent/> => <BlackboardCoreDrawing/>.
     * For <BlackboardCoreDrawing/> => <ClientComponent/>, see the method "setImageAsBackground" 
     * 
     * @param downloadURL for image on Firebase storage 
     * @param blob the blob representing the image
     * @effect mutates the background canvas by displaying the image,
     *         filling its height and width (and not necessarily preserving aspect ratio)
     * 
     * TODO: refactor with composition API
     */
    backgroundImage ({ downloadURL, blob }) {
      this.bgCtx.clearRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
      if (downloadURL || blob) {
        this.$_renderBackground(
          blob ? URL.createObjectURL(blob) : downloadURL
        );
      }
    }
  },
  mounted () {
    this.initializeCanvas();
    // document.fonts.ready.then(this.createCustomCusor); // since cursor uses material icons font, load it after fonts are ready
    
    // explicitly expose `getThumbnailBlob` to client components that use <BlackboardCoreDrawing/>
    this.$emit("mounted", { 
      getThumbnailBlob: this.getThumbnailBlob,
    });
  },
  methods: {
    /** 
     * Ensures UI => strokesArray
     * 
     * All tools (pen, normal eraser, stroke eraser) will generate strokes.  
     * Because every stroke is processed here, UI => strokesArray.
     */
    handleEndOfStroke (newStroke) {
      newStroke.endTime = Number(this.currentTime.toFixed(1));
      newStroke.id = getRandomId(); 
      this.localStrokesArray.push(newStroke);
      this.$emit("stroke-drawn", newStroke);
    },
    initializeCanvas () {
      this.canvas = this.$refs.FrontCanvas;
      this.bgCanvas = this.$refs.BackCanvas;
      this.ctx = this.canvas.getContext("2d");
      this.bgCtx = this.bgCanvas.getContext("2d");

      this.resizeBlackboard(); // resizeBlackboard also re-renders everything
    },
    /**
     * 
     * Mutates this.currentStroke
     */
    startNewStroke (e) {
      e.preventDefault(); 

      this.prevPoint = { // TODO: use an optional
        x: -1, 
        y: -1 
      };
      this.currentStroke = {
        strokeNumber: this.strokesArray.length + 1,
        startTime: Number(this.currentTime.toFixed(1)),
        color: this.currentTool.color,
        lineWidth: this.currentTool.lineWidth,
        isErasing: this.isNormalEraser,
        points: [],
        sessionID: this.sessionID
      };

      // TODO: This is a quickfix to prevent the pencil offset bug
      if (this.$_rescaleCanvas()) {
        this.$_drawStrokesInstantly();
      }
    },
    touchStart (e) {
      if (this.isNotValidTouch(e)) return; 

      if (this.isDrawingWithApplePencil(e)) { 
        // disable touch drawing so the user doesn't accidentally draw with his/her palm 
        this.$store.commit("SET_ONLY_ALLOW_APPLE_PENCIL", true); 
      }
      this.handleContactWithBlackboard(e, { isInitialContact: true });
    },
    mouseDown (e) {
      this.isHoldingLeftClick = true;
      this.handleContactWithBlackboard(e, { isInitialContact: true });
    },
    touchMove (e) {
      if (this.isNotValidTouch(e)) return;  
  
      this.handleContactWithBlackboard(e, { isInitialContact: false });
    },
    // TODO REFACTOR: can take an optional argument, and share the function with mouse and touch
    mouseMove (e) {
      if (!this.isHoldingLeftClick) return; 
      this.handleContactWithBlackboard(e, { isInitialContact: false });
    },
    /**
     * TODO: Make `tool` an explicit parameter 
     */
    handleContactWithBlackboard (e, { isInitialContact }) {
      e.preventDefault(); // don't know what will happen if e.preventDefault is here
      const contactPoint = this.getStylusOrFingerOrMousePosition(e); // should make "isHoldingLeftClick" an explicit parameter
      
      if (this.isStrokeEraser) { 
        this.eraseAllStrokesWithinRadius(e, contactPoint); 
      } 
      else {
        if (isInitialContact) this.startNewStroke(e);
        this.lengthenTheCurrentStroke(e, contactPoint);
      }
    },
    lengthenTheCurrentStroke (e, contactPoint) {
      // update state
      this.currentStroke.points.push({ 
        unitX: parseFloat(contactPoint.x / this.canvas.width).toFixed(4),
        unitY: parseFloat(contactPoint.y / this.canvas.height).toFixed(4)
      });

      // update UI
      if (this.prevPoint.x !== -1 && this.prevPoint.y !== -1) {
        this.$_connectTwoPoints(
          [this.normalizePoint(this.prevPoint), this.normalizePoint(contactPoint)], // `points`: note that the points have to be normalized for now before refactors
          1, // `i`: note that setting i = 1 is a quick-fix (will refactor $_connectTwoPoints() in the future)
          this.isNormalEraser || this.isStrokeEraser, // `isErasing`,
          this.ctx,
          this.currentTool.color,
          this.currentTool.lineWidth,
        );
      }
      this.prevPoint = contactPoint;
    },
    /**
     * For each stroke that intersects with a circular region,
     * draw an "anti-stroke" to effectively delete it. 
     */
    eraseAllStrokesWithinRadius (e, eraserPosition) {
      for (const stroke of this.strokesArray) {
        if (stroke.wasErased || stroke.isErasing) {  
          continue;
        }
        for (const point of stroke.points) {
          const deltaX = eraserPosition.x - point.unitX * this.canvas.width;
          const deltaY = eraserPosition.y - point.unitY * this.canvas.height;
          const radius = 10; 
          if (Math.sqrt(deltaX**2 + deltaY**2) < radius) {
            this.eraseStroke(stroke);
            break; 
          }
        }
      }
    },
    /**
     * Create an anti-stroke that covers over another stroke, effectively erasing it. 
     * 
     * @param stroke the stroke to erase or cover over
     * @effect mutates <canvas/> and `localStrokesArray` 
     */
    eraseStroke (stroke) {
      // mark the stroke as erased so it can be ignored by future stroke erasers
      stroke.wasErased = true;
      const antiStroke = {
        startTime: Number(this.currentTime.toFixed(1)),
        isErasing: true,
        strokeNumber: this.strokesArray.length + 1,
        lineWidth: stroke.lineWidth + 2,
        points: stroke.points // points are normalized
      };
      this.$_drawStroke(antiStroke);
      this.handleEndOfStroke(antiStroke);
    },
    mouseUp (e) {
      this.isHoldingLeftClick = false;
      this.handleEndOfStroke(this.currentStroke); 
    },
    touchEnd (e) {
      if (! this.isDrawingWithApplePencil && this.onlyAllowApplePencil) {
        return; 
      }
      e.preventDefault(); 
      this.handleEndOfStroke(this.currentStroke); 
    },
    async resetBlackboard () {
      this.wipeUI();
      this.resetVariables(); 
      this.$emit("board-reset");
    },
    wipeUI () {
      this.ctx.clearRect(0, 0, this.canvas.scrollWidth, this.canvas.scrollHeight);
      this.bgCtx.clearRect(0, 0, this.bgCanvas.scrollWidth, this.bgCanvas.scrollHeight); // scroll width safer I think
    },
    resetVariables () {
      this.localStrokesArray = [];
      this.prevPoint = { 
        x: -1, 
        y: -1 
      };
      this.imageBlob = null;
    },
    /**
     * Generates a thumbnail by: 
     *   1. Render the background image / grey background on the back canvas 
     *   2. Then draw on the strokes on the back canvas as well
     * 
     *  Note that the thumbnail must be based only on ONE single canvas, whereas when we normally display the blackboard
     *  there are TWO canvases. 
     * 
     *   This implementation suffers from edge cases: 
     *     If eraser strokes are ignored, then strokes covered by the normal eraser will then be visible when rendered as a thumbnail
     *     I tried not using a background color, but then the white strokes will be invisible
     *     I tried not ignoring eraser strokes, but then the eraser strokes will damage not only the strokes but the background as well
     */
    getThumbnailBlob () {
      return new Promise(async resolve => {
        // TODO: better prop design for `backgroundImage = {};`
        // should it be null? ask questions in the community. You need to ask questions. 
        if (this.backgroundImage) {
          const { blob, downloadURL } = this.backgroundImage;
          await this.$_renderBackground(
            blob ? URL.createObjectURL(blob) : downloadURL
          );
        } else {
          // make the background black-grey
          this.bgCtx.fillStyle = "rgb(62, 66, 66)";
          this.bgCtx.fillRect(0, 0, this.bgCanvas.width, this.bgCanvas.height);
        }
        // now draw the strokes
        this.$_drawStrokesInstantly(this.bgCtx);

        // TODO: remove this quickfix (first introduced to avoid double drawing thumbnail)
        // this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.bgCanvas.toBlob(thumbnail => resolve(thumbnail));
      })
    },
    /**
     * Correctly readjusts the external and internal dimensions of the canvas.
     * Because the HTML canvas wipes everytime it's resized, 
     * the function has to also re-render all the pens strokes and background image. 
     */
    resizeBlackboard () {      
      const changeInternalAndExternalDimensionsOfBlackboard = ({ newWidth, newHeight }) => {
        this.canvas.style.width = `${newWidth}px`; 
        this.canvas.style.height = `${newHeight}px`;
        this.canvas.style.scrollWidth = `${newWidth}px`;
        this.canvas.style.scrollHeight = `${newHeight}px`;

        this.bgCanvas.style.width = `${newWidth}px`; 
        this.bgCanvas.style.height = `${newHeight}px`;
        this.bgCanvas.style.scrollWidth = `${newWidth}px`;
        this.bgCanvas.style.scrollHeight = `${newHeight}px`;
      }

      const { BlackboardWrapper } = this.$refs; 
      BlackboardWrapper.style.width = "100%"; 
      BlackboardWrapper.style.height = "100%"; 

      changeInternalAndExternalDimensionsOfBlackboard({
        newWidth: MASSIVE_MODE_DIMENSIONS.WIDTH,
        newHeight: MASSIVE_MODE_DIMENSIONS.HEIGHT
      });

      // below is necessary even though the same rescale logic resides in "startNewStroke()"
      // otherwise the existing strokes will be out of scale until the another stroke is drawn
      this.$_rescaleCanvas();
      this.$_drawStrokesInstantly();

      // re-render background
      if (!this.backgroundImage) {
        return; 
      }
      const { blob, downloadURL } = this.backgroundImage;
      if (blob || downloadURL) {
        this.$_renderBackground(
          blob ? URL.createObjectURL(blob) : downloadURL
        );
      }
    },
    // HANDLE BACKGROUND IMAGE
    /**
     * By design, Handles the case if `imageFile` is empty.
     * 
     *  Support all image file types and .pdf extension files 
     * 
     * TODO:
     */
    async handleImageFile (e) {
      const uploadedFile = e.target.files[0];
      if (!uploadedFile) return;
      let imageFile;  
      if (uploadedFile.type.split("/")[0] === "image") {
        imageFile = uploadedFile; 
      } else if (uploadedFile.type.split("/")[1] === "pdf") {
        imageFile = await this.convertPdfToImageFile(uploadedFile);
      } else {
        this.$root.$emit("show-snackbar", "Error: only image or pdf files are supported for now.");
        return; 
      }
      this.$_renderBackground(URL.createObjectURL(imageFile));
      this.$emit("update:background-image", { blob: imageFile });
    },
    async convertPdfToImageFile (src) {
      // TODO: fix npm errors and use normal imports
      const pdfjs = require("pdfjs-dist/build/pdf.js");
      pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.4.456/pdf.worker.min.js";
      
      const doc = await pdfjs.getDocument(URL.createObjectURL(src)).promise;
      const page = await doc.getPage(1);
      
      // Render the page on a Node canvas with 100% scale.
      const viewport = page.getViewport({ scale: 1.0 });
      const dummyCanvas = document.createElement("canvas");
      dummyCanvas.width = viewport.width;
      dummyCanvas.height = viewport.height;
      const ctx = dummyCanvas.getContext("2d");
      const renderContext = {
        canvasContext: ctx,
        viewport: viewport
      };
      
      await page.render(renderContext).promise
      const dataURL = dummyCanvas.toDataURL("image/png");
      const current_date = new Date();
      const file = this.dataURLtoFile(dataURL, current_date.getTime()+'.png');
      return file;
    },
    // https://stackoverflow.com/questions/16968945/convert-base64-png-data-to-javascript-file-objects/16972036
    dataURLtoFile (dataurl, filename) {
      var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
      while(n--){
        u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename, {type:mime});
    },
    createCustomCusor () {
      const dummyCanvas = document.createElement("canvas");
      dummyCanvas.width = 24;
      dummyCanvas.height = 24;
      const ctx = dummyCanvas.getContext("2d");
      ctx.fillStyle = this.isPen ? this.currentTool.color : "#fff";
      ctx.font = "24px 'Material Design Icons'";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.isPen ? "\uF64F": "\uF1FE", 12, 12);
      if (!this.$refs.FrontCanvas) return; 
      const dataURL = dummyCanvas.toDataURL("image/png");
      this.$refs.FrontCanvas.style.cursor = "url(" + dataURL + ") 0 24, auto";
    },
    async toggleFullScreen () {
      this.isFullScreen = !this.isFullScreen;
      await this.$nextTick();
      this.resizeBlackboard();
      window.scrollTo(0, document.body.scrollHeight) // to prevent being scrolled to the middle of page when Exiting the fullscreen
    },
    setTouchDisabled (newBoolean) {
      this.$store.commit("SET_ONLY_ALLOW_APPLE_PENCIL", newBoolean); 
    },
    checkRepInvariant () {
      if (this.strokesArray.length !== this.localStrokesArray.length) {
        throw new Error(
          `Rep invariant violated: external, internal lengths are ${this.strokesArray.length}, ${this.localStrokesArray.length}`
        );
        alert("Blackboard broke for some unknown reason, reload the page while I figure out why!");
      }
    },
    isNotValidTouch (e) {
      // disallow drawing with multiple fingers 
      if (! e.touches) return true;
      if (e.touches.length !== 1) return true;
      if (this.onlyAllowApplePencil && !this.isDrawingWithApplePencil(e)) return true; 
      return false;
    },
    /**
     * Note that a Surface Pen will register as "touch" rather than "stylus" 
     */
    isDrawingWithApplePencil (e) {
      return e.touches[0].touchType === "stylus";
    },
    /**
     * Sets the current tool, which directly affects:
     *   1. The behavior of `setStrokeProperties()`
     *   2. The cursor icon (for laptop users)
     * 
     * Let the source of truth be Vuex
     */
    changeTool (tool) {
      // set tool
      this.$store.commit("SET_CURRENT_TOOL", tool); 
      this.createCustomCusor();
    },
    /**
     * Get (x, y) position of stylus/touch/mouse
     */
    getStylusOrFingerOrMousePosition(e) {
      // mouse
      if (this.isHoldingLeftClick) {
        return { 
          x: e.offsetX, 
          y: e.offsetY 
        };
      } 
      // stylus/finger
      else {
        const { left, top } = this.canvas.getBoundingClientRect();
        return {
          x: e.touches[0].pageX - left - window.scrollX,
          y: e.touches[0].pageY - top - window.scrollY
        };
      }
    },
    normalizePoint ({ x, y }) {
      return {
        unitX: x / this.canvas.width,
        unitY: y / this.canvas.height
      };
    },
    // MIGHT BE USEFUL LATER TO REUSE DRAWINGS
    // convertAllStrokesToBeInitialStrokes () {
    //   for (const stroke of this.strokesArray) {
    //     [stroke.startTime, stroke.endTime] = [0, 0];
    //   }
    // },
  }
};
</script>

<style scoped>
.front-canvas {
  background-color: transparent;
  display: block;
  z-index: 2;
  /* Position relative is necessary for some reason */
  position: relative; 
}
.back-canvas {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 0;
  display: block;
  background-color: rgb(62, 66, 66);
}
</style>
