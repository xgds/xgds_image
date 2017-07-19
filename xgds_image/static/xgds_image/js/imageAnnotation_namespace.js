var xgds_image_annotation = xgds_image_annotation || {};

/*
TODO:
this vs xgds_image_annotation.
commented our mouse cursor mode stuff
disabled spectrum color picker
current status: fixing color picker. Chaning colorDictionary etc to this.colorPicker. Errors in index. Think it's from this.var/var undef
spectrum broken
events not tied because not using this?
make sure variables work in namespace... need to use this?
need to add this in front of everything good lord
 */
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

    currentAnnotationType: "arrow", //stores the type of the current annotation being drawn so we know which variable (arrow/line/rectangle/ellipse/text etc) to serialize on mouse:up

    overlay: "",

    /* Store imageJson locally */
    imageJson: "",

    /*
    Stores annotation [primary key] to [annotation json] mappings for all annotations currently drawn on the canvas {pk: annotation json}
    Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
    */
    annotationsDict: {},


    /*
    Stores a dictionary of pre-set (string)color -> (string)hex pairs.
    Loaded through ajax on document.onReady()
    */
    colorsDictionary: {},

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
    Annotation type we draw on canvas on click (arrow on default), changed by #annotationType
    */
    annotationType: "arrow",


    /*
    Default annotation color to draw annotations in
    */
    currentAnnotationColor: "white",

    toggleMenuBar: function() {
        if(this.imageAnnotationToolbarStatus=="invisible") {
            $("#imageAnnotationToolbar").show();
            this.imageAnnotationToolbarStatus="visible";
        }else{
            $("#imageAnnotationToolbar").hide();
            this.imageAnnotationToolbarStatus="invisible";
        }
    },

    initialize: function(imageJson, osdViewer) {
        //TODO from Tamar
        // imageJson.pk is the pk of the image you want to work with now.
        // if you were already initialized before, clear stuff
        // set your pk to be imageJson.pk
        // this.imagePK = imageJson.pk

        /* Clear variables (in case an image was previously loaded */
        this.annotationsDict = {};
        this.colorsDictionary = {};

        console.log("this.imageJson")
        console.log(this.imageJson["pk"]);
        console.log("imageJson (argument)");
        console.log(imageJson["pk"]);
        if(this.imageJson["pk"] == imageJson["pk"]) {
            console.log("Trying to load the same image again!");
        }

        this.imageJson = imageJson;
        this.viewer = osdViewer;
        this.overlay = this.viewer.fabricjsOverlay();

        this.currentAnnotationType = "arrow";
        this.mouseMode = "OSD";
        this.annotationType = "arrow";
        this.currentAnnotationColor = "white";
        this.imageAnnotationToolbarStatus = "invisible";

        // Set toolbar as invisible
        // $("#imageAnnotationToolbar").hide();

        // color picker
        var spectrumOptions = {
            showPaletteOnly: true,
            showPalette: true,
            palette: xgds_image_annotation.getPaletteColors(),
            color: this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].hex //set default color as the "first" key in colorsDictionary
        };
        console.log("palette");
        console.log(xgds_image_annotation.getPaletteColors());
        $("#colorPicker").spectrum(spectrumOptions);



        /****************************************************************************************************************

                                             E V E N T  L I S T E N E R S

        *****************************************************************************************************************/
        //event listeners
        // fabricJS mouse-down event listener

        this.overlay.fabricCanvas().observe('mouse:down', function (o) {
            console.log("EVENT TRIGERRED: fabricj-mouse:down");
            var pointer = xgds_image_annotation.overlay.fabricCanvas().getPointer(o.e);
            console.log("mousedown: " + "(" + pointer.y + ", " + pointer.x + ")");
            // console.log("EVENT TRIGERRED: fabricjs-mouse:down");
            console.log("mouse mode is " + xgds_image_annotation.getMouseMode());
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
                        // initializeText(pointer.x, pointer.y);
                        xgds_image_annotation.initializeTextboxPreview(pointer.x, pointer.y);
                        break;
                    default:
                        console.log("welp, that shouldn't have happened. Undefined annotationType");
                        console.log("The undefined type entered is: " + this.annotationType);
                        throw new Error("Tried to switch to an undefined annotationType");
                }
            }
        });

        //fabricJS mouse-move event listener
        this.overlay.fabricCanvas().observe('mouse:move', function (o) {
            console.log("EVENT TRIGERRED: fabricj-mouse:move");
            if (!xgds_image_annotation.isDown) return;
            var pointer = xgds_image_annotation.overlay.fabricCanvas().getPointer(o.e);
            switch (xgds_image_annotation.annotationType) {
                case "arrow":
                    xgds_image_annotation.updateArrow(pointer.x, pointer.y);
                    break;
                case "rectangle":
                    xgds_image_annotation.updateRectangleWidth(pointer.x, pointer.y);
                    break;
                case "ellipse":
                    xgds_image_annotation.updateEllipse(pointer.x, pointer.y);
                    break;
                case "text":
                    xgds_image_annotation.updateTextboxPreview(pointer.x, pointer.y);
                    break;
                default:
                    console.log("welp, that shouldn't have happened. Undefined annotationType");
                    throw new Error("Tried to switch to an undefined annotationType");
            }
            xgds_image_annotation.overlay.fabricCanvas().renderAll();
        });

        /* event listener that handles resizing the textbox based on amount of text */
        this.overlay.fabricCanvas().on('text:changed', function (opt) {
            var t1 = opt.target;
            if (t1.width > t1.fixedWidth) {
                t1.fontSize *= t1.fixedWidth / (t1.width + 1);
                t1.width = t1.fixedWidth;
            }
        });

        //fabricJS mouse-up event listener
        this.overlay.fabricCanvas().on('mouse:up', function (o) {
            console.log("EVENT TRIGERRED: fabricj-mouse:up");
            if (xgds_image_annotation.getMouseMode() == "addAnnotation") {
                var pointerOnMouseUp = xgds_image_annotation.overlay.fabricCanvas().getPointer(event.e);

                // save annotation to database
                xgds_image_annotation.createNewSerialization(xgds_image_annotation.currentAnnotationType, pointerOnMouseUp.x, pointerOnMouseUp.y);

                // If we just added a textbox, stay in edit mode so the user can edit. Otherwise, return to OSD navigation mode.
                if(xgds_image_annotation.currentAnnotationType.type == "text") {
                    xgds_image_annotation.setMouseMode("editAnnotation");
                    $("#editAnnotation").click(); //set nav bar to editAnnotation
                }else{
                    xgds_image_annotation.setMouseMode("OSD");
                    $("#navigateImage").click(); // change nav bar back to OSD (navigateImage)
                }
            }
            xgds_image_annotation.isDown = false;
        });

        this.overlay.fabricCanvas().on('object:modified', function () {
            xgds_image_annotation.updateSerialization(xgds_image_annotation.overlay.fabricCanvas().getActiveObject());
        });

        $("input[name='cursorMode']").change(function () {
            // console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
            var mode = $("input[name='cursorMode']:checked").val();
            xgds_image_annotation.setMouseMode(mode);
        });

        $("input[name='annotationsOnOrOff']").change(function () {
            var onOff = $("input[name='annotationsOnOrOff']:checked").val();
            var objects = xgds_image_annotation.overlay.fabricCanvas().getObjects();
            if (onOff == "off") {
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
            } else {
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
            xgds_image_annotation.overlay.fabricCanvas().renderAll();
        });

        $("input[name='annotationType']").change(function () {
            // console.log("annotationType change detected: " + $("input[name='annotationShape']:checked").val());
            xgds_image_annotation.annotationType = $("input[name='annotationType']:checked").val();
            console.log("annotation shape changed to: " + xgds_image_annotation.annotationType);
        });

        $("#addAnnotation").click(function () {
            console.log("Add annotation button clicked");
            xgds_image_annotation.setMouseMode("addAnnotation");
        });

        $('#loadAnnotation').click(function () {
            xgds_image_annotation.getAnnotations();
        });

        $('#downloadScreenshot').click(function () {
            var OSD_layer = xgds_image_annotation.viewer.drawer.canvas.toDataURL("image/png");
            var annotations = xgds_image_annotation.overlay.fabricCanvas().toDataURL({format: 'image/png'});

            $.ajax({
                type: "POST",
                url: '/xgds_image/mergeImages/',
                datatype: 'json',
                data: {
                    image1: OSD_layer,
                    image2: annotations
                },
                success: function (base64string) {  //do we have to index data?
                    console.log("IMAGE MERGE SUCCESS");
                    window.open("data:image/png;base64," + base64string);
                    // put in image tag and see if black bars/transparency still there
                    var img = new Image();
                    img.src = "data:image/png;base64," + base64string;

                    // $('#downloadImagePreview').prepend('<img id="imgPreview" src=img />')
                    document.getElementById('downloadImagePreview').src="data:image/png;base64," + base64string;
                    $('#my_image').attr('src', "data:image/png;base64," + base64string);
                    $('#my_image').width(800);
                },
                error: function (e) {
                    console.log("Ajax error");
                    console.log(e);
                }
            });
        });

        $('#deleteAnnotation').click(function () {
            xgds_image_annotation.deleteActiveAnnotations();
        });

        $("#colorPicker").on('change.spectrum', function (e, color) {
            xgds_image_annotation.currentAnnotationColor = color.toHexString(); //convert to hex
            console.log("currentAnnotationColor is: " + xgds_image_annotation.currentAnnotationColor);
        });

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
        this.ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 25,
            stroke: this.currentAnnotationColor,
            fill: '',
            selectable: true,
            originX: 'center',
            originY: 'center',
            scaleX: 1,
            scaleY: 1,
            type: 'ellipse'
        });
        this.currentAnnotationType = this.ellipse
        this.overlay.fabricCanvas().add(this.ellipse);
    },

    updateEllipse: function(x, y) {
        var distance = this.distanceFormula(x, y, this.origX, this.origY);
        this.ellipse.set({rx: Math.abs(this.origX - x), ry: Math.abs(this.origY - y)});
        this.currentAnnotationType = this.ellipse
    },

    initializeRectangle: function(x, y) {
         this.rectangle = new fabric.Rect({
            left: x,
            top: y,
            fill: '',
            strokeWidth: 25,
            stroke: this.currentAnnotationColor,
            width: 1,
            height: 1,
            scaleX: 1,
            scaleY: 1,
            type: 'rect'
        });
        this.currentAnnotationType = this.rectangle;
        this.overlay.fabricCanvas().add(this.rectangle);
    },

    updateRectangleWidth: function(x, y) {
        var width = Math.abs(x - this.origX);
        var height = Math.abs(y - this.origY);
        this.rectangle.set({width: width, height: height});
        this.currentAnnotationType = this.rectangle;
    },

    initializeTextboxPreview: function(x, y) {
       this.textboxPreview = new fabric.Rect({
           left: x,
           top: y,
           fill: "",
           strokeWidth: 25,
           stroke: this.currentAnnotationColor,
           width: 1,
           height: 1,
           type: 'textboxPreview'
       });
       this.currentAnnotationType = this.textboxPreview;
       this.overlay.fabricCanvas().add(this.textboxPreview);
    },

    updateTextboxPreview: function(x, y) {
        var width = Math.abs(x - this.origX);
        var height = Math.abs(y - this.origY);
        this.textboxPreview.set({width: width, height: height});
        this.currentAnnotationType = this.textboxPreview;
    },

    /*
     Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
     computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
     really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
     */
    drawArrow: function(x, y) {
        var headlen = 100;  // arrow head size
        this.arrow = new fabric.Polyline(this.calculateArrowPoints(this.origX, this.origY, x, y, headlen), {
            fill: this.currentAnnotationColor,
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            scaleX: 1,
            scaleY: 1,
            selectable: true,
            type: 'arrow'
        });
        this.currentAnnotationType = this.arrow;
        this.overlay.fabricCanvas().add(this.arrow);
    },

    updateArrow: function(x, y) {
        var headlen = 100; //arrow head size
        this.overlay.fabricCanvas().remove(this.arrow);
        var angle = Math.atan2(y - this.origY, x - this.origX);

        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        // calculate the points.
        var pointsArray = this.calculateArrowPoints(x, y, headlen);
        this.arrow = new fabric.Polyline(pointsArray, {
            fill: this.currentAnnotationColor,
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        this.currentAnnotationType = this.arrow;
        this.overlay.fabricCanvas().add(this.arrow);
        this.overlay.fabricCanvas().renderAll();
    },

    calculateArrowPoints: function(x, y, headlen) {
        var angle = Math.atan2(y - this.origY, x - this.origX);
        var headlen = 100;  // arrow head size
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

    // support functions
    //sets if you can interact with objects on the fabricjs canvas
    setFabricCanvasInteractivity: function(boolean) {
         this.overlay.fabricCanvas().forEachObject(function (object) {
            object.selectable = boolean;
        });
    },

    deselectFabricObjects: function(){
        this.overlay.fabricCanvas().deactivateAll().renderAll();
    },

    setMouseMode: function(mode) {
        switch (mode) {
            case "OSD":
                console.log("mousemode: OSD");
                this.mouseMode = "OSD";
                this.setFabricCanvasInteractivity(false);
                this.deselectFabricObjects();
                this.viewer.setMouseNavEnabled(true);
                // $('#viewerWrapper').css('cursor', 'crosshair');
                // document.getElementById("viewerWrapper").style.cursor = "crosshair";
                break;
            case "addAnnotation":
                console.log("mousemode: addAnnotation");
                this.mouseMode = "addAnnotation";
                this.setFabricCanvasInteractivity(false);
                this.deselectFabricObjects();
                this.viewer.setMouseNavEnabled(false); //if we're in addAnnotation mode, don't set isDown to true -- actually, ONLY set to true if mode is addAnnotation
                break;
            case "editAnnotation":
                console.log("mousemode: editAnnotation");
                this.mouseMode = "editAnnotation";
                this.setFabricCanvasInteractivity(true);
                // $('#viewerWrapper').css('cursor', 'wait');
                // document.getElementById("viewerWrapper").style.cursor = "pointer";
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

    duplicateObject: function(object) {
        var objectCopy = {
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
            rx: object["rx"],
            ry: object["ry"],
            height: object["height"],
            width: object["width"],
            pk: object["pk"],
            image: object["image"]
        };
        return objectCopy;
    },

    getAnnotations: function() {
        var imagePK = this.imageJson["pk"];
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotations/' + imagePK,
            datatype: 'json',
            success: function (data) {
                console.log("retrieved data");
                console.log(data);
                data.forEach(function (annotation) {
                    //convert django pk/id to hex color
                    console.log(annotation);
                    // annotation["stroke"] = colorsDictionary[annotation["strokeColor"]].hex;
                    xgds_image_annotation.addAnnotationToCanvas(annotation);
                });
            },
            error: function (a) {
                console.log(a);
            }
        });
    },

    createNewSerialization: function(fabricObject, x, y) {
        if (fabricObject.type == "textboxPreview") {
            this.text = new fabric.Textbox('MyText', {
                width: x - this.origX,
                top: this.origY,
                left: this.origX,
                fontSize: 100,
                stroke: this.currentAnnotationColor,
                fill: this.currentAnnotationColor,
                borderColor: this.currentAnnotationColor,
                textAlign: 'center',
                scaleX: 1,
                scaleY: 1,
                type: 'text'
            });
            // debugger;
            this.currentAnnotationType = this.text;
            this.overlay.fabricCanvas().add(this.text);
            this.textboxPreview.remove();
            fabricObject = this.text;
        }
        console.log(fabricObject);

        var temp = this.duplicateObject(fabricObject);
        if(fabricObject.type == "arrow") { //arrow only needs fill
            temp["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
            temp["stroke"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load

        }else if (fabricObject.type == "text") { //text needs both stroke and fill
             temp["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
             temp["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
        } else { //everything else only needs stroke
            temp["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
            temp["fill"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
        }

        console.log("add annotation dump");
        console.log(temp);

        $.ajax({
            type: "POST",
            url: '/xgds_image/addAnnotation/',
            datatype: 'json',
            data: {
                annotation: JSON.stringify(temp),
                image_pk: this.imageJson["pk"]
            },
            success: function (data) {
                fabricObject.set({pk: data["pk"], image: data["image_pk"]});
            },
            error: function (e) {
                console.log("Ajax error");
                console.log(e);
            }
        });
    },

    updateSerialization: function(fabricObject) {
        var temp = this.duplicateObject(fabricObject);

        if(fabricObject.type == "arrow") { //arrow only needs fill
            temp["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
            temp["stroke"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load

        }else if (fabricObject.type == "text") { //text needs both stroke and fill
            temp["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
            temp["fill"] = this.getColorIdFromHex(fabricObject["fill"]);
        } else { //everything else only needs stroke
            temp["stroke"] = this.getColorIdFromHex(fabricObject["stroke"]);
            temp["fill"] = this.colorsDictionary[Object.keys(this.colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
        }

        console.log("alter annotation dump");
        console.log(temp);
        console.log(JSON.stringify(temp));
        $.ajax({
            type: "POST",
            url: '/xgds_image/alterAnnotation/',
            datatype: 'json',
            data: {
                //annotation: Json.stringify(fabricObject),
                annotation: JSON.stringify(temp),
                image_pk: this.imageJson["pk"]
            },
            success: function (data) {

            },
            error: function (a) {
                console.log("Ajax error");
                console.log(a)
            }
        });
    },

    getAnnotationColors: function() {
        console.log("JSON response w/ color dictionary incoming");
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotationColors/',
            datatype: 'json',
            async: false,
            success: function (colorsJson) {
                console.log("raw annotations json dump " + colorsJson);
                console.log(colorsJson);
                colorsJson.forEach(function (color) {
                    xgds_image_annotation.colorsDictionary[color["id"]] = {name: color["name"], hex: color["hex"], id: color["id"]};
                });
                xgds_image_annotation.currentAnnotationColor = xgds_image_annotation.colorsDictionary[Object.keys(xgds_image_annotation.colorsDictionary)[0]].hex;
                // can't use this to refer to xgds_image_annotation object in ajax block?
            },
            error: function (a) {
                console.log("Ajax error");
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
     */
    getPaletteColors: function() {
        this.getAnnotationColors(); //now the dictionary should be full

        var retval = [];

        var row1 = [];
        var row2 = [];

        var theKeys = Object.keys(this.colorsDictionary);

        for (var i = 0; i < theKeys.length; i = i + 2) {
            // console.log("row : " + i + ': ' +  colorsDictionary[theKeys[i]].hex);
            row1.push(this.colorsDictionary[theKeys[i]].hex);
            if (i + 1 < theKeys.length) {
                row2.push(this.colorsDictionary[theKeys[i + 1]].hex);
            }
        }
        retval.push(row1);
        retval.push(row2);
        return retval;
    },

    deleteActiveAnnotations: function() {
        var annotation = this.overlay.fabricCanvas().getActiveObject();
        if (annotation["pk"] in this.annotationsDict) {
            $.ajax({
                type: "POST",
                url: '/xgds_image/deleteAnnotation/',
                datatype: "json",
                data: {
                    pk: annotation["pk"]
                },
                success: function (data) {
                    console.log(data);
                },
                error: function (a) {
                    console.log("Ajax error");
                    console.log(a)
                    throw new Error("Unable to delete the annotation's entry from the database");
                }
            });

            //delete from dict and database
            delete this.annotationsDict[annotation["pk"]];
            this.overlay.fabricCanvas().getActiveObject().remove();
        } else {
            //annotation not saved in database anyways, just remove from canvas
            this.overlay.fabricCanvas().getActiveObject().remove();
        }
    },

    /*
     Given an annotation model, add it to the canvas
     */
    addAnnotationToCanvas: function(annotationJson) {
        if (annotationJson["pk"] in this.annotationsDict) {
            console.log("Annotation is already drawn on canvas, aborting load for this annotation");
            return;
        } else { //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
            this.annotationsDict[annotationJson["pk"]] = annotationJson;
        }
        if (annotationJson["annotationType"] == "Rectangle") {
            this.addRectToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "Ellipse") {
            this.addEllipseToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "Arrow") {
            this.addArrowToCanvas(annotationJson);
        } else if (annotationJson["annotationType"] == "Text") {
            this.addTextToCanvas(annotationJson);
        } else {
            throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
        }
    },


    addRectToCanvas: function(annotationJson) {
        this.rect = new fabric.Rect({
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
            type: 'rect',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        this.overlay.fabricCanvas().add(this.rect);
        this.overlay.fabricCanvas().renderAll();
    },

    addEllipseToCanvas: function(annotationJson) {
        this.ellipse = new fabric.Ellipse({
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
            image: annotationJson["image"]
        });
        this.overlay.fabricCanvas().add(this.ellipse);
        this.overlay.fabricCanvas().renderAll();
    },

    addArrowToCanvas: function(annotationJson) {
        /* Arrows "stroke" is actually their fill. Their stroke/border is always black */
        this.arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: 'black',
            strokeWidth: annotationJson["strokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: this.colorsDictionary[annotationJson["fill"]].hex,
            angle: annotationJson["angle"],
            type: 'arrow',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        console.log("image and pk pls");
        this.overlay.fabricCanvas().add(this.arrow);
        this.overlay.fabricCanvas().renderAll();
    },

    addTextToCanvas: function(annotationJson) {
        console.log("text annotation object");
        console.log(annotationJson);
        this.text = new fabric.Textbox("hello world", {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: this.colorsDictionary[annotationJson["strokeColor"]].hex,
            strokeWidth: annotationJson["strokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: this.colorsDictionary[annotationJson["fill"]].hex,
            borderColor: this.colorsDictionary[annotationJson["fill"]].hex,
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            text: annotationJson["content"], //text should be the right field here //todonow: this may be the wrong thing to call it.
            type: 'text',
            scaleX: annotationJson["scaleX"],
            scaleY: annotationJson["scaleY"],
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            textAlign: 'center',
            fontSize: 100 //Font size is static for now
        });

        this.overlay.fabricCanvas().add(this.text);
        this.overlay.fabricCanvas().renderAll();
    }
}); // end of namespace


$(window).on( "load", function() {
// $(document).ready(function () {

});

    /*  Global Variables  */
    //fabricjs-openseadragon annotation object





/*
Nice Stuff
Make textboxes nicer
Make cursor cooporate

tie menu to controls
can't click annotations -- seems like fabricCanvas sometimes goes behind the OSD canvas. Occlusion of sorts.
just a lot of cleaning up in general needed


Add lines:

function initializeLine(x, y) {
    line = new fabric.Line([x, y, x, y], {
        left: x,
        top: y,
        stroke: "red",
        strokeWidth: 25,
        originX: 'center',
        originY: 'center',
        type: 'line'
    });
    currentAnnotationType = line;
    overlay.fabricCanvas().add(line)
}

function updateLineEndpoint(x, y) {
    line.set({x2: x, y2: y});
    currentAnnotationType = line;
}

TODO: Can either implement scaling saving or prevent scaling and just create a new shape

TEXTBOX STUFF
TODO: select text after adding it to canvas, stay in edit mode
TODO: add blank lines to text to make rectangle the right size <-- this one really annoys me but seems quite annoying to fix as well
TODO: add intuitive mouse controls <-- for some reason mousemode isn't responding in the openseadragon viewer
TODO: yellow box, scale text, insert text here


COLOR STUFF
TODO: rn arrows stroke is BLACK, instaed of currentAnnotationColor. Throws off getColorIdFromHex()
TODO: set default color annotation to be white--instead it should be colorDictionary[0].name
TODO: make sure all colors are in canonical form (e.g. rgb(r,g,b))

CURSOR STUFF
TODO: inspect element and see if pointer/cursor mode is actually being attached

EXPORT AS IMAGE
**TODO: export canvas as an image

Right now we have two images. Annotations w/ transparent background and the OSD view. Can either try to set background on the fabricjs canvas and export that
OR blend the two images.


MISCELLANEOUS
***TODO: de-hardcode image_pk
TODO: Standardize initialization settings
TODO: xgds_image_annotation namespace
TODO: ask tamar how to organize... all of this
TODO: add css
****TODO: image_pk automation



TODO: LATER
TODO: something wacko is happenign with stroke color in models
TODO: release as an open source plugin
TODO: rect vs rectangle (ugh fabricjs uses rect)
TODO: namespace/organize all of this to be opensourceable <--- events section in spectrumjs has a good example

TODO: monitor
TODO: prototyping/javascript namespace
TODO: wacko rectangle drawing behavior
TODO: add try catch to views.py
TODO: clean up JSONresponse vs HTTP response


SHOULD BE RESOLVED BUT KEEP AN EYE OUT
TODO: Navigate Image/Edit Annotations kinda glitchy -- maybe make a "set mode" function that will take care of the gui as well as the mode.

 */




















