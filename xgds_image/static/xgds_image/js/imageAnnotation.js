    var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
    var viewer = OpenSeadragon({
        id:            "openseadragon1",
        prefixUrl:     prefixUrl,
        showNavigator: true,
        gestureSettingsMouse:   {
            clickToZoom: false
        },
        clickToZoom: "false",
        tileSources:   [{
            Image:  {
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
    var arrow, arrowTemp, line, rectangle, circle, ellipse, text, isDown, origX, origY;

    /* the mouse can be in 3 modes:
        1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
        2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
        3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw on clicK)
        getters and setters are below
     */
    var mouseMode = "OSD";

    // addRectToCanvas(1000, 1000);

    //Euclidean distance between (x1,y1) and (x2,y2)
    function distanceFormula(x1, y1, x2, y2) {
        var xDist = Math.pow((x1-x2),2);
        var yDist = Math.pow((y1-y2),2);
        return Math.sqrt(xDist+yDist);
    }

    function initializeLine(x, y) {
        line = new fabric.Line([x, y, x, y], {
            left: x,
            top: y,
            stroke: "red",
            strokeWidth: 15,
            originX: 'center',
            originY: 'center'
        });
        overlay.fabricCanvas().add(line)
    }

    function updateLineEndpoint(x, y) {
        line.set({x2:x, y2:y});
    }

    function initializeEllipse(x, y) {
        ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center', originY: 'center'
        });
        overlay.fabricCanvas().add(ellipse);
    }

    function updateEllipse(x, y) {
        var distance = distanceFormula(x,y,origX,origY);

        ellipse.set({rx: Math.abs(origX-x), ry:Math.abs(origY-y)});
    }


    //TODO: Create overloaded initializeCircle function
    function initializeCircle(x, y) {
        circle = new fabric.Circle({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center',
            originY: 'center'
        });
        overlay.fabricCanvas().add(circle);
    }

    //TODO: should I update the circle member variable automatically or pass in the object to modify?
    function updateCircleRadius(x, y, origX, origY) {
        var radius = distanceFormula(x, y, origX, origY);
        circle.set({radius: radius});
    }

    function initializeRectangle(x, y) {
        rectangle = new fabric.Rect({
            left: x,
            top: y,
            fill: 'blue',
            width: 1,
            height: 1
        });
        overlay.fabricCanvas().add(rectangle);
    }

    function updateRectangleWidth(x, y, origX, origY) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        rectangle.set({width: width, height: height});
    }

    function initializeText(x, y) {
        text = new fabric.Text("hello world", {
            left: x,
            top: y
        });
        overlay.fabricCanvas().add(text);
    }

    function updateTextContent(x, y) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        text.set({width: width, height: height})
    }

    /*
    Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
    computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
    really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
    */

    function drawArrow(x, y) { //TODO: order of points fed to calculateArrowPoints probably matters
        var headlen = 100;  // arrow head size
        arrow = new fabric.Polyline(calculateArrowPoints(origX,origY,x,y,headlen), {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        overlay.fabricCanvas().add(arrow);
    }

    function updateArrow(x, y) {
        overlay.fabricCanvas().remove(arrow)
        //TODO: dont forget to remove from canvas
        var angle = Math.atan2(y - origY, x - origX);
        var headlen = 100;  // arrow head size TODO: this should not be manually put here
        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);
        // calculate the points.

        var pointsArray = calculateArrowPoints(x, y, headlen);
        arrow = new fabric.Polyline(pointsArray, {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }

    //TODO: Refactor this to camelcaps
    //TODO: TODO: this should not be manually put here
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
		},{
			x: x - (headlen / 4) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen / 4) * Math.sin(angle - Math.PI / 2)
		}, {
			x: x - (headlen) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen) * Math.sin(angle - Math.PI / 2)
		},{
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
		},{
			x: origX,
			y: origY
		}
	];
        return points;
    }

    //TODO: only save from save button, not on unclick
    //fabricJS mouse-down event listener
    overlay.fabricCanvas().observe('mouse:down', function(o){
         console.log("EVENT TRIGERRED: fabricjs-mouse:down");
         console.log("mouse mode is " + getMouseMode());
         if(getMouseMode()=="addAnnotation") {
             isDown = true;
             var pointer = overlay.fabricCanvas().getPointer(o.e);
             origX = pointer.x;
             origY = pointer.y;
             // initializeCircle(pointer.x, pointer.y);
             // initializeRectangle(pointer.x, pointer.y);
             // initializeLine(pointer.x, pointer.y);
             // initializeEllipse(pointer.x, pointer.y);
             // initializeText(pointer.x, pointer.y);
             // initializeArrow(pointer.x, pointer.y);
             drawArrow(pointer.x, pointer.y);
         }
    });

    //fabricJS mouse-move event listener
    overlay.fabricCanvas().observe('mouse:move', function(o){
         if (!isDown) return;
         var pointer = overlay.fabricCanvas().getPointer(o.e);
         // updateCircleRadius(pointer.x, pointer.y, origX, origY); //do I need to pass this or can I access it as a member? in general, need to clarify b/w member obj.
         // updateRectangleWidth(pointer.x, pointer.y, origX, origY);
         // updateLineEndpoint(pointer.x, pointer.y);
         // updateEllipse(pointer.x, pointer.y);
         // updateTextContent(pointer.x, pointer.y);
         updateArrow(pointer.x, pointer.y);
         overlay.fabricCanvas().renderAll();
    });

    //fabricJS mouse-up event listener
    overlay.fabricCanvas().on('mouse:up', function(o){
        console.log("EVENT TRIGERRED: fabricj-mouse:up");
        if(getMouseMode()=="addAnnotation") {
            setMouseMode("OSD");
        }
        isDown = false;
    });

    //OSD event listener. Currently not really used.
    viewer.addHandler('canvas-click', function(event) {
        var pointer = overlay.fabricCanvas().getPointer(event.e);
        console.log("EVENT TRIGERRED: OSD-canvas-click")
    });

    //Toggle map scrolling button.
    $("#toggleMapScrolling").click(function() {
        console.log("toggle dat map scrolling boi");
        viewer.setMouseNavEnabled(false);
        setMouseMode("addAnnotation");
    })

    $("input[name='cursorMode']").change(function() {
        console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
        var mode1 = $("input[name='cursorMode']").val();
        mode1="addAnnotation";
        setMouseMode(mode1);
    });

    $("input[name='annotationShape']").change(function(){
        console.log("annotationShape change detected: " + $("input[name='annotationShape']:checked").val());

    });

    $("#addAnnotation").click(function() {
        setMouseMode("addAnnotation");
    });

    $('#loadAnnotation').click(function() {
       deserializeFromJSON();
    });

    $('#saveAnnotation').click(function() {
       serializeToJSON();
    });



    function setMouseMode(mode) {
        switch(mode) {
            case "OSD":
                console.log("mousemode: OSD");
            mouseMode="OSD";
                viewer.setMouseNavEnabled(true);
                break;
            case "addAnnotation":
                console.log("mousemode: addAnnotation");
                mouseMode="addAnnotation";
                viewer.setMouseNavEnabled(false); //if we're in addAnnotation mode, don't set isDown to true -- actually, ONLY set to true if mode is addAnnotation
                break;
            case "editAnnotation":
                console.log("mousemode: editAnnotation");
                mouseMode="editAnnotation";
                break;
            default:
                console.log(mode);
                throw "Tried to set invalid mouse mode";
        }
    }

    function getMouseMode(){
        return mouseMode;
    }

    function serializeToJSON() {
        console.log("attempting to serialize");
        $.ajax({
            type: "POST",
            url: '/xgds_image/saveAnnotations/', //TODO should be able to get this from url // maybe change the url/hard code it
            datatype: 'json',
            data: {
                mapAnnotations: JSON.stringify(overlay.fabricCanvas()),
                image_pk: 1 // on the single image page it's app.options.modelPK, on the multi image page we have to get it from the selected item
            },
            success: function(data) {
                 console.log("ajax return call json " + data);
            },
            error: function(a,b,c,d) {
                console.log(a);
            }
        });
    }

    //TODO: should probably change the name of this function
    function deserializeFromJSON() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotations/1',
            datatype: 'json',
            success: function(data) {
                console.log(data);
                data.forEach(function(annotation) { //TODO: change name of the parameter
                    addAnnotationToCanvas(annotation);
                });
            },
            error: function(a,b,c,d) {
                console.log(a);
            }
        });
    }

    /*
        Given an annotation model, add it to the canvas
        //TODO: fill out methods called below and add correct arguments
     */
    function addAnnotationToCanvas(annotationJson) {
        if (annotationJson["annotationType"]=="Rectangle") {
            addRectToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Ellipse") {
            addEllipseToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Arrow") {
            addArrowToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Text") {
            addTextToCanvas(annotationJson);
        }else{
            throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
        }
    }

    function addRectToCanvas(annotationJson) {
        console.log("Attempting to draw saved rectangle to canvas");
        var rect = new fabric.Rect({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: "blue", //TODO: color dictionary reference isn't working, had to hard code it.
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"]
        });
        overlay.fabricCanvas().add(rect);
        overlay.fabricCanvas().renderAll();
    }

    function addEllipseToCanvas(annotationJson) {
        console.log("Attempting to draw saved ellipse to canvas");
        ellipse = new fabric.Ellipse({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"],
            rx: annotationJson["radiusX"],
            ry: annotationJson["radiusY"]
        });
        console.log("what does this pointer look like: " + annotationJson["fill"]);
        overlay.fabricCanvas().add(ellipse);
        overlay.fabricCanvas().renderAll();
    }

    function addArrowToCanvas(annotationJson) {
        arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"]
        });
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }

    function addTextToCanvas(annotationJson) {
        console.log("Attempting to draw saved text to canvas");
        text = new fabric.Text("hello world", {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"], //TODO: this is a pointer, need to access database to pull this color out
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            text: annotationJson["content"] //text should be the right field here
        });
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
TODO: edit, delete, pk
edit/delete: mouse modes for manipulating annotations
pk: store pk's in a pk-json dictionary to prevent duplicate loads and to manipulate from annotations list
 */

/* TODO:
mouse modes
serialization
color pallete
xgds ref
*/

/*

TODO: add mouse modes
TODO: add color picker

left, top, strokewidth, strokecolor, originX, originY, fill, angle <---- SHOULD ADD SELECTABLE

line: default
ellipse: rx, ry instead of radius
circle: radius
rect: width, height
text: width, height, content
arrow: points, type?

 */




















