var xgds_image_annotation = xgds_image_annotation || {};

$.extend(xgds_image_annotation, {
    arrow: "",
    line: "",
    rectangle: "",
    circle: "",
    ellipse: "",
    text: "",
    isDown: "",
    textboxPreview: "",
    origX: "",
    origY: "",
    selectedFabricObject: undefined,

    overlay: "",

    /* Store imageJson locally */
    imageJson: "",

    /*
    Stores annotation [primary key] to [annotation json] mappings for all annotations currently drawn on the canvas {pk: annotation json}
    Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
    */
    annotationsDict: {},
    
    getDictKey: function(source){
        var theType = source['annotationType'];
        if (theType === undefined) {
            theType = source['type'];
        }
        theType = theType.toLowerCase();
        return theType + '_' + source['pk'];
    },

    /*
    Stores a dictionary of pre-set (string)color -> (string)hex pairs.
    Loaded through ajax on document.onReady()
    */
    colorsDictionary: {},

    /*
    Spectrum color palette. Stores an array of colors in the correct format for the spectrum color picker.
     */
    spectrumColorPalette: [],

    /*
    Boolean of whether colors dictionary is loaded or not
     */
    colorsLoaded: false,

    /* the mouse can be in 3 modes:
     1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
     2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
     3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw onclicK)
     getters and setters are below
     */
    mouseMode: "OSD",

    /* Stores whether the image annotation toolbar is currently hidden or not. Can be visible/invisible*/
    imageAnnotationToolbarStatus: "invisible",

    /*
    Annotation type we draw on canvas on click (rectangle on default), changed by #annotationType radio menu
    */
    annotationType: "rectangle",

    /*
    Default annotation color to draw annotations in
    */
    currentAnnotationColor: "red",

    /*
    Default annotation size
     */
    currentAnnotationSize: "medium",

    /*
    Dictionary of different annotation sizes. Stroke is the stroke size used for non-arrow shapes. Arrow size is controlled by headlen.
     */
    annotationSizes: {
        "small": {
            "stroke": .5,
            "arrow": 2,
            "font": 4
        },
        "medium": {
            "stroke": 1,
            "arrow": 4,
            "font": 6
        },
        "large": {
            "stroke": 2,
            "arrow": 7,
            "font": 8
        },
    },

    /*
    Global setting to show/hide toolbar on default
     */
    showToolbar: "false",

    /*
    Global setting to show/hide annotations on default
     */
    showAnnotations: "true",

    // Toggle image annotation toolbar. Connected to button id=toggleImageAnnotationsMenu in image-view2.handlebars
    toggleMenuBar: function() {
        if(this.imageAnnotationToolbarStatus=="invisible") {
            $("#imageAnnotationToolbar").show();
            this.showToolbar = "true";
            this.imageAnnotationToolbarStatus="visible";
            $("#addAnnotation").prop("checked", true);
            $("#addAnnotation").parent().addClass("active");

            $("#navigateImage").prop("checked", false);
            $("#navigateImage").parent().removeClass("active");

            $("#editAnnotation").prop("checked", false);
            $("#editAnnotation").parent().removeClass("active");

            this.setMouseMode("addAnnotation");
        }else{
            $("#imageAnnotationToolbar").hide();
            this.showToolbar = "false";
            this.imageAnnotationToolbarStatus="invisible";
            this.setMouseMode("OSD");
        }
    },

    /*
    Clear xgds_image_annotation global variables (that will have been set by previous images if the viewer was loaded before)
    Initialize member variables
     */
    initialize: function(imageJson, osdViewer) {
        /* Clear variables */
        this.annotationsDict = {};

        /* Initialize member variables */
        this.imageJson = imageJson;
        this.viewer = osdViewer;
        this.overlay = this.viewer.fabricjsOverlay({scale:100});

        this.annotationType = "rectangle";
        this.currentAnnotationColor = "red";
        this.imageAnnotationToolbarStatus = "invisible";

        /* Show/hide toolbar based on default setting, showToolbar */
        if (this.showToolbar === "false") {
            $("#imageAnnotationToolbar").hide();
            this.imageAnnotationToolbarStatus = "invisible";
        } else {
            $("#imageAnnotationToolbar").show();
            this.imageAnnotationToolbarStatus = "visible";
        }

        /* Load colors into colors dictionary if not already loaded. This populates the colors dictionary AND creates the spectrum color palette */
        //TODO: change this back later--keep for now to prevent continuous-annotation-drawing bug
        this.spectrumColorPalette = this.getPaletteColors();

        // Initialize color picker options
        var spectrumOptions = {
            showPaletteOnly: true,
            showPalette: true,
            palette: this.spectrumColorPalette,
            color: this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].hex //set default color as the "first" key in colorsDictionary
        };

        $("#colorPicker").spectrum(spectrumOptions);

        /* Load and display annotations */
        xgds_image_annotation.getAnnotations();

        if(xgds_image_annotation.showAnnotations == "false") { // This code is duplicated in the getAnnotations callback to deal with async
            console.log("activated almonds");
            $("#off").click();
            xgds_image_annotation.turnAnnotationsOnOff("off");
        }

        /* Update the currentAnnotationSize radio menubar to have the correct annotationSize selected */
        if(xgds_image_annotation.currentAnnotationSize == "small") {
            $("#small").click();
        } else if(xgds_image_annotation.currentAnnotationSize == "medium"){
            $("#medium").click();
        } else {
            $("#large").click();
        }

        this.setMouseMode("OSD");

        /****************************************************************************************************************

                                             E V E N T  L I S T E N E R S

        *****************************************************************************************************************/

        /*
        mouse:down event listener
        On mousedown:
            - mark isDown as true. On mouse:up, we draw annotations if isDown is true.
            - set origX, origY as the initial click location.
            - initialize the correct function based on what the annotationType is.
         */
        this.overlay.fabricCanvas().observe('mouse:down', function (o) {
            xgds_image_annotation.setMouseMode(xgds_image_annotation.mouseMode);
            if (xgds_image_annotation.getMouseMode() == "addAnnotation") {
                xgds_image_annotation.isDown = true;

                var pointer = xgds_image_annotation.overlay.fabricCanvas().getPointer(o.e);
                xgds_image_annotation.origX = pointer.x;
                xgds_image_annotation.origY = pointer.y;
                switch (xgds_image_annotation.annotationType) {
                    case "arrow":
                        xgds_image_annotation.drawArrow(pointer.x, pointer.y);
                        break;
                    case "rectangle":
                        xgds_image_annotation.initializeRectangle(pointer.x, pointer.y);
                        break;
                    case "ellipse":
                        xgds_image_annotation.initializeEllipse(pointer.x, pointer.y);
                        break;
                    case "text":
                        xgds_image_annotation.initializeTextboxPreview(pointer.x, pointer.y);
                        break;
                    default:
                        console.log("That shouldn't have happened :( Undefined annotationType");
                        console.log("The undefined type entered is: " + this.annotationType);
                        throw new Error("Tried to switch to an undefined annotationType");
                }
            }
        });

        /*
        mouse:up event listener
        If isDown is true and the mouse if moved, redraw the currentAnnotationShape on canvas with the new current mouse position.
         */
        this.overlay.fabricCanvas().observe('mouse:move', function(o) {
            if (!xgds_image_annotation.isDown) {
                return;
            }
            var selected_object = xgds_image_annotation.selectedFabricObject;
            if (_.isUndefined(selected_object)) {
                return;
            }
            var canvas = xgds_image_annotation.overlay.fabricCanvas();
            var pointer = canvas.getPointer(o.e);
            switch (selected_object.type) {
                case "arrow":
                    xgds_image_annotation.updateArrow(selected_object, pointer.x, pointer.y);
                    break;
                case "rectangle":
                case "text":
                case "textboxPreview":
                    xgds_image_annotation.updateRectangleSize(selected_object, pointer.x, pointer.y);
                    break;
                case "ellipse":
                    xgds_image_annotation.updateEllipse(selected_object, pointer.x, pointer.y);
                    break;
                default:
                    console.log("That shouldn't have happened :( Undefined annotationType");
                    console.log("The undefined type entered is: " + this.annotationType);
                    throw new Error("Tried to switch to an undefined annotationType");
            }
            canvas.requestRenderAll();
        });

        /* event listener that handles resizing the textbox based on amount of text */
        this.overlay.fabricCanvas().on('text:changed', function (opt) {
            var t1 = opt.target;
            if (t1.width > t1.fixedWidth) {
                t1.fontSize *= t1.fixedWidth / (t1.width + 1);
                t1.width = t1.fixedWidth;
            }
            xgds_image_annotation.updateSerialization(xgds_image_annotation.overlay.fabricCanvas().getActiveObject());
        });

        /*
        mouse:up event listener
        If we are in addAnnotation mode and the mouse is lifted, save the currentAnnotationShape to Django
         */
        this.overlay.fabricCanvas().on('mouse:up', function (o) {
            if(xgds_image_annotation.getMouseMode() == "addAnnotation") {
                xgds_image_annotation.selectedFabricObject.selectable = true;
                var pointerOnMouseUp = xgds_image_annotation.overlay.fabricCanvas().getPointer(event.e);

                // save annotation to database
                xgds_image_annotation.createNewSerialization(xgds_image_annotation.selectedFabricObject, pointerOnMouseUp.x, pointerOnMouseUp.y);

                // Set fabric interactivity to false
                xgds_image_annotation.setFabricCanvasInteractivity(false);

                // If we just added a textbox, stay in edit mode so the user can edit. Otherwise, return to OSD navigation mode.
                if(xgds_image_annotation.selectedFabricObject.type == "text") {
                    xgds_image_annotation.setMouseMode("editAnnotation"); // break out into edit mode
                    $("#editAnnotation").click(); // set nav bar to editAnnotation
                }
            }
            xgds_image_annotation.isDown = false;
        });

        // Update the database entry of any modified object
        this.overlay.fabricCanvas().on('object:modified', function () {
            xgds_image_annotation.updateSerialization(xgds_image_annotation.overlay.fabricCanvas().getActiveObject());
        });

        // Listen for mouse mode changes
        $("input[name='cursorMode']").change(function () {
            var mode = $("input[name='cursorMode']:checked").val();
            xgds_image_annotation.setMouseMode(mode);
        });

        // Listen and set for annotations on/off
        $("input[name='annotationsOnOrOff']").change(function () {
            var onOff = $("input[name='annotationsOnOrOff']:checked").val();
            xgds_image_annotation.turnAnnotationsOnOff(onOff);
        });

        // Listen for user-selected annotationType
        $("input[name='annotationType']").change(function () {
            xgds_image_annotation.annotationType = $("input[name='annotationType']:checked").val();
        });

        // Listen for user-selected annotationSize
        $("input[name='annotationSize']").change(function () {
            xgds_image_annotation.currentAnnotationSize = $("input[name='annotationSize']:checked").val();
        });

        /*
        Download screenshot of *current* view (i.e. will take into account current zoom level)
        Ajax images to server, combine with pillow, and return.
        TODO: keep exif data
         */
        $('#downloadScreenshot').click(function (event) {
        		event.preventDefault();
            var OSD_layer = xgds_image_annotation.viewer.drawer.canvas.toDataURL("image/png"); // current OSD view
            var annotations = xgds_image_annotation.overlay.fabricCanvas().toDataURL({format: 'image/png'}); // image with annotations, transparent background
            var imagePK = xgds_image_annotation.imageJson["pk"];
            var postData = {
                    image1: OSD_layer,
                    image2: annotations,
                    imagePK: imagePK
                };
        	 $.fileDownload('/xgds_image/mergeImages/', {
        		 	data: postData,
        		 	httpMethod: "POST",
                 successCallback: function (url) {
                	 console.log('downloaded');
                 },
                 failCallback: function (htmlResponse, url) {
                	 console.log(htmlResponse);
                 }
             });
        });

        $('#deleteSelected').click(function() {
            xgds_image_annotation.deleteActiveAnnotation();
        });

        $('#deleteAll').click(function() {
            xgds_image_annotation.deleteAllAnnotations();
        });

        $('#deleteMine').click(function() {
            xgds_image_annotation.deleteMyAnnotations();
        });

        $("#colorPicker").on('change.spectrum', function (e, color) {
            xgds_image_annotation.currentAnnotationColor = color.toHexString(); //convert to hex
        });

//        $(document).keyup(function(e) {
//            //TODO: change alert to some kind of error <p> tag
//            if(xgds_image_annotation.getMouseMode() != "editAnnotation" && e.which == 8) {
//                alert("Please enter edit annotation mode and select the annotation you would like to delete");
//                return;
//            }
////            else if(e.which == 8) { // key code 8 is the delete key (on iOS devices). If the delete key doesn't work for PCs, try adding key code 46 too.
////                xgds_image_annotation.deleteActiveAnnotation();
////            }
//
//        });

    }, // end of initialize

    /****************************************************************************************************************

                                    A N N O T A T I O N S (Initializers and Updaters)

    *****************************************************************************************************************/
    //annotations

    //Euclidean distance between (x1,y1) and (x2,y2)
    distanceFormula: function(x1, y1, x2, y2) {
        var xDist = Math.pow((x1 - x2), 2);
        var yDist = Math.pow((y1 - y2), 2);
        return Math.sqrt(xDist + yDist);
    },

    initializeEllipse: function(x, y) {
        var ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: this.annotationSizes[this.currentAnnotationSize]["stroke"],
            stroke: this.currentAnnotationColor,
            fill: '',
            originX: 'center',
            originY: 'center',
            scaleX: 1,
            scaleY: 1,
            type: 'ellipse',
            size: this.currentAnnotationSize
        });
        this.selectedFabricObject = ellipse;
        this.overlay.fabricCanvas().add(ellipse);
    },

    updateEllipse: function(ellipse, x, y) {
        ellipse.set({rx: Math.abs(this.origX - x), ry: Math.abs(this.origY - y)});
        // this.selectedFabricObject = ellipse;
    },

    initializeRectangle: function(x, y) {
         var rectangle = new fabric.Rect({
            left: x,
            top: y,
            fill: '',
            strokeWidth: this.annotationSizes[this.currentAnnotationSize]["stroke"],
            stroke: this.currentAnnotationColor,
            width: 1,
            height: 1,
            scaleX: 1,
            scaleY: 1,
            type: 'rectangle',
            size: this.currentAnnotationSize
        });
        this.selectedFabricObject = rectangle;
        this.overlay.fabricCanvas().add(rectangle);
    },

    updateRectangleSize: function(rectangle, x, y) {
        var width = Math.abs(x - this.origX);
        var height = Math.abs(y - this.origY);
        rectangle.set({width: width, height: height});
    },

    initializeTextboxPreview: function(x, y) {
       var textbox_preview = new fabric.Rect({
           left: x,
           top: y,
           fill: '',
           strokeWidth: this.annotationSizes[this.currentAnnotationSize]["stroke"],
           stroke: this.currentAnnotationColor,
           width: 1,
           height: 1,
           type: 'textboxPreview',
           size: this.currentAnnotationSize
       });
       this.selectedFabricObject = textbox_preview;
       this.overlay.fabricCanvas().add(textbox_preview);
    },

    /*
     Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
     computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
     really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
     */
    drawArrow: function(x, y) {
        var headlen = this.annotationSizes[this.currentAnnotationSize]["arrow"];  // arrow head size
        var arrow = new fabric.Polygon(this.calculateArrowPoints(this.origX, this.origY, x, y, headlen), {
            fill: this.currentAnnotationColor,
            opacity: 1,
            originX: 'left',
            originY: 'top',
            scaleX: 1,
            scaleY: 1,
            type: 'arrow',
            size: this.currentAnnotationSize
        });
        this.selectedFabricObject = arrow;
        this.overlay.fabricCanvas().add(arrow);
    },

    updateArrow: function(arrow, x, y) {
        var headlen = this.annotationSizes[this.currentAnnotationSize]["arrow"]; // current arrow head size
        var canvas = this.overlay.fabricCanvas();
        canvas.remove(arrow);
        var angle = Math.atan2(y - this.origY, x - this.origX);

        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        // calculate the points.
        var pointsArray = this.calculateArrowPoints(x, y, headlen);
        var oldArrowSize = arrow.size
        var arrow = new fabric.Polygon(pointsArray, {
            fill: this.currentAnnotationColor,
            opacity: 1,
            originX: 'left',
            originY: 'top',
            type: 'arrow',
            size: oldArrowSize
        });
        this.selectedFabricObject = arrow;
        canvas.add(arrow);
        canvas.requestRenderAll();
    },

    // Compute set of points to create arrow shape
    calculateArrowPoints: function(x, y, headlen) {
        var angle = Math.atan2(y - this.origY, x - this.origX);
        var headlen = this.annotationSizes[this.currentAnnotationSize]["arrow"],

        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        var points = [
            {
                x: this.origX,  // start point
                y: this.origY
            }, {
                x: this.origX - (headlen / 4) * Math.cos(angle - Math.PI / 2),
                y: this.origY - (headlen / 4) * Math.sin(angle - Math.PI / 2)
            }, {
                x: x - (headlen / 4) * Math.cos(angle - Math.PI / 2),
                y: y - (headlen / 4) * Math.sin(angle - Math.PI / 2)
            }, {
                x: x - (headlen) * Math.cos(angle - Math.PI / 2),
                y: y - (headlen) * Math.sin(angle - Math.PI / 2)
            }, {
                x: x + (headlen) * Math.cos(angle),  // tip
                y: y + (headlen) * Math.sin(angle)
            }, {
                x: x - (headlen) * Math.cos(angle + Math.PI / 2),
                y: y - (headlen) * Math.sin(angle + Math.PI / 2)
            }, {
                x: x - (headlen / 4) * Math.cos(angle + Math.PI / 2),
                y: y - (headlen / 4) * Math.sin(angle + Math.PI / 2)
            }, {
                x: this.origX - (headlen / 4) * Math.cos(angle + Math.PI / 2),
                y: this.origY - (headlen / 4) * Math.sin(angle + Math.PI / 2)
            }, {
                x: this.origX,
                y: this.origY
            }
        ];
        return points;
    },

    setFabricCanvasInteractivity: function(selectable) {
        var fabricCanvas = this.overlay.fabricCanvas();

        fabricCanvas.forEachObject(function (object) {
            object.selectable = selectable;
        });
    },

    deselectFabricObjects: function(){
        this.overlay.fabricCanvas().discardActiveObject();
    },

    setMouseMode: function(mode) {
        switch (mode) {
            case "OSD":
                this.mouseMode = "OSD";
                this.setFabricCanvasInteractivity(false);
                this.deselectFabricObjects();
                this.viewer.setMouseNavEnabled(true);
                break;
            case "addAnnotation":
                this.mouseMode = "addAnnotation";
                this.setFabricCanvasInteractivity(false);
                this.deselectFabricObjects();
                this.viewer.setMouseNavEnabled(false);
                break;
            case "editAnnotation":
                this.mouseMode = "editAnnotation";
                this.setFabricCanvasInteractivity(true);
                this.viewer.setMouseNavEnabled(false);
                break;
            default:
                console.log(mode);
                throw "Tried to set invalid mouse mode";
        }
    },

    getMouseMode: function() {
        return this.mouseMode;
    },

    /*
    We duplicate objects before serializing them because...
     */
    build_annotation_dict: function(object) {
        if (_.isNull(object) || _.isEmpty(object) || _.isUndefined(object)){
            return {};
        }
        var result_dict = {
            left: object["left"],
            top: object["top"],
            stroke: object["stroke"],
            strokeWidth: object["strokeWidth"],
            originX: object["originX"],
            originY: object["originY"],
            fill: object["fill"],
            angle: object["angle"],
            type: object["type"],
            scaleX: object["scaleX"],
            scaleY: object["scaleY"],
            points: object["points"],
            text: object["text"],
            fontSize: object["fontSize"],
            rx: object["rx"],
            ry: object["ry"],
            height: object["height"],
            width: object["width"],
            pk: object["pk"],
            image: object["image"],
            size: object["size"]
        };
        return result_dict;
    },

    /* Retrieve and draw on canvas all stored annotations from Django */
    getAnnotations: function() {
        var imagePK = this.imageJson["pk"];
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotations/' + imagePK,
            datatype: 'json',
            success: function (data) {
                data.forEach(function (annotation) {
                    xgds_image_annotation.addAnnotationToCanvas(annotation)
                    // Not optimal but this if statement doesn't work outside of the for each for some reason
                    if (xgds_image_annotation.showAnnotations == "false") {
                        $("#off").click();
                        xgds_image_annotation.turnAnnotationsOnOff("off");
                    }
                });
            },
            error: function (a) {
                console.log(a);
                throw "Error while loading annotations"
            }
        });
    },

    /* JSON currentAnnotationShape -> Ajax -> Django ORM/MariaDB */
    createNewSerialization: function(fabricObject, x, y) {
        var fabricCanvas = this.overlay.fabricCanvas();
        if (fabricObject.type == "textboxPreview") {
            var zoom = xgds_image_annotation.viewer.viewport.getZoom();
            var font_size = Math.round(this.annotationSizes[this.currentAnnotationSize].font / zoom);
            if (font_size < 1) {
                font_size = 1;
            }

            var text = new fabric.Textbox('dblClick', {
                width: x - this.origX,
                top: this.origY,
                left: this.origX,
                fontFamily: 'Arial',
                fontSize: font_size,
                stroke: 'white',  // weirdly this has to be here or you cannot go into edit mode
                strokeWidth: font_size*0.03,
                fill: this.currentAnnotationColor,
                borderColor: this.currentAnnotationColor,
                textAlign: 'center',
                scaleX: 1,
                scaleY: 1,
                type: 'text',
                size: this.currentAnnotationSize
            });
            this.selectedFabricObject = text;

            fabricCanvas.add(text);
            fabricCanvas.remove(fabricObject);
            fabricObject = text;
        } else {
            // this makes it so we can select it later.  Seems stupid, not sure why we have to do this.
            fabricCanvas.remove(fabricObject);
            fabricCanvas.add(fabricObject);
        }
        var annotation_dict = this.build_annotation_dict(fabricObject);

        // Color edge cases/aesthetic
        if(fabricObject.type == "arrow" || fabricObject.type == "text") {
            annotation_dict["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
            annotation_dict["stroke"] = annotation_dict["fill"];
        } else { //everything else only needs stroke
            annotation_dict["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
            annotation_dict["fill"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
        }

        $.ajax({
            type: "POST",
            url: '/xgds_image/addAnnotation/',
            datatype: 'json',
            context: this,
            data: {
                annotation: JSON.stringify(annotation_dict),
                image_pk: this.imageJson["pk"]
            },
            success: function (data) {
                fabricObject.set({pk: data["pk"], image: data["image_pk"]});
                data['annotation'] = fabricObject;
                xgds_image_annotation.annotationsDict[this.getDictKey(data)] = data;
            },
            error: function (e) {
                console.log("Ajax error");
                console.log(e);
            }
        });
    },

    /* Update annotation's database entry. */
    updateSerialization: function(fabricObject) {
        var annotation_dict = this.build_annotation_dict(fabricObject);

        if(fabricObject.type == "arrow") { //arrow only needs fill
            annotation_dict["stroke"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load
            annotation_dict["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
        }else if (fabricObject.type == "text") { //text needs both stroke and fill
            annotation_dict["stroke"] = this.getColorIdFromHex(fabricObject["fill"]);
            annotation_dict["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
        } else { //everything else only needs stroke
            annotation_dict["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
            annotation_dict["fill"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
        }

        var data = {annotation: JSON.stringify(annotation_dict),
                    image_pk: this.imageJson["pk"]
                   }
        $.ajax({
            type: "POST",
            url: '/xgds_image/alterAnnotation/',
            datatype: 'json',
            data: data,
            // success: function (data) {
            //     console.log('altered annotation');
            //     console.log(data);
            // },
            error: function (a) {
                console.log("Alter annotation ajax error");
                console.log(a)
            }
        });
    },

    /*
    Annotation color options are stored on the server side. Pull to js side dictionary (later loaded into color picker)
     */
    getAnnotationColors: function() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotationColors/',
            datatype: 'json',
            async: false,
            success: function (colorsJson) {
                colorsJson.forEach(function (color) {
                    xgds_image_annotation.colorsDictionary[color["id"]] = {name: color["name"], hex: color["hex"], id: color["id"]};
                });
                xgds_image_annotation.currentAnnotationColor = xgds_image_annotation.colorsDictionary[Object.keys(xgds_image_annotation.colorsDictionary)[0]].hex;
            },
            error: function (a) {
                console.log("getAnnotationColors Ajax error");
                console.log(a);
            }
        });
    },

    /*
     Given a hex, returns the django id/pk
     MUST USE # IN FRONT
     */
    getColorIdFromHex: function(hexColor) {
        for (var key in this.colorsDictionary) {
            if (xgds_image_annotation.colorsDictionary[key].hex.toString().toLowerCase() == hexColor.toString().toLowerCase()) {
                return xgds_image_annotation.colorsDictionary[key].id;
            }
        }
        throw new Error("getColorIdFromHex couldn't find a match for " + hexColor);
    },

    /*
     Populate colorsDictionary through getAnnotationColors()
     Return array for spectrum color picker palette
     Split spectrum color picker into two rows
     */
    getPaletteColors: function() {
        this.getAnnotationColors(); //now the dictionary should be full

        var retval = [];

        var row1 = [];
        var row2 = [];

        var theKeys = Object.keys(this.colorsDictionary);

        for (var i = 0; i < theKeys.length; i = i + 2) {
            row1.push(this.colorsDictionary[theKeys[i]].hex);
            if (i + 1 < theKeys.length) {
                row2.push(this.colorsDictionary[theKeys[i + 1]].hex);
            }
        }
        retval.push(row1);
        retval.push(row2);
        return retval;
    },

    // Select the currently selected annotation from the canvas and pass on to deleteAnnotation
    deleteActiveAnnotation: function() {
        // Break out if no annotation is currently selected
        if(this.overlay.fabricCanvas().getActiveObject() == null) {
            alert("Please select the annotation you would like to delete");
            return;
        }
        if (confirm("Click OK to permanently delete the selected annotation")) {
            var annotation = this.overlay.fabricCanvas().getActiveObject();
            this.deleteAnnotation(annotation);
        }
    },

    deleteAllAnnotations: function() {
        if (confirm("Click OK to permanently delete EVERYONE's annotations on this image")) {
            this.deleteAnnotation(undefined, true, true);
        }
    },

    deleteMyAnnotations: function() {
        if (confirm("Click OK to permanently delete YOUR's annotations on this image")) {
            this.deleteAnnotation(undefined, true, false);
        }
    },

    /* Delete annotation from annotationsDict and the database */
    deleteAnnotation: function(annotation, all, all_authors) {
        if (all === undefined){
            all = false;
        }
        if (all_authors === undefined){
            all = false;
        }
        var dictKey = undefined;
        var fabricCanvas = this.overlay.fabricCanvas();
        var data = {};
        var proceed = false;
        if (all){
            data['image_pk'] = this.imageJson["pk"];
            proceed = true;
        } else {
            dictKey = this.getDictKey(annotation);
            data['pk'] = annotation['pk'];
            data['type'] = annotation['type'];
            proceed = dictKey in this.annotationsDict;
        }

        data['all_authors'] = all_authors;
        if (proceed) {
            $.ajax({
                type: "POST",
                url: '/xgds_image/deleteAnnotation/',
                datatype: "json",
                data: data,
                success: function (data) {
                    if (all) {
                        if (all_authors) {
                            xgds_image_annotation.annotationsDict = {};
                            fabricCanvas.clear()
                        } else {
                            fabricCanvas.clear();
                            var kill_list = [];
                            Object.keys(xgds_image_annotation.annotationsDict).forEach(function(key) {
                                var annotation = xgds_image_annotation.annotationsDict[key];
                                if (annotation.author == current_user_pk) {
                                    kill_list.push(key);
                                } else {
                                    delete annotation['annotation'];
                                    xgds_image_annotation.addAnnotationToCanvas(annotation);
                                }
                            });
                            _.forEach(kill_list, function(key) {
                                delete xgds_image_annotation.annotationsDict[key];
                            });
                        }
                    } else {
                        fabricCanvas.remove(annotation);
                        if (_.isEqual(annotation, xgds_image_annotation.selectedFabricObject)){
                            fabricCanvas.remove(xgds_image_annotation.selectedFabricObject);
                            xgds_image_annotation.selectedFabricObject = undefined;
                        }
                        fabricCanvas.discardActiveObject();
                        delete xgds_image_annotation.annotationsDict[dictKey];
                    }
                },
                error: function (a) {
                    console.log("Error deleting annotation(s)");
                    console.log(a)
                    throw new Error("Unable to delete the annotation's entry from the database");
                }
            });
        } else {
            //annotation not saved in database anyways, just remove from canvas
            var ao = fabricCanvas.getActiveObject();
            fabricCanvas.remove(ao);
        }
    },

    /*
     Given an annotation model, add it to the canvas if not already drawn
     */
    addAnnotationToCanvas: function(annotationJson) {
        var dictKey = this.getDictKey(annotationJson);
        if (dictKey in this.annotationsDict) {
            if (!_.isUndefined(this.annotationsDict[dictKey].annotation)) {
                console.log("Annotation is already drawn on canvas, aborting load for this annotation");
                return;
            }
        } else { //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
            this.annotationsDict[dictKey] = annotationJson;
        }
        if (annotationJson["annotationType"] == "rectangle") {
            this.addRectToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "ellipse") {
            this.addEllipseToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "arrow") {
            this.addArrowToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "text") {
            this.addTextToCanvas(annotationJson);
        } else {
            throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
        }
    },

    addRectToCanvas: function(annotationJson) {
        var shape = new fabric.Rect({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: this.colorsDictionary[annotationJson["strokeColor"]].hex,
            strokeWidth: annotationJson["strokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: "",  //don't support fill
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            type: 'rectangle',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            size: annotationJson["size"]
        });
        annotationJson['annotation'] = shape;
        this.overlay.fabricCanvas().add(shape);
    },

    addEllipseToCanvas: function(annotationJson) {
        var shape = new fabric.Ellipse({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: this.colorsDictionary[annotationJson["strokeColor"]].hex,
            strokeWidth: annotationJson["strokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: "",  //don't support fill
            angle: annotationJson["angle"],
            rx: annotationJson["radiusX"],
            ry: annotationJson["radiusY"],
            type: 'ellipse',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            size: annotationJson["size"]
        });
        annotationJson['annotation'] = shape;
        this.overlay.fabricCanvas().add(shape);
    },

    addArrowToCanvas: function(annotationJson) {
        /* Arrows "stroke" color is actually their fill. Their stroke/border is always black */
        var shape = new fabric.Polygon(JSON.parse(annotationJson["points"]), {
            left: annotationJson["left"],
            top: annotationJson["top"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: this.colorsDictionary[annotationJson["fill"]].hex,
            angle: annotationJson["angle"],
            type: 'arrow',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            size: annotationJson["size"]
        });
        annotationJson['annotation'] = shape;
        this.overlay.fabricCanvas().add(shape);
    },

    addTextToCanvas: function(annotationJson) {
        var textbox_id = "text_" + annotationJson["pk"];
        var shape = new fabric.Textbox(textbox_id, {
            left: annotationJson["left"],
            top: annotationJson["top"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: this.colorsDictionary[annotationJson["fill"]].hex,
            stroke: 'white',
            strokeWidth: annotationJson["fontSize"]*0.03,
            borderColor: this.colorsDictionary[annotationJson["fill"]].hex,
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            text: annotationJson["content"],
            type: 'text',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            textAlign: 'center',
            fontFamily: 'Arial',
            fontSize: annotationJson["fontSize"],
            size: annotationJson["size"]
        });

        annotationJson['annotation'] = shape;
        this.overlay.fabricCanvas().add(shape);
    },

    turnAnnotationsOnOff: function(onOrOff) {
        var objects = xgds_image_annotation.overlay.fabricCanvas().getObjects();
        if (onOrOff == "off") {
            xgds_image_annotation.showAnnotations = "false";
            for (var i = 0; i < objects.length; i++) {
                //set all objects as invisible and lock in position
                objects[i].visible = false;
                objects[i].lockMovementX = true;
                objects[i].lockMovementY = true;
                objects[i].lockRotation = true;
                objects[i].lockScalingFlip = true;
                objects[i].lockScalingX = true;
                objects[i].lockScalingY = true;
                objects[i].lockSkewingX = true;
                objects[i].lockSkewingY = true;
                objects[i].lockUniScaling = true;
            }
        }else{
            xgds_image_annotation.showAnnotations = "true";
            //set all objects as visible and unlock
            for (var i = 0; i < objects.length; i++) {
                objects[i].visible = true;
                objects[i].lockMovementX = false;
                objects[i].lockMovementY = false;
                objects[i].lockRotation = false;
                objects[i].lockScalingFlip = false;
                objects[i].lockScalingX = false;
                objects[i].lockScalingY = false;
                objects[i].lockSkewingX = false;
                objects[i].lockSkewingY = false;
                objects[i].lockUniScaling = false;
            }
        }
        xgds_image_annotation.overlay.fabricCanvas().requestRenderAll();
    }
}); // end of namespace















