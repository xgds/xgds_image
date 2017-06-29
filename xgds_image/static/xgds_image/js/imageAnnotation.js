var xgds_image_annotation = xgds_image_annotation || {};

$.extend(xgds_image_annotation, {
    initialize: function (imageJson, osdViewer) {
        //imageJson.pk is the pk of the image you want to work iwth now.
        // if you were already initialized before, clear stuff
        // set your pk to be imageJson.pk
        this.imagePK = imageJson.pk;
    }
});


var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
var viewer = OpenSeadragon({
    id: "openseadragon1",
    prefixUrl: prefixUrl,
    showNavigator: false,
    gestureSettingsMouse: {
        clickToZoom: false
    },
    clickToZoom: "false",
    tileSources: [{
        Image: {
            //Need to change [tile_format="jpg", image_quality=0.85,]
            //Plus any other changes in deepzoom.py we make
            xmlns: "http://schemas.microsoft.com/deepzoom/2009",
            Url: "../../../../data/images/spacePics/ISS044-E-1998_files/",
            TileSize: "128",
            Overlap: "2",
            Format: "png",
            ServerFormat: "Default",
            Size: {
                Width: "4928",
                Height: "3280",
            }
        }
    }],
});

//fabricjs-openseadragon annotation object
var overlay = viewer.fabricjsOverlay();
var arrow, line, rectangle, circle, ellipse, text, isDown, textboxPreview, origX, origY;
var currentAnnotationType = "arrow"; //stores the type of the current annotation being drawn so we know which varaible (arrow/line/rectangle/ellipse/text etc) to serialize on mouse:up

/*
 Stores annotation primary key to annotation json mappings for all annotations currently drawn on the canvas {pk: annotation json}
 Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
 */
var annotationsDict = {};

/*
 Stores a dictionary of pre-set (string)color -> (string)hex pairs.
 Loaded through ajax on document.onReady()
 */
var colorsDictionary = {};


/* the mouse can be in 3 modes:
 1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
 2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
 3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw on clicK)
 getters and setters are below
 */
var mouseMode = "OSD";

/*
 Annotation type we draw on canvas on click (arrow on default), changed by #annotationType
 */
var annotationType = "arrow";

/*
 Default annotation color to draw annotations in
 */
var currentAnnotationColor = "white";

$(document).ready(function () {
    //color picker
    var spectrumOptions = {
        showPaletteOnly: true,
        showPalette: true,
        palette: getPaletteColors(),
        color: colorsDictionary[Object.keys(colorsDictionary)[0]].hex //set default color as the "first" key in colorsDictionary
    };
    $("#colorPicker").spectrum(spectrumOptions);
});

/****************************************************************************************************************

 A N N O T A T I O N S (Initializers and Updaters)

 *****************************************************************************************************************/
//annotations
//Euclidean distance between (x1,y1) and (x2,y2)
function distanceFormula(x1, y1, x2, y2) {
    var xDist = Math.pow((x1 - x2), 2);
    var yDist = Math.pow((y1 - y2), 2);
    return Math.sqrt(xDist + yDist);
}

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

function initializeEllipse(x, y) {
    ellipse = new fabric.Ellipse({
        left: x,
        top: y,
        radius: 1,
        strokeWidth: 25,
        stroke: currentAnnotationColor,
        fill: '',
        selectable: true,
        originX: 'center',
        originY: 'center',
        type: 'ellipse'
    });
    currentAnnotationType = ellipse
    overlay.fabricCanvas().add(ellipse);
}

function updateEllipse(x, y) {
    var distance = distanceFormula(x, y, origX, origY);
    ellipse.set({rx: Math.abs(origX - x), ry: Math.abs(origY - y)});
    currentAnnotationType = ellipse
}

function initializeCircle(x, y) {
    circle = new fabric.Circle({
        left: x,
        top: y,
        radius: 1,
        strokeWidth: 25,
        stroke: currentAnnotationColor,
        fill: '',
        selectable: true,
        originX: 'center',
        originY: 'center',
        type: 'circle'
    });
    currentAnnotationType = circle;
    overlay.fabricCanvas().add(circle);
}

//TODO: should I update the circle member variable automatically or pass in the object to modify?
function updateCircleRadius(x, y, origX, origY) {
    var radius = distanceFormula(x, y, origX, origY);
    circle.set({radius: radius});
    currentAnnotationType = circle;
}

function initializeRectangle(x, y) {
    rectangle = new fabric.Rect({
        left: x,
        top: y,
        fill: '',
        strokeWidth: 25,
        stroke: currentAnnotationColor,
        width: 1,
        height: 1,
        type: 'rect'
    });
    currentAnnotationType = rectangle;
    overlay.fabricCanvas().add(rectangle);
}

function updateRectangleWidth(x, y) {
    var width = Math.abs(x - origX);
    var height = Math.abs(y - origY);
    rectangle.set({width: width, height: height});
    currentAnnotationType = rectangle;
}

function initializeTextboxPreview(x, y) {
    textboxPreview = new fabric.Rect({
        left: x,
        top: y,
        fill: "",
        strokeWidth: 25,
        stroke: currentAnnotationColor,
        width: 1,
        height: 1,
        type: 'textboxPreview'
    });

    currentAnnotationType = textboxPreview;
    overlay.fabricCanvas().add(textboxPreview);
}

function updateTextboxPreview(x, y) {
    var width = Math.abs(x - origX);
    var height = Math.abs(y - origY);
    textboxPreview.set({width: width, height: height});
    currentAnnotationType = textboxPreview
}

function initializeText(x, y) {
    text = new fabric.Textbox('MyText', {
        width: 150,
        top: y,
        left: x,
        fontSize: 100,
        textAlign: 'center',
        type: 'text'
    }); //TODO: remove the fixed width stuff
    currentAnnotationType = text;
    overlay.fabricCanvas().add(text);
}

function updateTextContent(x, y) {
    var width = Math.abs(x - origX);
    var height = Math.abs(y - origY);
    text.set({width: width, height: height})
    currentAnnotationType = text;
}

/*
 Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
 computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
 really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
 */

function drawArrow(x, y) {
    var headlen = 100;  // arrow head size
    arrow = new fabric.Polyline(calculateArrowPoints(origX, origY, x, y, headlen), {
        fill: currentAnnotationColor,
        stroke: 'black',
        opacity: 1,
        strokeWidth: 2,
        originX: 'left',
        originY: 'top',
        selectable: true,
        type: 'arrow'
    });
    currentAnnotationType = arrow;
    overlay.fabricCanvas().add(arrow);
}

function updateArrow(x, y) {
    var headlen = 100; //arrow head size
    overlay.fabricCanvas().remove(arrow)
    var angle = Math.atan2(y - origY, x - origX);

    // bring the line end back some to account for arrow head.
    x = x - (headlen) * Math.cos(angle);
    y = y - (headlen) * Math.sin(angle);

    // calculate the points.
    var pointsArray = calculateArrowPoints(x, y, headlen);
    arrow = new fabric.Polyline(pointsArray, {
        fill: currentAnnotationColor,
        stroke: 'black',
        opacity: 1,
        strokeWidth: 2,
        originX: 'left',
        originY: 'top',
        selectable: true,
        type: 'arrow'
    });
    currentAnnotationType = arrow;
    overlay.fabricCanvas().add(arrow);
    overlay.fabricCanvas().renderAll();
}

function calculateArrowPoints(x, y, headlen) {
    var angle = Math.atan2(y - origY, x - origX);
    var headlen = 100;  // arrow head size
    // bring the line end back some to account for arrow head.
    x = x - (headlen) * Math.cos(angle);
    y = y - (headlen) * Math.sin(angle);

    var points = [
        {
            x: origX,  // start point
            y: origY
        }, {
            x: origX - (headlen / 4) * Math.cos(angle - Math.PI / 2),
            y: origY - (headlen / 4) * Math.sin(angle - Math.PI / 2)
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
            x: origX - (headlen / 4) * Math.cos(angle + Math.PI / 2),
            y: origY - (headlen / 4) * Math.sin(angle + Math.PI / 2)
        }, {
            x: origX,
            y: origY
        }
    ];
    return points;
}

/****************************************************************************************************************

 E V E N T  L I S T E N E R S

 *****************************************************************************************************************/
//event listeners
//fabricJS mouse-down event listener
overlay.fabricCanvas().observe('mouse:down', function (o) {
    // console.log("EVENT TRIGERRED: fabricjs-mouse:down");
    console.log("mouse mode is " + getMouseMode());
    if (getMouseMode() == "addAnnotation") {
        isDown = true;
        var pointer = overlay.fabricCanvas().getPointer(o.e);
        origX = pointer.x;
        origY = pointer.y;

        switch (annotationType) {
            case "arrow":
                drawArrow(pointer.x, pointer.y); //TODO: change this to agree with naming scheme
                break;
            case "rectangle":
                initializeRectangle(pointer.x, pointer.y);
                break;
            case "ellipse":
                initializeEllipse(pointer.x, pointer.y);
                break;
            case "text":
                // initializeText(pointer.x, pointer.y);
                initializeTextboxPreview(pointer.x, pointer.y);
                break;
            default:
                console.log("welp, that shouldn't have happened. Undefined annotationType");
                throw new Error("Tried to switch to an undefined annotationType");
        }
    }
});

//fabricJS mouse-move event listener
overlay.fabricCanvas().observe('mouse:move', function (o) {
    if (!isDown) return;
    var pointer = overlay.fabricCanvas().getPointer(o.e);

    switch (annotationType) {
        case "arrow":
            updateArrow(pointer.x, pointer.y); //TODO: change this to agree with naming scheme
            break;
        case "rectangle":
            updateRectangleWidth(pointer.x, pointer.y);
            break;
        case "ellipse":
            updateEllipse(pointer.x, pointer.y);
            break;
        case "text":
            // updateTextContent(pointer.x, pointer.y);
            updateTextboxPreview(pointer.x, pointer.y);
            break;
        default:
            console.log("welp, that shouldn't have happened. Undefined annotationType");
            throw new Error("Tried to switch to an undefined annotationType");
    }
    overlay.fabricCanvas().renderAll();
});

/* event listener that handles resizing the textbox based on amount of text */
overlay.fabricCanvas().on('text:changed', function (opt) {
    var t1 = opt.target;
    if (t1.width > t1.fixedWidth) {
        t1.fontSize *= t1.fixedWidth / (t1.width + 1);
        t1.width = t1.fixedWidth;
    }
});

//fabricJS mouse-up event listener
overlay.fabricCanvas().on('mouse:up', function (o) {
    // console.log("EVENT TRIGERRED: fabricj-mouse:up");
    if (getMouseMode() == "addAnnotation") {
        //need to draw textbox here
        var pointerOnMouseUp = overlay.fabricCanvas().getPointer(event.e);
        createNewSerialization(currentAnnotationType, pointerOnMouseUp.x, pointerOnMouseUp.y);
        setMouseMode("OSD");
        $("#navigateImage").click();
        //             $("input[name='cursorMode']").prop('checked, ')
        //               var mode = $("input[name='cursorMode']:checked").val();
        //               $('.myCheckbox').prop('checked', true);
        // $('.myCheckbox').prop('checked', false);

    }
    isDown = false;
});

$("input[name='cursorMode']").change(function () {
    console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
    var mode = $("input[name='cursorMode']:checked").val();
    setMouseMode(mode);
});

$("input[name='annotationsOnOrOff']").change(function () {
    var onOff = $("input[name='annotationsOnOrOff']:checked").val();
    var objects = overlay.fabricCanvas().getObjects();
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
    overlay.fabricCanvas().renderAll();
});

$("input[name='annotationType']").change(function () {
    // console.log("annotationType change detected: " + $("input[name='annotationShape']:checked").val());
    annotationType = $("input[name='annotationType']:checked").val();
    console.log("annotation shape changed to: " + annotationType);
});

overlay.fabricCanvas().on('object:modified', function () {
    updateSerialization(overlay.fabricCanvas().getActiveObject());
});

$("#addAnnotation").click(function () {
    setMouseMode("addAnnotation");
});

//TODO: rename
$('#loadAnnotation').click(function () {
    deserializeFromJSON();
});

$('#saveAnnotation').click(function () {
    // serializeToJSON();
    //TODONOW: set background as correct image
    var img1 = viewer.drawer.canvas.toDataURL("image/png");
    var img2 = overlay.fabricCanvas().toDataURL({format: 'image/png'});

    // window.open(img1);
    // window.open(overlay.fabricCanvas().toDataURL({format: 'image/png'}));

    console.log("INITIAL IMAGE SIZES")
    console.log(img1.length);
    console.log(img2.length);


    $.ajax({
        type: "POST",
        url: '/xgds_image/mergeImages/',
        datatype: 'json',
        data: {
            image1: img1,
            image2: img2
        },
        success: function (data) {
            console.log("IMAGE MERGE SUCCESS");
            console.log(data.length);

            console.log("logged data");

            var dataURI = "data:image/png;base64," + data;
            window.open(dataURI);
        },
        error: function (e) {
            console.log("Ajax error");
            console.log(e);
        }
    });


    // overlay.fabricCanvas().setBackgroundColor({source: img}, overlay.fabricCanvas().renderAll.bind(overlay.fabricCanvas()));
    // overlay.fabricCanvas().setBackgroundColor({source: 'https://localhost/static/basaltApp/css/logo.png'}, overlay.fabricCanvas().renderAll.bind(overlay.fabricCanvas()));

    // var img = new Image();
    // img.setAttribute('crossOrigin', 'anonymous');
    // img.src = "http://fabricjs.com/assets/escheresque_ste.png";
    // overlay.fabricCanvas().setBackgroundColor({source: img}, overlay.fabricCanvas().renderAll.bind(overlay.fabricCanvas()));

    //TODO: remove background image here
    console.log("blow on past taht error");
});

$('#deleteAnnotation').click(function () {
    deleteActiveAnnotation();
});

$('#saveImage').click(function () {
    var img = new Image();
    // img.onload = function(){
    //    overlay.fabricCanvas().setBackgroundImage(img.src, overlay.fabricCanvas().renderAll.bind(canvas), {
    //             originX: 'left',
    //             originY: 'top',
    //             left: 0,
    //             top: 0
    //     });
    // };
    // img.src = "http://fabricjs.com/assets/escheresque_ste.png";

    //gets the annotations
    // window.open(overlay.fabricCanvas().toDataURL({format: 'image/png'}));
    var annotation = overlay.fabricCanvas().toDataURL({format: 'image/png'});

    //gets the OSD image
    var osdView = viewer.drawer.canvas.toDataURL("image/png");

    //somehow blend
    var canvas = document.getElementById("openseadragon-container");
    var context = canvas.getContext('2d');

    var imageObj1 = new Image();
    imageObj1.src = annotation;
    imageObj1.onload = function () {
        context.drawImage(imageObj1, x, y);
    };

    var imageObj2 = new Image();
    imageObj2.src = osdView;
    imageObj2.onload = function () {
        context.drawImage(imageObj2, x, y);
    };


    //open
    // window.open(canvas.toDataURL());


    // var data = overlay.fabricCanvas().toDataURL({format:'png'});
    // var img = new Image();
    // img.src = data;
    // window.open(img);
})

$("#colorPicker").on('change.spectrum', function (e, color) {
    currentAnnotationColor = color.toHexString(); //convert to hex
    console.log("currentAnnotationColor is: " + currentAnnotationColor);

});

//sets if you can interact with objects on the fabricjs canvas
function setFabricCanvasInteractivity(boolean) {
    overlay.fabricCanvas().forEachObject(function (object) {
        object.selectable = boolean;
    });
}

function deselectFabricObjects() {
    overlay.fabricCanvas().deactivateAll().renderAll();
}

function setMouseMode(mode) {
    switch (mode) {
        case "OSD":
            console.log("mousemode: OSD");
            mouseMode = "OSD";
            setFabricCanvasInteractivity(false);
            deselectFabricObjects();
            viewer.setMouseNavEnabled(true);
            // $('#viewerWrapper').css('cursor', 'crosshair');
            document.getElementById("viewerWrapper").style.cursor = "crosshair";
            break;
        case "addAnnotation":
            console.log("mousemode: addAnnotation");
            mouseMode = "addAnnotation";
            setFabricCanvasInteractivity(false);
            deselectFabricObjects();
            viewer.setMouseNavEnabled(false); //if we're in addAnnotation mode, don't set isDown to true -- actually, ONLY set to true if mode is addAnnotation
            break;
        case "editAnnotation":
            console.log("mousemode: editAnnotation");
            mouseMode = "editAnnotation";
            setFabricCanvasInteractivity(true);
            // $('#viewerWrapper').css('cursor', 'wait');
            document.getElementById("viewerWrapper").style.cursor = "pointer";
            viewer.setMouseNavEnabled(false);
            break;
        default:
            console.log(mode);
            throw "Tried to set invalid mouse mode";
    }
}

function getMouseMode() {
    return mouseMode;
}

function duplicateObject(object) {
    var objectCopy = {
        left: object["left"],
        top: object["top"],
        stroke: object["stroke"],
        strokeWidth: object["strokeWidth"],
        originX: object["originX"],
        originY: object["originY"], /*             */
        fill: object["fill"],
        angle: object["angle"],
        type: object["type"],
        points: object["points"], /* hacky fix */
        text: object["text"],
        rx: object["rx"],
        ry: object["ry"],
        height: object["height"],
        width: object["width"],
        pk: object["pk"],
        image: object["image"]
    };
    return objectCopy;
}

function objectListToJsonList(list) {
    var retval = [];
    list.foreach(function (object) {
        retval.push(duplicateObject(object));
    });
    return JSON.stringify(retval);
}

// //TODO: pretty sure I can delete this but keep around a bit longer
// function serializeToJSON() { //TODO: need to not save duplicate entries... maybe do that on the python side... just dont save if it has a pk? needs to coordinate from alterAnnotations()
//     throw new Error("serializeToJson is depreciated! Don't use this function");
//     return;
//
//     console.log("attempting to serialize");
//     $.ajax({
//         type: "POST",
//         url: '/xgds_image/saveAnnotations/', //TODO should be able to get this from url // maybe change the url/hard code it
//         datatype: 'json',
//         data: {
//             mapAnnotations: JSON.stringify(overlay.fabricCanvas()), //TODO: can't just JSON.stringify, need to add our own fields
//             // mapAnnotations: objectListToJsonList(overlay.fabricCanvas().getObjects()),
//             image_pk: 1 // on the single image page it's app.options.modelPK, on the multi image page we have to get it from the selected item
//         },
//         success: function(data) {
//              console.log("ajax return call json " + data);
//         },
//         error: function(a,b,c,d) {
//             console.log(a);
//         }
//     });
// }

//TODO: should probably change the name of this function
function deserializeFromJSON() {
    $.ajax({
        type: "POST",
        url: '/xgds_image/getAnnotations/1',
        datatype: 'json',
        success: function (data) {
            console.log(data);
            data.forEach(function (annotation) {
                //convert django pk/id to hex color
                console.log(annotation);
                // annotation["stroke"] = colorsDictionary[annotation["strokeColor"]].hex;
                addAnnotationToCanvas(annotation);
            });
        },
        error: function (a, b, c, d) {
            console.log(a);
        }
    });
}

function createNewSerialization(fabricObject, x, y) {
    if (fabricObject.type == "textboxPreview") {
        text = new fabric.Textbox('MyText', {
            width: x - origX,
            top: origY,
            left: origX,
            fontSize: 100,
            stroke: currentAnnotationColor,
            fill: currentAnnotationColor,
            borderColor: currentAnnotationColor,
            textAlign: 'center',
            type: 'text'
        });
        currentAnnotationType = text;
        overlay.fabricCanvas().add(text);
        textboxPreview.remove();
        fabricObject = text;
    }
    console.log(fabricObject);

    var temp = duplicateObject(fabricObject);
    if(fabricObject.type == "arrow") { //arrow only needs fill
        temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
        temp["stroke"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load

    }else if (fabricObject.type == "text") { //text needs both stroke and fill
         temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
         temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
    } else { //everything else only needs stroke
        temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
        temp["fill"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
    }

    console.log("add annotation dump");
    console.log(temp);

    $.ajax({
        type: "POST",
        url: '/xgds_image/addAnnotation/',
        datatype: 'json',
        data: {
            annotation: JSON.stringify(temp),
            image_pk: 1
        },
        success: function (data) {
            fabricObject.set({pk: data["pk"], image: data["image_pk"]});
        },
        error: function (e) {
            console.log("Ajax error");
            console.log(e);
        }
    });
}

function updateSerialization(fabricObject) {
    var temp = duplicateObject(fabricObject);

    if(fabricObject.type == "arrow") { //arrow only needs fill
        temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
        temp["stroke"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign stroke to a random color to keep database happy. We ignore this when we repaint arrow on load

    }else if (fabricObject.type == "text") { //text needs both stroke and fill
        temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
        temp["fill"] = getColorIdFromHex(fabricObject["fill"]);
    } else { //everything else only needs stroke
        temp["stroke"] = getColorIdFromHex(fabricObject["stroke"]);
        temp["fill"] = colorsDictionary[Object.keys(colorsDictionary)[0]].id;  //assign fill to a random color to keep database happy. We ignore this when we repaint any non-arrow on load
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
            image_pk: 1
        },
        success: function (data) {

        },
        error: function (a) {
            console.log("Ajax error");
            console.log(a)
        }
    });
}

function getAnnotationColors() {
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
                colorsDictionary[color["id"]] = {name: color["name"], hex: color["hex"], id: color["id"]};
            });
            currentAnnotationColor = colorsDictionary[Object.keys(colorsDictionary)[0]].hex;
        },
        error: function (a) {
            console.log("Ajax error");
            console.log(a)
        }
    });
}

/*
 Given a hex, returns the django id/pk
 MUST USE # IN FRONT
 */
function getColorIdFromHex(hexColor) {
    for (var key in colorsDictionary) {
        console.log("searching...");
        if (colorsDictionary[key].hex.toString().toLowerCase() == hexColor.toString().toLowerCase()) {
            console.log(hexColor.toString().toLowerCase() + " matches this key");
            console.log(colorsDictionary[key]);
            return colorsDictionary[key].id;
        }
    }
    throw new Error("getColorIdFromHex couldn't find a match for " + hexColor);
    return null;
}

/*
 Populate colorsDictionary through getAnnotationColors()
 Return array for spectrum color picker palette
 */
function getPaletteColors() {
    getAnnotationColors(); //now the dictionary should be full

    var retval = [];

    var row1 = [];
    var row2 = [];

    var theKeys = Object.keys(colorsDictionary);

    for (var i = 0; i < theKeys.length; i = i + 2) {
        // console.log("row : " + i + ': ' +  colorsDictionary[theKeys[i]].hex);
        row1.push(colorsDictionary[theKeys[i]].hex);
        if (i + 1 < theKeys.length) {
            row2.push(colorsDictionary[theKeys[i + 1]].hex);
        }
    }
    retval.push(row1);
    retval.push(row2);

    return retval;
}

function deleteActiveAnnotation() {
    var annotation = overlay.fabricCanvas().getActiveObject();
    if (annotation["pk"] in annotationsDict) {
        //TODO: remove from database
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
        delete annotationsDict[annotation["pk"]];
        overlay.fabricCanvas().getActiveObject().remove();
    } else {
        //annotation not saved in database anyways, just remove from canvas
        overlay.fabricCanvas.getActiveObject().remove();
    }
}

/*
 Given an annotation model, add it to the canvas
 */
function addAnnotationToCanvas(annotationJson) {
    if (annotationJson["pk"] in annotationsDict) {
        console.log("Annotation is already drawn on canvas, aborting load for this annotation");
        return;
    } else { //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
        annotationsDict[annotationJson["pk"]] = annotationJson;
    }
    if (annotationJson["annotationType"] == "Rectangle") {
        addRectToCanvas(annotationJson);
    } else if (annotationJson["annotationType"] == "Ellipse") {
        addEllipseToCanvas(annotationJson);
    } else if (annotationJson["annotationType"] == "Arrow") {
        addArrowToCanvas(annotationJson);
    } else if (annotationJson["annotationType"] == "Text") {
        addTextToCanvas(annotationJson);
    } else {
        throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
    }
}

function addRectToCanvas(annotationJson) {
    var rect = new fabric.Rect({
        left: annotationJson["left"],
        top: annotationJson["top"],
        stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
        strokeWidth: annotationJson["strokeWidth"],
        originX: annotationJson["originX"],
        originY: annotationJson["originY"],
        fill: "",  //don't support fill
        angle: annotationJson["angle"],
        width: annotationJson["width"],
        height: annotationJson["height"],
        type: 'rect',
        pk: annotationJson["pk"],
        image: annotationJson["image"]
    });
    overlay.fabricCanvas().add(rect);
    overlay.fabricCanvas().renderAll();
}

function addEllipseToCanvas(annotationJson) {
    ellipse = new fabric.Ellipse({
        left: annotationJson["left"],
        top: annotationJson["top"],
        stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
        strokeWidth: annotationJson["strokeWidth"],
        originX: annotationJson["originX"],
        originY: annotationJson["originY"],
        fill: "",  //don't support fill
        angle: annotationJson["angle"],
        rx: annotationJson["radiusX"],
        ry: annotationJson["radiusY"],
        type: 'ellipse',
        pk: annotationJson["pk"],
        image: annotationJson["image"]
    });
    overlay.fabricCanvas().add(ellipse);
    overlay.fabricCanvas().renderAll();
}

function addArrowToCanvas(annotationJson) {
    /* Arrows "stroke" is actually their fill. Their stroke/border is always black */
    arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
        left: annotationJson["left"],
        top: annotationJson["top"],
        stroke: 'black',
        // stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
        strokeWidth: annotationJson["strokeWidth"],
        originX: annotationJson["originX"],
        originY: annotationJson["originY"],
        fill: colorsDictionary[annotationJson["fill"]].hex,
        angle: annotationJson["angle"],
        type: 'arrow',
        pk: annotationJson["pk"],
        image: annotationJson["image"]
    });
    console.log("image and pk pls");
    overlay.fabricCanvas().add(arrow);
    overlay.fabricCanvas().renderAll();
}

function addTextToCanvas(annotationJson) {
    console.log("text annotation object");
    console.log(annotationJson);
    text = new fabric.Textbox("hello world", {
        left: annotationJson["left"],
        top: annotationJson["top"],
        stroke: colorsDictionary[annotationJson["strokeColor"]].hex,
        strokeWidth: annotationJson["strokeWidth"],
        originX: annotationJson["originX"],
        originY: annotationJson["originY"],
        fill: colorsDictionary[annotationJson["fill"]].hex,
        borderColor: colorsDictionary[annotationJson["fill"]].hex,
        angle: annotationJson["angle"],
        width: annotationJson["width"],
        height: annotationJson["height"],
        text: annotationJson["content"], //text should be the right field here //todonow: this may be the wrong thing to call it.
        type: 'text', //TODO todonow todowill what have we got here
        pk: annotationJson["pk"],
        image: annotationJson["image"],
        textAlign: 'center',
        fontSize: 100 //Font size is static for now
    });
    console.log("textbox width (this is causing the error: " + annotationJson["width"]);
    //yup, we got some redundant parametesr here son.
    //IT'S SETTING THE WIDTH FROM THE DATABASE THAT BREAKS THE TEXTBOXES
    //the width is undef. textbox no field width.

    overlay.fabricCanvas().add(text);
    overlay.fabricCanvas().renderAll();
}

//create a new circle and add it to canvas
//TODO: still need to add standardized attribute/json list
function addCircleToCanvas(x, y) {
    // var circle = new fabric.Circle({
    //     left: x,
    //     top: y,
    //     radius: 225,
    //     strokeWidth: 1,
    //     stroke: 'black',
    //     fill: 'white',
    //     selectable: true,
    //     originX: 'center', originY: 'center'
    // });
    // overlay.fabricCanvas().add(circle);
    // overlay.fabricCanvas().renderAll();
}

/*
edit/delete: mouse modes for manipulating annotations
pk: store pk's in a pk-json dictionary to prevent duplicate loads and to manipulate from annotations list
 */

/* TODO:

The four big things left I think are
1.) color picker (all the backend (i.e. dictionaries) is set up. Just need to connect to some kind of front end UI).
2.) Export canvas as an image
3.) turn annotations on/off


mouse modes
serialization
color pallete
xgds ref
*/

/*

CURRENT STATUS

Critical Features
preserve colors when loading -- (1.) update createNewSerialization 2.) update deserializeFromJson)
export image
image_pk/generalization stuff



Nice Stuff
Make textboxes nicer
Make cursor cooporate


tie menu to controls
can't click annotations -- seems like fabricCanvas sometimes goes behind the OSD canvas. Occlusion of sorts.
just a lot of cleaning up in general needed


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




















